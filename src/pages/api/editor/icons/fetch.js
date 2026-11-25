// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import path from "node:path";

import { assertMethod, withEditor } from "utils/editor/guard";
import { fetchRemoteImage, storeIcon } from "utils/editor/icons";

// Download a remote image into config/icons (fixes sites that block hotlinking).
async function handler(req, res) {
  assertMethod(req, "POST");
  const { url, name } = req.body ?? {};
  const { buf, type, url: finalUrl } = await fetchRemoteImage(url);
  const file = storeIcon(name || path.basename(finalUrl.pathname), buf, type);
  return res.status(200).json({ file, ref: `/icons/${file}` });
}

export default withEditor(handler);
