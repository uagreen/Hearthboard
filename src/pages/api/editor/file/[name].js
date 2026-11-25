// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import { parseYaml, readFile } from "utils/editor/files";
import { assertMethod, withEditor } from "utils/editor/guard";

async function handler(req, res) {
  assertMethod(req, "GET");
  const f = readFile(req.query.name);
  const parsed = /\.ya?ml$/.test(f.name) ? parseYaml(f.text) : { errors: [], data: null };
  return res.status(200).json({ ...f, data: parsed.data, errors: parsed.errors });
}

export default withEditor(handler);
