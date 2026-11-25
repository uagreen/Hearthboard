# Форк Homepage з вбудованим редактором — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Один форк `gethomepage/homepage` з редактором конфігурації за адресою `/editor`, без окремого контейнера, з виправленою вкладкою Settings і каталогом, що генерується з коду форку.

**Architecture:** Бекенд редактора — Next API routes під `src/pages/api/editor/`, спільна логіка — у `src/utils/editor/`. Фронтенд — статичні ES-модулі в `public/editor/`, сторінка `/editor` через rewrite. Каталог віджетів і vendor-бібліотеки генеруються скриптами на `prebuild`/`predev` у `public/editor/`.

**Tech Stack:** Next.js (pages router), pnpm, Vitest (`pnpm test`), ESLint (`pnpm lint`), `yaml` (Document API), `diff`, `marked`, `sortablejs`. Playwright лише для e2e-смоуку.

**Spec:** `docs/superpowers/specs/2026-11-25-homepage-fork-editor-design.md`

Шляхи нижче — відносно кореня **форку** (створюється в Task 0). Вихідний код редактора (для перенесення) — клон `jchisholm59/homepage-editor` у `scratchpad/editor` (файли `server.js`, `lib/sync.js`, `public/*.js`, `scripts/build-catalog.mjs`).

## Global Constraints

- Результат — GPL-3.0; код редактора (MIT, автор jchisholm59) зберігає копірайт у `NOTICE` і в заголовках перенесених файлів.
- Не «Homepage» у назві форку; не видавати за офіційний проєкт. У README — позначка про створення частини коду за допомогою ШІ.
- Жодних PR в апстрім; віддалений репозиторій `upstream` для merge.
- Існуючі `config/*.yaml` працюють без змін; правки в ядрі Homepage мінімальні (`next.config.js`, `package.json`, `Dockerfile`, `.gitignore`), увесь код редактора — в окремих каталогах (`src/utils/editor/`, `src/pages/api/editor/`, `public/editor/`, `scripts/editor/`).
- Редактор **вимкнений за замовчуванням** (`HOMEPAGE_EDITOR=true` вмикає); при ввімкненні потрібна автентифікація (див. Task 2).
- Перевірки: `pnpm lint`, `pnpm test`; pre-commit для змінених файлів. Стиль тестів — як у сусідніх `*.test.js`, мок відповіді — `src/test-utils/create-mock-res.js`.
- Версія апстріму на момент плану — **Homepage 2.8.0** (редактор писався під 1.13.2): у 2.x є вбудований NextAuth (`withAuth`, `isAuthEnabled`, `HOMEPAGE_ALLOWED_HOSTS`), які редактор має використовувати.

## Review Focus

1. **Обхід шляху** у імені файлу (`../settings.yaml`, `a/b.yaml`, `x.txt`, `settings.yaml/`) — має відхилятися 400, нічого не читається й не пишеться (Task 1).
2. **Конфлікт редагування**: збереження з застарілим `baseMtime` → 409 і файл не змінюється (Task 2).
3. **Редактор вимкнений / без захисту**: усі маршрути `/api/editor/*` дають 404 без `HOMEPAGE_EDITOR`; при ввімкненні без автентифікації й без пароля — 403 з поясненням (Task 2).
4. **Порожній або лише закоментований YAML** (нова установка): структурне збереження працює, коментарі не губляться (Task 1).
5. **Невалідний YAML** не записується на диск, бекап не створюється (Task 2).

---

### Task 0: Форк і каркас

**Files:**
- Create: `NOTICE`, `docs/superpowers/specs/…`, `docs/superpowers/plans/…` (копії з поточної папки)
- Modify: `README.md`, `Dockerfile:38-39` (LABEL license → `GPL-3.0`; source → URL форку)

**Interfaces:**
- Produces: працююче `pnpm install && pnpm test` на чистому форку; віддалені `origin` (форк) і `upstream` (gethomepage/homepage).

