// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";
import { expectBlockValue } from "test-utils/widget-assertions";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/transmission/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders placeholders while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "transmission" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".service-block")).toHaveLength(4);
    expect(screen.getByText("transmission.leech")).toBeInTheDocument();
    expect(screen.getByText("transmission.download")).toBeInTheDocument();
    expect(screen.getByText("transmission.seed")).toBeInTheDocument();
    expect(screen.getByText("transmission.upload")).toBeInTheDocument();
  });

  it("computes leech/seed counts and upload/download rates when loaded", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        arguments: {
          torrents: [
            { rateDownload: 10, rateUpload: 1, percentDone: 1 },
            { rateDownload: 5, rateUpload: 2, percentDone: 0.5 },
          ],
        },
      },
      error: undefined,
    });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "transmission" } }} />, {
      settings: { hideErrors: false },
    });

    expectBlockValue(container, "transmission.leech", 1);
    expectBlockValue(container, "transmission.seed", 1);
    expectBlockValue(container, "transmission.download", 15);
    expectBlockValue(container, "transmission.upload", 3);
  });

  describe("downloads and states", () => {
    const ALL = ["leech", "download", "seed", "upload", "queued", "paused", "errored"];
    const torrents = [
      {
        id: 1,
        name: "Ubuntu ISO",
        status: 4,
        percentDone: 0.42,
        rateDownload: 2048,
        rateUpload: 0,
        eta: 125,
        totalSize: 4096,
        error: 0,
      },
      {
        id: 2,
        name: "Broken one",
        status: 0,
        percentDone: 0.1,
        rateDownload: 0,
        rateUpload: 0,
        eta: -1,
        totalSize: 100,
        error: 2,
        errorString: "Tracker gave an error",
      },
      {
        id: 3,
        name: "Waiting",
        status: 3,
        percentDone: 0,
        rateDownload: 0,
        rateUpload: 0,
        eta: -1,
        totalSize: 100,
        error: 0,
      },
      {
        id: 4,
        name: "Seeding",
        status: 6,
        percentDone: 1,
        rateDownload: 0,
        rateUpload: 5,
        eta: -1,
        totalSize: 100,
        error: 0,
      },
    ];
    const render = (widget) => {
      useWidgetAPI.mockReturnValue({ data: { arguments: { torrents } }, error: undefined });
      return renderWithProviders(<Component service={{ widget: { type: "transmission", ...widget } }} />, {
        settings: { hideErrors: false },
      });
    };

    it("renders queued, paused and errored blocks", () => {
      const { container } = render({ fields: ALL });
      expectBlockValue(container, "transmission.queued", 1);
      expectBlockValue(container, "transmission.paused", 1);
      expectBlockValue(container, "transmission.errored", 1);
    });

    it("keeps the four original blocks by default", () => {
      const { container } = render({});
      expect(container.querySelectorAll(".service-block")).toHaveLength(4);
    });

    it("does not render the downloads accordion without showDownloads", () => {
      const { container } = render({});
      expect(container.querySelector("details")).toBeNull();
    });

    it("renders a progress bar per downloading torrent", () => {
      render({ showDownloads: true });
      const bars = screen.getAllByRole("progressbar");
      expect(bars).toHaveLength(2);
      expect(screen.getByText("Ubuntu ISO")).toBeInTheDocument();
      const ubuntu = bars.find((bar) => bar.getAttribute("aria-valuenow") === "42");
      expect(ubuntu).toBeTruthy();
      expect(screen.getByText(/2m/)).toBeInTheDocument();
    });

    it("renders the error text for an errored torrent", () => {
      render({ showDownloads: true });
      expect(screen.getByText("Tracker gave an error")).toBeInTheDocument();
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
      useWidgetAPI.mockReturnValue({ data: { arguments: { torrents: [torrents[3]] } }, error: undefined });
      renderWithProviders(<Component service={{ widget: { type: "transmission", showDownloads: true } }} />, {
        settings: { hideErrors: false },
      });
      expect(screen.getByText("transmission.no_downloads")).toBeInTheDocument();
    });

    it("tolerates a torrent without a name", () => {
      useWidgetAPI.mockReturnValue({
        data: { arguments: { torrents: [{ id: 9, status: 4, percentDone: 0.5, rateDownload: 1 }] } },
        error: undefined,
      });
      renderWithProviders(<Component service={{ widget: { type: "transmission", showDownloads: true } }} />, {
        settings: { hideErrors: false },
      });
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    });
  });
});
