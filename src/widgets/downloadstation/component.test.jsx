// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";
import { expectBlockValue } from "test-utils/widget-assertions";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/downloadstation/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders placeholders while tasks are missing", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "downloadstation" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".service-block")).toHaveLength(4);
    expect(screen.getByText("downloadstation.leech")).toBeInTheDocument();
    expect(screen.getByText("downloadstation.download")).toBeInTheDocument();
    expect(screen.getByText("downloadstation.seed")).toBeInTheDocument();
    expect(screen.getByText("downloadstation.upload")).toBeInTheDocument();
  });

  it("computes leech/seed counts and total upload/download rates", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        data: {
          tasks: [
            { size: 10, additional: { transfer: { size_downloaded: 10, speed_download: 5, speed_upload: 1 } } },
            { size: 20, additional: { transfer: { size_downloaded: 5, speed_download: 6, speed_upload: 2 } } },
          ],
        },
      },
      error: undefined,
    });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "downloadstation" } }} />, {
      settings: { hideErrors: false },
    });

    // completed = 1, leech = 1
    expectBlockValue(container, "downloadstation.seed", 1);
    expectBlockValue(container, "downloadstation.leech", 1);
    expectBlockValue(container, "downloadstation.download", 11);
    expectBlockValue(container, "downloadstation.upload", 3);
  });

  describe("downloads list", () => {
    const transfer = (downloaded, speed) => ({ transfer: { size_downloaded: downloaded, speed_download: speed } });
    const tasks = [
      { id: "a", title: "Ubuntu ISO", size: 100, status: "downloading", additional: transfer(42, 2048) },
      { id: "b", title: "Broken one", size: 100, status: "error", additional: transfer(10, 0) },
      { id: "c", title: "Seeding one", size: 100, status: "seeding", additional: transfer(100, 0) },
    ];
    const render = (widget, list = tasks) => {
      useWidgetAPI.mockReturnValue({ data: { data: { tasks: list } }, error: undefined });
      return renderWithProviders(<Component service={{ widget: { type: "downloadstation", ...widget } }} />, {
        settings: { hideErrors: false },
      });
    };

    it("does not render the accordion without showDownloads", () => {
      const { container } = render({});
      expect(container.querySelector("details")).toBeNull();
    });

    it("renders a progress bar per downloading or failed task", () => {
      render({ showDownloads: true });
      const bars = screen.getAllByRole("progressbar");
      expect(bars).toHaveLength(2);
      expect(screen.getByText("Ubuntu ISO")).toBeInTheDocument();
      expect(bars.some((bar) => bar.getAttribute("aria-valuenow") === "42")).toBe(true);
      expect(screen.queryByText("Seeding one")).toBeNull();
    });

    it("lists the failed task first with the error text", () => {
      render({ showDownloads: true });
      const titles = screen.getAllByText(/Ubuntu ISO|Broken one/).map((el) => el.textContent);
      expect(titles).toEqual(["Broken one", "Ubuntu ISO"]);
      expect(screen.getByText("downloadstation.error")).toBeInTheDocument();
    });

    it("limits rows to downloadsCount", () => {
      render({ showDownloads: true, downloadsCount: 1 });
      expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    });

    it("opens the accordion when expandSections is set", () => {
      const { container } = render({ showDownloads: true, expandSections: true });
      expect(container.querySelector("details").open).toBe(true);
    });

    it("shows a hint when nothing is downloading", () => {
      render({ showDownloads: true }, [tasks[2]]);
      expect(screen.getByText("downloadstation.no_downloads")).toBeInTheDocument();
    });

    it("tolerates a task without a title or size", () => {
      render({ showDownloads: true }, [{ id: "z", status: "downloading" }]);
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    });
  });
});
