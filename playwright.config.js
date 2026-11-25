// End-to-end smoke test for the editor UI. Runs a dev server with the editor on and a throw-away
// config directory (Homepage fills it with its skeleton files, like a fresh install).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { defineConfig } from "@playwright/test";

const PORT = 3100;
const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "hearthboard-e2e-"));

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120000,
  retries: 0,
  // The dev server compiles each route on first use, which is slow on a cold start.
  expect: { timeout: 60000 },
  use: { baseURL: `http://localhost:${PORT}`, browserName: "chromium" },
  webServer: {
    command: `pnpm editor:assets && pnpm exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/editor`,
    timeout: 300000,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      HOMEPAGE_EDITOR: "true",
      EDITOR_ALLOW_NO_AUTH: "true",
      HOMEPAGE_CONFIG_DIR: configDir,
      LOG_TARGETS: "stdout",
    },
  },
});