- [x] **Step 1: Створити форк на GitHub** — це публічна дія від імені автора: попросити автора створити форк (`<FORK_NAME>` — його вибір) і дати URL; самостійно не створювати.
- [x] **Step 2: Клонувати форк, додати `upstream`, створити гілку `editor-integration`**
  Run: `git remote add upstream https://github.com/gethomepage/homepage && git fetch upstream && git remote -v`
  Expected: `origin` і `upstream` у списку.
- [x] **Step 3: Базова перевірка** — `pnpm install --frozen-lockfile && pnpm test`. Expected: усі тести проходять (зафіксувати кількість як базову лінію).
- [x] **Step 4: Додати `NOTICE`** (рядок про код редактора: «Portions © jchisholm59, MIT», з повним текстом MIT-ліцензії), абзац у README про форк, позначку про ШІ, посилання на апстрім; виправити LABEL у `Dockerfile`.
- [x] **Step 5: Commit** — `chore: fork bootstrap, NOTICE and README disclosure`

**Виконано 2026-11-25. Відхилення й факти:**
- Форк: `uagreen/Hearthboard`, назва обрана автором. Робоча копія — `/mnt/e/projekts/Homepage_gui` (корінь репозиторію), а не окрема папка; `core.fileMode=false` (диск Windows ставить 755 усім файлам).
- Базова лінія Step 3: **1934 проходять, 18 падають** (`theme`, `color`, `search`, `pages/index`), усі з `localStorage.* is not a function` — Node 25 у системі; на Node 24 не перевірялося. Нові тести порівнювати з цією лінією.
- Доступ на запис: SSH-ключ `id_ed25519_hearthboard`, alias `github-hearthboard` у `~/.ssh/config` (працює лише з WSL, не з PhpStorm під Windows).
- Коміт `f5f20e13`, гілка `editor-integration` запушена.

---

### Task 1: Ядро редактора (файли, YAML-злиття, бекапи)

**Files:**
- Create: `src/utils/editor/sync.js` (перенос `lib/sync.js` як є), `src/utils/editor/files.js`, `src/utils/editor/backups.js`
- Test: `src/utils/editor/sync.test.js`, `src/utils/editor/files.test.js`, `src/utils/editor/backups.test.js`
- Modify: `package.json` (залежності `yaml`, `diff`)

**Interfaces:**
- Produces (`files.js`, усі працюють над `CONF_DIR` з `utils/config/config`):
  - `configPath(name: string): string` — кидає `EditorError` (`status: 400`) для імен не за `/^[\w][\w.-]*\.(ya?ml|css|js)$/`.
  - `readFile(name): {name, text, mtime, exists}`; `listFiles(): {name, size}[]`
  - `parseYaml(text): {doc, errors: string[], data}`
  - `renderEdit(name, body: {text}|{data}): {current, text, errors, diff, contentDiff, changed}`
  - `class EditorError extends Error { status: number }`
- Produces (`backups.js`, каталог з `EDITOR_BACKUP_DIR`, за замовчуванням `<CONF_DIR>/../backups`… — виконавець вибирає розумний шлях і документує): `backupFile(name, current): string|null`, `listBackups(): {id, files}[]`, `readBackup(id, name)`, `pruneBackups(keep = 300)`.
- Produces (`sync.js`): `syncDocument(doc, value): void`.

