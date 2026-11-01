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
