// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import { assertMethod, withEditor } from "utils/editor/guard";

const MAX_URLS = 200;

async function check(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const r = await fetch(url, { method, redirect: "manual", signal: AbortSignal.timeout(6000) });
      if (method === "HEAD" && (r.status === 405 || r.status === 501)) continue;
      return { url, status: r.status, ok: r.status < 400 || r.status === 401 || r.status === 403 };
    } catch (e) {
      const code = e.cause?.code ?? e.message;
      // Self-signed HTTPS (Proxmox, NAS UIs...) means the server answered, which is all we check.
      if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code))
        return { url, status: 0, ok: true, note: "self-signed certificate" };
      if (method === "GET") return { url, status: 0, ok: false, error: code };
    }
  }
  return { url, status: 0, ok: false, error: "no response" };
}

// Private LAN addresses are allowed on purpose: the point is to check LAN services.
async function handler(req, res) {
  assertMethod(req, "POST");
  const urls = [
    ...new Set((req.body?.urls ?? []).filter((u) => typeof u === "string" && /^https?:\/\//.test(u))),
  ].slice(0, MAX_URLS);
  const results = [];
  for (let i = 0; i < urls.length; i += 16) {
    results.push(...(await Promise.all(urls.slice(i, i + 16).map(check))));
  }
  return res.status(200).json(results);
}

export default withEditor(handler);
