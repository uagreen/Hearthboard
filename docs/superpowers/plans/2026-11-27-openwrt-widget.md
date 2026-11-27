# OpenWrt clients, WAN rate and update status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The openwrt widget shows connected DHCP clients, WAN rx/tx rate and firmware update status, with per-router session tokens.

**Architecture:** Pure helpers in `openwrt-utils.js` (version comparison, rate, field detection). `proxy.js` uses them, adds extra ubus calls only when the matching field is requested. Components render new blocks.

**Tech Stack:** Next.js pages router, ubus JSON-RPC, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-27-openwrt-widget-design.md`

## Global Constraints

- New fields: system mode `clients`, `update`; interface mode `rxRate`, `txRate`. Defaults unchanged (`uptime`,`cpuLoad` / `widget.status`,`bytesTx`,`bytesRx`).
- `clients`/`update` are fetched only when listed in `fields`; `checkUpdates: false` disables the internet request.
- Update source: `https://downloads.openwrt.org/.versions.json`, cached 12 h; failure cached 15 min.
- Prettier 3.3.3 + organize-imports (`scratchpad/prettier33`); `.jsx` tests with `--pool vmThreads`, node tests default pool; no new service-helpers options (all server-side).
- Strings in `public/locales/en/common.json`; docs in `docs/widgets/services/openwrt.md`.

## Review Focus

- First poll / counter reset / zero elapsed time: rate is `null`, never negative or `NaN`.
- Snapshot, rc or unknown version string: status `unknown`, no crash.
- ACL denies `luci-rpc` or `system board`: `clients`/`update` are `null`, other fields still render.
- `.versions.json` unreachable or malformed: `update` `unknown`, widget still works.
- Two routers on one dashboard: tokens do not clash.

---

### Task 1: Helpers

**Files:**

- Create: `src/widgets/openwrt/openwrt-utils.js`, `src/widgets/openwrt/openwrt-utils.test.js`

**Interfaces:**

- Produces:

  - `computeRate(prev: {bytes:number, at:number}|undefined, bytes: number, at: number) -> number|null` (bytes/s; `null` if no prev, `at <= prev.at`, or `bytes < prev.bytes`).
  - `wantsField(widget: object, name: string) -> boolean` (`widget.fields` array or JSON string; entry `name` or `openwrt.<name>`).
  - `updateStatus(current: string|undefined, versions: object|null) -> {state: "uptodate"|"patch"|"series"|"unknown", latest?: string}`. Series = `major.minor`; `patch` when a non-rc version of the same series in `versions_list` is greater (latest returned); else `series` when `stable_version`'s series is newer (latest = stable_version); else `uptodate`. Non-numeric current (`SNAPSHOT`, `-rc`), missing/malformed `versions`, or a series absent from the list → `unknown`.

- [x] **Step 1: Write failing tests**: `computeRate` (first sample, normal, counter reset, same timestamp, rounding to integer); `wantsField` (array, `openwrt.clients`, JSON string, absent fields); `updateStatus` with a fixture `{stable_version:"25.12.6", oldstable_version:"24.10.8", versions_list:["25.12.6","25.12.0-rc1","24.10.8","24.10.7","23.05.6"]}`: `24.10.7`→patch/24.10.8, `24.10.8`→series/25.12.6, `25.12.6`→uptodate, `SNAPSHOT`→unknown, `25.12.0-rc1`→unknown, `19.07.1`→unknown, `null` versions→unknown, `undefined` current→unknown.
- [x] **Step 2: Run** `pnpm vitest run src/widgets/openwrt/openwrt-utils.test.js`. Expected: FAIL (module missing).
- [x] **Step 3: Implement** the three functions in `openwrt-utils.js`; compare versions numerically per segment.
- [x] **Step 4: Run** again. Expected: PASS.
- [x] **Step 5: Commit** `feat(openwrt): helpers for rates, field detection and firmware status`.

### Task 2: Proxy

**Files:**

- Modify: `src/widgets/openwrt/proxy.js`, `src/widgets/openwrt/proxy.test.js`

**Interfaces:**

