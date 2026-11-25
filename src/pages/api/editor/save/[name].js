// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import fs from "node:fs";

import { invalidateDashboardData } from "utils/config/dashboard";
import { backupFile } from "utils/editor/backups";
import { EditorError, configPath, renderEdit } from "utils/editor/files";
import { assertMethod, withEditor } from "utils/editor/guard";

async function handler(req, res) {
  assertMethod(req, "POST");
  const { name } = req.query;
  const { current, text, errors, changed } = renderEdit(name, req.body);
  if (errors.length) throw new EditorError(400, `Not saved, the YAML is invalid: ${errors[0]}`);
  const { baseMtime } = req.body;
  if (baseMtime !== undefined && current.exists && Math.abs(current.mtime - baseMtime) > 1) {
    throw new EditorError(
      409,
      `${name} was changed by something else since you opened it. Reload to see the latest version.`,
    );
  }
  if (!changed) return res.status(200).json({ saved: false, mtime: current.mtime });
  const backup = backupFile(name, current);
  // Write in place (not rename) so the file keeps its owner and permissions.
  fs.writeFileSync(configPath(name), text);
  invalidateDashboardData();
  return res.status(200).json({ saved: true, backup, mtime: fs.statSync(configPath(name)).mtimeMs });
}

export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

export default withEditor(handler);
