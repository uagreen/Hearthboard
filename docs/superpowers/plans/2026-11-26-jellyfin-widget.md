# Jellyfin widget: libraries, continue watching, recently added — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `jellyfin` service widget with three opt-in sections (library links, "continue watching" episodes, "recently added" per library), each item showing poster, title and rating, with a user switcher on the dashboard; document the Jellyfin ≥ 12 setup.

**Architecture:** Plan A of the spec: new proxy `mappings` in `src/widgets/jellyfin/widget.js` (same routes for `version` 1 and 2, header auth already sent by the proxy), pure helpers in `library-utils.js`, a new `LibrarySections` component in `library.jsx` mounted from `component.jsx`. Posters are loaded by the browser directly from `{service.href}/Items/{id}/Images/Primary` (anonymous endpoint); links point to `{href}/web/#/…`. New config options are passed to the client through `cleanServiceGroups` in `utils/config/service-helpers.js`.

**Tech Stack:** Next.js pages router, React, SWR via `useWidgetAPI`, Vitest + Testing Library (jsdom), docs in `docs/`.

**Spec:** `docs/superpowers/specs/2026-11-26-jellyfin-widget-design.md` (approved 2026-11-26; endpoints verified against OpenAPI 12.4.0).

## Global Constraints

- Everything new is **off by default**; existing configs and `version: 1` / Emby behaviour must not change (existing jellyfin/emby tests stay green unmodified).
- Option names and defaults exactly: `showLibraries` false, `showContinueWatching` false, `showLatest` false, `latestCount` 5, `continueCount` 5 (both clamped to 1–10), `user` (name, optional), `enableUserSwitch` true, `expandSections` false.
- Routes used (same for version 1 and 2): `Users`, `UserViews?userId`, `Items/Latest?userId&parentId&limit`, `UserItems/Resume?userId&limit&includeItemTypes=Episode`. Never `Users/{id}/Items/...` (absent in 12.x) and never the `emby/` prefix for new code.
- Rating is `CommunityRating` shown as `★ 7.8`; never labelled "IMDb". No external services; no image proxy; API key never reaches the browser.
- Library URL forms: movies `#/movies?topParentId=<id>&collectionType=movies`, tvshows `#/tv?topParentId=<id>&collectionType=tvshows`, music `#/music?topParentId=<id>&collectionType=music`, other/none `#/mixed?topParentId=<id>&collectionType=mixed`; item `#/details?id=<id>&serverId=<ServerId>`; base `{href}/web/`.
- Follow repo conventions: Prettier + ESLint clean, `src/**/*.test.*`, commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; do not commit `AGENTS.md` or `.osp/`; no PRs, no push without the author's say-so.
- Environment: `/mnt/e` is slow; run vitest with `--testTimeout 120000 --hookTimeout 120000`, one run at a time, never together with eslint. `localStorage` is broken in the Node 25 jsdom environment (known baseline failures), so tests must `vi.stubGlobal("localStorage", …)`.

## Review Focus

1. `href` missing, `"#"`, with trailing slash or a path prefix (`https://x/jf/`) → no crash; links and posters omitted or built correctly.
2. Item with no `ImageTags.Primary`, no `CommunityRating` (or `0`), episode without `SeriesId` → no broken `<img>`, no `★ undefined`.
3. `Users` request fails (non-admin key, 401/403) → no crash; falls back to configured `user`, else a visible hint.
4. Stored user id no longer exists on the server → falls back to configured `user`, then first user.
5. Library with zero recent items, many libraries, `latestCount`/`continueCount` of `0`, `99`, `"abc"` → clamped/defaulted.

---

### Task 1: Pass the new options to the client

**Files:**

- Modify: `src/utils/config/service-helpers.js` (the `["emby", "jellyfin"].includes(type)` block, ~line 586; and the destructured names list ~line 345)
- Test: `src/utils/config/service-helpers.test.js`

**Interfaces:**

- Produces: for `type: jellyfin`, `widget.showLibraries|showContinueWatching|showLatest|enableUserSwitch|expandSections: boolean`, `widget.latestCount|continueCount: number`, `widget.user: string`, present only when configured.

