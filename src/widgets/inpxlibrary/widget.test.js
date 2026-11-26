import { describe, expect, it } from "vitest";

import { expectWidgetConfigShape } from "test-utils/widget-config";

import widget from "./widget";

describe("inpxlibrary widget config", () => {
  it("exports a valid widget config", () => {
    expectWidgetConfigShape(widget);
  });

  it("maps the public status endpoint and the per-user endpoints", () => {
    expect(widget.api).toBe("{url}/{endpoint}");
    expect(widget.mappings.IndexStatus).toMatchObject({ endpoint: "api/index-status" });
    expect(widget.mappings.Reading).toMatchObject({ endpoint: "api/library/continue", params: ["pageSize"] });
    expect(widget.mappings.Want).toMatchObject({ endpoint: "api/library/want", params: ["pageSize"] });
    expect(widget.mappings.Shelves).toMatchObject({ endpoint: "api/shelves" });
    expect(widget.mappings.ShelfBooks).toMatchObject({
      endpoint: "api/shelves/{shelfId}/books",
      segments: ["shelfId"],
    });
  });
});
