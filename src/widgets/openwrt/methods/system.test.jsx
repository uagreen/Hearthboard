// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";
import { expectBlockValue } from "test-utils/widget-assertions";

const { useWidgetAPI } = vi.hoisted(() => ({
  useWidgetAPI: vi.fn(),
}));

vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./system";

describe("widgets/openwrt/methods/system", () => {
  it("returns null while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });
    const { container } = renderWithProviders(<Component service={{ widget: { type: "openwrt" } }} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders uptime and cpu load when loaded", () => {
    useWidgetAPI.mockReturnValue({ data: { uptime: 123, cpuLoad: "0.5" }, error: undefined });

    renderWithProviders(<Component service={{ widget: { type: "openwrt" } }} />, { settings: { hideErrors: false } });

    expect(screen.getByText("openwrt.uptime")).toBeInTheDocument();
    expect(screen.getByText("openwrt.cpuLoad")).toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();
    expect(screen.getByText("0.5")).toBeInTheDocument();
  });

  it("shows only uptime and load by default", () => {
    useWidgetAPI.mockReturnValue({ data: { uptime: 1, cpuLoad: "0.1", clients: 4 }, error: undefined });
    const { container } = renderWithProviders(<Component service={{ widget: { type: "openwrt" } }} />, {
      settings: { hideErrors: false },
    });
    expect(container.querySelectorAll(".service-block")).toHaveLength(2);
  });

  it("renders the clients count when listed in fields", () => {
    useWidgetAPI.mockReturnValue({ data: { uptime: 1, cpuLoad: "0.1", clients: 4 }, error: undefined });
    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "openwrt", fields: ["uptime", "clients"] } }} />,
      { settings: { hideErrors: false } },
    );
    expectBlockValue(container, "openwrt.clients", 4);
  });

  it("renders a dash for unknown clients", () => {
    useWidgetAPI.mockReturnValue({ data: { uptime: 1, cpuLoad: "0.1", clients: null }, error: undefined });
    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "openwrt", fields: ["clients"] } }} />,
      { settings: { hideErrors: false } },
    );
    expectBlockValue(container, "openwrt.clients", "—");
  });

  it.each([
    [{ state: "uptodate" }, "openwrt.up_to_date"],
    [{ state: "patch", latest: "24.10.8" }, "openwrt.update_patch"],
    [{ state: "series", latest: "25.12.6" }, "openwrt.update_series"],
    [{ state: "unknown" }, "openwrt.update_unknown"],
  ])("renders the firmware status %j", (update, text) => {
    useWidgetAPI.mockReturnValue({ data: { uptime: 1, cpuLoad: "0.1", update }, error: undefined });
    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "openwrt", fields: ["update"] } }} />,
      { settings: { hideErrors: false } },
    );
    expectBlockValue(container, "openwrt.update", text);
  });

  it("renders a dash when the firmware status was not requested or disabled", () => {
    useWidgetAPI.mockReturnValue({ data: { uptime: 1, cpuLoad: "0.1" }, error: undefined });
    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "openwrt", fields: ["update"] } }} />,
      { settings: { hideErrors: false } },
    );
    expectBlockValue(container, "openwrt.update", "—");
  });
});
