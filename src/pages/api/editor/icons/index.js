// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import { assertMethod, withEditor } from "utils/editor/guard";
import { getIconIndex } from "utils/editor/icons";

async function handler(req, res) {
  assertMethod(req, "GET");
  return res.status(200).json(await getIconIndex());
}

export default withEditor(handler);
