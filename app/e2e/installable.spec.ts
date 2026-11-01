import { expect, test } from "@playwright/test";
import { openMore, signUpAndOnboard } from "./helpers";

/** The installable app (docs/plans/installable-app.md): a manifest and icons, the page's links to them, and the More rows. */
test("the app has a manifest with real icons, and the page links to them", async ({ page, request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  const manifest = (await response.json()) as { name: string; short_name: string; start_url: string; display: string; scope: string; icons: { src: string; sizes: string; type: string; purpose?: string }[] };
  expect(manifest).toMatchObject({ name: "MakerFlow", short_name: "MakerFlow", start_url: "/app", display: "standalone", scope: "/" });
  expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) {
    const png = await request.get(icon.src);
    expect(png.status(), icon.src).toBe(200);
    expect(png.headers()["content-type"]).toContain("image/png");
    expect((await png.body()).subarray(1, 4).toString()).toBe("PNG");
  }
  expect((await request.get("/icons/apple-touch-icon.png")).status()).toBe(200);

  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon\.png/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  await expect(page.locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]').first()).toHaveAttribute("content", "yes");
});

test("More has Tell another maker, which copies a link where there is no share sheet, and no install row in a normal browser", async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signUpAndOnboard(page, "install-more", "Install Co");
  // No share sheet in this browser: the link is copied instead.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });
  await page.goto("/app");
  await openMore(page);
  await expect(page.getByTestId("install-row")).toHaveCount(0);
  await page.getByTestId("share-row").click();
  await expect(page.getByText("Link copied. Paste it into a message.")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("MakerFlow");
  expect(copied).toContain("http://localhost:3000");
});

/** The card on Home that shows a new maker on a phone how to add the app (docs/plans/installable-app.md, follow-up). */
test("a new maker on an Android phone sees the steps once, and never again after the first visit, pressed or not", async ({ page }) => {
  test.setTimeout(120_000);
  // signUpAndOnboard ends on Home: this is the first visit, and the only one the prompt is shown on.
  await signUpAndOnboard(page, "install-card-android", "Install Card Android Co");
  const card = page.getByTestId("install-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Put MakerFlow on your home screen");
  await expect(card).toContainText("Install app");
  await expect(card).not.toContainText("Safari");
  // Moving between tabs does not take it away before it is read.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Quotes" }).click();
  await expect(page.getByRole("heading", { name: "Quotes", level: 1 })).toBeVisible();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home" }).click();
  await expect(card).toBeVisible();
  // Not pressed Got it, but it has been seen: a fresh load does not bring it back.
  await page.reload();
  await expect(page.getByTestId("business-name")).toBeVisible();
  await expect(card).toHaveCount(0);
});

test("Got it closes the prompt", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "install-card-done", "Install Card Done Co");
  const card = page.getByTestId("install-card");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Got it" }).click();
  await expect(card).toHaveCount(0);
});

test("where the browser offers an install, the card has one button that asks it", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "install-card-prompt", "Install Card Prompt Co");
  await expect(page.getByTestId("install-card")).toBeVisible();
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    (window as unknown as { __asked: number }).__asked = 0;
    event.prompt = async () => {
      (window as unknown as { __asked: number }).__asked++;
    };
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
  await page.getByRole("button", { name: "Install MakerFlow" }).click();
  expect(await page.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(1);
  // Once installed, it is gone.
  await expect(page.getByTestId("install-card")).toHaveCount(0);
});

test.describe("an iPhone in Safari", () => {
  test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" });
  test("is told where Share and Add to Home Screen are", async ({ page }) => {
    test.setTimeout(120_000);
    await signUpAndOnboard(page, "install-card-ios", "Install Card IOS Co");
    const card = page.getByTestId("install-card");
    await expect(card).toContainText("Share button");
    await expect(card).toContainText("Add to Home Screen");
    await expect(card).not.toContainText("Install app");
  });
});
