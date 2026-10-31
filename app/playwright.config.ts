import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Some sandboxes ship a preinstalled Chromium instead of Playwright's own download.
const sandboxChromium = "/opt/pw-browsers/chromium";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (existsSync(sandboxChromium) ? sandboxChromium : undefined);

export default defineConfig({
  testDir: "./e2e",
  // Every test signs up its own person, so none depends on another: in CI they are shared out one by one across the
  // shards (a file would put the long walks on one shard). Locally they keep to a file at a time.
  fullyParallel: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // The tests run against the dev server, which compiles each page the first time it is
  // opened. Under a full parallel run that first compile can pass the default 5 s wait (seen
  // once on a step right after a page change), so assertions wait up to 10 s.
  expect: { timeout: 10_000 },
  // A whole test gets 60 s (the default is 30 s). The long quote walks (send, revise, policies) take
  // 20 to 30 s on their own, and the first compile of a page in the dev server adds more under load.
  timeout: 60_000,
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
    // Safari on an iPhone lays some things out differently (date fields, for one), and most of the people using
    // the app will be on one. Only the layout checks run here, in CI or when asked for (WEBKIT=1: needs
    // `pnpm exec playwright install webkit`).
    ...(process.env.CI || process.env.WEBKIT
      ? [{ name: "iphone", testMatch: /layout\.spec\.ts/, use: { ...devices["iPhone 14"] } }]
      : []),
  ],
  webServer: [
    // A stand-in for the AI service that reads documents, so the reader's screens can be walked (e2e/fake-reader.mjs).
    { command: "node e2e/fake-reader.mjs", url: "http://127.0.0.1:4010", reuseExistingServer: !process.env.CI, timeout: 30_000 },
    {
      command: "pnpm dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // The reader is switched on by a key; here it is a made-up one and the "service" is the stand-in above.
      env: { ANTHROPIC_API_KEY: "test-key", ANTHROPIC_BASE_URL: "http://127.0.0.1:4010" },
    },
  ],
});
