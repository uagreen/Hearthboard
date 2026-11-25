// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

vi.mock("utils/logger", () => ({ default: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));

let dir;
let fetchRoute;
let uploadRoute;
const fetchMock = vi.fn();

beforeAll(async () => {
  await import("pages/api/editor/icons/fetch");
  await import("pages/api/editor/icons/upload");
}, 120000);

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "editor-iconroutes-"));
  vi.stubEnv("HOMEPAGE_CONFIG_DIR", dir);
  vi.stubEnv("HOMEPAGE_EDITOR", "true");
  vi.stubEnv("EDITOR_ALLOW_NO_AUTH", "true");
  vi.stubEnv("HOMEPAGE_AUTH_ENABLED", "");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.resetModules();
  fetchRoute = (await import("pages/api/editor/icons/fetch")).default;
  uploadRoute = (await import("pages/api/editor/icons/upload")).default;
}, 60000);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fs.rmSync(dir, { recursive: true, force: true });
});

const headers = { host: "localhost:3000" };
const post = async (body) => {
  const res = createMockRes();
  await fetchRoute({ method: "POST", headers, query: {}, body }, res);
  return res;
};

describe("api/editor/icons/fetch", () => {
  it.each([
    "http://127.0.0.1/x.png",
    "file:///etc/passwd",
    "http://169.254.169.254/x",
    "http://[::1]/x.png",
    "gopher://x",
  ])("rejects %s with 400 without making a request", async (url) => {
    const res = await post({ url });
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not follow a redirect to a loopback address", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "http://127.0.0.1:8080/secret.png" } }),
    );
    const res = await post({ url: "https://93.184.216.34/x.png" });
    expect(res.statusCode).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("downloads an image into the icon directory", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(Buffer.from("png"), { status: 200, headers: { "content-type": "image/png" } }),
    );
    const res = await post({ url: "https://93.184.216.34/Logo.png", name: "Logo" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ file: "logo.png", ref: "/icons/logo.png" });
    expect(fs.readFileSync(path.join(dir, "icons", "logo.png"), "utf8")).toBe("png");
  });

  it("answers 404 when the editor is disabled", async () => {
    vi.stubEnv("HOMEPAGE_EDITOR", "");
    const res = await post({ url: "https://93.184.216.34/x.png" });
    expect(res.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("api/editor/icons/upload", () => {
  const upload = async (chunks, type = "image/png", name = "My Icon") => {
    const res = createMockRes();
    const req = Object.assign(Readable.from(chunks), {
      method: "POST",
      headers: { ...headers, "content-type": type },
      query: { name },
    });
    await uploadRoute(req, res);
    return res;
  };

  it("stores an uploaded image", async () => {
    const res = await upload([Buffer.from("ab"), Buffer.from("cd")]);
    expect(res.statusCode).toBe(200);
    expect(res.body.file).toBe("my-icon.png");
    expect(fs.readFileSync(path.join(dir, "icons", "my-icon.png"), "utf8")).toBe("abcd");
  });

  it("rejects non-image uploads with 400", async () => {
    const res = await upload([Buffer.from("<html>")], "text/html");
    expect(res.statusCode).toBe(400);
  });

  it("rejects an upload over 15 MB with 400", async () => {
    const res = await upload([Buffer.alloc(8e6), Buffer.alloc(8e6)]);
    expect(res.statusCode).toBe(400);
    expect(fs.existsSync(path.join(dir, "icons"))).toBe(false);
  });
});
