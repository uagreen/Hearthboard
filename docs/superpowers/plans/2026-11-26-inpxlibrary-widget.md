# inpxlibrary widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new service widget `inpxlibrary` for [inpx-library-server](https://github.com/Habsaec/inpx-library-server): library counters and indexing status (public API) plus optional "reading", "want to read" and one named shelf (up to 10 books each, per-user, behind Basic auth).

**Architecture:** Follows the existing service-widget shape (`widget.js` with `mappings`, registered in `widgets.js` / `components.js`). Requests go through the shared `credentialedProxyHandler`, extended with one branch that adds `Authorization: Basic` when `username` and `password` are configured. The client component renders counter blocks and `<details>` accordions; credentials never reach the browser. Covers are loaded by the browser directly from the library's `href`.

**Tech Stack:** Next.js pages router, React, SWR via `useWidgetAPI`, Vitest + Testing Library, docs in `docs/` (mkdocs).

**Spec:** `docs/superpowers/specs/2026-11-26-inpxlibrary-widget-design.md` (approved 2026-11-26).

## Global Constraints

- Widget type name `inpxlibrary`; `api: "{url}/{endpoint}"`.
- Option names and defaults exactly: `fields` default `["books","authors","series","genres"]` (allowed: `books`, `authors`, `series`, `genres`, `languages`; max 4 shown), `username`, `password` (server-only), `showReading` false, `showWant` false, `shelf` (name, optional), `count` 10 (clamped 1-10), `showIndexing` true, `expandSections` false.
- Endpoints (verified in the server source): `api/index-status` (public; `{stats:{totalBooks,totalAuthors,totalSeries,totalGenres,totalLanguages}, active, processedArchives, totalArchives, indexedAt, error, ...}`), `api/library/continue` and `api/library/want` (`{items,total,page,pageSize}`, query `pageSize`), `api/shelves` (array of shelves with `id`, `name`), `api/shelves/{shelfId}/books` (array, newest first, so the first N are the latest). Book fields used: `id`, `title`, `authors`, `series`, `seriesNo`.
- `username` and `password` must never appear in the client payload (`cleanServiceGroups`) or in tests/docs as real values (placeholders only).
- Personal endpoints are requested only when the matching option is enabled; after an error on a personal endpoint the component stops requesting it (the server rate-limits failed Basic logins).
- Covers: `{href}/api/books/{id}/cover-thumb`, hidden on image error; book link `{href}/book/{id}`; no `href` (empty or `#`) means no links and no images.
- Repo conventions: Prettier + ESLint clean; new tests as `src/**/*.test.*`; commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; do not commit `AGENTS.md`; no PRs; no push without the author's say-so. Docs must disclose that the widget was written with AI assistance only where the existing Hearthboard docs do (nothing extra per page).
- Environment: `/mnt/e` is slow and vitest's jsdom workers often fail to start with the default pool. Run `.jsx` component tests with `--pool vmThreads` (and `--testTimeout 120000 --hookTimeout 120000`); run node-environment tests that import widget files in the default pool (vmThreads breaks them with "Linked modules must use the same context"). One vitest or eslint run at a time. `localStorage` is not needed here.
- CI formats with prettier 3.3.3 + `prettier-plugin-organize-imports` 4.1.0 (newer local prettier can disagree). Before finishing, `--check` all changed `.js/.jsx/.mjs/.md` files with that version (install it in a scratch directory) and run `pnpm exec eslint` on the changed files in the background without a time limit.

## Review Focus

1. No `username` configured: counters and indexing line still work, and **no** request to `api/library/*` or `api/shelves*` is made.
2. A personal endpoint answers with an error (401/403/network): its polling stops, a hint is shown, counters are unaffected.
3. `shelf` name not found, no shelves at all, or a shelf with 0 books.
4. A book without authors/series/cover; `href` missing or `#`; a cover that fails to load.
5. `index-status` with `stats` missing/`null` (server still warming), or while indexing with `totalArchives` 0: no `NaN`, blocks show `-`.

---

### Task 1: Widget definition, proxy auth, registration

**Files:**

- Create: `src/widgets/inpxlibrary/widget.js`, `src/widgets/inpxlibrary/widget.test.js`
- Modify: `src/widgets/widgets.js` (import + map entry, alphabetical), `src/utils/proxy/handlers/credentialed.js` (one branch), `src/utils/proxy/handlers/credentialed.test.js`

**Interfaces:**

- Produces mappings: `IndexStatus: {endpoint: "api/index-status"}`, `Reading: {endpoint: "api/library/continue", params: ["pageSize"]}`, `Want: {endpoint: "api/library/want", params: ["pageSize"]}`, `Shelves: {endpoint: "api/shelves"}`, `ShelfBooks: {endpoint: "api/shelves/{shelfId}/books", segments: ["shelfId"]}`; `proxyHandler: credentialedProxyHandler`.
- `credentialed.js`: for `widget.type === "inpxlibrary"` sets `Authorization: Basic base64(username:password)` only when both are set; otherwise sets no auth header and no `X-API-Key`.

