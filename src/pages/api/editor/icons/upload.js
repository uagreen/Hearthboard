// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import { EditorError } from "utils/editor/files";
import { assertMethod, withEditor } from "utils/editor/guard";
import { MAX_ICON_BYTES, storeIcon } from "utils/editor/icons";

async function handler(req, res) {
  assertMethod(req, "POST");
  if (Number(req.headers["content-length"]) > MAX_ICON_BYTES) throw new EditorError(400, "Image is over 15 MB");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_ICON_BYTES) throw new EditorError(400, "Image is over 15 MB");
    chunks.push(chunk);
  }
  const file = storeIcon(String(req.query.name ?? "icon"), Buffer.concat(chunks), req.headers["content-type"]);
  return res.status(200).json({ file, ref: `/icons/${file}` });
}

export const config = { api: { bodyParser: false } };

export default withEditor(handler);