- [ ] **Step 1: Тести `sync.test.js`** — перенести ідеї з `scripts/roundtrip-test.mjs` та `edit-test.mjs` оригіналу: незмінений `data` дає ідентичний текст; зміна одного ключа зберігає коментарі та порядок; порожній документ (`''` і лише `# коментар`) приймає `{title: 'x'}` без втрати коментаря.
- [ ] **Step 2: Тести `files.test.js`** — `configPath` відхиляє `../settings.yaml`, `a/b.yaml`, `x.txt`, `settings.yaml/`, `.hidden.yaml` (400); приймає `settings.yaml`, `custom.css`; `renderEdit` для `{data}` на файлі з YAML-помилкою кидає 400 «edit it as text».
- [ ] **Step 3: Тести `backups.test.js`** — `backupFile` створює `<id>/<name>`; `pruneBackups(2)` лишає 2 найновіших; `readBackup` з id, що не відповідає `/^\d{4}-[\w-]+$/`, → 400.
- [ ] **Step 4: Запустити — FAIL.** Run: `pnpm vitest run src/utils/editor` — Expected: FAIL (модулів немає).
- [ ] **Step 5: Реалізувати** модулі за сигнатурами вище, переносячи логіку з `server.js` (рядки `configPath`, `readFile`, `parseYaml`, `render`, `backupFile`, `pruneBackups`). Тести використовують тимчасовий каталог через `HOMEPAGE_CONFIG_DIR`/`EDITOR_BACKUP_DIR`.
- [ ] **Step 6: Запустити — PASS.** Run: `pnpm vitest run src/utils/editor && pnpm lint`
- [ ] **Step 7: Commit** — `feat(editor): core file, yaml-merge and backup utilities`

---

### Task 2: Захист і API файлів (info, files, file, preview, save)

**Files:**
- Create: `src/utils/editor/guard.js`, `src/pages/api/editor/info.js`, `src/pages/api/editor/files.js`, `src/pages/api/editor/file/[name].js`, `src/pages/api/editor/preview/[name].js`, `src/pages/api/editor/save/[name].js`
- Test: `src/utils/editor/guard.test.js`, `src/pages/api/editor/save/[name].test.js`

**Interfaces:**
- Consumes: Task 1 (`files.js`, `backups.js`); з Homepage — `withAuth`, `isAuthEnabled`, `invalidateDashboardData` (`utils/config/dashboard`).
- Produces: `withEditor(handler): NextApiHandler` у `guard.js`:
  1. `HOMEPAGE_EDITOR !== "true"` → 404 `{error}`;
  2. якщо `isAuthEnabled()` → делегує `withAuth`;
  3. інакше вимагає Basic-автентифікацію з `EDITOR_PASSWORD` (порівняння через `crypto.timingSafeEqual` над SHA-256); без пароля й без `EDITOR_ALLOW_NO_AUTH=true` → 403 з підказкою, що задати;
  4. обгортає помилки: `EditorError.status` → відповідь `{error}`, інше → 500.
- Контракти маршрутів — як у `server.js` оригіналу, шлях `/api/editor/...`: `GET info` → `{homepageVersion, password: boolean, canRestart: boolean}` (версія з `package.json`); `GET files`; `GET file/:name`; `POST preview/:name`; `POST save/:name` (тіло `{text|data, baseMtime?}`, ліміт тіла 2 MB через `export const config`).
- Після успішного збереження — `invalidateDashboardData()` напряму (без HTTP-виклику `/api/revalidate`).

- [ ] **Step 1: Тести `guard.test.js`** — без `HOMEPAGE_EDITOR` → 404; увімкнено, auth вимкнено, пароль не задано → 403; пароль задано, невірний заголовок → 401, вірний → викликається handler; `EDITOR_ALLOW_NO_AUTH=true` → handler.
- [ ] **Step 2: Тести `save/[name].test.js`** (з тимчасовим `HOMEPAGE_CONFIG_DIR`): валідне збереження створює бекап і викликає `invalidateDashboardData`; невалідний YAML → 400, файл і каталог бекапів без змін; застарілий `baseMtime` → 409, файл без змін; `changed:false` → `{saved:false}` без бекапу.
- [ ] **Step 3: Запустити — FAIL.** Run: `pnpm vitest run src/utils/editor/guard.test.js "src/pages/api/editor"`
- [ ] **Step 4: Реалізувати `withEditor` і маршрути**, повторивши логіку обробників оригіналу; кожен маршрут експортує `withEditor(handler)`. Використати `utils/logger` як у сусідніх маршрутах.
- [ ] **Step 5: Запустити — PASS**, `pnpm lint`.
- [ ] **Step 6: Commit** — `feat(editor): guarded file API with diff, backup and conflict detection`

---

