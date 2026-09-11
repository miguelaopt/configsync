// Usage: node shot.mjs <out.png> <url> [width] [height] [--login email:pass] [--full]
import { chromium } from "@playwright/test";
const [out, url, w = "1280", h = "800", ...rest] = process.argv.slice(2);
const full = rest.includes("--full");
const li = rest.indexOf("--login");
const login = li >= 0 ? rest[li + 1] : null;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, storageState: process.env.STATE && (await import("node:fs")).existsSync(process.env.STATE) ? process.env.STATE : undefined });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
if (login) {
  const [email, password] = login.split(":");
  await page.goto("http://localhost:3000/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL(/dashboard|games/, { timeout: 15000 }).catch(() => {});
  if (process.env.STATE) await ctx.storageState({ path: process.env.STATE });
}
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: out, fullPage: full });
console.log("saved", out, "errors:", errors.length ? errors : "none");
await browser.close();
