// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import { assertMethod, withEditor } from "utils/editor/guard";
import { readLocalIcon } from "utils/editor/icons";

const TYPES = { svg: "image/svg+xml", png: "image/png", webp: "image/webp", gif: "image/gif", ico: "image/x-icon" };

async function handler(req, res) {
  assertMethod(req, "GET");
  const { name } = req.query;
  const buf = readLocalIcon(name);
  const ext = name.split(".").pop().toLowerCase();
  res.setHeader("Content-Type", TYPES[ext] ?? "image/jpeg");
  // User-supplied SVG must never run scripts when opened directly.
  res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).send(buf);
}

export default withEditor(handler);
