// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

import { EditorError } from "./files";
import { withEditor } from "./guard";

vi.mock("utils/logger", () => ({ default: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));

const basic = (pass, user = "") => `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
const req = (authorization) => ({ headers: { host: "localhost:3000", ...(authorization ? { authorization } : {}) } });

describe("utils/editor/guard withEditor", () => {
  beforeEach(() => {
    vi.stubEnv("HOMEPAGE_EDITOR", "true");
    vi.stubEnv("HOMEPAGE_AUTH_ENABLED", "");
    vi.stubEnv("EDITOR_PASSWORD", "");
    vi.stubEnv("EDITOR_ALLOW_NO_AUTH", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("answers 404 when HOMEPAGE_EDITOR is not true, without calling the handler", async () => {
    vi.stubEnv("HOMEPAGE_EDITOR", "");
    const handler = vi.fn();
    const res = createMockRes();
    await withEditor(handler)(req(), res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty("error");
    expect(handler).not.toHaveBeenCalled();
  });

  it("answers 403 with a hint when enabled with no auth and no password", async () => {
    const handler = vi.fn();
    const res = createMockRes();
    await withEditor(handler)(req(), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/EDITOR_PASSWORD/);
    expect(handler).not.toHaveBeenCalled();
  });

  it("answers 401 for a missing or wrong password", async () => {
    vi.stubEnv("EDITOR_PASSWORD", "secret");
    for (const header of [undefined, basic("wrong"), "Bearer secret"]) {
      const handler = vi.fn();
      const res = createMockRes();
      await withEditor(handler)(req(header), res);
      expect(res.statusCode).toBe(401);
      expect(res.headers["WWW-Authenticate"]).toMatch(/^Basic/);
      expect(handler).not.toHaveBeenCalled();
    }
  });

  it("calls the handler with the right password, whatever the username", async () => {
    vi.stubEnv("EDITOR_PASSWORD", "secret");
    const handler = vi.fn((r, res) => res.status(200).json({ ok: true }));
    const res = createMockRes();
    await withEditor(handler)(req(basic("secret", "anyone")), res);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it("calls the handler with EDITOR_ALLOW_NO_AUTH=true", async () => {
    vi.stubEnv("EDITOR_ALLOW_NO_AUTH", "true");
    const handler = vi.fn((r, res) => res.status(200).json({ ok: true }));
    await withEditor(handler)(req(), createMockRes());
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("delegates to Homepage auth when it is enabled (401 without a session)", async () => {
    vi.stubEnv("HOMEPAGE_AUTH_ENABLED", "true");
    vi.stubEnv("HOMEPAGE_AUTH_SECRET", "test-session-secret-at-least-32-characters");
    vi.stubEnv("EDITOR_ALLOW_NO_AUTH", "true");
    const handler = vi.fn();
    const res = createMockRes();
    await withEditor(handler)({ ...req(), cookies: {} }, res);
    expect(res.statusCode).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("answers 401, not 404, to anonymous requests when Homepage auth is on and the editor is off", async () => {
    vi.stubEnv("HOMEPAGE_EDITOR", "");
    vi.stubEnv("HOMEPAGE_AUTH_ENABLED", "true");
    vi.stubEnv("HOMEPAGE_AUTH_SECRET", "test-session-secret-at-least-32-characters");
    const res = createMockRes();
    await withEditor(vi.fn())({ ...req(), cookies: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("rejects hosts that are not allowed", async () => {
    vi.stubEnv("HOMEPAGE_ALLOWED_HOSTS", "");
    vi.stubEnv("EDITOR_ALLOW_NO_AUTH", "true");
    const handler = vi.fn();
    const res = createMockRes();
    await withEditor(handler)({ headers: { host: "evil.example" } }, res);
    expect(res.statusCode).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it("maps EditorError to its status and anything else to 500", async () => {
    vi.stubEnv("EDITOR_ALLOW_NO_AUTH", "true");
    const res1 = createMockRes();
    await withEditor(() => {
      throw new EditorError(409, "conflict");
    })(req(), res1);
    expect(res1.statusCode).toBe(409);
    expect(res1.body).toEqual({ error: "conflict" });

    const res2 = createMockRes();
    await withEditor(async () => {
      throw new Error("boom");
    })(req(), res2);
    expect(res2.statusCode).toBe(500);
  });
});
