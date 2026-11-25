// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { invalidateDashboardData } = vi.hoisted(() => ({ invalidateDashboardData: vi.fn() }));
vi.mock("utils/config/dashboard", () => ({ invalidateDashboardData }));
vi.mock("utils/logger", () => ({ default: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));

let dir;
let backups;
let save;

// The first import of the route is slow on a cold cache (e.g. a Windows-mounted disk).
beforeAll(async () => {
  await import("pages/api/editor/save/[name]");
}, 120000);

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "editor-save-"));
  fs.mkdirSync(path.join(dir, "config"));
  vi.stubEnv("HOMEPAGE_CONFIG_DIR", path.join(dir, "config"));
  vi.stubEnv("EDITOR_BACKUP_DIR", path.join(dir, "backups"));
  vi.stubEnv("HOMEPAGE_EDITOR", "true");
  vi.stubEnv("EDITOR_ALLOW_NO_AUTH", "true");
  vi.stubEnv("HOMEPAGE_AUTH_ENABLED", "");
  invalidateDashboardData.mockClear();
  vi.resetModules();
  backups = await import("utils/editor/backups");
  save = (await import("pages/api/editor/save/[name]")).default;
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

const file = (n) => path.join(dir, "config", n);
const call = async (name, body) => {
  const res = createMockRes();
  await save({ method: "POST", query: { name }, body, headers: { host: "localhost:3000" } }, res);
  return res;
};

describe("api/editor/save/[name]", () => {
  it("saves valid YAML, makes a backup and invalidates the dashboard cache", async () => {
    fs.writeFileSync(file("settings.yaml"), "title: old\n");
    const res = await call("settings.yaml", { text: "title: new\n" });
    expect(res.statusCode).toBe(200);
    expect(res.body.saved).toBe(true);
    expect(fs.readFileSync(file("settings.yaml"), "utf8")).toBe("title: new\n");
    expect(backups.readBackup(res.body.backup, "settings.yaml")).toBe("title: old\n");
    expect(invalidateDashboardData).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid YAML with 400, leaving the file and backups untouched", async () => {
    fs.writeFileSync(file("settings.yaml"), "title: old\n");
    const res = await call("settings.yaml", { text: "a: [1,\n" });
    expect(res.statusCode).toBe(400);
    expect(fs.readFileSync(file("settings.yaml"), "utf8")).toBe("title: old\n");
    expect(backups.listBackups()).toEqual([]);
    expect(invalidateDashboardData).not.toHaveBeenCalled();
  });

  it("answers 409 for a stale baseMtime, leaving the file unchanged", async () => {
    fs.writeFileSync(file("settings.yaml"), "title: old\n");
    const mtime = fs.statSync(file("settings.yaml")).mtimeMs;
    const res = await call("settings.yaml", { text: "title: new\n", baseMtime: mtime - 5000 });
    expect(res.statusCode).toBe(409);
    expect(fs.readFileSync(file("settings.yaml"), "utf8")).toBe("title: old\n");
    expect(backups.listBackups()).toEqual([]);
  });

  it("accepts a matching baseMtime", async () => {
    fs.writeFileSync(file("settings.yaml"), "title: old\n");
    const mtime = fs.statSync(file("settings.yaml")).mtimeMs;
    const res = await call("settings.yaml", { text: "title: new\n", baseMtime: mtime });
    expect(res.statusCode).toBe(200);
    expect(res.body.saved).toBe(true);
  });

  it("returns {saved:false} without a backup when nothing changed", async () => {
    fs.writeFileSync(file("settings.yaml"), "title: same\n");
    const res = await call("settings.yaml", { text: "title: same\n" });
    expect(res.statusCode).toBe(200);
    expect(res.body.saved).toBe(false);
    expect(backups.listBackups()).toEqual([]);
    expect(invalidateDashboardData).not.toHaveBeenCalled();
  });

  it("rejects path traversal with 400 and writes nothing", async () => {
    const res = await call("../evil.yaml", { text: "a: 1\n" });
    expect(res.statusCode).toBe(400);
    expect(fs.existsSync(path.join(dir, "evil.yaml"))).toBe(false);
  });

  it("answers 404 when the editor is disabled", async () => {
    vi.stubEnv("HOMEPAGE_EDITOR", "");
    const res = await call("settings.yaml", { text: "a: 1\n" });
    expect(res.statusCode).toBe(404);
    expect(fs.existsSync(file("settings.yaml"))).toBe(false);
  });

  it("creates a new file without a backup", async () => {
    const res = await call("settings.yaml", { data: { title: "x" } });
    expect(res.statusCode).toBe(200);
    expect(res.body.backup).toBeNull();
    expect(fs.readFileSync(file("settings.yaml"), "utf8")).toBe("title: x\n");
  });
});
