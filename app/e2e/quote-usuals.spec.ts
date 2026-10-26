import { expect, test } from "@playwright/test";
import { openDocuments, signUpAndOnboard } from "./helpers";
import { fillItem } from "./quote-helpers";

/**
 * "Use this … on new quotes" (docs/plans/use-on-new-quotes.md): one tick at the end of a section says whether what is on
 * the quote is what new quotes start with, and changes that at once. "Use my usual" puts the usual back.
 */

test("the intro: ticked, new quotes start with it; changed, the tick is off and the usual can be put back", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "us-desc", "Usual Co");

  // Nothing saved yet: a new quote starts with a generic suggestion, and there is nothing of the maker's own to keep.
  await page.goto("/app/quotes/new");
  const intro = page.getByLabel("Intro (optional)");
  const tick = page.getByRole("checkbox", { name: "Use this intro on new quotes" });
  await expect(intro).toHaveValue("Thank you for your interest. Below is what I would prepare for you.");
  await expect(tick).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use my usual intro" })).toHaveCount(0);

  // Their own words can be kept, in one tap. (The page must be awake before typing.)
  await page.waitForLoadState("networkidle");
  await intro.fill("Thank you for asking about your order.");
  await expect(tick).not.toBeChecked();
  await tick.check();
  await expect(page.getByText("New quotes now start with this intro.")).toBeVisible();
  await expect(tick).toBeChecked();

  // The next new quote starts with it, ticked; Quote settings shows it too.
  await page.goto("/app/quotes/new");
  await expect(page.getByLabel("Intro (optional)")).toHaveValue("Thank you for asking about your order.");
  await expect(page.getByRole("checkbox", { name: "Use this intro on new quotes" })).toBeChecked();
  await openDocuments(page);
  await expect(page.getByLabel("Intro (optional)")).toHaveValue("Thank you for asking about your order.");

  // Changed on a quote: not the usual any more, and it can be put back.
  await page.goto("/app/quotes/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Intro (optional)").fill("Just for this one.");
  await expect(page.getByRole("checkbox", { name: "Use this intro on new quotes" })).not.toBeChecked();
  await page.getByRole("button", { name: "Use my usual intro" }).click();
  await expect(page.getByLabel("Intro (optional)")).toHaveValue("Thank you for asking about your order.");
  await expect(page.getByText("Using your usual intro.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use my usual intro" })).toHaveCount(0);

  // Unticked: new quotes go back to the generic start.
  await page.getByRole("checkbox", { name: "Use this intro on new quotes" }).uncheck();
  await expect(page.getByText("New quotes no longer start with this intro.")).toBeVisible();
  await page.goto("/app/quotes/new");
  await expect(page.getByLabel("Intro (optional)")).toHaveValue("Thank you for your interest. Below is what I would prepare for you.");
});

test("the sign-off (its message and who signs) and the ways to pay are kept for new quotes with their ticks", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "us-wording", "Wording Co");
  await page.goto("/app/quotes/new");
  // The generic message, signed by the business, is not something of theirs to keep.
  await expect(page.getByLabel("Sign-off (optional)")).toHaveValue("Thank you for the opportunity to quote. Please get in touch with any questions.");
  await expect(page.getByRole("checkbox", { name: "Use this sign-off on new quotes" })).toHaveCount(0);

  // (Typing while the page is still waking up can land in front of the text instead of replacing it: type until it takes.)
  const message = page.getByLabel("Sign-off (optional)");
  await expect(async () => {
    await message.fill("Kind regards");
    await expect(message).toHaveValue("Kind regards", { timeout: 1_000 });
  }).toPass();
  await page.getByLabel("Sign with", { exact: true }).selectOption("other");
  await page.getByLabel("Name to sign with").fill("Studio Wording");
  await page.getByRole("checkbox", { name: "Use this sign-off on new quotes" }).check();
  await expect(page.getByText("New quotes now start with this sign-off.")).toBeVisible();
  await page.getByLabel("Other ways to pay (optional)").fill("EFT to Wording Co");
  await page.getByRole("checkbox", { name: "Use these ways to pay on new quotes" }).check();
  await expect(page.getByText("New quotes now start with these ways to pay.")).toBeVisible();

  await page.goto("/app/quotes/new");
  await expect(page.getByLabel("Sign-off (optional)")).toHaveValue("Kind regards");
  await expect(page.getByLabel("Sign with", { exact: true })).toHaveValue("other");
  await expect(page.getByLabel("Name to sign with")).toHaveValue("Studio Wording");
  await expect(page.getByLabel("Other ways to pay (optional)")).toHaveValue("EFT to Wording Co");
  await expect(page.getByRole("checkbox", { name: "Use this sign-off on new quotes" })).toBeChecked();
});

