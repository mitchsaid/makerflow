import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

/**
 * A quote, an invoice and a job ask in the same order, with the same words (docs/ux-review-2026-10-25.md, N3), and the
 * order is the document's own, top to bottom: the number and dates, the customer, the items, delivery (founder, 2026-10-25).
 */

/** The sections of the form, in the order they appear on the screen. */
async function sections(page: Page, formId: string) {
  return page.locator(`#${formId} legend, [data-testid=${formId}] legend`).evaluateAll((legends) =>
    legends.filter((l) => l.closest("fieldset")?.parentElement?.closest("fieldset") == null).map((l) => (l.textContent ?? "").trim()),
  );
}
const ORDER = ["Dates", "Customer", "Items", "Delivery or collection"];
const inOrder = (names: string[]) => ORDER.filter((n) => names.includes(n));

test("new quote, new invoice and new job ask for the dates, the customer, the items, then delivery", async ({ page }) => {
  await signUpAndOnboard(page, "form-order", "Order Co");

  await page.goto("/app/quotes/new");
  const quote = await sections(page, "quote-form");
  // As the quote reads: its number and dates, who it is for, the intro, the items, delivery; then the money and the wording.
  expect(quote.slice(0, 5)).toEqual(["Quote number and dates", "Customer", "Intro (optional)", "Items", "Delivery or collection"]);
  expect(quote.at(-1)).toBe("Sign-off");
  await expect(page.getByRole("group", { name: "Quote number and dates" })).toContainText("QT-0001");
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
