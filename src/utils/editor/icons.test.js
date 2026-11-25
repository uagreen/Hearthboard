// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dir;
let icons;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "editor-icons-"));
  vi.stubEnv("HOMEPAGE_CONFIG_DIR", dir);
  vi.resetModules();
  icons = await import("./icons");
}, 60000);

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("utils/editor/icons", () => {
  describe("safeIconName", () => {
    it.each([
      ["My Icon!.PNG", "my-icon-.png"],
      ["../../etc/passwd", "etc-passwd"],
      [".hidden", "hidden"],
      ["a/b\\c", "a-b-c"],
    ])("turns %s into a safe name", (input, expected) => {
      const out = icons.safeIconName(input);
      expect(out).toBe(expected);
      expect(out).not.toMatch(/[\\/]/);
      expect(out).not.toMatch(/^\./);
    });
  });

  describe("storeIcon", () => {
    it("stores an image under the sanitized name with the extension of its type", () => {
      const file = icons.storeIcon("My Logo.jpeg", Buffer.from("x"), "image/png");
      expect(file).toBe("my-logo.png");
      expect(fs.readFileSync(path.join(dir, "icons", file), "utf8")).toBe("x");
      expect(icons.localIcons()).toEqual(["my-logo.png"]);
    });

    it("rejects non-images with 400 and stores nothing", () => {
      for (const type of ["text/html", undefined, "application/octet-stream"]) {
        try {
          icons.storeIcon("x", Buffer.from("<html>"), type);
          throw new Error("did not throw");
        } catch (e) {
          expect(e.status).toBe(400);
        }
      }
      expect(icons.localIcons()).toEqual([]);
    });

    it("rejects images over 15 MB with 400", () => {
      expect(() => icons.storeIcon("big", Buffer.alloc(15e6 + 1), "image/png")).toThrow(/15 MB/);
      expect(icons.localIcons()).toEqual([]);
    });
  });

  describe("assertFetchableUrl", () => {
    it.each([
      "file:///etc/passwd",
      "ftp://example.com/x.png",
      "javascript:alert(1)",
      "not a url",
      "http://127.0.0.1/x.png",
      "http://127.1.2.3/x.png",
      "http://localhost/x.png",
      "http://0.0.0.0/x.png",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/x.png",
      "http://[::ffff:127.0.0.1]/x.png",
      "http://[fe80::1]/x.png",
    ])("rejects %s with 400", async (url) => {
      await expect(icons.assertFetchableUrl(url)).rejects.toMatchObject({ status: 400 });
    });

    it("accepts a public http(s) address", async () => {
      await expect(icons.assertFetchableUrl("https://93.184.216.34/x.png")).resolves.toBeInstanceOf(URL);
      await expect(icons.assertFetchableUrl("http://192.168.1.10/x.png")).resolves.toBeInstanceOf(URL);
    });
  });
});
