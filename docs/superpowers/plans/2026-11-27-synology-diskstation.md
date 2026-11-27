# Disk Station health, volumes, update and network Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The diskstation widget gets temperature, firmware, DSM update, disk health, network and user-count fields plus volume and disk accordions.

**Architecture:** Three new mappings (`storage_info`, `upgrade`, `connections`) on the existing Synology proxy. Pure helpers in `diskstation-utils.js`. The component calls the new endpoints only when a field or accordion needs them (endpoint `""` disables the request) and renders `ProgressRow` for volumes.

**Tech Stack:** Next.js pages router, React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-27-synology-widgets-design.md`

**Depends on:** `docs/superpowers/plans/2026-11-27-synology-downloadstation.md` Task 1 (`ProgressRow`).

## Global Constraints

- New fields: `temperature`, `firmware`, `update`, `diskHealth`, `networkDown`, `networkUp`, `users`. Defaults stay `uptime`, `volumeAvailable`, `resources.cpu`, `resources.mem`.
- Options: `showVolumes`, `showDisks`, `expandSections` (all default false).
- New endpoints only when needed; nothing extra for existing configs.
- Missing permission or unexpected shape: the value is `—`, the rest renders.
- Prettier 3.3.3 + organize-imports (`scratchpad/prettier33`); `.jsx` tests with `--pool vmThreads`; eslint in the background without a time limit; local imports before `utils/...` imports.
- Strings in `public/locales/en/common.json`; docs in `docs/widgets/services/diskstation.md`.
- Unverified (say so in docs): `SYNO.Core.CurrentConnection` response keys, the values of disk/volume `status` and `smart_status`.

## Review Focus

- `network` without a `total` entry, `volumes` empty, `disks` missing: dashes or an empty-state hint, no crash.
- Volume `size.total` of 0 or strings: no `NaN%`.
- A disk with `temp` missing.
- API denied (error from the proxy) for one optional endpoint: the other blocks still render.
- Existing four blocks and the `volume` option unchanged.

---

### Task 1: Mappings and helpers

**Files:**

- Modify: `src/widgets/diskstation/widget.js`, `src/widgets/diskstation/widget.test.js`
- Create: `src/widgets/diskstation/diskstation-utils.js`, `src/widgets/diskstation/diskstation-utils.test.js`

**Interfaces:**

- Produces mappings: `storage_info` (`SYNO.Storage.CGI.Storage`, `load_info`), `upgrade` (`SYNO.Core.Upgrade.Server`, `check`), `connections` (`SYNO.Core.CurrentConnection`, `get`), each with `endpoint` equal to its key.
- Produces helpers:

  - `wantsField(widget, name) -> boolean` (`fields` array or JSON string; `name` or `diskstation.<name>`).
  - `volumeRows(storage) -> {id, percent, used, total, status}[]` from `data.volumes` (sizes parsed with `Number`, percent clamped 0-100, 0 when total is 0).
  - `diskRows(storage) -> {id, name, model, temp, status, smart}[]` from `data.disks` (`temp` null when missing).
  - `healthIssues(storage) -> number|null`: disks with `status` or `smart_status` not `normal` plus volumes with `status` not `normal`; `null` when there is no storage data.
  - `networkTotal(utilization) -> {down, up}|null` from the `network` entry with `device === "total"` (`rx` down, `tx` up).
  - `updateState(upgrade) -> {state: "uptodate"|"available"|"unknown", version?}` from `data.update ?? data`.
  - `connectionCount(connections) -> number|null`: `data.total` if a number, else `data.items.length`, else `null`.

- [x] **Step 1: Write failing tests** for each helper (fixtures from the spec's facts; missing/empty inputs return the documented neutral values) and for the three mappings in `widget.test.js`.
- [x] **Step 2: Run** `pnpm vitest run src/widgets/diskstation/diskstation-utils.test.js src/widgets/diskstation/widget.test.js`. Expected: FAIL.
- [x] **Step 3: Implement** the mappings and helpers.
- [x] **Step 4: Run** again. Expected: PASS.
- [x] **Step 5: Commit** `feat(diskstation): mappings and helpers for storage, upgrade and connections`.

### Task 2: Component, options, strings

**Files:**

- Modify: `src/widgets/diskstation/component.jsx`, `src/widgets/diskstation/component.test.jsx`, `src/utils/config/service-helpers.js` (+ test), `public/locales/en/common.json`

**Interfaces:**

- Consumes: Task 1 helpers; `ProgressRow` from `components/services/widget/progress-row`.
- Produces: blocks `diskstation.temperature|firmware|update|diskHealth|networkDown|networkUp|users`; accordions for `showVolumes`/`showDisks`; options `showVolumes`, `showDisks` (booleans) passed through `cleanServiceGroups` for `diskstation` (`expandSections` already destructured; add `showVolumes`, `showDisks` names; keep the `volume` block). Locale keys under `diskstation`: `temperature` "Temperature", `firmware` "DSM", `update` "Update", `diskHealth` "Disks", `networkDown` "Download", `networkUp` "Upload", `users` "Users", `volumes` "Volumes", `disks` "Disks", `health_ok` "OK", `health_issues` "{{count}} issues", `up_to_date` "Up to date", `update_available` "Update: {{version}}", `update_unknown` "Unknown", `no_volumes` "No volumes", `no_disks` "No disks".

- [x] **Step 1: Convert the existing tests** to mock `useWidgetAPI` by endpoint (`mockImplementation((widget, endpoint) => responses[endpoint])`, unknown endpoints return `{data: undefined, error: undefined}`); they must still assert the same values. Then add failing tests: new blocks render values from fixtures; each optional endpoint is requested only when needed (assert `useWidgetAPI` was not called with `storage_info`/`upgrade`/`connections` by default and was with the field set); `—` when data is missing or the endpoint errors; one failing optional endpoint does not hide the other blocks; the volumes accordion renders a progressbar per volume with status; the disks accordion renders model and temperature; empty-state hints; default render still 4 blocks; service-helpers passes `showVolumes`, `showDisks`, `expandSections` without credentials.
- [x] **Step 2: Run** component test with `--pool vmThreads`, service-helpers test with default pool. Expected: new tests FAIL, converted existing tests PASS.
- [x] **Step 3: Implement:** `withWidgetFields(service, DEFAULT_FIELDS, 11)`; hooks for the new endpoints called unconditionally with `""` when not needed; optional-endpoint errors are not propagated to the top-level `Container error`; accordions styled like `src/widgets/transmission/component.jsx`; add locale keys and the service-helpers lines.
- [x] **Step 4: Run** the same commands plus `pnpm vitest run src/utils/editor`. Expected: PASS.
- [x] **Step 5: Commit** `feat(diskstation): health, volumes, update, network and user fields`.

### Task 3: Docs and checks

**Files:**

- Modify: `docs/widgets/services/diskstation.md`

- [x] **Step 1: Docs:** allowed fields (eleven), options with defaults, an example config, what each field shows, the admin-account requirement, and the unverified items listed in Global Constraints.
- [x] **Step 2: Run** eslint (background, no limit) on changed files and prettier 3.3.3 `--check`. Expected: exit 0, no diffs.
- [x] **Step 3: Tick** this plan, format it with prettier 3.3.3, commit `docs(diskstation): new fields and accordions`.