- [x] **Step 1: Write the failing test** `cleanServiceGroups passes jellyfin library options to the client` next to the existing jellyfin/emby option tests (copy their setup): a jellyfin widget with `showLibraries: true, showContinueWatching: true, showLatest: true, latestCount: 4, continueCount: 3, user: "anna", enableUserSwitch: false, expandSections: true` yields exactly those values; one with none of them yields none of those keys (`"showLatest" in widget === false`).
- [x] **Step 2: Run** `pnpm vitest run src/utils/config/service-helpers.test.js --testTimeout 120000 --hookTimeout 120000`. Expected: the new test FAILS (keys undefined), others pass.
- [x] **Step 3: Implement** the pass-through in the jellyfin block: booleans with `!!JSON.parse(x)`, counts with `Number(JSON.parse(x))`, `user` as string; add the names to the destructuring list under the existing `// emby, jellyfin` comment.
- [x] **Step 4: Run** the same command. Expected: PASS; run prettier + eslint on both files.
- [x] **Step 5: Commit** `feat(jellyfin): pass library section options to the widget client`

### Task 2: Proxy mappings and pure helpers

**Files:**

- Modify: `src/widgets/jellyfin/widget.js`
- Create: `src/widgets/jellyfin/library-utils.js`
- Test: `src/widgets/jellyfin/widget.test.js`, `src/widgets/jellyfin/library-utils.test.js`, `src/widgets/jellyfin/contract.test.js`

**Interfaces:**

- Produces (`widget.js` mappings): `Users: {endpoint: "Users"}`, `Views: {endpoint: "UserViews", params: ["userId"]}`, `Latest: {endpoint: "Items/Latest", params: ["userId", "parentId", "limit"]}`, `Resume: {endpoint: "UserItems/Resume", params: ["userId", "limit", "includeItemTypes"]}`.
- Produces (`library-utils.js`, all pure):
  - `clampCount(value: unknown, fallback = 5): number` — integer 1–10, otherwise `fallback`.
  - `webBase(href: string | undefined): string | null` — `https://host/path/web` without trailing slash; `null` for empty, `"#"` or non-http(s).
  - `libraryUrl(href, view: {Id, CollectionType?}): string | null`
  - `itemUrl(href, item: {Id, ServerId?}): string | null`
  - `posterUrl(href, item, maxHeight = 360): string | null` — `{base}/Items/{id}/Images/Primary?maxHeight=…&tag=…` (episodes: `SeriesId` + `SeriesPrimaryImageTag`, else own `ImageTags.Primary`); `null` when no tag or no href.
  - `formatRating(item): string | null` — `"★ 7.8"` (one decimal), `null` for missing/0.
  - `itemTitle(item): {title: string, subtitle: string | null}` — episode: title = `SeriesName`, subtitle = `S01E02 · Name` (numbers padded); otherwise title = `Name`, subtitle = `ProductionYear` as string or null.
  - `pickUser(users: {Id, Name}[], storedId?: string, configuredName?: string): {Id, Name} | undefined` — stored id if present in `users`, else configured name (case-insensitive), else first.

- [x] **Step 1: Write failing tests.** `widget.test.js`: the four mappings exist with the exact endpoints/params above and none starts with `emby/`. `library-utils.test.js`: table tests for every function including Review Focus 1, 2, 4, 5 (`webBase("https://x/jf/")` → `"https://x/jf/web"`, `webBase("#")` → `null`, `clampCount(0)`/`("abc")`/`99`, `formatRating({CommunityRating: 0})` → `null`, episode without `SeriesId` → `posterUrl` null, `pickUser` with a stale stored id). `contract.test.js`: every endpoint used by `widget.js` v2/new mappings (strip query) is in a literal list `VERIFIED_12_4_PATHS` copied from the spec's verified facts (`Sessions`, `Items/Counts`, `Sessions/{sessionId}/Playing/{command}`, `Users`, `UserViews`, `Items/Latest`, `UserItems/Resume`), with a comment naming the OpenAPI version and date.
- [x] **Step 2: Run** `pnpm vitest run src/widgets/jellyfin --testTimeout 120000 --hookTimeout 120000`. Expected: new tests FAIL (missing mappings/module), existing jellyfin tests pass.
- [x] **Step 3: Implement** the mappings and `library-utils.js` (URL building with `new URL`; library type → route table from Global Constraints).
- [x] **Step 4: Run** the same command. Expected: all PASS; prettier + eslint on the touched files.
- [x] **Step 5: Commit** `feat(jellyfin): library, latest and resume endpoints plus URL/poster helpers`

### Task 3: `LibrarySections` component

**Files:**

- Create: `src/widgets/jellyfin/library.jsx`, `src/widgets/jellyfin/library.test.jsx`
- Modify: `src/widgets/jellyfin/component.jsx` (rename the existing default export function to `NowPlayingAndBlocks`; new default export `Component` renders it followed by `LibrarySections` only when `showLibraries || showContinueWatching || showLatest`), `public/locales/en/common.json` (`jellyfin.libraries`, `jellyfin.continue_watching`, `jellyfin.recently_added`, `jellyfin.user`, `jellyfin.no_items`, `jellyfin.users_unavailable`)
- Test: existing `component.test.jsx` must stay green unmodified.

