import { describe, expect, it } from "vitest";

import { computeRate, updateStatus, wantsField } from "./openwrt-utils";

const VERSIONS = {
  stable_version: "25.12.6",
  oldstable_version: "24.10.8",
  versions_list: ["25.12.6", "25.12.0-rc1", "24.10.8", "24.10.7", "23.05.6"],
};

describe("widgets/openwrt/openwrt-utils", () => {
  describe("computeRate", () => {
    it("is null without a previous sample", () => {
      expect(computeRate(undefined, 1000, 5000)).toBeNull();
    });

    it("returns whole bytes per second", () => {
      expect(computeRate({ bytes: 1000, at: 1000 }, 4000, 3000)).toBe(1500);
      expect(computeRate({ bytes: 0, at: 0 }, 10, 3000)).toBe(3);
    });

    it("is null after a counter reset", () => {
      expect(computeRate({ bytes: 5000, at: 1000 }, 100, 2000)).toBeNull();
    });

    it("is null when no time has passed", () => {
      expect(computeRate({ bytes: 1, at: 1000 }, 5, 1000)).toBeNull();
      expect(computeRate({ bytes: 1, at: 2000 }, 5, 1000)).toBeNull();
    });
  });

  describe("wantsField", () => {
    it("detects fields in an array, with or without the widget prefix", () => {
      expect(wantsField({ fields: ["uptime", "clients"] }, "clients")).toBe(true);
      expect(wantsField({ fields: ["openwrt.update"] }, "update")).toBe(true);
      expect(wantsField({ fields: ["uptime"] }, "clients")).toBe(false);
    });

    it("accepts a JSON string and tolerates missing fields", () => {
      expect(wantsField({ fields: '["clients"]' }, "clients")).toBe(true);
      expect(wantsField({}, "clients")).toBe(false);
      expect(wantsField({ fields: "not json" }, "clients")).toBe(false);
    });
  });

  describe("updateStatus", () => {
    it("reports a newer patch in the same series", () => {
      expect(updateStatus("24.10.7", VERSIONS)).toEqual({ state: "patch", latest: "24.10.8" });
    });

    it("reports a newer series when on the latest patch of an older one", () => {
      expect(updateStatus("24.10.8", VERSIONS)).toEqual({ state: "series", latest: "25.12.6" });
    });

    it("is up to date on the latest stable", () => {
      expect(updateStatus("25.12.6", VERSIONS)).toEqual({ state: "uptodate" });
    });

    it("is unknown for snapshots, release candidates and unknown series", () => {
      expect(updateStatus("SNAPSHOT", VERSIONS).state).toBe("unknown");
      expect(updateStatus("25.12.0-rc1", VERSIONS).state).toBe("unknown");
      expect(updateStatus("19.07.1", VERSIONS).state).toBe("unknown");
    });

    it("is unknown without a current version or a usable version list", () => {
      expect(updateStatus(undefined, VERSIONS).state).toBe("unknown");
      expect(updateStatus("24.10.7", null).state).toBe("unknown");
      expect(updateStatus("24.10.7", { stable_version: "25.12.6" }).state).toBe("unknown");
    });
  });
});