- [x] **Step 1: Write failing tests.** `widget.test.js`: `expectWidgetConfigShape(widget)` and the five mappings above exactly. `credentialed.test.js`: following the existing per-type tests there, `inpxlibrary` with `username`/`password` sends the Basic header; without them sends no `Authorization` and no `X-API-Key` header.
- [x] **Step 2: Run** `pnpm vitest run src/widgets/inpxlibrary src/utils/proxy/handlers/credentialed.test.js --testTimeout 120000 --hookTimeout 120000`. Expected: new tests FAIL (module missing / header absent).
- [x] **Step 3: Implement** `widget.js`, register it in `widgets.js`, add the branch to `credentialed.js` (before the final `else`).
- [x] **Step 4: Run** the same command. Expected: PASS (the whole `credentialed.test.js` stays green); prettier on touched files.
- [x] **Step 5: Commit** `feat(inpxlibrary): widget definition and Basic auth in the credentialed proxy`

### Task 2: Pass the options to the client, keep credentials out

**Files:**

- Modify: `src/utils/config/service-helpers.js` (destructuring list and a `type === "inpxlibrary"` block next to the jellyfin one), `src/utils/config/service-helpers.test.js`

**Interfaces:**

- Produces on the client widget (only when configured): `showReading`, `showWant`, `showIndexing`, `expandSections` (booleans), `count` (number), `shelf` (string). `fields` is already passed by the generic code. **Never** `username` or `password`.

- [x] **Step 1: Write the failing test** next to the jellyfin one: an `inpxlibrary` widget with `showReading: true, showWant: "true", showIndexing: false, expandSections: true, count: "7", shelf: "Favorites", username: "reader", password: "secret"` yields exactly those client values and has neither `username` nor `password`; a bare `inpxlibrary` widget has none of the new keys.
- [x] **Step 2: Run** `pnpm vitest run src/utils/config/service-helpers.test.js --testTimeout 120000 --hookTimeout 120000`. Expected: new test FAILS, the rest pass.
- [x] **Step 3: Implement** the pass-through with the same `!!JSON.parse(x)` / `Number(JSON.parse(x))` pattern as jellyfin.
- [x] **Step 4: Run** the same command. Expected: PASS; prettier.
- [x] **Step 5: Commit** `feat(inpxlibrary): pass widget options to the client without credentials`

### Task 3: Pure helpers

**Files:**

- Create: `src/widgets/inpxlibrary/library-utils.js`, `src/widgets/inpxlibrary/library-utils.test.js`

**Interfaces (all pure):**

- `clampCount(value: unknown, fallback = 10): number` — integer 1-10, else `fallback`.
- `baseUrl(href: string | undefined): string | null` — origin + path without trailing slash; `null` for empty, `"#"`, non-http(s).
- `bookUrl(href, id): string | null` → `{base}/book/{id}`; `coverUrl(href, id): string | null` → `{base}/api/books/{id}/cover-thumb`.
- `findShelf(shelves: {id, name}[] | unknown, name: string | undefined): {id, name} | undefined` — case-insensitive, trimmed; `undefined` for non-array or no match.
- `indexingLine(status: object | undefined): {kind: "indexing", done: number, total: number} | {kind: "updated", at: string} | null` — `indexing` when `status.active` (counts coerced to numbers, `0` when missing); `updated` with `indexedAt` otherwise; `null` when neither.
- `statValue(stats: object | null | undefined, field: "books"|"authors"|"series"|"genres"|"languages"): number | undefined` — maps to `totalBooks` … `totalLanguages`; `undefined` when missing or not a finite number.
- `authorsText(book): string` — `book.authors` trimmed, `""` when absent.

- [x] **Step 1: Write failing table tests** for each function, including Review Focus 3-5 (`clampCount(0|99|"x")`, `baseUrl("#")`, `findShelf(undefined, "a")`, `findShelf([{id:1,name:" Fav "}], "fav")`, `indexingLine({active:true})` → `done 0, total 0`, `statValue(null, "books")` → `undefined`).
- [x] **Step 2: Run** `pnpm vitest run src/widgets/inpxlibrary/library-utils.test.js --testTimeout 120000 --hookTimeout 120000`. Expected: FAIL (module missing).
- [x] **Step 3: Implement** `library-utils.js`.
- [x] **Step 4: Run** the same command. Expected: PASS; prettier.
- [x] **Step 5: Commit** `feat(inpxlibrary): URL, shelf and status helpers`

### Task 4: Component, registration, strings

**Files:**

