// Portions derived from homepage-editor, © jchisholm59 (MIT). See NOTICE.
import pkg from "../../../../package.json";

import { assertMethod, withEditor } from "utils/editor/guard";

async function handler(req, res) {
  assertMethod(req, "GET");
  return res.status(200).json({
    homepageVersion: pkg.upstreamVersion ?? pkg.version,
    version: pkg.version,
    password: Boolean(process.env.EDITOR_PASSWORD),
    canRestart: Boolean(process.env.DOCKER_PROXY),
  });
}

export default withEditor(handler);
