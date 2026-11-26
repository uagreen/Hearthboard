# Transmission downloads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transmission widget gets a downloads accordion with progress bars, plus `queued`/`paused`/`errored` blocks and error rows.

**Architecture:** The existing proxy adds extra `torrent-get` fields only when `showDownloads` is set. Pure helpers in `transmission-utils.js` compute counts and rows. `component.jsx` renders blocks and a `<details>` accordion with progress bars. Options pass through `cleanServiceGroups`.

**Tech Stack:** Next.js pages router, React, SWR via `useWidgetAPI`, Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-26-transmission-downloads-design.md`

## Global Constraints

- Options: `showDownloads` (default false), `downloadsCount` (1-20, default 5), `expandSections` (default false).
- `fields` allowed: `["leech","download","seed","upload","queued","paused","errored"]`; defaults stay the first four.
- Without `showDownloads` the proxy request body stays byte-identical to today (`percentDone,status,rateDownload,rateUpload`).
- `username`/`password` never reach the browser.
- Formatting must pass prettier 3.3.3 + organize-imports (`scratchpad/prettier33`); `.jsx` tests run with `--pool vmThreads`, node tests with the default pool.
- Docs in `docs/widgets/services/transmission.md`; strings in `public/locales/en/common.json`.

## Review Focus

- Torrent with no `name`, `eta` of -1/-2, `totalSize` 0: no crash, no `NaN%`.
- `percentDone` outside 0-1: bar width clamped.
- Empty downloads list: a hint, not an empty accordion.
- `showDownloads` given as the string `"true"` (docker labels): proxy still adds fields.
- Many torrents: only `downloadsCount` rows rendered.

---

### Task 1: Proxy requests extra fields only when asked

**Files:**
- Modify: `src/widgets/transmission/proxy.js`
- Test: `src/widgets/transmission/proxy.test.js`

**Interfaces:**
- Produces: `torrent-get` body `fields` = base four, plus `["id","name","eta","totalSize","error","errorString"]` when `widget.showDownloads` is `true` or `"true"`.

- [x] **Step 1: Write failing tests** `requests extra torrent fields when showDownloads is true`, `... when showDownloads is the string "true"`, `keeps the original four fields when showDownloads is absent` (assert on `JSON.parse(httpProxy.mock.calls[0][1].body).arguments.fields`).
- [x] **Step 2: Run** `pnpm vitest run src/widgets/transmission/proxy.test.js` (default pool). Expected: the two new "extra fields" tests FAIL.
- [x] **Step 3: Implement** in `proxy.js`: `const BASE_FIELDS`, `const DOWNLOAD_FIELDS`, `const wantsDownloads = widget.showDownloads === true || widget.showDownloads === "true"`; build `fields` from them.
- [x] **Step 4: Run** the same command. Expected: all PASS.
- [x] **Step 5: Commit** `feat(transmission): request download fields when showDownloads is set`.

### Task 2: Helpers (counts, rows, ETA)

**Files:**
- Create: `src/widgets/transmission/transmission-utils.js`, `src/widgets/transmission/transmission-utils.test.js`

**Interfaces:**
- Produces:
  - `countStates(torrents: object[]) -> {queued: number, paused: number, errored: number}` (queued = status 3 or 5; paused = status 0; errored = `error > 0`).
  - `downloadRows(torrents: object[], count: number) -> object[]`: includes `status === 4` and incomplete (`percentDone < 1`) with `error > 0`; errored first, then `rateDownload` descending; sliced to `clampCount(count)`.
  - `clampCount(value) -> number`: integer 1-20, default 5 for non-numbers.
  - `percentOf(torrent) -> number`: `percentDone` clamped to 0-1, times 100, rounded to one decimal; 0 for missing/NaN.
  - `formatEta(seconds) -> string`: `""` for negative/non-number; else `"45s"`, `"12m"`, `"3h 5m"`, `"2d 4h"`.

- [x] **Step 1: Write failing tests** for each function including: `clampCount(0)`=1, `clampCount(99)`=20, `clampCount("x")`=5; `percentOf({percentDone: 1.4})`=100, `percentOf({})`=0; `formatEta(-1)`="", `formatEta(125)`="2m", `formatEta(11100)`="3h 5m"; `downloadRows` puts the errored torrent first, drops seeding ones, respects count; `countStates` on a mixed list.
- [x] **Step 2: Run** `pnpm vitest run src/widgets/transmission/transmission-utils.test.js`. Expected: FAIL (module missing).
- [x] **Step 3: Implement** the five functions in `transmission-utils.js`.
- [x] **Step 4: Run** again. Expected: PASS.
- [x] **Step 5: Commit** `feat(transmission): helpers for state counts, download rows and ETA`.

### Task 3: Component, options, locales

**Files:**
- Modify: `src/widgets/transmission/component.jsx`, `src/widgets/transmission/component.test.jsx`, `src/utils/config/service-helpers.js` (+ its test), `public/locales/en/common.json`

**Interfaces:**
- Consumes: Task 2 helpers; the proxy fields from Task 1.
- Produces: widget options `showDownloads`, `downloadsCount`, `expandSections` passed to the client for `type === "transmission"` (booleans via `!!JSON.parse(...)`, count via `Number(JSON.parse(...))`; `expandSections` already exists in the destructuring, so only add the `transmission` block and the new names `showDownloads`, `downloadsCount`). Blocks `transmission.queued|paused|errored`.

- [x] **Step 1: Write failing tests.** Component: `renders queued, paused and errored blocks`; `does not render the downloads accordion without showDownloads`; `renders a progress bar per downloading torrent` (role `progressbar`, `aria-valuenow`, name, ETA text); `renders the error text for an errored torrent`; `shows a hint when nothing is downloading`; `tolerates a torrent without a name`. Use `fields: [..seven..]` in the widget so the blocks are visible. `service-helpers`: `passes transmission options and not credentials`.
- [x] **Step 2: Run** component test with `--pool vmThreads` and the service-helpers test with the default pool. Expected: new tests FAIL.
- [x] **Step 3: Implement.** `component.jsx`: blocks `queued/paused/errored` from `countStates`; when `widget.showDownloads`, render `<details>` (style as in `src/widgets/inpxlibrary/component.jsx`, `open` from `expandSections`) under the Container with one row per `downloadRows(...)`: name (truncated, `title`), `div role="progressbar" aria-valuenow aria-valuemin=0 aria-valuemax=100` with a filled inner bar (red when `error > 0`), line with percent, `t("common.byterate")` speed, `formatEta`, `t("common.bytes")` size; errored rows show `errorString`. Add the `transmission` block in `service-helpers.js` after the `inpxlibrary` block and add `showDownloads`, `downloadsCount` to the destructured names. Add locale keys `transmission.queued|paused|errored|downloads|no_downloads`. Confirm in `Container` that blocks beyond the first four stay hidden unless named in `fields`; if not, rule and ledger.
- [x] **Step 4: Run** the same commands. Expected: PASS. Also run `pnpm vitest run src/utils/editor` (catalog) to see the `fields` list is unaffected.
- [x] **Step 5: Commit** `feat(transmission): downloads accordion with progress bars, state blocks and error rows`.

### Task 4: Docs, lint, format

**Files:**
- Modify: `docs/widgets/services/transmission.md`

- [x] **Step 1: Docs:** allowed fields (seven), the three options with defaults, an example config, a note that data comes from one `torrent-get` request, a note that ETA/progress is as Transmission reports.
- [x] **Step 2: Run** `npx eslint` on all changed files and prettier 3.3.3 `--check` on them (scratchpad install). Expected: exit 0, no diffs.
- [x] **Step 3: Tick** this plan's boxes and commit `docs(transmission): downloads accordion and new fields`.
