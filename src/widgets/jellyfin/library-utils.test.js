import { describe, expect, it } from "vitest";

import {
  clampCount,
  formatRating,
  itemTitle,
  itemUrl,
  libraryUrl,
  pickUser,
  posterUrl,
  webBase,
} from "./library-utils";

describe("jellyfin/library-utils", () => {
  describe("clampCount", () => {
    it("keeps integers between 1 and 10 and falls back otherwise", () => {
      expect(clampCount(4)).toBe(4);
      expect(clampCount(10)).toBe(10);
      expect(clampCount(0)).toBe(5);
      expect(clampCount(99)).toBe(5);
      expect(clampCount("abc")).toBe(5);
      expect(clampCount(undefined, 3)).toBe(3);
      expect(clampCount(2.5)).toBe(5);
    });
  });

  describe("webBase", () => {
    it("builds the web client base and tolerates trailing slashes and path prefixes", () => {
      expect(webBase("https://jf.example.com")).toBe("https://jf.example.com/web");
      expect(webBase("https://x/jf/")).toBe("https://x/jf/web");
    });

    it("returns null for missing, placeholder or non-http hrefs", () => {
      expect(webBase(undefined)).toBeNull();
      expect(webBase("")).toBeNull();
      expect(webBase("#")).toBeNull();
      expect(webBase("javascript:alert(1)")).toBeNull();
    });
  });

  describe("libraryUrl", () => {
    const href = "https://jf.example.com";
    it("uses the web client route of the collection type", () => {
      expect(libraryUrl(href, { Id: "a", CollectionType: "movies" })).toBe(
        "https://jf.example.com/web/#/movies?topParentId=a&collectionType=movies",
      );
      expect(libraryUrl(href, { Id: "b", CollectionType: "tvshows" })).toBe(
        "https://jf.example.com/web/#/tv?topParentId=b&collectionType=tvshows",
      );
      expect(libraryUrl(href, { Id: "c", CollectionType: "music" })).toBe(
        "https://jf.example.com/web/#/music?topParentId=c&collectionType=music",
      );
      expect(libraryUrl(href, { Id: "d" })).toBe(
        "https://jf.example.com/web/#/mixed?topParentId=d&collectionType=mixed",
      );
    });

    it("returns null without a usable href", () => {
      expect(libraryUrl(undefined, { Id: "a", CollectionType: "movies" })).toBeNull();
    });
  });

  describe("itemUrl", () => {
    it("links to the details page", () => {
      expect(itemUrl("https://jf", { Id: "i1", ServerId: "s1" })).toBe("https://jf/web/#/details?id=i1&serverId=s1");
      expect(itemUrl("https://jf", { Id: "i1" })).toBe("https://jf/web/#/details?id=i1");
      expect(itemUrl("#", { Id: "i1" })).toBeNull();
    });
  });

  describe("posterUrl", () => {
    it("uses the item's own primary image", () => {
      expect(posterUrl("https://jf", { Id: "m1", ImageTags: { Primary: "tagA" } }, 200)).toBe(
        "https://jf/Items/m1/Images/Primary?maxHeight=200&tag=tagA",
      );
    });

    it("uses the series poster for episodes", () => {
      expect(
        posterUrl("https://jf", {
          Id: "e1",
          Type: "Episode",
          SeriesId: "s1",
          SeriesPrimaryImageTag: "tagS",
          ImageTags: { Primary: "tagE" },
        }),
      ).toBe("https://jf/Items/s1/Images/Primary?maxHeight=360&tag=tagS");
    });

    it("returns null when there is no image, no series id or no href", () => {
      expect(posterUrl("https://jf", { Id: "m1", ImageTags: {} })).toBeNull();
      expect(posterUrl("https://jf", { Id: "e1", Type: "Episode", SeriesPrimaryImageTag: "t" })).toBeNull();
      expect(posterUrl(undefined, { Id: "m1", ImageTags: { Primary: "t" } })).toBeNull();
    });
  });

  describe("formatRating", () => {
    it("shows one decimal with a star and hides missing or zero ratings", () => {
      expect(formatRating({ CommunityRating: 7.84 })).toBe("★ 7.8");
      expect(formatRating({ CommunityRating: 8 })).toBe("★ 8.0");
      expect(formatRating({ CommunityRating: 0 })).toBeNull();
      expect(formatRating({})).toBeNull();
    });
  });

  describe("itemTitle", () => {
    it("formats episodes as series plus season/episode and name", () => {
      expect(
        itemTitle({
          Type: "Episode",
          SeriesName: "Severance",
          ParentIndexNumber: 2,
          IndexNumber: 4,
          Name: "Woe's Hollow",
        }),
      ).toEqual({ title: "Severance", subtitle: "S02E04 · Woe's Hollow" });
    });

    it("uses the name and production year for other items", () => {
      expect(itemTitle({ Name: "Dune", ProductionYear: 2021 })).toEqual({ title: "Dune", subtitle: "2021" });
      expect(itemTitle({ Name: "Dune" })).toEqual({ title: "Dune", subtitle: null });
    });
  });

  describe("pickUser", () => {
    const users = [
      { Id: "1", Name: "Anna" },
      { Id: "2", Name: "Bob" },
    ];
    it("prefers the stored id, then the configured name, then the first user", () => {
      expect(pickUser(users, "2", "anna")).toEqual(users[1]);
      expect(pickUser(users, undefined, "ANNA")).toEqual(users[0]);
      expect(pickUser(users, "gone", "bob")).toEqual(users[1]);
      expect(pickUser(users, "gone", "nobody")).toEqual(users[0]);
    });

    it("returns undefined for an empty list", () => {
      expect(pickUser([], "1", "anna")).toBeUndefined();
      expect(pickUser(undefined)).toBeUndefined();
    });
  });
});
