// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dir;
let backups;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "editor-backups-"));
  process.env.EDITOR_BACKUP_DIR = dir;
  vi.resetModules();
  backups = await import("./backups");
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.EDITOR_BACKUP_DIR;
});

describe("utils/editor/backups", () => {
  it("backupFile writes <id>/<name> with the current text", () => {
    const id = backups.backupFile("settings.yaml", { exists: true, text: "title: old\n" });
    expect(id).toMatch(/^\d{4}-/);
    expect(fs.readFileSync(path.join(dir, id, "settings.yaml"), "utf8")).toBe("title: old\n");
    expect(backups.listBackups()).toEqual([{ id, files: ["settings.yaml"] }]);
  });

  it("backupFile does nothing for a file that does not exist", () => {
    expect(backups.backupFile("settings.yaml", { exists: false, text: "" })).toBeNull();
    expect(backups.listBackups()).toEqual([]);
  });

  it("pruneBackups(2) keeps the 2 newest", () => {
    for (const id of ["2026-01-01T00-00-00-000Z", "2026-01-02T00-00-00-000Z", "2026-01-03T00-00-00-000Z"]) {
      fs.mkdirSync(path.join(dir, id));
      fs.writeFileSync(path.join(dir, id, "settings.yaml"), id);
    }
    backups.pruneBackups(2);
    expect(backups.listBackups().map((b) => b.id)).toEqual(["2026-01-03T00-00-00-000Z", "2026-01-02T00-00-00-000Z"]);
  });

  it("readBackup returns the stored text", () => {
    const id = "2026-01-01T00-00-00-000Z";
    fs.mkdirSync(path.join(dir, id));
    fs.writeFileSync(path.join(dir, id, "settings.yaml"), "a: 1\n");
    expect(backups.readBackup(id, "settings.yaml")).toBe("a: 1\n");
  });

  it.each(["../x", "abc", "2026/../..", "2026-01-01/../../etc"])("readBackup rejects id %s with 400", (id) => {
    try {
      backups.readBackup(id, "settings.yaml");
      throw new Error("did not throw");
    } catch (e) {
      expect(e.status).toBe(400);
    }
  });

  it("readBackup answers 404 for a missing backup and 400 for a bad name", () => {
    expect(() => backups.readBackup("2026-01-01T00-00-00-000Z", "settings.yaml")).toThrow(/No such backup/);
    expect(() => backups.readBackup("2026-01-01T00-00-00-000Z", "../x.yaml")).toThrow(/Not an editable/);
  });
});
