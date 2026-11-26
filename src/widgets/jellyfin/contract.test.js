import { describe, expect, it } from "vitest";

import widget from "./widget";

// Paths that exist in the Jellyfin OpenAPI spec 12.4.0 (https://api.jellyfin.org/openapi/jellyfin-openapi-stable.json,
// checked 2026-11-26). `/Users/{userId}/Views`, `/Users/{userId}/Items/Latest` and `/Users/{userId}/Items/Resume`
// are NOT in 12.4, and the `emby/` prefix was removed in 12.0.
const VERIFIED_12_4_PATHS = [
  "Sessions",
  "Items/Counts",
  "Sessions/{sessionId}/Playing/Pause",
  "Sessions/{sessionId}/Playing/Unpause",
  "Users",
  "UserViews",
  "Items/Latest",
  "UserItems/Resume",
];

describe("jellyfin widget contract with Jellyfin 12.x", () => {
  it("only maps endpoints that exist in Jellyfin 12.4 for the V2 and library mappings", () => {
    const names = ["SessionsV2", "CountV2", "UnpauseV2", "PauseV2", "Users", "Views", "Latest", "Resume"];
    for (const name of names) {
      const path = widget.mappings[name].endpoint.split("?")[0];
      expect(VERIFIED_12_4_PATHS, `${name} -> ${path}`).toContain(path);
    }
  });
});
