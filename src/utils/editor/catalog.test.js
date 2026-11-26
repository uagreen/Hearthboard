// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";
import YAML from "yaml";

import { buildCatalog } from "../../../scripts/editor/build-catalog.mjs";
import { classifyExample } from "../../../scripts/editor/catalog-examples.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("classifyExample", () => {
  it("accepts a plain mapping", () => {
    expect(classifyExample("title: x")).toEqual({ text: "title: x", insertable: true });
  });

  it("flags a `...` placeholder line", () => {
    expect(classifyExample("layout:\n  ...\n  A:\n    tab: B")).toMatchObject({
      insertable: false,
      reason: "placeholder",
    });
  });

  it("flags a list as not-a-mapping", () => {
    expect(classifyExample("- Group:\n    - S:\n        href: x")).toMatchObject({
      insertable: false,
      reason: "not-a-mapping",
    });
  });

  it.each(["just text", "", "# only a comment"])("flags %j as not-a-mapping", (text) => {
    expect(classifyExample(text)).toMatchObject({ insertable: false, reason: "not-a-mapping" });
  });

  it("flags broken YAML", () => {
    expect(classifyExample("a: [1,\n")).toMatchObject({ insertable: false, reason: "invalid-yaml" });
  });

  it("never puts a reason on an insertable example", () => {
    expect(classifyExample("a: 1")).not.toHaveProperty("reason");
  });
});

describe("buildCatalog on this repository's docs", () => {
  let catalog;
  beforeAll(() => {
    catalog = buildCatalog(ROOT);
  }, 60000);

  it("reports the upstream Homepage version from package.json, not the fork's own version", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    expect(pkg.upstreamVersion).toBeTruthy();
    expect(catalog.homepageVersion).toBe(pkg.upstreamVersion);
  });

  it("finds service widgets, each with a type and a fields array", () => {
    expect(catalog.serviceWidgets.length).toBeGreaterThan(0);
    for (const w of catalog.serviceWidgets) {
      expect(typeof w.type).toBe("string");
      expect(w.type).not.toBe("");
      expect(Array.isArray(w.fields)).toBe(true);
    }
  });

  it("has one entry for every service and info widget doc, with no duplicate types", () => {
    const slugs = (dir) =>
      fs
        .readdirSync(path.join(ROOT, "docs", "widgets", dir))
        .filter((f) => f.endsWith(".md") && f !== "index.md")
        .map((f) => f.slice(0, -3));
    expect(catalog.serviceWidgets.map((w) => w.slug).sort()).toEqual(slugs("services").sort());
    expect(catalog.infoWidgets.map((w) => w.slug).sort()).toEqual(slugs("info").sort());
    const types = catalog.serviceWidgets.map((w) => w.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("finds info widgets and the palettes", () => {
    expect(catalog.infoWidgets.length).toBeGreaterThan(0);
    expect(Object.keys(catalog.palettes).length).toBeGreaterThan(0);
  });

  it("gives every config example the {text, insertable} shape", () => {
    for (const page of Object.values(catalog.configs)) {
      for (const section of page.sections) {
        for (const ex of section.examples) {
          expect(typeof ex.text).toBe("string");
          expect(typeof ex.insertable).toBe("boolean");
          if (ex.insertable) expect(ex).not.toHaveProperty("reason");
          else expect(["placeholder", "not-a-mapping", "invalid-yaml"]).toContain(ex.reason);
        }
      }
    }
  });

  it("only marks settings examples insertable when they parse into a mapping", () => {
    let insertable = 0;
    for (const section of catalog.configs.settings.sections) {
      for (const ex of section.examples.filter((e) => e.insertable)) {
        insertable += 1;
        const data = YAML.parse(ex.text);
        expect(data !== null && typeof data === "object" && !Array.isArray(data)).toBe(true);
      }
    }
    expect(insertable).toBeGreaterThan(0);
  });
});
