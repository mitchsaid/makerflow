import { expect, test } from "@playwright/test";
import { openDocuments, signUpAndOnboard } from "./helpers";
import { fillItem } from "./quote-helpers";

/** "Your usual" on the quote form (docs/plans/quote-form-feedback.md, slice B). */

test("the introduction is a usual: set once, every new quote starts with it, and a quote can save a new one", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "us-desc", "Usual Co");

  // Nothing saved yet: a new quote starts with a generic suggestion, and nothing is offered for saving until it is changed.
  await page.goto("/app/quotes/new");
  const description = page.getByLabel("Description (optional)");
  await expect(description).toHaveValue("Thank you for your interest. Below is what I would prepare for you.");
  await expect(page.getByRole("button", { name: "Save as my usual description" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use my usual description" })).toHaveCount(0);

  // Typing one offers to keep it, in one tap.
  await description.fill("Thank you for asking about your order.");
  await page.getByRole("button", { name: "Save as my usual description" }).click();
  await expect(page.getByText("Saved as your usual description.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save as my usual description" })).toHaveCount(0);

  // The next new quote starts with it, and Quotes and invoices shows it too.
  await page.goto("/app/quotes/new");
  await expect(page.getByLabel("Description (optional)")).toHaveValue("Thank you for asking about your order.");
  await openDocuments(page);
  await expect(page.getByLabel("Introduction (optional)")).toHaveValue("Thank you for asking about your order.");

  // Changed on a quote, it can be put back, or kept as the new usual.
  await page.goto("/app/quotes/new");
  await page.getByLabel("Description (optional)").fill("Just for this one.");
  await expect(page.getByRole("button", { name: "Use my usual description" })).toBeVisible();
  await page.getByRole("button", { name: "Use my usual description" }).click();
  await expect(page.getByLabel("Description (optional)")).toHaveValue("Thank you for asking about your order.");
  // It says what happened as a plain statement, not as an instruction.
  await expect(page.getByText("Using your usual description.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use my usual description" })).toHaveCount(0);
});

test("the sign-off and the other ways to pay can be saved as usuals from the quote", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "us-wording", "Wording Co");
  await page.goto("/app/quotes/new");
  // No example is suggested any more; the sign-off starts with a generic one, which is not offered for saving as it is.
  await expect(page.getByText("Like “Yours in sweetness”")).toHaveCount(0);
  await expect(page.getByLabel("Message (optional)")).toHaveValue("Thank you for the opportunity to quote. Please get in touch with any questions.");
  await expect(page.getByRole("button", { name: "Save as my usual sign-off" })).toHaveCount(0);

  await page.getByLabel("Message (optional)").fill("Kind regards");
  await page.getByRole("button", { name: "Save as my usual sign-off" }).click();
  await expect(page.getByText("Saved as your usual sign-off.")).toBeVisible();
  await page.getByLabel("Other ways to pay (optional)").fill("EFT to Wording Co");
  await page.getByRole("button", { name: "Save as my usual ways to pay" }).click();
  await expect(page.getByText("Saved as your usual ways to pay.")).toBeVisible();

  await page.goto("/app/quotes/new");
  await expect(page.getByLabel("Message (optional)")).toHaveValue("Kind regards");
  await expect(page.getByLabel("Other ways to pay (optional)")).toHaveValue("EFT to Wording Co");
});

test("a deposit can be saved as the usual from a quote, and put back", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "us-deposit", "Deposit Usual Co");
  await page.goto("/app/quotes/new");
  const section = page.getByRole("group", { name: "Deposit" });

  // Nothing is offered while there is no deposit; ticking one and giving a percentage offers to keep it.
  await expect(section.getByRole("button", { name: /my usual/ })).toHaveCount(0);
  await section.getByRole("checkbox", { name: "Ask for a deposit to start work" }).check();
  await section.getByLabel("Percentage (%)").fill("50");
  await section.getByRole("button", { name: "Save as my usual deposit" }).click();
  await expect(page.getByText("Saved as your usual deposit.")).toBeVisible();

  // A new quote starts with it; changing it offers to go back.
  await page.goto("/app/quotes/new");
  await expect(section.getByRole("checkbox", { name: "Ask for a deposit to start work" })).toBeChecked();
  await expect(section.getByLabel("Percentage (%)")).toHaveValue("50");
  await section.getByLabel("Percentage (%)").fill("30");
  await section.getByRole("button", { name: "Use my usual deposit" }).click();
  await expect(section.getByLabel("Percentage (%)")).toHaveValue("50");
});

