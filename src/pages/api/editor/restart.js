// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import { EditorError } from "utils/editor/files";
import { assertMethod, withEditor } from "utils/editor/guard";

// New icons/background images are only served after Homepage restarts (Next.js static files).
// Needs a restart-only Docker API proxy (docker-socket-proxy with POST + ALLOW_RESTARTS).
async function handler(req, res) {
  assertMethod(req, "POST");
  const proxy = (process.env.DOCKER_PROXY ?? "").replace(/\/$/, "");
  if (!proxy) throw new EditorError(404, "Restarting is not set up (no DOCKER_PROXY)");
  const container = process.env.HOMEPAGE_CONTAINER || "homepage";
  const r = await fetch(`${proxy}/containers/${encodeURIComponent(container)}/restart?t=5`, {
    method: "POST",
    signal: AbortSignal.timeout(60000),
  });
  if (r.status !== 204) throw new EditorError(502, `Docker said HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return res.status(200).json({ restarted: true });
}

export default withEditor(handler);