### Task 3: Бекапи, іконки, перевірка посилань, перезапуск

**Files:**
- Create: `src/pages/api/editor/backups.js`, `backup/[id]/[name].js`, `restore/[id]/[name].js`, `icons/index.js`, `icons/served.js`, `icons/fetch.js`, `icons/upload.js`, `icons/local/[name].js`, `check-links.js`, `restart.js`, `src/utils/editor/icons.js`
- Test: `src/utils/editor/icons.test.js`, `src/pages/api/editor/check-links.test.js`

**Interfaces:**
- Consumes: Task 1–2.
- Produces (`icons.js`): `safeIconName(n: string): string`, `storeIcon(name: string, buf: Buffer, type: string|undefined): string` (кидає 400 для не-зображень і >15 MB), `localIcons(): string[]`.
- Маршрути — як в оригіналі: `GET backups`, `GET backup/:id/:name`, `POST restore/:id/:name`, `GET icons`, `GET icons/served`, `POST icons/fetch`, `POST icons/upload` (`bodyParser: false`, ліміт 15 MB), `GET icons/local/:name` (замість `/local-icons`), `POST check-links`, `POST restart` (404 без `DOCKER_PROXY`).
- `icons/fetch` і `check-links` роблять вихідні HTTP-запити за URL від користувача: **приймати лише `http(s)`, і відхиляти адреси loopback/link-local (`127.0.0.0/8`, `169.254.0.0/16`, `::1`) для `icons/fetch`**; `check-links` для приватних LAN-адрес залишає дозволеним (його мета — перевіряти LAN-сервіси).

- [ ] **Step 1: Тести** — `safeIconName('My Icon!.PNG')` → `'my-icon-.png'`-подібний безпечний результат без `/` і провідних крапок (точні значення виконавець фіксує за логікою оригіналу); `storeIcon` відхиляє `text/html` і буфер >15 MB; `icons/fetch` відхиляє `http://127.0.0.1/x.png` і `file:///etc/passwd` (400); `check-links` ігнорує не-http(s) і обмежує 200 URL.
- [ ] **Step 2: Запустити — FAIL.**
- [ ] **Step 3: Реалізувати** (перенести з `server.js`, секції Backups/Icons/Link checker; кеш індексу іконок — модульна змінна, як в оригіналі).
- [ ] **Step 4: Запустити — PASS**, `pnpm lint`.
- [ ] **Step 5: Commit** — `feat(editor): backups, icons, link checker and optional restart`

---

### Task 4: Каталог з коду форку

**Files:**
- Create: `scripts/editor/build-catalog.mjs` (перенос `scripts/build-catalog.mjs`), `scripts/editor/catalog-examples.mjs`, `scripts/editor/catalog.test.js` (або `src/utils/editor/catalog.test.js`, якщо Vitest не підхоплює `scripts/` — додати в `include` мінімально)
- Modify: `package.json` (скрипти `editor:catalog`, `prebuild`, `predev`), `.gitignore` (`public/editor/catalog.json`)

**Interfaces:**
- Produces: `public/editor/catalog.json` зі структурою оригіналу (`homepageVersion`, `palettes`, `serviceWidgets`, `infoWidgets`, `configs`) **з однією зміною**: кожен елемент `configs[page].sections[i].examples` тепер `{text: string, insertable: boolean, reason?: "placeholder"|"not-a-mapping"|"invalid-yaml"}`.
- Produces: `classifyExample(text: string): {text, insertable, reason?}` у `catalog-examples.mjs` — `insertable` лише якщо YAML парситься у mapping (не список, не scalar); `...` як окремий рядок → `reason: "placeholder"`.
- Скрипт читає `./docs` форку, версію бере з `package.json` (`version`), без клонування.

