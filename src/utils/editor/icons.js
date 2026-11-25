// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import dns from "node:dns/promises";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

import { EditorError } from "./files";

import { CONF_DIR } from "utils/config/config";

const iconDir = () => path.join(CONF_DIR, "icons");

export const MAX_ICON_BYTES = 15e6;
const IMAGE_TYPES = {
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};
export const ICON_FILE_RE = /^[\w][\w.-]*\.(png|svg|webp|jpe?g|gif|ico)$/i;

export const safeIconName = (n) =>
  String(n)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-.]+/, "");

export function localIcons() {
  return fs.existsSync(iconDir())
    ? fs
        .readdirSync(iconDir())
        .filter((f) => ICON_FILE_RE.test(f))
        .sort()
    : [];
}

export function storeIcon(name, buf, type) {
  const ext = IMAGE_TYPES[type?.split(";")[0].trim()];
  if (!ext) throw new EditorError(400, `Not an image (${type || "unknown type"})`);
  if (buf.length > MAX_ICON_BYTES) throw new EditorError(400, "Image is over 15 MB");
  const base = safeIconName(String(name).replace(/\.[a-z0-9]+$/i, "")) || "icon";
  fs.mkdirSync(iconDir(), { recursive: true });
  const file = `${base}.${ext}`;
  fs.writeFileSync(path.join(iconDir(), file), buf);
  return file;
}

export function readLocalIcon(name) {
  if (!ICON_FILE_RE.test(name)) throw new EditorError(400, "Not an icon file");
  const p = path.join(iconDir(), name);
  if (!fs.existsSync(p)) throw new EditorError(404, "No such icon");
  return fs.readFileSync(p);
}

// ---- Outgoing requests to user-supplied URLs ---------------------------------------------------

// Loopback, unspecified and link-local (cloud metadata) addresses; LAN ranges stay allowed.
function blockedIPv4(ip) {
  const [a, b] = ip.split(".").map(Number);
  return a === 127 || a === 0 || (a === 169 && b === 254);
}

function blockedAddress(ip) {
  if (net.isIPv4(ip)) return blockedIPv4(ip);
  const v6 = ip.toLowerCase();
  if (v6 === "::1" || v6 === "::" || /^fe[89ab]/.test(v6)) return true;
  // IPv4-mapped, in dotted (::ffff:127.0.0.1) or normalized hex (::ffff:7f00:1) form.
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (dotted) return blockedIPv4(dotted[1]);
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v6);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return blockedIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return false;
}

// Accepts only http(s) URLs whose host does not resolve to a loopback/link-local address.
// (A DNS answer can still change between this check and the request; this is a guard against
// pointing the editor at its own host or the cloud metadata service, not a full SSRF sandbox.)
export async function assertFetchableUrl(raw) {
  let url;
  try {
    url = new URL(String(raw ?? ""));
  } catch {
    throw new EditorError(400, "Need an http(s) URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new EditorError(400, "Need an http(s) URL");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses;
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await dns.lookup(host, { all: true })).map((a) => a.address);
    } catch {
      throw new EditorError(400, `Could not resolve ${host}`);
    }
  }
  if (addresses.some(blockedAddress)) throw new EditorError(400, "That address is not allowed");
  return url;
}

// Download a remote image; every redirect hop is checked again.
export async function fetchRemoteImage(raw) {
  let url = await assertFetchableUrl(raw);
  for (let hop = 0; hop < 5; hop++) {
    const r = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux) Firefox/157.0", Referer: `${url.origin}/` },
    });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      url = await assertFetchableUrl(new URL(r.headers.get("location"), url).href);
      continue;
    }
    if (!r.ok) throw new EditorError(400, `Download failed: HTTP ${r.status}`);
    if (Number(r.headers.get("content-length")) > MAX_ICON_BYTES) throw new EditorError(400, "Image is over 15 MB");
    return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type"), url };
  }
  throw new EditorError(400, "Too many redirects");
}

// ---- Icon index from the public icon sets (cached for a day) -----------------------------------
const CDN = {
  dashboard: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/tree.json",
  selfhst: "https://cdn.jsdelivr.net/gh/selfhst/icons@main/index.json",
};
let iconIndex = { at: 0, data: null };

async function fetchJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

export async function getIconIndex() {
  if (!iconIndex.data || Date.now() - iconIndex.at > 24 * 3600e3) {
    const [dash, sh] = await Promise.allSettled([fetchJson(CDN.dashboard), fetchJson(CDN.selfhst)]);
    const strip = (list) => [...new Set((list ?? []).map((f) => f.replace(/\.(png|svg|webp)$/, "")))];
    iconIndex = {
      at: Date.now(),
      data: {
        // Dashboard Icons: "name" (png by default) or "name.svg"/"name.webp".
        dashboard:
          dash.status === "fulfilled"
            ? { png: strip(dash.value.png), svg: strip(dash.value.svg) }
            : { png: [], svg: [] },
        // selfh.st: "sh-name" (png) or "sh-name.svg".
        selfhst:
          sh.status === "fulfilled"
            ? sh.value.map((i) => ({ ref: i.Reference, name: i.Name, svg: i.SVG === "Yes" }))
            : [],
        errors: [dash, sh].filter((r) => r.status === "rejected").map((r) => r.reason.message),
      },
    };
  }
  return { ...iconIndex.data, local: localIcons() };
}