- Consumes: Task 1 helpers.
- Produces: interface response gains `rxRate`, `txRate` (number|null). System response gains `clients` (number|null) when `wantsField(widget,"clients")` and `update` (`{state, latest?}`|null) when `wantsField(widget,"update")` and `widget.checkUpdates` is not `false`/`"false"`. Session token stored per `widget.url`. Rate samples stored per `${url}|${interfaceName}`.
- Ubus calls: `["call", token, "luci-rpc", "getDHCPLeases", {}]` → `[0, {dhcp_leases:[…]}]`; `system board` → `[0, {release:{version}}]`. First element non-zero → `null`. Versions fetched with `httpProxy(new URL("https://downloads.openwrt.org/.versions.json"), {method:"GET"})`, cached in module state (12 h ok, 15 min failure); tests reset cache via an exported `resetOpenwrtCaches()`.

- [x] **Step 1: Write failing tests** (mock `utils/proxy/http` `httpProxy`): `returns rxRate/txRate null on the first poll and numbers on the second` (fake `Date.now`), `rate is null after a counter reset`, `clients counts dhcp_leases when fields include clients`, `clients is null when luci-rpc is denied`, `does not call luci-rpc or system board without the fields`, `update is patch for an older version in the same series`, `update is unknown when versions.json fails`, `checkUpdates false skips the internet request`, `tokens are kept per router` (two urls login separately and each reuses its own token).
- [x] **Step 2: Run** `pnpm vitest run src/widgets/openwrt/proxy.test.js`. Expected: new tests FAIL, the existing login test still passes.
- [x] **Step 3: Implement** in `proxy.js`: replace the global `authToken` with a `Map` keyed by `widget.url` (default token `00000000000000000000000000000000`), pass the widget into `fetchData`/`login`; add `fetchClients`, `fetchUpdate`, rate computation in `fetchInterface`; export `resetOpenwrtCaches`.
- [x] **Step 4: Run** the same command. Expected: PASS.
- [x] **Step 5: Commit** `feat(openwrt): clients, WAN rate and update status in the proxy, per-router tokens`.

### Task 3: Components and strings

**Files:**

- Modify: `src/widgets/openwrt/methods/system.jsx`, `methods/system.test.jsx`, `methods/interface.jsx`, `methods/interface.test.jsx`, `public/locales/en/common.json`

**Interfaces:**

- Consumes: response fields from Task 2.
- Produces: blocks `openwrt.clients`, `openwrt.update` (system); `openwrt.rxRate`, `openwrt.txRate` (interface). Locale keys `openwrt.clients` "Clients", `openwrt.update` "Firmware", `openwrt.rxRate` "Download", `openwrt.txRate` "Upload", `openwrt.up_to_date` "Up to date", `openwrt.update_patch` "Update: {{version}}", `openwrt.update_series` "New series {{version}}", `openwrt.update_unknown` "Unknown".

- [x] **Step 1: Write failing tests**: system renders clients value and "—" for `null`; update texts for the four states (translation keys via the mocked `t`, check the existing test helper behaviour first); interface renders `rxRate`/`txRate` with `common.byterate` and "—" for `null`; defaults still render only the original blocks (system: 2, interface: 3 incl. `widget.status`) and the new blocks appear when listed in `fields`.
- [x] **Step 2: Run** with `--pool vmThreads` on both test files. Expected: new tests FAIL.
- [x] **Step 3: Implement** with `withWidgetFields(service, DEFAULT, 4|5)` and the new `Block`s; add locale keys.
- [x] **Step 4: Run** the same. Expected: PASS.
- [x] **Step 5: Commit** `feat(openwrt): blocks for clients, firmware status and WAN rates`.

### Task 4: Docs and checks

**Files:**

- Modify: `docs/widgets/services/openwrt.md`

- [x] **Step 1: Docs:** fields per mode, `checkUpdates`, an example (`interfaceName: wan` with `fields`), ACL additions (`system: ["info","board"]`, `luci-rpc: ["getDHCPLeases"]`), notes: clients = DHCP leases only, speed needs two polls, update check contacts downloads.openwrt.org, packages are not checked.
- [x] **Step 2: Run** eslint on changed files and prettier 3.3.3 `--check`. Expected: exit 0, no diffs.
- [x] **Step 3: Tick** this plan's boxes, format it with prettier 3.3.3, commit `docs(openwrt): new fields, ACL and update check`.
