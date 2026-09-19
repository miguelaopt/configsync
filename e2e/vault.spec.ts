import { test, expect, type Page } from "@playwright/test";

/**
 * Full product walk-through: account → game → preset → category → settings → edit →
 * duplicate → compare → copy → export → import → archive/delete.
 * Runs on both the desktop and mobile projects (see playwright.config.ts).
 */

const unique = Date.now().toString(36);
const email = `e2e-${unique}@example.com`;
const password = "e2e-password-123";

test.describe.configure({ mode: "serial" });

async function signUp(page: Page) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("E2E Player");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

test("create account and see the empty dashboard", async ({ page }) => {
  await signUp(page);
  await expect(page.getByRole("heading", { name: /Hi E2E/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Build your library" })).toBeVisible();
  await expect(page.getByText("Your library is empty.")).toBeVisible();
});

test.describe("library flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard");
  });

  test("game → preset → category → settings → edit → duplicate → compare → copy → export → import → delete", async ({
    page,
    context,
    browserName,
  }) => {
    // --- Create game -------------------------------------------------------
    await page.goto("/games");
    await page.getByRole("button", { name: "Add game" }).first().click();
    const gameDialog = page.getByRole("dialog", { name: "Add a game" });
    await gameDialog.getByLabel("Name").fill("Test Arena");
    await gameDialog.getByLabel("Platforms").fill("PC");
    await gameDialog.getByLabel("Platforms").press("Enter");
    await gameDialog.getByRole("button", { name: "Add game" }).click();
    await page.waitForURL("**/games/test-arena");
    await expect(page.getByRole("heading", { name: "Test Arena" })).toBeVisible();

    // --- Create preset with starter categories ------------------------------
    await page.getByRole("button", { name: "New preset" }).click();
    const presetDialog = page.getByRole("dialog", { name: "New preset" });
    await presetDialog.getByLabel("Name").fill("Main Setup");
    await presetDialog.getByText("Starter categories").click();
    await presetDialog.getByRole("button", { name: "Create preset" }).click();
    await page.waitForURL("**/games/test-arena/main-setup");
    await expect(page.getByRole("heading", { name: "Controls" })).toBeVisible();

    // --- Add a custom category --------------------------------------------
    const addCategory = page.getByRole("button", { name: /Add category|^Add$/ }).first();
    await addCategory.click();
    const catDialog = page.getByRole("dialog", { name: "Add a category" });
    await catDialog.getByLabel("Name").fill("Mouse");
    await catDialog.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByRole("heading", { name: "Mouse" })).toBeVisible();

    // --- Add settings to Controls -------------------------------------------
    const addSetting = async (
      name: string,
      type: string,
      fillValue?: (dialog: ReturnType<Page["getByRole"]>) => Promise<void>,
    ) => {
      await page.getByRole("button", { name: "Add setting to Controls" }).click();
      const dialog = page.getByRole("dialog", { name: "Add a setting" });
      await dialog.getByLabel("Name", { exact: true }).fill(name);
      await dialog.getByLabel("Type").click();
      await page.getByRole("option", { name: new RegExp(`^${type}`) }).click();
      if (fillValue) await fillValue(dialog);
      await dialog.getByRole("button", { name: "Add setting" }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    };
    await addSetting("Sensitivity", "Whole number", async (dialog) => {
      await dialog.getByLabel("Min").fill("1");
      await dialog.getByLabel("Max").fill("20");
      await dialog.getByLabel("Sensitivity", { exact: true }).fill("8");
    });
    await addSetting("Vibration", "Toggle");
    await addSetting("Aim Assist", "Toggle", async (dialog) => {
      await dialog.getByRole("switch", { name: "Aim Assist" }).click();
    });

    // --- Inline edit + save -------------------------------------------------
    await page.getByRole("switch", { name: "Vibration" }).click();
    await expect(page.getByText("1 unsaved change")).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/Saved 1 change/)).toBeVisible();
    await expect(page.getByRole("switch", { name: "Vibration" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // --- Duplicate preset -------------------------------------------------
    await page.getByRole("button", { name: "Actions for Main Setup" }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await page.waitForURL("**/games/test-arena/main-setup-copy");
    await expect(page.getByRole("heading", { name: "Main Setup (copy)" })).toBeVisible();

    // change a value in the copy so compare has something to show
    await page.getByRole("switch", { name: "Vibration" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/Saved 1 change/)).toBeVisible();

    // --- Compare ------------------------------------------------------------
    await page.getByRole("link", { name: "Compare" }).click();
    await page.waitForURL(/\/compare\?a=/);
    await expect(page.getByRole("heading", { name: "Compare presets" })).toBeVisible();
    await expect(page.getByText("1 changed")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Vibration" })).toBeVisible();

    // --- Copy ---------------------------------------------------------------
    if (browserName === "chromium")
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/games/test-arena/main-setup");
    await page.getByRole("button", { name: /Copy preset as/ }).click();
    await expect(page.getByText(/Copied 3 settings as plain text/)).toBeVisible();
    if (browserName === "chromium") {
      const clip = await page.evaluate(() => navigator.clipboard.readText());
      expect(clip).toContain("Sensitivity: 8");
      expect(clip).toContain("Vibration: On");
    }

    // --- Export (download) --------------------------------------------------
    const downloadPromise = page.waitForEvent("download");
    await page.goto("/export");
    await page.getByRole("link", { name: "Download" }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/configsync-library-.*\.json/);
    const path = await download.path();
    const fs = await import("node:fs");
    const exported = JSON.parse(fs.readFileSync(path!, "utf8")) as {
      games: { name: string; presets: { name: string }[] }[];
    };
    expect(exported.games.map((g) => g.name)).toContain("Test Arena");

    // --- Import into a new game ---------------------------------------------
    const importFile = {
      ...exported,
      games: exported.games
        .filter((g) => g.name === "Test Arena")
        .map((g) => ({ ...g, name: "Imported Arena" })),
    };
    await page.goto("/import");
    await page.getByText("Or paste JSON").click();
    await page.getByLabel("JSON to import").fill(JSON.stringify(importFile));
    await expect(page.getByText("Looks good")).toBeVisible();
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Imported" })).toBeVisible();
    await page.getByRole("link", { name: "Open Imported Arena" }).click();
    await page.waitForURL("**/games/imported-arena");
    await expect(page.getByText("Main Setup", { exact: true })).toBeVisible();

    // --- Search -------------------------------------------------------------
    await page.goto("/search?q=Sensitivity");
    await expect(page.getByRole("heading", { name: /Settings/ })).toBeVisible();

    // --- Add from catalog ----------------------------------------------------
    await page.goto("/games");
    await page.getByRole("button", { name: "Add game" }).first().click();
    await page.getByRole("button", { name: /Counter-Strike 2/ }).click();
    await page.waitForURL("**/games/counter-strike-2");
    await page.getByRole("link", { name: "Default" }).click();
    await page.waitForURL("**/games/counter-strike-2/default");
    await expect(page.getByRole("heading", { name: "Video" })).toBeVisible();
    await expect(page.getByText("Multisampling Anti-Aliasing Mode")).toBeVisible();

    // --- Catalog entry already owned shows disabled -------------------------
    await page.goto("/games");
    await page.getByRole("button", { name: "Add game" }).first().click();
    await expect(page.getByRole("button", { name: /Counter-Strike 2/ })).toBeDisabled();
    await page.keyboard.press("Escape");

    // --- Free limit: a 4th active game is refused with a way out ------------
    await page.goto("/games");
    await page.getByRole("button", { name: "Add game" }).first().click();
    const fourth = page.getByRole("dialog", { name: "Add a game" });
    await fourth.getByLabel("Name").fill("Fourth Game");
    await fourth.getByRole("button", { name: "Add game" }).click();
    await expect(page.getByText("Free keeps up to 3 active games")).toBeVisible();
    await expect(page.getByRole("link", { name: "See plans" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto("/games");
    await expect(page.getByText("Fourth Game")).toHaveCount(0);
    await page.goto("/pricing");
    // exact: the footer has a "Product" column, and getByRole name matching is substring-based.
    await expect(page.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();

    // --- Import a real config file as a preset -------------------------------
    await page.goto("/import?tab=files");
    await expect(page.getByRole("tab", { name: "Game files" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.locator("#gf-video").setInputFiles("tests/fixtures/cs2_video.txt");
    await expect(page.getByRole("status")).toContainText("will be created");
    await page.getByRole("button", { name: "Import as preset" }).click();
    await page.waitForURL("**/games/counter-strike-2/imported-*");
    await expect(page.getByLabel("Resolution width")).toHaveValue("1280");

    // --- Public profile -----------------------------------------------------
    await page.goto("/games/test-arena/main-setup");
    await page.getByRole("button", { name: "Actions for Main Setup" }).click();
    await page.getByRole("menuitem", { name: "Make public" }).click();
    await expect(page.getByText("Preset is public")).toBeVisible();
    await page.goto("/settings");
    const username = await page.getByLabel("Username").inputValue();
    await page.getByLabel("Public profile").click();
    await page.getByLabel("Bio").fill("Settings I actually use.");
    await page.locator("#link-0").fill("https://twitch.tv/e2e-player");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved")).toBeVisible();
    const anon = await context.browser()!.newContext({ baseURL: new URL(page.url()).origin });
    const pub = await anon.newPage();
    await pub.goto(`/p/${username}`);
    await expect(pub.getByRole("heading", { name: "E2E Player" })).toBeVisible();
    await expect(pub.getByRole("link", { name: "Twitch" })).toBeVisible();
    await pub.getByRole("link", { name: "Main Setup" }).click();
    await expect(pub.getByRole("heading", { name: "Main Setup" })).toBeVisible();
    await expect(pub.getByText("Sensitivity")).toBeVisible();
    const privateRes = await pub.goto(`/p/${username}/test-arena/main-setup-copy`);
    expect(privateRes?.status()).toBe(404);
    await anon.close();

    // --- Archive + delete ---------------------------------------------------
    await page.goto("/games/imported-arena");
    await page.getByRole("button", { name: "Game actions" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await expect(page.getByText("Game archived")).toBeVisible();
    await page.getByRole("button", { name: "Game actions" }).click();
    await page.getByRole("menuitem", { name: "Delete game…" }).click();
    await page.getByRole("button", { name: "Delete game" }).click();
    await page.waitForURL("**/games");
    await expect(page.getByText("Imported Arena")).toHaveCount(0);
  });
});