test("a deposit is kept for new quotes with its tick, and put back with Use my usual", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "us-deposit", "Deposit Usual Co");
  await page.goto("/app/quotes/new");
  const section = page.getByRole("group", { name: "Deposit" });

  // Nothing is offered while there is no deposit; adding one and giving a percentage offers to keep it.
  await expect(section.getByRole("checkbox", { name: "Use this deposit on new quotes" })).toHaveCount(0);
  await page.getByRole("button", { name: "Add a deposit" }).click();
  await section.getByLabel("Percentage (%)").fill("50");
  await section.getByRole("checkbox", { name: "Use this deposit on new quotes" }).check();
  await expect(page.getByText("New quotes now start with this deposit.")).toBeVisible();

  // A new quote starts with it; changing it unticks it and offers to go back.
  await page.goto("/app/quotes/new");
  await expect(section.getByLabel("Percentage (%)")).toHaveValue("50");
  await expect(section.getByRole("checkbox", { name: "Use this deposit on new quotes" })).toBeChecked();
  await section.getByLabel("Percentage (%)").fill("30");
  await expect(section.getByRole("checkbox", { name: "Use this deposit on new quotes" })).not.toBeChecked();
  await section.getByRole("button", { name: "Use my usual deposit" }).click();
  await expect(section.getByLabel("Percentage (%)")).toHaveValue("50");
});

test("a discount is kept for new quotes with its tick, starts every new quote open, and unticking stops it", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "us-discount", "Discount Usual Co");
  await page.goto("/app/quotes/new");
  const section = page.getByRole("group", { name: "Discount" });
  const tick = page.getByRole("checkbox", { name: "Use this discount on new quotes" });

  // Nothing is offered until there is a discount with an amount; then one tap keeps it.
  await page.getByRole("button", { name: "Add a discount" }).click();
  await expect(tick).toHaveCount(0);
  await section.getByLabel("Discount (%)").fill("10");
  await tick.check();
  await expect(page.getByText("New quotes now start with this discount.")).toBeVisible();

  // A new quote starts with it, already open and ticked; changing it offers to go back.
  await page.goto("/app/quotes/new");
  await expect(page.getByLabel("Discount on the whole quote")).toHaveValue("percent");
  await expect(page.getByLabel("Discount (%)")).toHaveValue("10");
  await expect(tick).toBeChecked();
  await page.getByLabel("Discount (%)").fill("15");
  await page.getByRole("button", { name: "Use my usual discount" }).click();
  await expect(page.getByLabel("Discount (%)")).toHaveValue("10");
  await expect(page.getByText("Using your usual discount.")).toBeVisible();

  // Unticked: new quotes start without a discount (Quote settings agrees).
  await tick.uncheck();
  await expect(page.getByText("New quotes no longer start with this discount.")).toBeVisible();
  await page.goto("/app/quotes/new");
  await expect(page.getByRole("button", { name: "Add a discount" })).toBeVisible();
  await openDocuments(page, "Starting values");
  await expect(page.locator("#discount-default").getByLabel("Discount on a new quote")).toHaveValue("none");
});

test("delivery or collection, and a term, are kept for new quotes with their ticks", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "us-handover", "Handover Co");
  await page.goto("/app/quotes/new");
  await page.waitForLoadState("networkidle");

  // Not decided yet: nothing to keep. Collection: one tap keeps the choice (the fee and address are each quote's).
  await expect(page.getByRole("checkbox", { name: /new quotes with (delivery|collection)/ })).toHaveCount(0);
  await page.getByRole("radio", { name: /Collection/ }).check();
  await page.getByRole("checkbox", { name: "Start new quotes with collection" }).check();
  await expect(page.getByText("New quotes now start with this choice.")).toBeVisible();

  // A term written on the quote goes into the saved terms; its tick puts it on every new quote.
  await page.getByRole("button", { name: "Add a term" }).click();
  await page.getByRole("dialog").getByLabel("Wording").fill("Orders need two days' notice.");
  await page.getByRole("dialog").getByRole("button", { name: "Save term" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const term = page.getByTestId("quote-term").filter({ hasText: "Orders need two days' notice." });
  await term.getByRole("checkbox", { name: /to new quotes$/ }).check();
  await expect(term.getByText("New quotes now start with this term.")).toBeVisible();

  await page.goto("/app/quotes/new");
  await expect(page.getByRole("radio", { name: /Collection/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Start new quotes with collection" })).toBeChecked();
  await expect(page.getByTestId("quote-term").filter({ hasText: "Orders need two days' notice." })).toBeVisible();
});

test("\"I decide on each quote\": a new quote opens the deposit choice with nothing chosen, and saves fine without one", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "us-ask", "Ask Co");
  await openDocuments(page, "Starting values");
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
  await expect(section.getByRole("checkbox", { name: /on new quotes/ })).toHaveCount(0);

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
