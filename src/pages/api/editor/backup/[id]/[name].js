// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import { createTwoFilesPatch } from "diff";

import { readBackup } from "utils/editor/backups";
import { readFile } from "utils/editor/files";
import { assertMethod, withEditor } from "utils/editor/guard";

async function handler(req, res) {
  assertMethod(req, "GET");
  const { id, name } = req.query;
  const text = readBackup(id, name);
  const current = readFile(name);
  const diff = createTwoFilesPatch(`${name} (current)`, `${name} (backup ${id})`, current.text, text, "", "", {
    context: 3,
  });
  return res.status(200).json({ text, diff });
}

export default withEditor(handler);
