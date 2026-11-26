import { describe, expect, it } from "vitest";

import {
  authorsText,
  baseUrl,
  bookUrl,
  clampCount,
  coverUrl,
  findShelf,
  indexingLine,
  statValue,
} from "./library-utils";

describe("inpxlibrary/library-utils", () => {
  describe("clampCount", () => {
    it("keeps integers from 1 to 10 and falls back otherwise", () => {
      expect(clampCount(7)).toBe(7);
      expect(clampCount(10)).toBe(10);
      expect(clampCount(0)).toBe(10);
      expect(clampCount(99)).toBe(10);
      expect(clampCount("abc")).toBe(10);
      expect(clampCount(2.5)).toBe(10);
      expect(clampCount(undefined, 5)).toBe(5);
    });
  });

  describe("baseUrl, bookUrl, coverUrl", () => {
    it("builds links from the browser-facing href", () => {
      expect(baseUrl("https://lib.example.com/")).toBe("https://lib.example.com");
      expect(baseUrl("https://x/lib/")).toBe("https://x/lib");
      expect(bookUrl("https://lib.example.com", "42")).toBe("https://lib.example.com/book/42");
      expect(coverUrl("https://lib.example.com", "42")).toBe("https://lib.example.com/api/books/42/cover-thumb");
    });

    it("returns null without a usable href or id", () => {
      for (const href of [undefined, "", "#", "javascript:alert(1)"]) {
        expect(baseUrl(href)).toBeNull();
        expect(bookUrl(href, "1")).toBeNull();
        expect(coverUrl(href, "1")).toBeNull();
      }
      expect(bookUrl("https://lib", undefined)).toBeNull();
    });
  });

  describe("findShelf", () => {
    const shelves = [
      { id: 1, name: " Favorites " },
      { id: 2, name: "Later" },
    ];
    it("matches by trimmed, case-insensitive name", () => {
      expect(findShelf(shelves, "favorites")).toEqual(shelves[0]);
      expect(findShelf(shelves, " LATER ")).toEqual(shelves[1]);
    });

    it("returns undefined for no match, no name or a non-array", () => {
      expect(findShelf(shelves, "missing")).toBeUndefined();
      expect(findShelf(shelves, undefined)).toBeUndefined();
      expect(findShelf(undefined, "a")).toBeUndefined();
      expect(findShelf({ error: "x" }, "a")).toBeUndefined();
    });
  });

  describe("indexingLine", () => {
    it("reports progress while indexing, with zero defaults", () => {
      expect(indexingLine({ active: true, processedArchives: 12, totalArchives: 40 })).toEqual({
        kind: "indexing",
        done: 12,
        total: 40,
      });
      expect(indexingLine({ active: true })).toEqual({ kind: "indexing", done: 0, total: 0 });
    });

    it("reports the last index time otherwise", () => {
      expect(indexingLine({ active: false, indexedAt: "2026-11-25T10:00:00Z" })).toEqual({
        kind: "updated",
        at: "2026-11-25T10:00:00Z",
      });
    });

    it("returns null with nothing to show", () => {
      expect(indexingLine(undefined)).toBeNull();
      expect(indexingLine({ active: false })).toBeNull();
    });
  });

  describe("statValue", () => {
    const stats = { totalBooks: 10, totalAuthors: 3, totalSeries: 0, totalGenres: 5, totalLanguages: 2 };
    it("maps field names to the server's totals", () => {
      expect(statValue(stats, "books")).toBe(10);
      expect(statValue(stats, "authors")).toBe(3);
      expect(statValue(stats, "series")).toBe(0);
      expect(statValue(stats, "genres")).toBe(5);
      expect(statValue(stats, "languages")).toBe(2);
    });

    it("returns undefined for missing stats, unknown fields or non-numbers", () => {
      expect(statValue(null, "books")).toBeUndefined();
      expect(statValue(undefined, "books")).toBeUndefined();
      expect(statValue(stats, "nope")).toBeUndefined();
      expect(statValue({ totalBooks: "10" }, "books")).toBeUndefined();
      expect(statValue({ totalBooks: NaN }, "books")).toBeUndefined();
    });
  });

  describe("authorsText", () => {
    it("trims the authors string and tolerates a missing one", () => {
      expect(authorsText({ authors: "  Strugatsky A., Strugatsky B.  " })).toBe("Strugatsky A., Strugatsky B.");
      expect(authorsText({})).toBe("");
      expect(authorsText(undefined)).toBe("");
    });
  });
});