**Interfaces:**

- Consumes: Task 1 options on `service.widget`; Task 2 mappings via `useWidgetAPI(widget, "Users" | "Views" | "Latest" | "Resume", {userId, parentId?, limit, includeItemTypes?})` and every helper in `library-utils.js`; `service.href` for links and posters.
- Produces: `export default function LibrarySections({ service })`. User choice stored in `localStorage` under `jellyfin-user:${widget.service_group}/${widget.service_name}` (value: user `Id`); invalid/absent → `pickUser`.

- [ ] **Step 1: Write failing tests** in `library.test.jsx` (mock `useWidgetAPI` by endpoint name, stub `localStorage`; fixtures shaped like the OpenAPI schema: `Users` array, `Views`/`Resume` as `{Items: [...]}`, `Latest` as bare array):
  - all flags off → renders nothing.
  - `showLibraries` → one link per view with the correct `#/movies?…`/`#/tv?…` href.
  - `showContinueWatching` → a `<details>` titled "Continue watching" with one entry per episode: `<img>` `src` is the series poster, title/subtitle text, `★ 7.8`, link to `#/details?id=…&serverId=…`; closed unless `expandSections`.
  - `showLatest` → one `<details>` per library, each at most `latestCount` items; a library with `[]` shows "No items".
  - user switcher: `<select>` lists users, preselects `pickUser` result, changing it writes `localStorage` and re-queries with the new `userId`; `enableUserSwitch: false` hides it.
  - Review Focus 1–3: no `href` → no `<img>`/links but titles present; `Users` error → no select and no section queries (a `userId` is unknown), the `users_unavailable` hint is shown; missing rating → no star text.
- [ ] **Step 2: Run** `pnpm vitest run src/widgets/jellyfin --testTimeout 120000 --hookTimeout 120000`. Expected: new tests FAIL (module missing), old ones pass.
- [ ] **Step 3: Implement** `library.jsx` (native `<details>`/`<summary>`, Tailwind classes matching the surrounding widget, `loading="lazy"` posters with fixed aspect box, nothing rendered until a user id is known) and wire it into `component.jsx`; add locale strings.
- [ ] **Step 4: Run** the same command. Expected: all PASS including untouched `component.test.jsx`; prettier + eslint on touched files (run eslint alone, in the background if it exceeds 120 s).
- [ ] **Step 5: Commit** `feat(jellyfin): libraries, continue watching and recently added sections`

### Task 4: Documentation, catalog, final checks

**Files:**

- Modify: `docs/widgets/services/jellyfin.md`
- Test: `src/utils/editor/catalog.test.js` (existing), `pnpm editor:catalog`

- [ ] **Step 1: Update the docs page.** Fix the version table row to `>= 12` → `2`; add the new options with defaults and a YAML example (all new keys commented as optional); document: needs `href` on the service for links/posters, `Users` needs an administrator API key, the switcher lets anyone viewing the dashboard see another user's "continue watching", rating is `CommunityRating` (source depends on the metadata provider, not necessarily IMDb), new sections need a server that has `UserViews`/`Items/Latest`/`UserItems/Resume` (12.x does), and a short troubleshooting note asking for `docker logs` lines `HTTP Error … calling …` if `version: 2` still fails.
- [ ] **Step 2: Run** `pnpm editor:catalog` then `pnpm vitest run src/utils/editor/catalog.test.js src/utils/editor/catalog-utils.test.js --testTimeout 120000 --hookTimeout 120000`. Expected: catalog regenerates without error and tests PASS (the new YAML example must parse or be classified, not break the build).
- [ ] **Step 3: Run** `pnpm vitest run src/widgets/jellyfin src/widgets/emby src/utils/config/service-helpers.test.js --testTimeout 120000 --hookTimeout 120000`. Expected: all PASS; `pnpm exec prettier --check` on `docs/widgets/services/jellyfin.md` and every touched file.
- [ ] **Step 4: Commit** `docs(jellyfin): new sections, version table and troubleshooting`
- [ ] **Step 5: Hand over** with an explicit list of what was _not_ verified: no real Jellyfin 12.x server was available, so the reported "does not work on 12.x" cause is still unknown (ask the author for the widget error text or the `HTTP Error` log line); posters/links/web routes were verified only against the OpenAPI spec and `jellyfin-web` source, not in a browser.
