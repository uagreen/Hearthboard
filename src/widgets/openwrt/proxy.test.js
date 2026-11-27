import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { sendJsonRpcRequest, httpProxy, getServiceWidget, logger } = vi.hoisted(() => ({
  sendJsonRpcRequest: vi.fn(),
  httpProxy: vi.fn(),
  getServiceWidget: vi.fn(),
  logger: { debug: vi.fn() },
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));
vi.mock("utils/config/service-helpers", () => ({
  default: getServiceWidget,
}));
vi.mock("utils/proxy/handlers/jsonrpc", () => ({
  sendJsonRpcRequest,
}));
vi.mock("utils/proxy/http", () => ({
  httpProxy,
}));
vi.mock("widgets/widgets", () => ({
  default: {
    openwrt: {
      api: "{url}",
    },
  },
}));

import openwrtProxyHandler, { resetOpenwrtCaches } from "./proxy";

describe("widgets/openwrt/proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendJsonRpcRequest.mockReset();
    httpProxy.mockReset();
    resetOpenwrtCaches();
  });

  it("logs in and retries after an unauthorized response", async () => {
    getServiceWidget.mockResolvedValue({ type: "openwrt", url: "http://openwrt", username: "u", password: "p" });

    sendJsonRpcRequest
      // initial call -> unauthorized
      .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ error: { code: -32002 } }))])
      // login -> sets ubus token
      .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify([0, { ubus_rpc_session: "sess" }]))])
      // retry system info -> ok
      .mockResolvedValueOnce([
        200,
        "application/json",
        Buffer.from(JSON.stringify([0, { uptime: 1, load: [0, 131072, 0] }])),
      ]);

    const req = { query: { group: "g", service: "svc", index: "0" } };
    const res = createMockRes();

    await openwrtProxyHandler(req, res);

    expect(sendJsonRpcRequest).toHaveBeenCalledTimes(3);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).cpuLoad).toBe("2.00");
  });

  describe("new fields", () => {
    const VERSIONS = {
      stable_version: "25.12.6",
      versions_list: ["25.12.6", "24.10.8", "24.10.7"],
    };
    const ok = (body) => [200, "application/json", Buffer.from(JSON.stringify(body))];

    // answers ubus calls by "object.method"; unknown calls are denied like a missing ACL entry
    const mockUbus = (answers) => {
      sendJsonRpcRequest.mockImplementation(async (url, method, params) => {
        const key = `${params[1]}.${params[2]}`;
        return ok(answers[key] ?? [6]);
      });
    };
    const run = async (widget) => {
      getServiceWidget.mockResolvedValue({ type: "openwrt", url: "http://openwrt", ...widget });
      const res = createMockRes();
      await openwrtProxyHandler({ query: { group: "g", service: "svc", index: "0" } }, res);
      return JSON.parse(res.body);
    };
    const SYSTEM = { "system.info": [0, { uptime: 1, load: [0, 65536, 0] }] };

    it("returns null rates on the first poll and numbers on the second", async () => {
      const now = vi.spyOn(Date, "now");
      mockUbus({ "network.device.status": [0, { eth1: { up: true, statistics: { rx_bytes: 1000, tx_bytes: 100 } } }] });
      now.mockReturnValue(1000);
      const first = await run({ interfaceName: "eth1" });
      expect(first.rxRate).toBeNull();
      expect(first.txRate).toBeNull();

      mockUbus({ "network.device.status": [0, { eth1: { up: true, statistics: { rx_bytes: 5000, tx_bytes: 300 } } }] });
      now.mockReturnValue(3000);
      const second = await run({ interfaceName: "eth1" });
      expect(second.rxRate).toBe(2000);
      expect(second.txRate).toBe(100);
      now.mockRestore();
    });

    it("returns a null rate after a counter reset", async () => {
      const now = vi.spyOn(Date, "now");
      mockUbus({ "network.device.status": [0, { eth1: { up: true, statistics: { rx_bytes: 9000, tx_bytes: 900 } } }] });
      now.mockReturnValue(1000);
      await run({ interfaceName: "eth1" });
      mockUbus({ "network.device.status": [0, { eth1: { up: true, statistics: { rx_bytes: 10, tx_bytes: 5 } } }] });
      now.mockReturnValue(2000);
      const data = await run({ interfaceName: "eth1" });
      expect(data.rxRate).toBeNull();
      expect(data.txRate).toBeNull();
      now.mockRestore();
    });

    it("counts dhcp leases when fields include clients", async () => {
      mockUbus({ ...SYSTEM, "luci-rpc.getDHCPLeases": [0, { dhcp_leases: [{}, {}, {}], dhcp6_leases: [{}] }] });
      const data = await run({ fields: ["uptime", "clients"] });
      expect(data.clients).toBe(3);
    });

    it("returns null clients when luci-rpc is denied", async () => {
      mockUbus(SYSTEM);
      const data = await run({ fields: ["clients"] });
      expect(data.clients).toBeNull();
      expect(data.uptime).toBe(1);
    });

    it("does not call luci-rpc, system board or the internet without the fields", async () => {
      mockUbus(SYSTEM);
      await run({});
      const calls = sendJsonRpcRequest.mock.calls.map((c) => `${c[2][1]}.${c[2][2]}`);
      expect(calls).toEqual(["system.info"]);
      expect(httpProxy).not.toHaveBeenCalled();
    });

    it("reports a patch update for an older version in the same series", async () => {
      mockUbus({ ...SYSTEM, "system.board": [0, { release: { version: "24.10.7" } }] });
      httpProxy.mockResolvedValue([200, "application/json", Buffer.from(JSON.stringify(VERSIONS))]);
      const data = await run({ fields: ["update"] });
      expect(data.update).toEqual({ state: "patch", latest: "24.10.8" });
      expect(httpProxy.mock.calls[0][0].toString()).toBe("https://downloads.openwrt.org/.versions.json");
    });

    it("caches the version list between polls", async () => {
      mockUbus({ ...SYSTEM, "system.board": [0, { release: { version: "24.10.7" } }] });
      httpProxy.mockResolvedValue([200, "application/json", Buffer.from(JSON.stringify(VERSIONS))]);
      await run({ fields: ["update"] });
      await run({ fields: ["update"] });
      expect(httpProxy).toHaveBeenCalledTimes(1);
    });

    it("reports unknown when the version list cannot be fetched", async () => {
      mockUbus({ ...SYSTEM, "system.board": [0, { release: { version: "24.10.7" } }] });
      httpProxy.mockRejectedValue(new Error("offline"));
      const data = await run({ fields: ["update"] });
      expect(data.update).toEqual({ state: "unknown" });
    });

    it("skips the internet request when checkUpdates is false", async () => {
      mockUbus({ ...SYSTEM, "system.board": [0, { release: { version: "24.10.7" } }] });
      const data = await run({ fields: ["update"], checkUpdates: false });
      expect(httpProxy).not.toHaveBeenCalled();
      expect(data.update).toBeUndefined();
    });

    it("keeps one session token per router", async () => {
      const seen = {};
      sendJsonRpcRequest.mockImplementation(async (url, method, params) => {
        const [token, obj, fn] = params;
        const host = url.toString();
        if (obj === "session") return ok([0, { ubus_rpc_session: `tok-${host}` }]);
        (seen[host] ??= []).push(token);
        if (token !== `tok-${host}`) return ok({ error: { code: -32002 } });
        return ok(SYSTEM[`${obj}.${fn}`]);
      });
      for (const url of ["http://a.lan", "http://b.lan", "http://a.lan"]) {
        getServiceWidget.mockResolvedValue({ type: "openwrt", url, username: "u", password: "p" });
        const res = createMockRes();
        await openwrtProxyHandler({ query: { group: "g", service: "svc", index: "0" } }, res);
        expect(res.statusCode).toBe(200);
      }
      // the second visit to router a reuses its own token and does not need a new login
      expect(seen["http://a.lan/"].at(-1)).toBe("tok-http://a.lan/");
      expect(seen["http://a.lan/"]).toHaveLength(3);
    });
  });
});
