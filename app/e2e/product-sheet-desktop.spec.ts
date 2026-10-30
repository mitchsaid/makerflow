import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

/** The product sheet over a quote, on a desktop-sized screen, where it is a dialog in the middle of the page. */
test.use({ viewport: { width: 1440, height: 800 }, isMobile: false, hasTouch: false });

test("saying a new product has variations keeps the sheet where it was scrolled to", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "desk-variations", "Desk Variations Co");
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Add new product" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Cake");
  await dialog.getByLabel("Price", { exact: true }).fill("450");

  const yes = dialog.getByRole("radio", { name: "Yes" });
  await yes.scrollIntoViewIfNeeded();
  const scrolled = await dialog.evaluate((el) => el.scrollTop);
  expect(scrolled).toBeGreaterThan(0);
  await yes.click();
  await expect(dialog.getByLabel("Variation name")).toBeVisible();
  // Stays where it was (give a late jump time to show).
  await page.waitForTimeout(600);
  expect(await dialog.evaluate((el) => el.scrollTop)).toBeGreaterThanOrEqual(scrolled - 5);
  await expect(dialog.getByLabel("Variation name")).toBeInViewport();
});
