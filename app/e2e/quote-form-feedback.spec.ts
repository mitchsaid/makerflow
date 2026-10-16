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
  // It opens as a percentage (not as "No discount"), with the box ready to type in.
  await expect(page.getByLabel("Discount on the whole quote")).toHaveValue("percent");
  await expect(page.getByLabel("Discount (%)")).toBeFocused();
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

test("a problem that is fixed disappears; one that comes back after another save shows again", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "qf-return", "Return Co");
  await page.goto("/app/quotes/new");
  await fillItem(page, 1, "Cake", "1", "100");
  await addCustomerInSheet(page, "Thandi Nkosi");

  // A day before the quote's own date: refused at the field and in the summary.
  await page.getByLabel("Valid until").fill("2020-01-01");
  await page.getByRole("button", { name: "Save draft" }).click();
  const summary = page.getByTestId("form-summary");
  await expect(summary).toContainText("Valid until");
  await expect(page.locator("#validUntil-error")).toBeVisible();

  // A button that sets the date (not a typed field) fixes it as well.
  await page.getByRole("button", { name: "Valid for 30 days" }).click();
  await expect(page.locator("#validUntil-error")).toHaveCount(0);
  await expect(summary).toHaveCount(0);

  // Wrong again, saved again: the problem is shown again.
  await page.getByLabel("Valid until").fill("2020-01-01");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(summary).toContainText("Valid until");
  await expect(page.locator("#validUntil-error")).toBeVisible();
});

test("an optional part that was opened stays open while it is cleared, and focus stays put", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "qf-sticky", "Sticky Co");
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add a needed-by date" }).click();
  await page.getByLabel("Needed by (optional)").fill("2030-02-01");
  await page.getByLabel("Needed by (optional)").fill("");
  await expect(page.getByLabel("Needed by (optional)")).toBeVisible();

  await page.getByRole("button", { name: "Add a discount" }).click();
  // It opens as a percentage; the maker moves to the kind and chooses "No discount": the box goes, focus stays on the choice.
  await page.getByLabel("Discount on the whole quote").focus();
  await page.getByLabel("Discount on the whole quote").selectOption("none");
  await expect(page.getByLabel("Discount on the whole quote")).toBeFocused();
});

test("the action bar keeps its shape on any phone, whatever the total, and never runs off the screen", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "qf-bar", "Bar Co");
  await page.goto("/app/quotes/new");
  await fillItem(page, 1, "Cake", "1", "1234567");
  let height = 0;
  for (const width of [412, 393, 390, 360]) {
    await page.setViewportSize({ width, height: 800 });
    const bar = await page.getByTestId("action-bar").boundingBox();
    // Total and Save on one row, the next step on the row below: the same height at every phone width.
    if (height === 0) height = bar?.height ?? 0;
    expect(bar?.height, `bar height at ${width}px`).toBeCloseTo(height, 0);
    expect(height).toBeLessThan(125);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `sideways overflow at ${width}px`).toBeLessThanOrEqual(0);
    for (const name of ["Save draft", "Continue to preview"]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0), `${name} inside the screen at ${width}px`).toBeLessThanOrEqual(width);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  }
});
