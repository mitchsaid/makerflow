import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

/** A quote, an invoice and a job ask in the same order, with the same words (docs/ux-review-2026-10-25.md, N3). */

/** The sections of the form, in the order they appear on the screen. */
async function sections(page: Page, formId: string) {
  return page.locator(`#${formId} legend, [data-testid=${formId}] legend`).evaluateAll((legends) =>
    legends.filter((l) => l.closest("fieldset")?.parentElement?.closest("fieldset") == null).map((l) => (l.textContent ?? "").trim()),
  );
}
const ORDER = ["Customer", "Items", "Dates", "Delivery or collection"];
const inOrder = (names: string[]) => ORDER.filter((n) => names.includes(n));

test("new quote, new invoice and new job ask for the customer, the items, the dates, then delivery", async ({ page }) => {
  await signUpAndOnboard(page, "form-order", "Order Co");

  await page.goto("/app/quotes/new");
  const quote = await sections(page, "quote-form");
  expect(inOrder(quote)).toEqual(ORDER);
  // The wording comes after the money.
  expect(quote.indexOf("About this quote")).toBeGreaterThan(quote.indexOf("Dates"));
  // The pinned bar is the total; with no breakdown there is no second Totals card.
  await expect(page.getByTestId("totals")).toHaveCount(0);

  await page.goto("/app/invoices/new");
  await expect(page.getByLabel("Due date")).toBeVisible();
  expect(inOrder(await sections(page, "invoice-draft-form"))).toEqual(ORDER);
  await expect(page.getByTestId("totals")).toHaveCount(0);

  await page.goto("/app/jobs/new");
  await expect(page.getByRole("heading", { name: "New job", level: 1 })).toBeVisible();
  const job = await page.locator("main legend").evaluateAll((ls) => ls.map((l) => (l.textContent ?? "").trim()));
  expect(inOrder(job)).toEqual(ORDER);
});
