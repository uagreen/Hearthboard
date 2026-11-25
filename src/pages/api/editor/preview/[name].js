// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import { renderEdit } from "utils/editor/files";
import { assertMethod, withEditor } from "utils/editor/guard";

async function handler(req, res) {
  assertMethod(req, "POST");
  const { text, errors, diff, contentDiff, changed } = renderEdit(req.query.name, req.body);
  return res.status(200).json({ text, errors, diff, contentDiff, changed });
}

export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

export default withEditor(handler);
