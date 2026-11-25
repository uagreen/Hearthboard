// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

vi.mock("utils/logger", () => ({ default: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));
const { invalidateDashboardData } = vi.hoisted(() => ({ invalidateDashboardData: vi.fn() }));
vi.mock("utils/config/dashboard", () => ({ invalidateDashboardData }));

let dir;
let list;
let show;
let restore;

const ID = "2026-01-01T00-00-00-000Z";

beforeAll(async () => {
  await import("pages/api/editor/backups");
  await import("pages/api/editor/backup/[id]/[name]");
  await import("pages/api/editor/restore/[id]/[name]");
}, 120000);

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "editor-backuproutes-"));
  fs.mkdirSync(path.join(dir, "config"));
  fs.mkdirSync(path.join(dir, "backups", ID), { recursive: true });
  fs.writeFileSync(path.join(dir, "backups", ID, "settings.yaml"), "title: old\n");
  fs.writeFileSync(path.join(dir, "config", "settings.yaml"), "title: now\n");
  vi.stubEnv("HOMEPAGE_CONFIG_DIR", path.join(dir, "config"));
  vi.stubEnv("EDITOR_BACKUP_DIR", path.join(dir, "backups"));
  vi.stubEnv("HOMEPAGE_EDITOR", "true");
  vi.stubEnv("EDITOR_ALLOW_NO_AUTH", "true");
  vi.stubEnv("HOMEPAGE_AUTH_ENABLED", "");
  invalidateDashboardData.mockClear();
  vi.resetModules();
  list = (await import("pages/api/editor/backups")).default;
  show = (await import("pages/api/editor/backup/[id]/[name]")).default;
  restore = (await import("pages/api/editor/restore/[id]/[name]")).default;
}, 60000);

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

const call = async (handler, method, query) => {
  const res = createMockRes();
  await handler({ method, query, headers: { host: "localhost:3000" }, body: {} }, res);
  return res;
};

describe("api/editor backups", () => {
  it("lists backups", async () => {
    const res = await call(list, "GET", {});
    expect(res.body).toEqual([{ id: ID, files: ["settings.yaml"] }]);
  });

  it("shows a backup with a diff against the current file", async () => {
    const res = await call(show, "GET", { id: ID, name: "settings.yaml" });
    expect(res.statusCode).toBe(200);
    expect(res.body.text).toBe("title: old\n");
    expect(res.body.diff).toContain("+title: old");
  });

  it("restores a backup, backing up the current file first", async () => {
    const res = await call(restore, "POST", { id: ID, name: "settings.yaml" });
    expect(res.statusCode).toBe(200);
    expect(res.body.restored).toBe(true);
    expect(fs.readFileSync(path.join(dir, "config", "settings.yaml"), "utf8")).toBe("title: old\n");
    expect(fs.readFileSync(path.join(dir, "backups", res.body.backup, "settings.yaml"), "utf8")).toBe("title: now\n");
    expect(invalidateDashboardData).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ id: "../x", name: "settings.yaml" }],
    [{ id: ID, name: "../settings.yaml" }],
    [{ id: ID + "/..", name: "settings.yaml" }],
  ])("rejects %j with 400 and changes nothing", async (query) => {
    const res = await call(restore, "POST", query);
    expect(res.statusCode).toBe(400);
    expect(fs.readFileSync(path.join(dir, "config", "settings.yaml"), "utf8")).toBe("title: now\n");
    expect(invalidateDashboardData).not.toHaveBeenCalled();
  });

  it("answers 404 for a missing backup", async () => {
    const res = await call(restore, "POST", { id: "2026-02-02T00-00-00-000Z", name: "settings.yaml" });
    expect(res.statusCode).toBe(404);
  });
});
