// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import { describe, expect, it } from "vitest";
import YAML from "yaml";

import { syncDocument } from "./sync";

const SAMPLE = `# top comment
title: Home # inline
layout:
  # keep me
  Media:
    style: row
    columns: 3
`;

describe("utils/editor/sync", () => {
  it("returns identical text when the data is unchanged", () => {
    const doc = YAML.parseDocument(SAMPLE);
    syncDocument(doc, doc.toJS());
    expect(doc.toString({ lineWidth: 0 })).toBe(SAMPLE);
  });

  it("changes one key and keeps comments and order", () => {
    const doc = YAML.parseDocument(SAMPLE);
    const data = doc.toJS();
    data.layout.Media.columns = 4;
    syncDocument(doc, data);
    const out = doc.toString({ lineWidth: 0 });
    expect(out).toBe(SAMPLE.replace("columns: 3", "columns: 4"));
  });

  it("fills an empty document", () => {
    const doc = YAML.parseDocument("");
    syncDocument(doc, { title: "x" });
    expect(doc.toJS()).toEqual({ title: "x" });
  });

  it("fills a comment-only document without losing the comment", () => {
    const doc = YAML.parseDocument("# only a comment\n");
    syncDocument(doc, { title: "x" });
    const out = doc.toString({ lineWidth: 0 });
    expect(out).toContain("# only a comment");
    expect(YAML.parse(out)).toEqual({ title: "x" });
  });
});
