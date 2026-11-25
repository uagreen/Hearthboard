import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { copyVendor } from "../../../scripts/editor/copy-vendor.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const vendor = (...p) => path.join(ROOT, "public", "editor", "vendor", ...p);

describe("copyVendor", () => {
  it("copies the browser libraries and the docs images the UI imports", () => {
    copyVendor();
    expect(fs.existsSync(vendor("sortable", "sortable.esm.js"))).toBe(true);
    expect(fs.existsSync(vendor("marked", "marked.esm.js"))).toBe(true);
    expect(fs.existsSync(vendor("yaml", "index.js"))).toBe(true);
    // Documentation markdown embeds these via ../../assets/…
    expect(fs.existsSync(vendor("docs-assets", "style-default.webp"))).toBe(true);
  }, 60000);

  it("every image referenced by the catalog's markdown exists in the copied assets", async () => {
    const { buildCatalog } = await import("../../../scripts/editor/build-catalog.mjs");
    const catalog = buildCatalog(ROOT);
    const md = [
      ...Object.values(catalog.configs).flatMap((p) => p.sections.map((s) => s.markdown)),
      ...catalog.serviceWidgets.map((w) => w.markdown),
      ...catalog.infoWidgets.map((w) => w.markdown),
    ].join("\n");
    const refs = [...md.matchAll(/!\[[^\]]*\]\(((?:\.\.\/)*\/?assets\/[^)\s]+)/g)].map((m) =>
      m[1].replace(/^.*assets\//, ""),
    );
    expect(refs.length).toBeGreaterThan(0);
    for (const file of refs) expect(fs.existsSync(vendor("docs-assets", file)), file).toBe(true);
  }, 60000);
});
