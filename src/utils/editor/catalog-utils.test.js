// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { exampleHint, sectionsWithPage } from "../../../public/editor/catalog-utils.js";
import { buildCatalog } from "../../../scripts/editor/build-catalog.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("sectionsWithPage", () => {
  let catalog;
  beforeAll(() => {
    catalog = buildCatalog(ROOT);
  }, 60000);

  it("gives every menu item a page that exists in the catalog (the Settings crash)", () => {
    const all = sectionsWithPage(catalog.configs);
    expect(all.length).toBeGreaterThan(0);
    for (const s of all) {
      expect(Object.keys(catalog.configs)).toContain(s.page);
      // This is exactly what the Settings view reads when a menu item is clicked.
      expect(catalog.configs[s.page].doc).toBeDefined();
      expect(typeof s.pageLabel).toBe("string");
      expect(typeof s.id).toBe("string");
    }
  });

  it("covers every section of every page, keeping order, with unique keys", () => {
    const all = sectionsWithPage(catalog.configs);
    const expected = Object.values(catalog.configs).reduce((n, p) => n + p.sections.length, 0);
    expect(all).toHaveLength(expected);
    expect(new Set(all.map((s) => s.key)).size).toBe(all.length);
    expect(all[0].page).toBe(Object.keys(catalog.configs)[0]);
  });

  it("does not mutate the catalog sections", () => {
    sectionsWithPage(catalog.configs);
    expect(catalog.configs.settings.sections[0]).not.toHaveProperty("page");
  });
});

describe("exampleHint", () => {
  it("is empty for an insertable example", () => {
    expect(exampleHint({ text: "a: 1", insertable: true })).toBe("");
  });

  it.each(["placeholder", "not-a-mapping", "invalid-yaml"])("explains %s", (reason) => {
    const hint = exampleHint({ text: "x", insertable: false, reason });
    expect(hint).toMatch(/\w/);
  });

  it("explains the list case by pointing at the Services tab", () => {
    expect(exampleHint({ text: "- a", insertable: false, reason: "not-a-mapping" })).toMatch(/Services/);
  });
});
