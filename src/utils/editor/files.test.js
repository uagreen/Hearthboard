// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dir;
let files;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "editor-files-"));
  process.env.HOMEPAGE_CONFIG_DIR = dir;
  vi.resetModules();
  files = await import("./files");
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.HOMEPAGE_CONFIG_DIR;
});

describe("utils/editor/files", () => {
  describe("configPath", () => {
    it.each(["../settings.yaml", "a/b.yaml", "x.txt", "settings.yaml/", ".hidden.yaml"])(
      "rejects %s with 400",
      (name) => {
        expect(() => files.configPath(name)).toThrow(files.EditorError);
        try {
          files.configPath(name);
        } catch (e) {
          expect(e.status).toBe(400);
        }
      },
    );

    it.each(["settings.yaml", "custom.css", "custom.js", "docker.yml"])("accepts %s", (name) => {
      expect(files.configPath(name)).toBe(path.join(dir, name));
    });
  });

  it("readFile reports a missing file as not existing", () => {
    expect(files.readFile("settings.yaml")).toEqual({ name: "settings.yaml", text: "", mtime: 0, exists: false });
  });

  it("readFile and listFiles see written files, only config-like ones", () => {
    fs.writeFileSync(path.join(dir, "settings.yaml"), "title: x\n");
    fs.writeFileSync(path.join(dir, "notes.txt"), "no");
    const f = files.readFile("settings.yaml");
    expect(f.exists).toBe(true);
    expect(f.text).toBe("title: x\n");
    expect(files.listFiles()).toEqual([{ name: "settings.yaml", size: 9 }]);
  });

  it("parseYaml reports errors and no data", () => {
    const bad = files.parseYaml("a: [1,\n");
    expect(bad.errors.length).toBeGreaterThan(0);
    expect(bad.data).toBeNull();
    expect(files.parseYaml("a: 1\n").data).toEqual({ a: 1 });
  });

  describe("renderEdit", () => {
    it("merges {data} into the existing document, keeping comments", () => {
      fs.writeFileSync(path.join(dir, "settings.yaml"), "# hi\ntitle: a\n");
      const r = files.renderEdit("settings.yaml", { data: { title: "b" } });
      expect(r.text).toBe("# hi\ntitle: b\n");
      expect(r.changed).toBe(true);
      expect(r.errors).toEqual([]);
      expect(r.diff).toContain("+title: b");
    });

    it("structural save works on a new, empty file", () => {
      const r = files.renderEdit("settings.yaml", { data: { title: "x" } });
      expect(r.text).toBe("title: x\n");
    });

    it("structural save on a comment-only file keeps the comment", () => {
      fs.writeFileSync(path.join(dir, "settings.yaml"), "# only a comment\n");
      const r = files.renderEdit("settings.yaml", { data: { title: "x" } });
      expect(r.text).toContain("# only a comment");
      expect(r.text).toContain("title: x");
    });

    it("rejects {data} when the current file has YAML errors", () => {
      fs.writeFileSync(path.join(dir, "settings.yaml"), "a: [1,\n");
      expect(() => files.renderEdit("settings.yaml", { data: { a: 1 } })).toThrow(/edit it as text/);
    });

    it("rejects {data} for non-YAML files and empty bodies", () => {
      expect(() => files.renderEdit("custom.css", { data: {} })).toThrow(/only for YAML/);
      expect(() => files.renderEdit("settings.yaml", {})).toThrow(/Nothing to save/);
    });

    it("reports YAML errors of a text edit without throwing", () => {
      const r = files.renderEdit("settings.yaml", { text: "a: [1,\n" });
      expect(r.errors.length).toBeGreaterThan(0);
    });

    it("rejects path traversal and writes nothing", () => {
      expect(() => files.renderEdit("../evil.yaml", { text: "a: 1" })).toThrow(files.EditorError);
      expect(fs.readdirSync(dir)).toEqual([]);
    });
  });
});