- [ ] **Step 1: Тести** — `classifyExample('title: x')` → `insertable: true`; `classifyExample('layout:\n  ...\n  A:\n    tab: B')` → `insertable:false, reason:'placeholder'`; `classifyExample('- Group:\n    - S:\n        href: x')` → `reason:'not-a-mapping'`; інтеграційний: після `build-catalog` `serviceWidgets.length > 0`, кожен має `type` і масив `fields`; для всіх прикладів сторінки `settings` — `insertable === true` ⇒ парситься у mapping.
- [ ] **Step 2: Запустити — FAIL.**
- [ ] **Step 3: Реалізувати**: перенести генератор, замінити `examples` на результат `classifyExample`; шляхи `docs/` — відносно кореня форку. Прогнати проти документації 2.8.0 і **вручну звірити** кількість віджетів із `ls docs/widgets/services | wc -l` (різниця пояснюється в коментарі, а не ігнорується).
- [ ] **Step 4: `package.json`**: `"editor:catalog": "node scripts/editor/build-catalog.mjs"`, `"prebuild"`/`"predev"` запускають каталог і Task 5 vendor-скрипт.
- [ ] **Step 5: Запустити — PASS**, `pnpm lint`, `pnpm editor:catalog` створює файл.
- [ ] **Step 6: Commit** — `feat(editor): generate widget/settings catalog from the fork's own docs`

---

### Task 5: Фронтенд, `/editor`, виправлення Settings

**Files:**
- Create: `public/editor/` (перенос `public/*.js`, `index.html`, `style.css` з оригіналу), `public/editor/catalog-utils.js`, `src/utils/editor/catalog-utils.test.js`, `scripts/editor/copy-vendor.mjs`, `tests/e2e/editor.spec.js`, `playwright.config.js`
- Modify: `public/editor/*.js` (URL `/api/…` → `/api/editor/…`; `/local-icons/` → `/api/editor/icons/local/`; `/vendor/…` лишається, файли кладе скрипт у `public/editor/vendor/`), `public/editor/views.js` (Settings), `next.config.js` (rewrite `/editor` → `/editor/index.html`), `.gitignore` (`public/editor/vendor`), `Dockerfile:45` (копіювати `public` з builder: `COPY --link --from=builder --chown=1000:1000 /app/public ./public/`, бо генеровані файли не лежать у контексті)

**Interfaces:**
- Produces: `sectionsWithPage(configs: Record<string,{sections: Section[]}>): (Section & {page: string, pageLabel: string})[]` у `catalog-utils.js` (чиста функція без DOM; експортується як ES-модуль, що імпортується і з Vitest).
- `views.js` будує і `toc`, і `all` з результату `sectionsWithPage` — **кожен елемент меню має `page` за побудовою**, `select(s)` більше не бере секцію без `page`.
- Кнопка «Use this» показується лише для `example.insertable`; для інших — підказка з `reason` («прикладі є шаблон, скопіюйте вручну» / «це список, вставляється через вкладку Services»).
- `scripts/editor/copy-vendor.mjs` копіює `sortablejs/modular`, `marked/lib/marked.esm.js`, `yaml/browser/dist` у `public/editor/vendor/{sortable,marked,yaml}`.

- [ ] **Step 1: Тести `catalog-utils.test.js`** — кожен елемент `sectionsWithPage(catalog.configs)` має `page ∈ {settings, services, bookmarks, docker, …}` і `configs[s.page].doc` визначений (відтворює помилку `Cannot read properties of undefined (reading 'doc')`).
- [ ] **Step 2: Запустити — FAIL.**
- [ ] **Step 3: Реалізувати** `catalog-utils.js`, виправити `views.js` (рядки 111–130 оригіналу), адаптувати «Use this» до `{text, insertable, reason}`, оновити URL у всіх модулях.
- [ ] **Step 4: Playwright e2e `editor.spec.js`** — з `HOMEPAGE_EDITOR=true EDITOR_ALLOW_NO_AUTH=true` і тестовим `HOMEPAGE_CONFIG_DIR`: відкрити `/editor`, пройти кожну вкладку (`improve, appearance, services, bookmarks, widgets, settings, files, backups`) і в Settings клікнути перші 5 пунктів бічного меню; тест падає на будь-якому `pageerror` або `console.error`. Додати скрипт `test:e2e`.
- [ ] **Step 5: Запустити — PASS**: `pnpm vitest run src/utils/editor/catalog-utils.test.js`; `pnpm test:e2e`. **Примітка:** у середовищі розробки Chromium потребує системних бібліотек (`libnspr4`, `libnss3`); якщо їх нема, e2e запускається в CI, а в звіті прямо зазначається, що локально він не виконувався.
- [ ] **Step 6: Ручна перевірка** — `pnpm dev`, відкрити `/editor`, вкладка Settings: меню клікається, «Use this» працює для вставного прикладу й прихована з поясненням для решти.
- [ ] **Step 7: Commit** — `feat(editor): mount UI at /editor, fix Settings navigation crash`

