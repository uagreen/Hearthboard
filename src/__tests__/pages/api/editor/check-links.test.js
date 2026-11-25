// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

vi.mock("utils/logger", () => ({ default: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));

let route;
const fetchMock = vi.fn();

beforeAll(async () => {
  await import("pages/api/editor/check-links");
}, 120000);

beforeEach(async () => {
  vi.stubEnv("HOMEPAGE_EDITOR", "true");
  vi.stubEnv("EDITOR_ALLOW_NO_AUTH", "true");
  vi.stubEnv("HOMEPAGE_AUTH_ENABLED", "");
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  route = (await import("pages/api/editor/check-links")).default;
}, 60000);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const post = async (body) => {
  const res = createMockRes();
  await route({ method: "POST", headers: { host: "localhost:3000" }, query: {}, body }, res);
  return res;
};

describe("api/editor/check-links", () => {
  it("ignores everything that is not http(s) and de-duplicates", async () => {
    const res = await post({
      urls: [
        "ftp://x/y",
        "javascript:alert(1)",
        "file:///etc/passwd",
        "http://a.example/",
        "http://a.example/",
        "/relative",
      ],
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.map((r) => r.url)).toEqual(["http://a.example/"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("checks at most 200 URLs", async () => {
    const urls = Array.from({ length: 250 }, (_, i) => `http://host${i}.example/`);
    const res = await post({ urls });
    expect(res.body).toHaveLength(200);
    expect(fetchMock).toHaveBeenCalledTimes(200);
  });

  it("allows private LAN addresses, which is the point of the checker", async () => {
    const res = await post({ urls: ["http://192.168.1.5:8080/"] });
    expect(res.body).toEqual([{ url: "http://192.168.1.5:8080/", status: 200, ok: true }]);
  });

  it("reports failures and treats 401/403 as alive", async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url.includes("down")) throw Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } });
      return new Response(null, { status: url.includes("auth") ? 401 : 500 });
    });
    const res = await post({ urls: ["http://down.example/", "http://auth.example/", "http://broken.example/"] });
    const by = Object.fromEntries(res.body.map((r) => [new URL(r.url).hostname, r]));
    expect(by["down.example"]).toMatchObject({ ok: false, error: "ECONNREFUSED" });
    expect(by["auth.example"]).toMatchObject({ ok: true, status: 401 });
    expect(by["broken.example"]).toMatchObject({ ok: false, status: 500 });
  });

  it("does not follow redirects", async () => {
    await post({ urls: ["http://a.example/"] });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });
});