test("a discount can be saved as the usual from a quote, starts every new quote open, and is changed or removed under Quotes and invoices", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "us-discount", "Discount Usual Co");
  await page.goto("/app/quotes/new");
  const section = page.getByRole("group", { name: "Discount" });

  // Nothing is offered until there is a discount with an amount; then one tap keeps it.
  await page.getByRole("button", { name: "Add a discount" }).click();
  await expect(section.getByRole("button", { name: /my usual/ })).toHaveCount(0);
  await section.getByLabel("Discount (%)").fill("10");
  await section.getByRole("button", { name: "Save as my usual discount" }).click();
  await expect(page.getByText("Saved as your usual discount.")).toBeVisible();

  // A new quote starts with it, already open; changing it offers to go back.
  await page.goto("/app/quotes/new");
  await expect(page.getByLabel("Discount on the whole quote")).toHaveValue("percent");
  await expect(page.getByLabel("Discount (%)")).toHaveValue("10");
  await expect(page.getByRole("button", { name: "Add a discount" })).toHaveCount(0);
  await page.getByLabel("Discount (%)").fill("15");
  await page.getByRole("button", { name: "Use my usual discount" }).click();
  await expect(page.getByLabel("Discount (%)")).toHaveValue("10");
  await expect(page.getByText("Using your usual discount.")).toBeVisible();

  // Under Quotes and invoices it can be changed, or taken away: new quotes then start without the discount.
  await openDocuments(page);
  const form = page.locator("#discount-default");
  await expect(form.getByLabel("Discount on a new quote")).toHaveValue("percent");
  await expect(form.getByLabel("Discount (%)")).toHaveValue("10");
  await form.getByLabel("Discount on a new quote").selectOption("none");
  await form.getByRole("button", { name: "Save discount" }).click();
  await expect(form.getByText("Saved.")).toBeVisible();
  await page.goto("/app/quotes/new");
  await expect(page.getByRole("button", { name: "Add a discount" })).toBeVisible();
  await expect(page.getByLabel("Discount on the whole quote")).toHaveCount(0);
});

test("\"I decide on each quote\": a new quote opens the deposit choice with nothing chosen, and saves fine without one", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "us-ask", "Ask Co");
  await openDocuments(page);
  const deposit = page.getByRole("group", { name: "Deposit" });
  await deposit.getByLabel("Deposit on a new quote").selectOption("ask");
  await expect(deposit.getByLabel("Percentage (%)")).toHaveCount(0);
  await page.getByRole("button", { name: "Save deposit" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  await page.goto("/app/quotes/new");
  const section = page.getByRole("group", { name: "Deposit" });
  const choice = section.getByRole("radiogroup");
  await expect(section.getByText("Do you want a deposit on this quote?")).toBeVisible();
  await expect(choice.getByRole("radio", { checked: true })).toHaveCount(0);
  // Nothing to fill in until a choice is made, and no usual is offered (the choice is made on every quote).
  await expect(section.getByLabel("Percentage (%)")).toHaveCount(0);
  await expect(section.getByRole("button", { name: /my usual/ })).toHaveCount(0);

  await section.getByRole("radio", { name: "A percentage of the total" }).check();
  await section.getByLabel("Percentage (%)").fill("25");
  await expect(section.getByLabel("Balance due")).toBeVisible();
  await section.getByRole("radio", { name: "No deposit" }).check();
  await expect(section.getByLabel("Percentage (%)")).toHaveCount(0);

  // A saved draft keeps the choice that was made (and still never offers to replace "I decide on each quote").
  await section.getByRole("radio", { name: "A percentage of the total" }).check();
  await section.getByLabel("Percentage (%)").fill("30");
  await fillItem(page, 1, "Cake", "1", "100");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  const saved = page.getByRole("group", { name: "Deposit" });
  await expect(saved.getByRole("radio", { name: "A percentage of the total" })).toBeChecked();
  await expect(saved.getByLabel("Percentage (%)")).toHaveValue("30");
  await expect(saved.getByRole("button", { name: /my usual/ })).toHaveCount(0);
});
