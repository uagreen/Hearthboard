// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import crypto from "node:crypto";

import { EditorError } from "./files";

import { withAllowedHost, withAuth } from "utils/auth";
import { isAuthEnabled } from "utils/env";
import createLogger from "utils/logger";

const logger = createLogger("editor");

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest();

// Basic auth with any username; the password is compared in constant time.
function passwordOk(req, password) {
  const m = /^Basic (.+)$/.exec(req.headers?.authorization ?? "");
  if (!m) return false;
  const given = Buffer.from(m[1], "base64")
    .toString()
    .replace(/^[^:]*:/, "");
  return crypto.timingSafeEqual(sha256(given), sha256(password));
}

// Throws a 405 unless the request uses one of the given methods.
export function assertMethod(req, ...methods) {
  if (!methods.includes(req.method)) throw new EditorError(405, `Method ${req.method} not allowed`);
}

function catchErrors(handler) {
  return async function editorHandler(req, res) {
    try {
      return await handler(req, res);
    } catch (e) {
      if (e instanceof EditorError) return res.status(e.status).json({ error: e.message });
      logger.error(e);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };
}

// The editor can rewrite the dashboard, so it is off by default and never open without a login:
// 1. Host validation first, like every Homepage API route.
// 2. With Homepage authentication enabled, that login is required (401), then HOMEPAGE_EDITOR must be "true".
// 3. Otherwise HOMEPAGE_EDITOR must be "true", else every route is a 404.
// 4. Then EDITOR_PASSWORD (Basic auth) is required, unless EDITOR_ALLOW_NO_AUTH=true.
export function withEditor(handler) {
  const safe = catchErrors(handler);
  const enabledOnly = (req, res) =>
    process.env.HOMEPAGE_EDITOR === "true" ? safe(req, res) : res.status(404).json({ error: "Not found" });
  const authed = withAuth(enabledOnly);

  return withAllowedHost(async function guardedHandler(req, res) {
    if (isAuthEnabled()) return authed(req, res);
    if (process.env.HOMEPAGE_EDITOR !== "true") return res.status(404).json({ error: "Not found" });
    const password = process.env.EDITOR_PASSWORD;
    if (password) {
      if (passwordOk(req, password)) return safe(req, res);
      res.setHeader("WWW-Authenticate", 'Basic realm="Homepage Editor"');
      return res.status(401).json({ error: "Password required" });
    }
    if (process.env.EDITOR_ALLOW_NO_AUTH === "true") return safe(req, res);
    return res.status(403).json({
      error:
        "The editor needs protection: enable Homepage authentication (HOMEPAGE_AUTH_ENABLED), " +
        "set EDITOR_PASSWORD, or set EDITOR_ALLOW_NO_AUTH=true on a trusted network.",
    });
  });
}
