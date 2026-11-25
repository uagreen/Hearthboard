// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import fs from "node:fs";

import { invalidateDashboardData } from "utils/config/dashboard";
import { backupFile, readBackup } from "utils/editor/backups";
import { configPath, readFile } from "utils/editor/files";
import { assertMethod, withEditor } from "utils/editor/guard";

async function handler(req, res) {
  assertMethod(req, "POST");
  const { id, name } = req.query;
  const text = readBackup(id, name);
  const backup = backupFile(name, readFile(name));
  fs.writeFileSync(configPath(name), text);
  invalidateDashboardData();
  return res.status(200).json({ restored: true, backup });
}

export default withEditor(handler);
