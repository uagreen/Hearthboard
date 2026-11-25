// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import YAML from "yaml";

// Decide whether a documentation example can be inserted into a config file as-is:
// only a YAML mapping without a `...` placeholder line can be merged by the editor.
export function classifyExample(text) {
  if (/^\s*\.\.\.\s*$/m.test(text)) return { text, insertable: false, reason: "placeholder" };
  let data;
  try {
    data = YAML.parse(text);
  } catch {
    return { text, insertable: false, reason: "invalid-yaml" };
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { text, insertable: false, reason: "not-a-mapping" };
  }
  return { text, insertable: true };
}
