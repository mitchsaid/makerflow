import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Some sandboxes ship a preinstalled Chromium instead of Playwright's own download.
const sandboxChromium = "/opt/pw-browsers/chromium";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (existsSync(sandboxChromium) ? sandboxChromium : undefined);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // The tests run against the dev server, which compiles each page the first time it is
  // opened. Under a full parallel run that first compile can pass the default 5 s wait (seen
  // once on a step right after a page change), so assertions wait up to 10 s.
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
