// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";
import { expectBlockValue } from "test-utils/widget-assertions";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

const NONE = { data: undefined, error: undefined };

// answers by endpoint; "" (disabled) and unknown endpoints behave like an idle request
const respond = (responses) =>
  useWidgetAPI.mockImplementation((widget, endpoint) => (endpoint && responses[endpoint]) || NONE);

const BASE = {
  system_info: {
    data: { data: { up_time: "48:00:00", sys_temp: 41, firmware_ver: "DSM 7.2.1-69057" } },
    error: undefined,
  },
  system_storage: {
    data: { data: { vol_info: [{ name: "vol1", used_size: "20", total_size: "100" }] } },
    error: undefined,
  },
  utilization: {
    data: {
      data: {
        cpu: { user_load: "10", system_load: "5" },
        memory: { real_usage: "25" },
        network: [
          { device: "eth0", rx: 1, tx: 2 },
          { device: "total", rx: 3000, tx: 400 },
        ],
      },
    },
    error: undefined,
  },
};

const STORAGE = {
  data: {
    data: {
      disks: [
        { id: "sda", name: "Drive 1", model: "WD Red", status: "normal", smart_status: "normal", temp: 35 },
        { id: "sdb", name: "Drive 2", model: "WD Blue", status: "normal", smart_status: "warning" },
      ],
      volumes: [
        { id: "volume_1", status: "normal", size: { total: "1000", used: "250" } },
        { id: "volume_2", status: "degraded", size: { total: "500", used: "400" } },
      ],
    },
  },
  error: undefined,
};

const render = (widget = {}) =>
  renderWithProviders(<Component service={{ widget: { type: "diskstation", ...widget } }} />, {
    settings: { hideErrors: false },
  });

const requested = () => useWidgetAPI.mock.calls.map((call) => call[1]).filter(Boolean);

describe("widgets/diskstation/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders placeholders while loading", () => {
    respond({});

    const { container } = render();

    expect(container.querySelectorAll(".service-block")).toHaveLength(4);
    expect(screen.getByText("diskstation.uptime")).toBeInTheDocument();
    expect(screen.getByText("diskstation.volumeAvailable")).toBeInTheDocument();
    expect(screen.getByText("resources.cpu")).toBeInTheDocument();
    expect(screen.getByText("resources.mem")).toBeInTheDocument();
  });

  it("computes uptime days, volume free bytes, and CPU/memory usage", () => {
    respond(BASE);

    const { container } = render({ volume: "vol1" });

    expectBlockValue(container, "diskstation.uptime", "2 diskstation.days");
    expectBlockValue(container, "diskstation.volumeAvailable", 80);
    expectBlockValue(container, "resources.cpu", 15);
    expectBlockValue(container, "resources.mem", 25);
  });

  it("shows only the four original blocks and requests nothing extra by default", () => {
    respond({ ...BASE, storage_info: STORAGE });

    const { container } = render();

    expect(container.querySelectorAll(".service-block")).toHaveLength(4);
    expect(container.querySelector("details")).toBeNull();
    expect(requested()).not.toContain("storage_info");
    expect(requested()).not.toContain("upgrade");
    expect(requested()).not.toContain("connections");
  });

  it("renders temperature, firmware and network from the existing requests", () => {
    respond(BASE);

    const { container } = render({ fields: ["temperature", "firmware", "networkDown", "networkUp"] });

    expectBlockValue(container, "diskstation.temperature", 41);
    expectBlockValue(container, "diskstation.firmware", "DSM 7.2.1-69057");
    expectBlockValue(container, "diskstation.networkDown", 3000);
    expectBlockValue(container, "diskstation.networkUp", 400);
  });

  it("requests storage_info only for diskHealth and counts the issues", () => {
    respond({ ...BASE, storage_info: STORAGE });

    const { container } = render({ fields: ["diskHealth"] });

    expect(requested()).toContain("storage_info");
    expect(requested()).not.toContain("upgrade");
    // disk 2 (smart warning) and volume_2 (degraded)
    expectBlockValue(container, "diskstation.diskHealth", "diskstation.health_issues");
  });

  it("reports healthy storage as OK", () => {
    respond({
      ...BASE,
      storage_info: {
        data: { data: { disks: [{ status: "normal" }], volumes: [{ status: "normal", size: {} }] } },
        error: undefined,
      },
    });

    const { container } = render({ fields: ["diskHealth"] });

    expectBlockValue(container, "diskstation.diskHealth", "diskstation.health_ok");
  });

  it.each([
    [{ data: { update: { available: true, version: "DSM 7.2.2" } } }, "diskstation.update_available"],
    [{ data: { update: { available: false } } }, "diskstation.up_to_date"],
    [{ data: {} }, "diskstation.update_unknown"],
  ])("renders the DSM update state %j", (upgrade, text) => {
    respond({ ...BASE, upgrade: { data: upgrade, error: undefined } });

    const { container } = render({ fields: ["update"] });

    expect(requested()).toContain("upgrade");
    expectBlockValue(container, "diskstation.update", text);
  });

  it("renders the user count and a dash when it is unknown", () => {
    respond({ ...BASE, connections: { data: { data: { total: 3 } }, error: undefined } });
    const { container, unmount } = render({ fields: ["users"] });
    expect(requested()).toContain("connections");
    expectBlockValue(container, "diskstation.users", 3);
    unmount();

    respond({ ...BASE, connections: { data: { data: {} }, error: undefined } });
    const second = render({ fields: ["users"] });
    expectBlockValue(second.container, "diskstation.users", "—");
  });

  it("keeps the other blocks when an optional endpoint fails", () => {
    respond({ ...BASE, upgrade: { data: undefined, error: { message: "denied" } } });

    const { container } = render({ fields: ["uptime", "update", "temperature"] });

    expectBlockValue(container, "diskstation.update", "—");
    expectBlockValue(container, "diskstation.temperature", 41);
    expectBlockValue(container, "diskstation.uptime", "2 diskstation.days");
  });

  it("renders a progress bar and status per volume", () => {
    respond({ ...BASE, storage_info: STORAGE });

    render({ showVolumes: true });

    expect(requested()).toContain("storage_info");
    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("volume_2")).toBeInTheDocument();
  });

  it("renders every disk with model and temperature, tolerating a missing temperature", () => {
    respond({ ...BASE, storage_info: STORAGE });

    render({ showDisks: true });

    expect(screen.getByText(/Drive 1/)).toBeInTheDocument();
    expect(screen.getByText(/WD Red/)).toBeInTheDocument();
    expect(screen.getByText(/35/)).toBeInTheDocument();
    expect(screen.getByText(/Drive 2/)).toBeInTheDocument();
  });

  it("shows empty-state hints", () => {
    respond({ ...BASE, storage_info: { data: { data: { disks: [], volumes: [] } }, error: undefined } });

    render({ showVolumes: true, showDisks: true });

    expect(screen.getByText("diskstation.no_volumes")).toBeInTheDocument();
    expect(screen.getByText("diskstation.no_disks")).toBeInTheDocument();
  });

  it("opens the accordions when expandSections is set", () => {
    respond({ ...BASE, storage_info: STORAGE });

    const { container } = render({ showVolumes: true, showDisks: true, expandSections: true });

    const sections = container.querySelectorAll("details");
    expect(sections).toHaveLength(2);
    sections.forEach((section) => expect(section.open).toBe(true));
  });

  it("shows the error when a base request fails", () => {
    respond({ ...BASE, system_info: { data: undefined, error: { message: "boom" } } });

    const { container } = render();

    expect(container.querySelectorAll(".service-block")).toHaveLength(0);
  });
});
