import { describe, expect, it } from "vitest";

import { expectWidgetConfigShape } from "test-utils/widget-config";

import widget from "./widget";

describe("jellyfin widget config", () => {
  it("exports a valid widget config", () => {
    expectWidgetConfigShape(widget);
  });

  it("maps the library endpoints without the removed emby/ prefix", () => {
    expect(widget.mappings.Users).toMatchObject({ endpoint: "Users" });
    expect(widget.mappings.Views).toMatchObject({ endpoint: "UserViews", params: ["userId"] });
    expect(widget.mappings.Latest).toMatchObject({
      endpoint: "Items/Latest",
      params: ["userId", "parentId", "limit"],
    });
    expect(widget.mappings.Resume).toMatchObject({
      endpoint: "UserItems/Resume",
      params: ["userId", "limit", "includeItemTypes"],
    });
    for (const name of ["Users", "Views", "Latest", "Resume"]) {
      expect(widget.mappings[name].endpoint.startsWith("emby/")).toBe(false);
    }
  });
});