---

### Task 6: Документація, CI, образ

**Files:**
- Create: `docs/configs/editor.md` (як увімкнути, змінні `HOMEPAGE_EDITOR`, `EDITOR_PASSWORD`, `EDITOR_ALLOW_NO_AUTH`, `EDITOR_BACKUP_DIR`, `DOCKER_PROXY`; застереження про безпеку), `.github/workflows/e2e.yml`
- Modify: `README.md`, `mkdocs.yml` (сторінка editor), `.github/workflows/docker-publish.yml` (ім'я образу → ghcr форку), видалити/вимкнути workflow, що прив'язані до апстріму й секретів (`issue-triage`, `pr-triage`, `pr-quality`, `reaction-comments`, `repo-maintenance`, `crowdin`, `docs-publish`) — перелік звірити з тим, що справді вимагає секретів апстріму

**Interfaces:**
- Consumes: усі попередні задачі.

- [ ] **Step 1:** Написати `docs/configs/editor.md` і розділ у README (скріншоти — після ручної перевірки Task 5).
- [ ] **Step 2:** CI: `lint.yml` і `pnpm test` залишити; додати `e2e.yml` (встановлення Chromium через `pnpm exec playwright install --with-deps chromium`).
- [ ] **Step 3:** Зібрати образ локально: `docker build -t <fork>:dev .`, запустити з `-e HOMEPAGE_EDITOR=true -e EDITOR_PASSWORD=… -v <тестовий config>:/app/config`, переконатися, що `/editor` відкривається, зберігає зміну в `settings.yaml` і дашборд її підхоплює. Expected: файл змінено, бекап створено, `GET /` відображає зміну.
- [ ] **Step 4:** Перевірити, що без `HOMEPAGE_EDITOR` `GET /api/editor/info` → 404 в образі.
- [ ] **Step 5: Commit** — `docs/ci: editor docs, e2e workflow, fork image publishing`

---

### Task 7 (не деталізовано): покращення віджетів

Залежить від відповіді автора на відкрите питання №1 зі spec (які віджети й чого бракує). План цієї задачі складається **окремо** після відповіді; до того в цьому плані вона не виконується.

---

## Self-review

- **Покриття spec:** цілі 1–3, 5 → Tasks 0–6; ціль 4 → Task 7 (відкладена свідомо). Анти-цілі: сумісність з апстрімом → Global Constraints і розміщення коду; захист → Task 2; атрибуція → Task 0. Виправлення 1 → Task 5; 2–3 → Task 4–5; 4 (тести) → Tasks 4–5.
- **Відхилення від spec, про які слід знати:** (а) захист: spec казав «пароль як `EDITOR_PASSWORD`», а в Homepage 2.x уже є NextAuth — план спершу використовує його (`withAuth`), а `EDITOR_PASSWORD` лишає як запасний варіант; (б) форма `examples` у каталозі змінюється з рядка на об'єкт; (в) `Dockerfile` копіює `public` з builder. Після схвалення плану оновити spec відповідно.
- **Узгодженість типів:** `EditorError`, `withEditor`, `classifyExample`, `sectionsWithPage` визначені в одній задачі й використовуються в наступних з тими самими іменами.
- **Пропорція:** тіла функцій не наведено, лише сигнатури, тести й значення зі spec.
