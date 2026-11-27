import { describe, expect, it } from "vitest";

import { expectWidgetConfigShape } from "test-utils/widget-config";

import widget from "./widget";

describe("diskstation widget config", () => {
  it("exports a valid widget config", () => {
    expectWidgetConfigShape(widget);
  });

  it("maps the storage, upgrade and connection endpoints", () => {
    expect(widget.mappings.storage_info).toMatchObject({
      apiName: "SYNO.Storage.CGI.Storage",
      apiMethod: "load_info",
      endpoint: "storage_info",
    });
    expect(widget.mappings.upgrade).toMatchObject({
      apiName: "SYNO.Core.Upgrade.Server",
      apiMethod: "check",
      endpoint: "upgrade",
    });
    expect(widget.mappings.connections).toMatchObject({
      apiName: "SYNO.Core.CurrentConnection",
      apiMethod: "get",
      endpoint: "connections",
    });
  });
});
