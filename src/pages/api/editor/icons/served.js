// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import { assertMethod, withEditor } from "utils/editor/guard";
import { localIcons } from "utils/editor/icons";

// Is config/icons actually served by Homepage at /icons/? (needs the extra Docker mount)
async function handler(req, res) {
  assertMethod(req, "GET");
  const sample = localIcons()[0];
  if (!sample) return res.status(200).json({ served: null, reason: "no local icons" });
  try {
    const base = process.env.HOMEPAGE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
    const r = await fetch(`${base.replace(/\/$/, "")}/icons/${encodeURIComponent(sample)}`, {
      signal: AbortSignal.timeout(5000),
    });
    return res
      .status(200)
      .json({ served: r.ok && /image|svg|octet/.test(r.headers.get("content-type") ?? ""), sample });
  } catch (e) {
    return res.status(200).json({ served: false, sample, reason: e.message });
  }
}

export default withEditor(handler);
