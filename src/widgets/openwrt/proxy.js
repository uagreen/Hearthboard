import { computeRate, updateStatus, wantsField } from "./openwrt-utils";

import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";
import { formatApiCall } from "utils/proxy/api-helpers";
import { sendJsonRpcRequest } from "utils/proxy/handlers/jsonrpc";
import { httpProxy } from "utils/proxy/http";
import widgets from "widgets/widgets";

const PROXY_NAME = "OpenWRTProxyHandler";
const logger = createLogger(PROXY_NAME);
const LOGIN_PARAMS = ["00000000000000000000000000000000", "session", "login"];
const RPC_METHOD = "call";

const DEFAULT_TOKEN = "00000000000000000000000000000000";
const VERSIONS_URL = "https://downloads.openwrt.org/.versions.json";
const VERSIONS_TTL = 12 * 60 * 60 * 1000;
const VERSIONS_FAILURE_TTL = 15 * 60 * 1000;

// session tokens and rate samples are kept per router, so several routers on one dashboard do not clash
const tokens = new Map();
const samples = new Map();
let versionsCache = null;

export function resetOpenwrtCaches() {
  tokens.clear();
  samples.clear();
  versionsCache = null;
}

const PARAMS = {
  system: ["system", "info", {}],
  board: ["system", "board", {}],
  device: ["network.device", "status", {}],
  leases: ["luci-rpc", "getDHCPLeases", {}],
};

const tokenFor = (widget) => tokens.get(widget.url) ?? DEFAULT_TOKEN;

async function getWidget(req) {
  const { group, service, index } = req.query;

  if (!group || !service) {
    logger.debug("Invalid or missing service '%s' or group '%s'", service, group);
    return null;
  }

  const widget = await getServiceWidget(group, service, index);

  if (!widget) {
    logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
    return null;
  }

  return widget;
}

function isUnauthorized(data) {
  const json = JSON.parse(data.toString());
  return json?.error?.code === -32002;
}

async function login(url, widget) {
  const { username, password } = widget;
  const response = await sendJsonRpcRequest(url, RPC_METHOD, [...LOGIN_PARAMS, { username, password }]);

  if (response[0] === 200) {
    const responseData = JSON.parse(response[2]);
    tokens.set(widget.url, responseData[1].ubus_rpc_session);
  }

  return response;
}

async function fetchInterface(url, widget) {
  const { interfaceName } = widget;
  const [, contentType, data] = await sendJsonRpcRequest(url, RPC_METHOD, [tokenFor(widget), ...PARAMS.device]);
  if (isUnauthorized(data)) {
    return [401, contentType, data];
  }
  const response = JSON.parse(data.toString())[1];
  const networkInterface = response[interfaceName];
  if (!networkInterface) {
    return [404, contentType, { error: "Interface not found" }];
  }

  const bytesRx = networkInterface.statistics.rx_bytes;
  const bytesTx = networkInterface.statistics.tx_bytes;

  const now = Date.now();
  const key = `${widget.url}|${interfaceName}`;
  const prev = samples.get(key);
  samples.set(key, { rx: bytesRx, tx: bytesTx, at: now });

  const interfaceInfo = {
    up: networkInterface.up,
    bytesRx,
    bytesTx,
    rxRate: computeRate(prev && { bytes: prev.rx, at: prev.at }, bytesRx, now),
    txRate: computeRate(prev && { bytes: prev.tx, at: prev.at }, bytesTx, now),
  };
  return [200, contentType, interfaceInfo];
}

async function ubusResult(url, widget, params) {
  try {
    const [, , data] = await sendJsonRpcRequest(url, RPC_METHOD, [tokenFor(widget), ...params]);
    const json = JSON.parse(data.toString());
    return Array.isArray(json) && json[0] === 0 ? json[1] : null;
  } catch (e) {
    logger.debug("ubus call %s failed: %s", params.slice(0, 2).join("."), e?.message);
    return null;
  }
}

async function fetchClients(url, widget) {
  const leases = await ubusResult(url, widget, PARAMS.leases);
  return Array.isArray(leases?.dhcp_leases) ? leases.dhcp_leases.length : null;
}

async function getVersions() {
  if (versionsCache && Date.now() < versionsCache.expires) return versionsCache.data;

  let data = null;
  try {
    const [status, , body] = await httpProxy(new URL(VERSIONS_URL), { method: "GET" });
    if (status === 200) data = JSON.parse(body.toString());
  } catch (e) {
    logger.debug("Could not fetch the OpenWrt version list: %s", e?.message);
  }
  versionsCache = { data, expires: Date.now() + (data ? VERSIONS_TTL : VERSIONS_FAILURE_TTL) };
  return data;
}

async function fetchUpdate(url, widget) {
  const board = await ubusResult(url, widget, PARAMS.board);
  const versions = board?.release?.version ? await getVersions() : null;
  return updateStatus(board?.release?.version, versions);
}

async function fetchSystem(url, widget) {
  const [, contentType, data] = await sendJsonRpcRequest(url, RPC_METHOD, [tokenFor(widget), ...PARAMS.system]);
  if (isUnauthorized(data)) {
    return [401, contentType, data];
  }
  const systemResponse = JSON.parse(data.toString())[1];
  const response = {
    uptime: systemResponse.uptime,
    cpuLoad: (systemResponse.load[1] / 65536.0).toFixed(2),
  };
  if (wantsField(widget, "clients")) response.clients = await fetchClients(url, widget);
  if (wantsField(widget, "update") && widget.checkUpdates !== false && widget.checkUpdates !== "false") {
    response.update = await fetchUpdate(url, widget);
  }
  return [200, contentType, response];
}

async function fetchData(url, widget) {
  let response;
  if (widget.interfaceName) {
    response = await fetchInterface(url, widget);
  } else {
    response = await fetchSystem(url, widget);
  }
  return response;
}

export default async function proxyHandler(req, res) {
  const { group, service } = req.query;

  if (!group || !service) {
    logger.debug("Invalid or missing service '%s' or group '%s'", service, group);
    return res.status(400).json({ error: "Invalid proxy service type" });
  }

  const widget = await getWidget(req);

  if (!widget) {
    logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
    return res.status(400).json({ error: "Invalid proxy service type" });
  }

  const api = widgets?.[widget.type]?.api;
  const url = new URL(formatApiCall(api, { ...widget }));

  let [status, , data] = await fetchData(url, widget);

  if (status === 401) {
    const [loginStatus, , loginData] = await login(url, widget);
    if (loginStatus !== 200) {
      return res.status(loginStatus).end(loginData);
    }
    [status, , data] = await fetchData(url, widget);

    if (status === 401) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  return res.status(200).end(JSON.stringify(data));
}
