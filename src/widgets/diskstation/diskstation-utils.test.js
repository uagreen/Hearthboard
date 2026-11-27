import { describe, expect, it } from "vitest";

import {
  connectionCount,
  diskRows,
  healthIssues,
  networkTotal,
  updateState,
  volumeRows,
  wantsField,
} from "./diskstation-utils";

const STORAGE = {
  data: {
    disks: [
      { id: "sda", name: "Drive 1", model: "WD Red", status: "normal", smart_status: "normal", temp: 35 },
      { id: "sdb", name: "Drive 2", model: "WD Red", status: "normal", smart_status: "warning" },
    ],
    volumes: [
      { id: "volume_1", status: "normal", size: { total: "1000", used: "250" } },
      { id: "volume_2", status: "degraded", size: { total: "0", used: "0" } },
    ],
  },
};

describe("widgets/diskstation/diskstation-utils", () => {
  it("wantsField detects fields with or without the widget prefix and in JSON strings", () => {
    expect(wantsField({ fields: ["uptime", "update"] }, "update")).toBe(true);
    expect(wantsField({ fields: ["diskstation.users"] }, "users")).toBe(true);
    expect(wantsField({ fields: '["users"]' }, "users")).toBe(true);
    expect(wantsField({ fields: ["uptime"] }, "users")).toBe(false);
    expect(wantsField({}, "users")).toBe(false);
    expect(wantsField({ fields: "broken" }, "users")).toBe(false);
  });

  it("volumeRows parses sizes and clamps the percentage", () => {
    expect(volumeRows(STORAGE)).toEqual([
      { id: "volume_1", percent: 25, used: 250, total: 1000, status: "normal" },
      { id: "volume_2", percent: 0, used: 0, total: 0, status: "degraded" },
    ]);
    expect(volumeRows(undefined)).toEqual([]);
    expect(volumeRows({ data: {} })).toEqual([]);
  });

  it("diskRows keeps a missing temperature as null", () => {
    const rows = diskRows(STORAGE);
    expect(rows[0]).toEqual({
      id: "sda",
      name: "Drive 1",
      model: "WD Red",
      temp: 35,
      status: "normal",
      smart: "normal",
    });
    expect(rows[1].temp).toBeNull();
    expect(diskRows(undefined)).toEqual([]);
  });

  it("healthIssues counts disks and volumes that are not normal", () => {
    // disk 2 (smart warning) + volume_2 (degraded)
    expect(healthIssues(STORAGE)).toBe(2);
    expect(healthIssues({ data: { disks: [{ status: "normal" }], volumes: [{ status: "normal" }] } })).toBe(0);
    expect(healthIssues(undefined)).toBeNull();
    expect(healthIssues({ data: {} })).toBeNull();
  });

  it("networkTotal reads the total entry", () => {
    const utilization = {
      data: {
        network: [
          { device: "eth0", rx: 1, tx: 2 },
          { device: "total", rx: 300, tx: 40 },
        ],
      },
    };
    expect(networkTotal(utilization)).toEqual({ down: 300, up: 40 });
    expect(networkTotal({ data: { network: [{ device: "eth0", rx: 1, tx: 2 }] } })).toBeNull();
    expect(networkTotal(undefined)).toBeNull();
  });

  it("updateState reads the upgrade check", () => {
    expect(updateState({ data: { update: { available: true, version: "DSM 7.2.2" } } })).toEqual({
      state: "available",
      version: "DSM 7.2.2",
    });
    expect(updateState({ data: { available: false } })).toEqual({ state: "uptodate" });
    expect(updateState({ data: {} }).state).toBe("unknown");
    expect(updateState(undefined).state).toBe("unknown");
  });

  it("connectionCount prefers the total, then the list length, else null", () => {
    expect(connectionCount({ data: { total: 4, items: [1] } })).toBe(4);
    expect(connectionCount({ data: { items: [1, 2] } })).toBe(2);
    expect(connectionCount({ data: {} })).toBeNull();
    expect(connectionCount(undefined)).toBeNull();
  });
});
