import { describe, expect, it } from "vitest";

import { clampCount, taskPercent, taskRows } from "./downloadstation-utils";

const task = (over = {}) => ({
  id: "t",
  title: "x",
  size: 100,
  status: "downloading",
  additional: { transfer: { size_downloaded: 50, speed_download: 10 } },
  ...over,
});

describe("widgets/downloadstation/downloadstation-utils", () => {
  it("clampCount limits to 1-20 and defaults to 5", () => {
    expect(clampCount(0)).toBe(1);
    expect(clampCount(99)).toBe(20);
    expect(clampCount("7")).toBe(7);
    expect(clampCount("x")).toBe(5);
    expect(clampCount(undefined)).toBe(5);
  });

  it("taskPercent clamps and tolerates missing data", () => {
    expect(taskPercent(task())).toBe(50);
    expect(taskPercent(task({ additional: { transfer: { size_downloaded: 250 } } }))).toBe(100);
    expect(taskPercent(task({ additional: { transfer: { size_downloaded: -5 } } }))).toBe(0);
    expect(taskPercent(task({ size: 0 }))).toBe(0);
    expect(taskPercent(task({ size: undefined }))).toBe(0);
    expect(taskPercent({})).toBe(0);
    expect(taskPercent(task({ size: 3, additional: { transfer: { size_downloaded: 1 } } }))).toBe(33.3);
  });

  it("taskRows keeps downloading and failed tasks, errors first, then fastest", () => {
    const tasks = [
      task({ id: "slow", additional: { transfer: { size_downloaded: 1, speed_download: 5 } } }),
      task({ id: "done", status: "finished" }),
      task({ id: "fast", additional: { transfer: { size_downloaded: 1, speed_download: 50 } } }),
      task({ id: "broken", status: "error", additional: { transfer: { size_downloaded: 1, speed_download: 0 } } }),
      task({ id: "seed", status: "seeding" }),
    ];
    expect(taskRows(tasks, 10).map((t) => t.id)).toEqual(["broken", "fast", "slow"]);
    expect(taskRows(tasks, 2).map((t) => t.id)).toEqual(["broken", "fast"]);
    expect(taskRows(undefined, 5)).toEqual([]);
  });
});
