// Copy the browser libraries (and doc images) the editor UI uses out of node_modules/docs into public/editor/vendor/,
// so Next.js serves them as static files. Run by predev/prebuild (see package.json).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nm = (...p) => path.join(root, "node_modules", ...p);
const out = path.join(root, "public", "editor", "vendor");

// [source, destination dir under vendor/, single file or whole directory]
const LIBS = [
  [nm("sortablejs", "modular"), "sortable"],
  [nm("marked", "lib", "marked.esm.js"), "marked"],
  [nm("yaml", "browser", "dist"), "yaml"],
  // Images the documentation markdown embeds (../../assets/…), so the help panes work offline.
  [path.join(root, "docs", "assets"), "docs-assets"],
];

export function copyVendor() {
  fs.rmSync(out, { recursive: true, force: true });
  for (const [src, name] of LIBS) {
    if (!fs.existsSync(src)) throw new Error(`Missing ${src}. Run pnpm install first.`);
    const dest = path.join(out, name);
    fs.mkdirSync(dest, { recursive: true });
    if (fs.statSync(src).isDirectory()) fs.cpSync(src, dest, { recursive: true });
    else fs.copyFileSync(src, path.join(dest, path.basename(src)));
  }
  return LIBS.map(([, name]) => name);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`vendor libraries copied: ${copyVendor().join(", ")}`);
}
