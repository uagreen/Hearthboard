import { describe, expect, it } from "vitest";

import { clampCount, countStates, downloadRows, formatEta, percentOf } from "./transmission-utils";

describe("widgets/transmission/transmission-utils", () => {
  it("clampCount limits to 1-20 and defaults to 5", () => {
    expect(clampCount(0)).toBe(1);
    expect(clampCount(99)).toBe(20);
    expect(clampCount(7)).toBe(7);
    expect(clampCount("x")).toBe(5);
    expect(clampCount(undefined)).toBe(5);
  });

  it("percentOf clamps and tolerates missing values", () => {
    expect(percentOf({ percentDone: 0.5 })).toBe(50);
    expect(percentOf({ percentDone: 1.4 })).toBe(100);
    expect(percentOf({ percentDone: -1 })).toBe(0);
    expect(percentOf({})).toBe(0);
    expect(percentOf({ percentDone: 0.12345 })).toBe(12.3);
  });

  it("formatEta formats seconds and hides unknown values", () => {
    expect(formatEta(-1)).toBe("");
    expect(formatEta(-2)).toBe("");
    expect(formatEta(undefined)).toBe("");
    expect(formatEta(45)).toBe("45s");
    expect(formatEta(125)).toBe("2m");
    expect(formatEta(11100)).toBe("3h 5m");
    expect(formatEta(2 * 86400 + 4 * 3600)).toBe("2d 4h");
  });

  it("countStates counts queued, paused and errored torrents", () => {
    const torrents = [{ status: 3 }, { status: 5 }, { status: 0 }, { status: 4, error: 2 }, { status: 6, error: 0 }];
    expect(countStates(torrents)).toEqual({ queued: 2, paused: 1, errored: 1 });
  });

  it("downloadRows keeps downloading and failed incomplete torrents, errored first, then fastest", () => {
    const torrents = [
      { id: 1, status: 4, rateDownload: 10, percentDone: 0.1 },
      { id: 2, status: 6, rateDownload: 0, percentDone: 1 },
      { id: 3, status: 4, rateDownload: 50, percentDone: 0.2 },
      { id: 4, status: 0, error: 3, rateDownload: 0, percentDone: 0.3 },
      { id: 5, status: 6, error: 1, rateDownload: 0, percentDone: 1 },
    ];
    expect(downloadRows(torrents, 10).map((t) => t.id)).toEqual([4, 3, 1]);
    expect(downloadRows(torrents, 2).map((t) => t.id)).toEqual([4, 3]);
  });
});
