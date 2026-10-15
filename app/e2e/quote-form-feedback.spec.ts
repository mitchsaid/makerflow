import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, openQuotes } from "./quote-helpers";

/** Founder feedback on the New quote screen (docs/plans/quote-form-feedback.md, slice A). */

test("the new quote reads like an app: no tagline, no title, optional parts offered, notes before the sign-off", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "qf-form", "Form Co");
  await page.goto("/app/quotes/new");
  await expect(page.getByRole("heading", { name: "New quote", level: 1 })).toBeVisible();

  // No tagline about numbering, no title box, and no back link (the X is the way out).
  await expect(page.getByText("It gets its number the first time you save it.")).toHaveCount(0);
  await expect(page.getByLabel("Quote title (optional)")).toHaveCount(0);
  await expect(page.getByTestId("back-link")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel new quote" })).toBeVisible();

  // Optional parts are offered, not shown.
  await expect(page.getByLabel("Needed by (optional)")).toHaveCount(0);
  await expect(page.getByLabel("Discount on the whole quote")).toHaveCount(0);
  await page.getByRole("button", { name: "Add a discount" }).click();
  await expect(page.getByLabel("Discount on the whole quote")).toBeFocused();
  await page.getByRole("button", { name: "Add a needed-by date" }).click();
  await expect(page.getByLabel("Needed by (optional)")).toBeFocused();

  // The form follows the printed quote: notes come just before the sign-off, after the terms and payment details.
  const order = await page.locator("legend").allTextContents();
  const at = (name: string) => order.findIndex((t) => t.trim() === name);
  expect(at("Terms")).toBeGreaterThan(-1);
  expect(at("Notes")).toBeGreaterThan(at("Terms"));
  expect(at("Notes")).toBeGreaterThan(at("How to pay") > -1 ? at("How to pay") : at("Terms"));
  expect(at("Sign-off")).toBe(at("Notes") + 1);
  await expect(page.getByText(/Payment details and terms have their own sections above/)).toBeVisible();
  await expect(page.getByText("Like “Yours in sweetness”")).toHaveCount(0);

  // The primary button is the next step.
  await expect(page.getByRole("button", { name: "Continue to preview", exact: true })).toBeVisible();
});

test("fixing a problem clears its message and its row in the summary at once", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "qf-errors", "Errors Co");
  await page.goto("/app/quotes/new");

  // Nothing yet: two things are missing.
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  const summary = page.getByTestId("form-summary");
  await expect(summary).toContainText("2 things need fixing");

  // Choosing a customer fixes one of them straight away, in the summary and at the field.
  await addCustomerInSheet(page, "Thandi Nkosi");
  await expect(summary).toContainText("1 thing needs fixing");
  await expect(summary).not.toContainText("Customer name");

  // Adding an item fixes the other, and the summary goes.
  await fillItem(page, 1, "Wedding cake", "1", "800");
  await expect(summary).toHaveCount(0);
});

test("a page under another goes back to its parent with a back control, not a text link", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "qf-back", "Back Co");

  // A new customer's page.
  await page.goto("/app/customers/new");
  await expect(page.getByRole("link", { name: "Customers", exact: true })).toHaveCount(0);
  const back = page.getByRole("link", { name: "Back to Customers" });
  await expect(back).toBeVisible();
  const box = await back.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await back.click();
  await expect(page.getByRole("heading", { name: "Customers", level: 1 })).toBeVisible();

  // A saved quote goes back to the quotes list.
  await openQuotes(page);
  await page.getByRole("link", { name: /Start your first quote|New quote/ }).first().click();
  await fillItem(page, 1, "Cake", "1", "100");
  await addCustomerInSheet(page, "Sipho");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  await page.getByRole("link", { name: "Back to Quotes" }).click();
  await expect(page.getByRole("heading", { name: "Quotes", level: 1 })).toBeVisible();
});
