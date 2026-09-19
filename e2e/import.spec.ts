import { randomUUID } from "node:crypto";
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { buildExportFile } from "../lib/import-export/serialize";
import type { ExportFile } from "../lib/import-export/schema";

let cookies: Awaited<ReturnType<BrowserContext["cookies"]>> = [];

// One account per project avoids exhausting the real five-signups/minute limit.
test.beforeAll(async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL });
  const response = await context.request.post("/api/auth/sign-up/email", {
    data: {
      name: "Import Player",
      email: `import-${randomUUID()}@example.com`,
      password: "import-password-123",
    },
    headers: { Origin: baseURL! },
  });
  expect(response.ok()).toBe(true);
  cookies = await context.cookies();
  await context.close();
});

test.beforeEach(async ({ context }) => {
  await context.addCookies(cookies);
});

async function review(page: Page, file: ExportFile) {
  await page.goto("/import");
  await page.getByText("or paste JSON").click();
  await page.getByLabel("JSON to import").fill(JSON.stringify(file));
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.getByText("Found", { exact: true })).toBeVisible();
}

async function exported(page: Page): Promise<ExportFile> {
  const response = await page.request.get("/api/export?scope=library&format=json");
  expect(response.ok()).toBe(true);
  return response.json();
}

test("backup review is read-only and conflict strategies preserve the default", async ({
  page,
}, testInfo) => {
  const backup = buildExportFile(
    [
      {
        name: "Import Arena",
        platforms: ["PC"],
        tags: [],
        presets: [
          {
            name: "Main",
            tags: [],
            isDefault: true,
            categories: [
              { name: "Controls", settings: [{ name: "Sensitivity", type: "integer", value: 8 }] },
            ],
          },
        ],
      },
    ],
    "game",
  );

  await review(page, backup);
  expect((await exported(page)).games).toHaveLength(0);
  await page.getByRole("button", { name: "Import 1 preset", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Imported", exact: true })).toBeVisible();

  await review(page, backup);
  await page.getByRole("radio", { name: /Keep both/ }).check();
  await page.getByRole("button", { name: "Import 1 preset", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Imported", exact: true })).toBeVisible();
  let presets = (await exported(page)).games[0]!.presets;
  expect(presets.map((p) => p.name).sort()).toEqual(["Main", "Main (2)"]);
  expect(presets.filter((p) => p.isDefault)).toHaveLength(1);

  backup.games[0]!.presets[0]!.categories[0]!.settings[0]!.value = 12;
  // Replacing the current default keeps that role even if the incoming file isn't a default.
  backup.games[0]!.presets[0]!.isDefault = false;
  await review(page, backup);
  await page.getByRole("radio", { name: /Skip duplicates/ }).check();
  await page.getByRole("button", { name: "Nothing to import", exact: true }).click();
  await expect(page.getByText(/1 skipped/)).toBeVisible();
  expect((await exported(page)).games[0]!.presets).toEqual(presets);

  backup.games[0]!.presets.push({
    ...structuredClone(backup.games[0]!.presets[0]!),
    name: "Main (2)",
  });
  await review(page, backup);
  await page.getByRole("button", { name: "Compare differences" }).first().click();
  const comparison = page.getByRole("dialog", { name: "Main — compare differences", exact: true });
  await expect(comparison.getByText(/1 changed/)).toBeVisible();
  await expect(comparison.getByRole("cell", { name: "8", exact: true })).toBeVisible();
  await expect(comparison.getByRole("cell", { name: "12", exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("import-comparison.png"),
    animations: "disabled",
  });
  await comparison.getByRole("button", { name: "Close", exact: true }).click();
  expect((await exported(page)).games[0]!.presets).toEqual(presets);
  await page.getByRole("radio", { name: /Replace existing/ }).check();
  await page
    .getByRole("group", { name: "Resolve Main (2)", exact: true })
    .getByRole("radio", { name: "Keep current", exact: true })
    .check();
  await expect(page.getByText(/This cannot be undone/)).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: testInfo.outputPath("backup-review.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Import 1 preset", exact: true }).click();
  await expect(page.getByText(/1 replaced/)).toBeVisible();
  presets = (await exported(page)).games[0]!.presets;
  expect(presets).toHaveLength(2);
  expect(presets.filter((p) => p.isDefault).map((p) => p.name)).toEqual(["Main"]);
  expect(presets.find((p) => p.name === "Main")!.categories[0]!.settings[0]!.value).toBe(12);
  expect(presets.find((p) => p.name === "Main (2)")!.categories[0]!.settings[0]!.value).toBe(8);
  await page.goto("/import");
  await expect(
    page.getByRole("region", { name: "Recent imports" }).getByRole("listitem"),
  ).toHaveCount(3);
});

test("Rocket League files preview actual values before import", async ({ page }, testInfo) => {
  const before = await exported(page);
  await page.goto("/import?tab=files");
  await page.getByRole("combobox", { name: "Game", exact: true }).click();
  await page.getByRole("option", { name: "Rocket League", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("game-source.png"),
    fullPage: true,
    animations: "disabled",
  });
  const input = page.getByLabel(/config files here/);
  await input.setInputFiles(["tests/fixtures/TAInput.ini", "tests/fixtures/TASystemSettings.ini"]);
  await expect(page.getByRole("status")).toContainText("10 settings recognised");
  await page.getByRole("button", { name: "Review 10 settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review settings" })).toBeVisible();
  await expect(page.getByText("Catalog default", { exact: true }).first()).toBeVisible();
  expect((await exported(page)).games).toEqual(before.games);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: testInfo.outputPath("game-review.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Import preset", exact: true }).click();
  await page.getByRole("link", { name: "Open imported preset" }).click();
  await page.waitForURL("**/games/rocket-league/imported-*");
  await expect(page.getByLabel("Resolution width")).toHaveValue("1920");

  await page.goto("/import?tab=files");
  await page.getByLabel(/config files here/).setInputFiles({
    name: "cs2_video.txt",
    mimeType: "text/plain",
    buffer: Buffer.from('"video.cfg" {}'),
  });
  await expect(page.getByRole("status")).toContainText("0 settings recognised");
  await expect(page.getByRole("button", { name: "Review 0 settings", exact: true })).toBeDisabled();
});
