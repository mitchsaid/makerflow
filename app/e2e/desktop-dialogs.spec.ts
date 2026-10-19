import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

// On a computer screen a sheet opens as a dialog in the middle of the page, not as a drawer on the right edge
// (founder, 2026-10-19: "all crucial work is happening on the edge of the screen"). On a phone it is still a sheet.
test.describe("on a computer screen", () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

  test("a sheet opens in the middle of the page, with the page dimmed behind it", async ({ page }) => {
    await signUpAndOnboard(page, "desktop-dialog", "Desktop Co");
    await page.goto("/app/quotes/new");
    await page.getByRole("button", { name: "Add item" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Let the opening movement finish before measuring.
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
    const box = (await dialog.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - 640), "centred across the page").toBeLessThan(2);
    expect(Math.abs(box.y + box.height / 2 - 400), "centred down the page").toBeLessThan(2);
    expect(box.width, "a comfortable width").toBeLessThanOrEqual(672);
    expect(box.x, "clear of the edges").toBeGreaterThan(100);
    expect(box.height, "never taller than the screen allows").toBeLessThanOrEqual(800 * 0.85 + 1);
    await page.screenshot({ path: "test-results/desktop-dialog.png" });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});

test("on a phone a sheet still fills the screen from the edge", async ({ page }) => {
  await signUpAndOnboard(page, "phone-sheet", "Phone Co");
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const box = (await dialog.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x + box.width).toBeGreaterThanOrEqual(viewport.width - 1);
  expect(box.height).toBeGreaterThanOrEqual(viewport.height - 1);
});
