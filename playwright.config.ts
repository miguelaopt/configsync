import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: process.env.CI ? `pnpm start -p ${port}` : `pnpm dev -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(port),
      BETTER_AUTH_URL: baseURL,
      NEXT_PUBLIC_APP_URL: baseURL,
      // Plans on (dummy Paddle values, no network) so the Free limit is exercised.
      PADDLE_API_KEY: "e2e-dummy",
      PADDLE_WEBHOOK_SECRET: "e2e-dummy",
      PADDLE_PRICE_MONTHLY: "pri_e2e_monthly",
      PADDLE_PRICE_LIFETIME: "pri_e2e_lifetime",
      NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_e2e",
      NEXT_PUBLIC_PADDLE_ENV: "sandbox",
    },
  },
});