- Create: `src/widgets/inpxlibrary/component.jsx`, `src/widgets/inpxlibrary/component.test.jsx`
- Modify: `src/widgets/components.js` (dynamic import entry), `public/locales/en/common.json` (an `inpxlibrary` block: `books`, `authors`, `series`, `genres`, `languages`, `indexing`, `updated`, `reading`, `want`, `shelf`, `shelf_not_found`, `auth_failed`, `no_items`)

**Interfaces:**

- Consumes: Task 1 mappings via `useWidgetAPI(widget, "IndexStatus" | "Reading" | "Want" | "Shelves" | "ShelfBooks", query)` (queries: `{pageSize: count}` for Reading/Want; `ShelfBooks` also sends `segments` — follow how jellyfin's `handlePlayCommand` builds `segments` or how other widgets pass them; if `useWidgetAPI` cannot send segments, build the URL with `getURLSearchParams` and `useSWR` directly, as the existing widgets that need segments do); Task 2 options on `service.widget`; Task 3 helpers; `withWidgetFields` for `fields`.
- Produces: `export default function Component({ service })`.
- Behaviour: counter `Block`s for `fields`; an indexing line when `showIndexing !== false` (`indexing 12 / 40` or `updated <date>`); accordions "Reading" (`showReading`), "Want to read" (`showWant`) and "Shelf: <name>" (`shelf` set), each at most `count` books (cover, title linking to `bookUrl`, authors, series); closed unless `expandSections`. A personal endpoint that returns an error is not requested again; its accordion shows the `auth_failed` hint. Unknown shelf name shows `shelf_not_found`. Empty list shows `no_items`.

- [ ] **Step 1: Write failing tests** (mock `utils/proxy/use-widget-api` by endpoint name, as `src/widgets/jellyfin/library.test.jsx` does): counters render from `stats` and `-` when `stats` is missing; indexing line for `active` and for `indexedAt`; no `Reading`/`Want`/`Shelves` request when the options are off (Review Focus 1); Reading renders up to `count` books with cover `src`, link `href`, authors; `showReading` with an error response renders the hint and the endpoint is requested with an empty endpoint on the next render (Review Focus 2); shelf found/not found/empty (3); book without authors/series, no `href` → no `img`/link, image `error` event hides the cover (4); `totalArchives: 0` while indexing shows no `NaN` (5).
- [ ] **Step 2: Run** `pnpm vitest run src/widgets/inpxlibrary/component.test.jsx --pool vmThreads --testTimeout 120000 --hookTimeout 120000`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `component.jsx` using `Container`/`Block` from `components/services/widget/*` like the jellyfin/komga widgets and native `<details>` accordions styled like `src/widgets/jellyfin/library.jsx`; register in `components.js`; add the locale strings.
- [ ] **Step 4: Run** the same command. Expected: PASS; prettier; `pnpm exec eslint src/widgets/inpxlibrary src/widgets/components.js` in the background, no time limit, exit 0.
- [ ] **Step 5: Commit** `feat(inpxlibrary): component with counters, indexing status and reading lists`

### Task 5: Documentation, catalog, final checks

**Files:**

- Create: `docs/widgets/services/inpxlibrary.md`
- Modify: `mkdocs.yml` (nav, alphabetical in "Service Widgets"), `docs/widgets/services/index.md` (list entry)

- [ ] **Step 1: Write the docs page** in the style of `docs/widgets/services/jellyfin.md`: what it needs (inpx-library-server), the public vs. login-only data, a YAML example with placeholder credentials (`username: reader`, `password: your-password`), the option table from the spec, notes: personal lists need the library user's own login (Basic), the server rate-limits failed logins so a wrong password can lock the account for a while, covers only show when the library allows anonymous browsing or the browser has a session there, `stats` are cached by the server for about 10 minutes, the shelf is picked by name.
- [ ] **Step 2: Run** `pnpm editor:catalog` then `pnpm vitest run src/utils/editor/catalog.test.js src/utils/editor/catalog-utils.test.js --pool vmThreads --testTimeout 120000 --hookTimeout 120000`. Expected: the catalog lists `inpxlibrary` with its options; tests PASS.
- [ ] **Step 3: Run** the suites of every touched area one at a time: `pnpm vitest run src/widgets/inpxlibrary src/utils/proxy/handlers src/utils/config/service-helpers.test.js` (default pool for the node tests) and `pnpm vitest run src/widgets/inpxlibrary/component.test.jsx --pool vmThreads`. Expected: all PASS; the existing widget tests untouched.
- [ ] **Step 4: Format and lint** all changed files with prettier 3.3.3 + organize-imports 4.1.0 (`--check`) and eslint (background, no time limit, exit 0).
- [ ] **Step 5: Commit** `docs(inpxlibrary): widget page, nav entry and index`
- [ ] **Step 6: Hand over** with what was not verified: no running inpx-library-server was available, response shapes come from its source code (`master` on 2026-11-26); the Basic-auth and cover behaviour against a real server, and the 401-stop behaviour in a browser, are for the author to check.
