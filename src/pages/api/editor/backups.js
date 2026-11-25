// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import { listBackups } from "utils/editor/backups";
import { assertMethod, withEditor } from "utils/editor/guard";

async function handler(req, res) {
  assertMethod(req, "GET");
  return res.status(200).json(listBackups());
}

export default withEditor(handler);
