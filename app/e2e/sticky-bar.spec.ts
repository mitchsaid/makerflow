import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, openQuotes } from "./quote-helpers";

/** Scrolls the page to `y` and returns where the action bar is on the screen. */
async function barTopAt(page: Page, y: "end" | number) {
  await page.evaluate((target) => {
    window.scrollTo(0, target === "end" ? document.documentElement.scrollHeight : target);
  }, y);
  await page.waitForTimeout(100);
  return page.getByTestId("action-bar").evaluate((el) => el.getBoundingClientRect().top);
}

async function maxScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
}

test("the action bar stays put at the end of the page, and nothing is hidden beneath it", async ({ page }) => {
  await signUpAndOnboard(page, "sticky", "Bar Co");
  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();
  await fillItem(page, 1, "Cake", "1", "100");
  await addCustomerInSheet(page, "Thandi");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();

  const viewport = page.viewportSize()!;
  const tabBarTop = await page.getByRole("navigation", { name: "Main" }).evaluate((el) => el.getBoundingClientRect().top);

  // On the draft: the bar is in the same place a long way from the end, and at the very end.
  const max = await maxScroll(page);
  expect(max).toBeGreaterThan(300);
  const farFromEnd = await barTopAt(page, max - 300);
  const atEnd = await barTopAt(page, "end");
  expect(Math.abs(atEnd - farFromEnd)).toBeLessThan(2);
  // It sits just above the tab bar.
  const barBottom = await page.getByTestId("action-bar").evaluate((el) => el.getBoundingClientRect().bottom);
  expect(Math.abs(barBottom - tabBarTop)).toBeLessThan(3);
  expect(barBottom).toBeLessThanOrEqual(viewport.height);

  // Delete draft is above the bar when scrolled to the end, fully visible and tappable.
  const deleteBox = (await page.getByRole("button", { name: "Delete draft" }).boundingBox())!;
  expect(deleteBox.y + deleteBox.height).toBeLessThanOrEqual(atEnd);
  await page.getByRole("button", { name: "Delete draft" }).click();
  await expect(page.getByRole("button", { name: "Yes, delete the draft" })).toBeVisible();
  // Asking to confirm grows the page; the bar is still where it was and the buttons are reachable.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const confirm = (await page.getByRole("button", { name: "Keep it" }).boundingBox())!;
  const barNow = await page.getByTestId("action-bar").evaluate((el) => el.getBoundingClientRect().top);
  expect(confirm.y + confirm.height).toBeLessThanOrEqual(barNow);
  await page.getByRole("button", { name: "Keep it" }).click();

  // The preview's bar behaves the same way.
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  const previewMax = await maxScroll(page);
  const previewFar = await barTopAt(page, Math.max(previewMax - 200, 0));
  const previewEnd = await barTopAt(page, "end");
  expect(Math.abs(previewEnd - previewFar)).toBeLessThan(2);
  const lastBox = (await page.getByTestId("coming-soon").last().boundingBox())!;
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(previewEnd);
});
