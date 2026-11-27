# Shared ProgressRow and Download Station downloads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the Transmission download row into a shared `ProgressRow`, then give Download Station a downloads accordion with progress bars.

**Architecture:** `ProgressRow` in `src/components/services/widget/`. Pure helpers in `downloadstation-utils.js`. The component renders blocks plus a `<details>` list; options pass through `cleanServiceGroups`.

**Tech Stack:** Next.js pages router, React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-27-synology-widgets-design.md`

## Global Constraints

- Options: `showDownloads` (default false), `downloadsCount` (1-20, default 5), `expandSections` (default false).
- Transmission behaviour and its tests must not change.
- Prettier 3.3.3 + organize-imports (`scratchpad/prettier33`); `.jsx` tests with `--pool vmThreads`, node tests default pool; eslint runs in the background without a time limit; local imports go before `utils/...` imports (eslint import/order).
- Strings in `public/locales/en/common.json`; docs in `docs/widgets/services/downloadstation.md`.
- `title`/`status` task fields are from memory of the DS API, not verified: say so in the docs.

## Review Focus

- Task without `title`, `size` of 0 or missing: no `NaN%`, no crash.
- Percent above 100 or below 0: bar clamped.
- No downloading tasks: a hint, not an empty accordion.
- `downloadsCount` as a string from config: clamped to 1-20, default 5.
- Credentials never in the client payload.

---

### Task 1: Shared ProgressRow

**Files:**

- Create: `src/components/services/widget/progress-row.jsx`, `src/components/services/widget/progress-row.test.jsx`
- Modify: `src/widgets/transmission/component.jsx`

**Interfaces:**

- Produces: `ProgressRow({ title: string, percent: number, details: string, error?: boolean, errorText?: string })`: header (truncated `title` with `title` attribute, `{percent}%`), `role="progressbar"` with `aria-valuemin=0`, `aria-valuemax=100`, `aria-valuenow={percent}` and a fill (`bg-red-500` when `error`, else `bg-emerald-500`, `style.width = percent%`), a `details` line, and `errorText` in red when `error` and present. Markup copied from Transmission's current `DownloadRow`.

- [x] **Step 1: Write failing tests** for `ProgressRow`: renders title, percent and details; `role=progressbar` `aria-valuenow`; error shows `errorText` and a red fill class; missing `title` does not crash.
- [x] **Step 2: Run** `pnpm vitest run --pool vmThreads src/components/services/widget/progress-row.test.jsx`. Expected: FAIL (module missing).
- [x] **Step 3: Implement** `progress-row.jsx`; make Transmission's `DownloadRow` a thin mapper to it (title ← name, percent ← `percentOf`, details ← the joined speed/eta/size string, error ← `error > 0`, errorText ← `errorString`).
- [x] **Step 4: Run** the new test and `pnpm vitest run --pool vmThreads src/widgets/transmission/component.test.jsx`. Expected: PASS (Transmission's 11 tests unchanged).
- [x] **Step 5: Commit** `refactor: shared ProgressRow component, Transmission uses it`.

### Task 2: Download Station helpers

**Files:**

- Create: `src/widgets/downloadstation/downloadstation-utils.js`, `src/widgets/downloadstation/downloadstation-utils.test.js`

**Interfaces:**

- Produces:

  - `clampCount(value) -> number` (integer 1-20, default 5).
  - `taskPercent(task) -> number`: `additional.transfer.size_downloaded / size * 100` clamped 0-100, one decimal; 0 when size missing or 0.
  - `taskRows(tasks: object[], count) -> object[]`: tasks with `status` `downloading` or `error`; errors first, then `additional.transfer.speed_download` descending; sliced to `clampCount(count)`.

- [x] **Step 1: Write failing tests** for the three functions with the cases from Review Focus.
- [x] **Step 2: Run** `pnpm vitest run src/widgets/downloadstation/downloadstation-utils.test.js`. Expected: FAIL.
- [x] **Step 3: Implement** the helpers.
- [x] **Step 4: Run** again. Expected: PASS.
- [x] **Step 5: Commit** `feat(downloadstation): helpers for task rows and progress`.

### Task 3: Component, options, strings

**Files:**

- Modify: `src/widgets/downloadstation/component.jsx`, `src/widgets/downloadstation/component.test.jsx`, `src/utils/config/service-helpers.js` (+ test), `public/locales/en/common.json`

**Interfaces:**

- Consumes: Tasks 1-2.
- Produces: options `showDownloads`, `downloadsCount`, `expandSections` for `type === "downloadstation"` (booleans `!!JSON.parse(...)`, count `Number(JSON.parse(...))`; add `downloadsCount` and `showDownloads` to the destructured names; `expandSections` already exists). Locale keys `downloadstation.downloads` "Downloads", `downloadstation.no_downloads` "Nothing is downloading", `downloadstation.error` "Error".

- [x] **Step 1: Write failing tests:** no accordion without `showDownloads`; a progress bar per downloading task with title and speed; an errored task listed first with the error text key; limit by `downloadsCount`; hint when nothing is downloading; task without title tolerated; `expandSections` opens the `<details>`; service-helpers passes the options and not `username`/`password`.
- [x] **Step 2: Run** component test with `--pool vmThreads`, service-helpers test with the default pool. Expected: new tests FAIL.
- [x] **Step 3: Implement** (accordion styled like `src/widgets/transmission/component.jsx`; details line: speed via `common.byterate`, status; error rows use `downloadstation.error` as `errorText`); add the service-helpers block after the transmission block; add locale keys.
- [x] **Step 4: Run** the same commands. Expected: PASS.
- [x] **Step 5: Commit** `feat(downloadstation): downloads accordion with progress bars`.

### Task 4: Docs and checks

**Files:**

- Modify: `docs/widgets/services/downloadstation.md`

- [x] **Step 1: Docs:** options with defaults, an example, a note that task `title`/`status` handling follows the Download Station API and was not tested against a live NAS.
- [x] **Step 2: Run** eslint (background, no limit) on changed files and prettier 3.3.3 `--check`. Expected: exit 0, no diffs.
- [x] **Step 3: Tick** this plan, format it with prettier 3.3.3, commit `docs(downloadstation): downloads accordion`.
