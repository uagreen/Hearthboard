import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { httpProxy, getServiceWidget, cache, logger } = vi.hoisted(() => {
  const store = new Map();

  return {
    httpProxy: vi.fn(),
    getServiceWidget: vi.fn(),
    cache: {
      get: vi.fn((k) => store.get(k)),
      put: vi.fn((k, v) => store.set(k, v)),
      del: vi.fn((k) => store.delete(k)),
      _reset: () => store.clear(),
    },
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

vi.mock("utils/config/service-helpers", () => ({
  default: getServiceWidget,
}));

vi.mock("utils/proxy/http", () => ({
  httpProxy,
}));

vi.mock("memory-cache", () => ({
  default: cache,
  ...cache,
}));

vi.mock("widgets/widgets", () => ({
  default: {
    transmission: {
      rpcUrl: "/transmission/",
    },
  },
}));

import transmissionProxyHandler from "./proxy";

describe("widgets/transmission/proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache._reset();
  });

  it("retries after a 409 response by caching the CSRF header", async () => {
    getServiceWidget.mockResolvedValue({
      type: "transmission",
      url: "http://tr",
      username: "u",
      password: "p",
    });

    httpProxy
      .mockResolvedValueOnce([409, "application/json", Buffer.from("nope"), { "x-transmission-session-id": "csrf" }])
      .mockResolvedValueOnce([200, "application/json", Buffer.from("ok"), {}]);

    const req = { query: { group: "g", service: "svc", index: "0" } };
    const res = createMockRes();

    await transmissionProxyHandler(req, res);

    expect(httpProxy).toHaveBeenCalledTimes(2);
    expect(httpProxy.mock.calls[1][1].headers["x-transmission-session-id"]).toBe("csrf");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(Buffer.from("ok"));
  });

  describe("torrent-get fields", () => {
    const run = async (extra) => {
      getServiceWidget.mockResolvedValue({
        type: "transmission",
        url: "http://tr",
        username: "u",
        password: "p",
        ...extra,
      });
      httpProxy.mockResolvedValue([200, "application/json", Buffer.from("{}"), {}]);
      await transmissionProxyHandler({ query: { group: "g", service: "svc", index: "0" } }, createMockRes());
      return JSON.parse(httpProxy.mock.calls[0][1].body).arguments.fields;
    };

    it("keeps the original four fields when showDownloads is absent", async () => {
      expect(await run({})).toEqual(["percentDone", "status", "rateDownload", "rateUpload"]);
    });

    it("requests extra torrent fields when showDownloads is true", async () => {
      const fields = await run({ showDownloads: true });
      expect(fields).toEqual(
        expect.arrayContaining([
          "percentDone",
          "status",
          "rateDownload",
          "rateUpload",
          "id",
          "name",
          "eta",
          "totalSize",
          "error",
          "errorString",
        ]),
      );
    });

    it('requests extra torrent fields when showDownloads is the string "true"', async () => {
      expect(await run({ showDownloads: "true" })).toContain("name");
    });
  });
});
