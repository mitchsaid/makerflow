import { expect, test } from "@playwright/test";
import { openBusinessProfile, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, openQuotes, sentQuote, sheet } from "./quote-helpers";

/** The quote flow, round two, slice 1 (docs/plans/quote-form-feedback-2.md). */

test("Mark as sent opens one short confirmation from the bottom, which Cancel closes", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "qf2-mark", "Confirm Co");
  await openBusinessProfile(page);
  await page.getByLabel("Phone", { exact: true }).fill("011 555 0101");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await openQuotes(page);
  await page.getByRole("link", { name: /Start your first quote|New quote/ }).first().click();
  await fillItem(page, 1, "Wedding cake", "1", "800");
  await addCustomerInSheet(page, "Thandi Nkosi");
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();

  await page.getByRole("button", { name: "Mark as sent", exact: true }).click();
  const confirm = sheet(page);
  await expect(confirm).toHaveAccessibleName("Mark this quote as sent");
  await expect(confirm).toContainText("That locks this version");
  // A short sheet at the bottom of the screen, not a whole screen.
  await expect(confirm.getByRole("button", { name: "Mark as sent", exact: true })).toBeVisible();
  const [box, viewport] = [await confirm.boundingBox(), page.viewportSize()!];
  expect(box!.y).toBeGreaterThan(viewport.height * 0.25);
  expect(box!.y + box!.height).toBeGreaterThanOrEqual(viewport.height - 1);

  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark as sent", exact: true })).toBeFocused();
});

test("on a sent quote, what to do next comes before the PDF, and the coming-soon cards come after it", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "qf2-next", "Next Co");
  await sentQuote(page);

  const next = page.getByRole("heading", { name: "What you can do next" });
  await expect(next).toBeVisible();
  await expect(page.getByTestId("pdf-pages")).toBeVisible();
  const y = async (locator: ReturnType<typeof page.locator>) => (await locator.boundingBox())!.y;
  const nextY = await y(next);
  const pdfY = await y(page.getByTestId("pdf-pages"));
  const soonY = await y(page.getByTestId("coming-soon").first());
  expect(nextY).toBeLessThan(pdfY);
  expect(soonY).toBeGreaterThan(pdfY);
  // The way to a job is said where the answer is asked for.
  await expect(page.getByText("When they accept, you can turn it into a job.")).toBeVisible();
});
