// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";
import { expectBlockValue } from "test-utils/widget-assertions";

const { useWidgetAPI } = vi.hoisted(() => ({
  useWidgetAPI: vi.fn(),
}));

vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./interface";

describe("widgets/openwrt/methods/interface", () => {
  it("returns null while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });
    const { container } = renderWithProviders(<Component service={{ widget: { type: "openwrt" } }} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders status and byte counters when loaded", () => {
    useWidgetAPI.mockReturnValue({ data: { up: true, bytesTx: 100, bytesRx: 200 }, error: undefined });

    renderWithProviders(<Component service={{ widget: { type: "openwrt" } }} />, { settings: { hideErrors: false } });

    expect(screen.getByText("widget.status")).toBeInTheDocument();
    expect(screen.getByText("openwrt.bytesTx")).toBeInTheDocument();
    expect(screen.getByText("openwrt.bytesRx")).toBeInTheDocument();

    // t("common.bytes") mock returns the numeric value as a string.
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("openwrt.up")).toBeInTheDocument();
  });

  it("shows the original three blocks by default", () => {
    useWidgetAPI.mockReturnValue({
      data: { up: true, bytesTx: 1, bytesRx: 2, rxRate: 10, txRate: 20 },
      error: undefined,
    });
    const { container } = renderWithProviders(<Component service={{ widget: { type: "openwrt" } }} />, {
      settings: { hideErrors: false },
    });
    expect(container.querySelectorAll(".service-block")).toHaveLength(3);
  });

  it("renders rxRate and txRate when listed in fields", () => {
    useWidgetAPI.mockReturnValue({
      data: { up: true, bytesTx: 1, bytesRx: 2, rxRate: 1500, txRate: 250 },
      error: undefined,
    });
    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "openwrt", fields: ["widget.status", "rxRate", "txRate"] } }} />,
      { settings: { hideErrors: false } },
    );
    expectBlockValue(container, "openwrt.rxRate", 1500);
    expectBlockValue(container, "openwrt.txRate", 250);
  });

  it("renders a dash for rates that are not known yet", () => {
    useWidgetAPI.mockReturnValue({
      data: { up: true, bytesTx: 1, bytesRx: 2, rxRate: null, txRate: null },
      error: undefined,
    });
    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "openwrt", fields: ["rxRate", "txRate"] } }} />,
      { settings: { hideErrors: false } },
    );
    expectBlockValue(container, "openwrt.rxRate", "—");
    expectBlockValue(container, "openwrt.txRate", "—");
  });
});
