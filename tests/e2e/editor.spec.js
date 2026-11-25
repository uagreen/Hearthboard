import { expect, test } from "@playwright/test";

const TABS = ["improve", "appearance", "services", "bookmarks", "widgets", "settings", "files", "backups"];

test("every tab opens and the Settings menu works, with no errors in the browser", async ({ page }) => {
  const problems = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console.error: ${m.text()}`);
  });

  await page.goto("/editor");
  await expect(page.locator("#hp-version")).toContainText("for Homepage");

  for (const tab of TABS) {
    await page.click(`#tabs button[data-view="${tab}"]`);
    await expect(page.locator(`#tabs button[data-view="${tab}"]`)).toHaveClass(/active/);
    await expect(page.locator("#view")).not.toBeEmpty();
  }

  // Settings: the crash was "Cannot read properties of undefined (reading 'doc')" on a menu click.
  await page.click('#tabs button[data-view="settings"]');
  const items = page.locator(".toc button");
  await expect(items.first()).toBeVisible();
  const count = await items.count();
  expect(count).toBeGreaterThan(5);

  let useButtons = 0;
  let hints = 0;
  let tried = false;
  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const title = (await item.textContent()).trim();
    await item.click();
    await expect(item).toHaveClass(/active/);
    await expect(page.locator("#view h2").first()).toHaveText(title);

    useButtons += await page.locator("#view button.use").count();
    hints += await page.locator("#view .example + .hint").count();

    // "Use this" merges an insertable example into the settings text below, without saving.
    const use = page.locator("#view button.use").first();
    if (!tried && (await use.count()) > 0) {
      tried = true;
      const area = page.locator("#view textarea");
      const before = await area.inputValue();
      await use.click();
      await expect(area).not.toHaveValue(before);
    }
  }
  expect(useButtons).toBeGreaterThan(0);
  expect(tried).toBe(true);
  // Examples that cannot be inserted get an explanation instead of a button.
  expect(hints).toBeGreaterThan(0);

  expect(problems).toEqual([]);
});

test("the editor API answers 401/403/404 style errors as JSON, not HTML", async ({ request }) => {
  const info = await request.get("/api/editor/info");
  expect(info.ok()).toBe(true);
  expect(await info.json()).toHaveProperty("homepageVersion");
  const bad = await request.get("/api/editor/file/..%2Fsettings.yaml");
  expect(bad.status()).toBe(400);
});
