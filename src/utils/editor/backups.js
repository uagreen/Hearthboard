// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import fs from "node:fs";
import path from "node:path";

import { EditorError, configPath } from "./files";

import { CONF_DIR } from "utils/config/config";

// Backups live inside the config volume by default, so they survive container recreation.
const backupDir = () => process.env.EDITOR_BACKUP_DIR || path.join(CONF_DIR, ".editor-backups");

export const BACKUP_ID_RE = /^\d{4}-[\w-]+$/;

const listBackupIds = () => {
  const dir = backupDir();
  return fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((d) => BACKUP_ID_RE.test(d))
        .sort()
        .reverse()
    : [];
};

export function pruneBackups(keep = 300) {
  for (const id of listBackupIds().slice(keep)) fs.rmSync(path.join(backupDir(), id), { recursive: true, force: true });
}

// Written before every save: <backup dir>/<timestamp>/<file>.
export function backupFile(name, current) {
  if (!current.exists) return null;
  configPath(name);
  const id = new Date().toISOString().replace(/[:.]/g, "-");
  fs.mkdirSync(path.join(backupDir(), id), { recursive: true });
  fs.writeFileSync(path.join(backupDir(), id, name), current.text);
  pruneBackups();
  return id;
}

export function listBackups() {
  return listBackupIds().map((id) => ({ id, files: fs.readdirSync(path.join(backupDir(), id)) }));
}

export function readBackup(id, name) {
  if (!BACKUP_ID_RE.test(id)) throw new EditorError(400, "Bad backup id");
  configPath(name);
  const p = path.join(backupDir(), id, name);
  if (!fs.existsSync(p)) throw new EditorError(404, "No such backup");
  return fs.readFileSync(p, "utf8");
}
