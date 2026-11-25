// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import fs from "node:fs";
import path from "node:path";

import { createTwoFilesPatch } from "diff";
import YAML from "yaml";

import { syncDocument } from "./sync";

import { CONF_DIR } from "utils/config/config";

export class EditorError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "EditorError";
    this.status = status;
  }
}

const NAME_RE = /^[\w][\w.-]*\.(ya?ml|css|js)$/;

// Only plain files directly inside the config dir (no paths), and only config-like extensions.
export function configPath(name) {
  if (typeof name !== "string" || !NAME_RE.test(name))
    throw new EditorError(400, `Not an editable config file: ${name}`);
  return path.join(CONF_DIR, name);
}

const isYaml = (name) => /\.ya?ml$/.test(name);

export function readFile(name) {
  const p = configPath(name);
  if (!fs.existsSync(p)) return { name, text: "", mtime: 0, exists: false };
  return { name, text: fs.readFileSync(p, "utf8"), mtime: fs.statSync(p).mtimeMs, exists: true };
}

export function listFiles() {
  if (!fs.existsSync(CONF_DIR)) return [];
  return fs
    .readdirSync(CONF_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && NAME_RE.test(d.name))
    .map((d) => ({ name: d.name, size: fs.statSync(path.join(CONF_DIR, d.name)).size }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Parse YAML the way Homepage does, reporting errors with line numbers.
export function parseYaml(text) {
  const doc = YAML.parseDocument(text, { keepSourceTokens: false });
  const errors = doc.errors.map((e) => `${e.message}`);
  return { doc, errors, data: errors.length ? null : doc.toJS() };
}

// Turn an edit ({text} or {data}) into the new file text; {data} is merged into the existing
// document so untouched items keep their comments, quoting and order.
export function renderEdit(name, body) {
  const current = readFile(name);
  let text;
  if (typeof body?.text === "string") {
    text = body.text;
  } else if (body?.data !== undefined) {
    if (!isYaml(name)) throw new EditorError(400, "Structured edits are only for YAML files");
    const { doc, errors } = parseYaml(current.text);
    if (errors.length) throw new EditorError(400, `The current ${name} has YAML errors, edit it as text: ${errors[0]}`);
    syncDocument(doc, body.data);
    text = doc.toString({ lineWidth: 0 });
  } else {
    throw new EditorError(400, "Nothing to save");
  }
  const errors = isYaml(name) ? parseYaml(text).errors : [];
  const patch = (opts) =>
    createTwoFilesPatch(`${name} (current)`, `${name} (new)`, current.text, text, "", "", { context: 3, ...opts });
  // contentDiff ignores indentation/spacing, so a first save that tidies mixed indentation
  // doesn't hide the real edits.
  return {
    current,
    text,
    errors,
    diff: patch(),
    contentDiff: patch({ ignoreWhitespace: true }),
    changed: text !== current.text,
  };
}
