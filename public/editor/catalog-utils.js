// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
// Pure catalog helpers (no DOM), imported by the editor UI and by the unit tests.

// Flatten catalog.configs into one list of sections, each knowing the page it belongs to.
// Both the side menu and the "all sections" lookup are built from this, so a menu item can
// never be missing its page.
export function sectionsWithPage(configs) {
  return Object.entries(configs).flatMap(([page, cfg]) =>
    cfg.sections.map((s) => ({ ...s, page, pageLabel: cfg.title ?? page, key: `${page}:${s.id}` })),
  );
}

// Why a documentation example has no "Use this" button; '' when it can be inserted.
export function exampleHint(example) {
  if (example.insertable) return "";
  switch (example.reason) {
    case "placeholder":
      return "This example contains a placeholder (...). Copy the parts you need by hand.";
    case "not-a-mapping":
      return /^\s*-/.test(example.text)
        ? "This example is a list. Add it from the Services tab instead."
        : "This example is not a settings block. Copy it by hand.";
    default:
      return "This example is not valid YAML on its own. Copy it by hand.";
  }
}
