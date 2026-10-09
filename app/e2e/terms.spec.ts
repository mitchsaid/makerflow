import { expect, test, type Page } from "@playwright/test";
import { openDocuments, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, openQuotes, sheet } from "./quote-helpers";

async function openTerms(page: Page) {
  await openDocuments(page);
  await page.getByRole("link", { name: "Manage your terms" }).click();
  await expect(page.getByRole("heading", { name: "Terms", level: 1 })).toBeVisible();
}

/** Adds a term from one of the examples on the library page. */
async function addPolicyFromExample(page: Page, example: string, includeByDefault = true) {
  await page.getByTestId("example-links").getByRole("link", { name: example }).click();
  if (includeByDefault) await page.getByRole("checkbox", { name: "Include on new quotes" }).check();
  await page.getByRole("button", { name: "Save term" }).click();
  await expect(page.getByTestId("policy-saved")).toBeVisible();
}

test("the terms library: an optional title, your own wording, examples to start from, saving", async ({ page }) => {
  await signUpAndOnboard(page, "pol-library", "Policy Co");
  await openTerms(page);
  // No fixed headings: an empty list, a way to add your own, and examples to start from.
  await expect(page.getByTestId("no-policies")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Expected variations", level: 2 })).toHaveCount(0);
  // The country's 13 examples, and the 5 short lines that were the old Terms box's starters.
  await expect(page.getByTestId("example-links").getByRole("link")).toHaveCount(18);

  await page.getByRole("link", { name: "Add a term" }).click();
  await expect(page.getByRole("heading", { name: "Add a term", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Title (optional)")).toHaveValue("");
  await expect(page.getByText(/not legal advice/)).toBeVisible();

  // Saving with nothing says how to fix it, at the field and in a summary. Only the wording is needed.
  await page.getByRole("button", { name: "Save term" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("Write what the term says");
  await expect(page.getByTestId("form-summary")).not.toContainText("Title");
  await expect(page.getByLabel("Wording")).toHaveAttribute("aria-invalid", "true");

  // An example fills in the title and the wording, with a plain note; its blanks are in square brackets.
  await page.getByRole("button", { name: "If you cancel: made to order" }).click();
  await expect(page.getByLabel("Title (optional)")).toHaveValue("If you cancel: made to order");
  await expect(page.getByLabel("Wording")).toHaveValue(/This is made to order for you\.[\s\S]*\[amount or %\]/);
  await expect(page.getByTestId("coming-soon").filter({ hasText: "Cancellation stages" })).toBeVisible();
  // Another example can replace it while it is still untouched.
  await page.getByRole("button", { name: "If you cancel: bookings and services" }).click();
  await expect(page.getByLabel("Wording")).toHaveValue(/in hospital, or the person it is for has died/);

  // Once it is edited, examples no longer overwrite it.
  await page.getByLabel("Wording").fill("You pay the deposit of 50%, plus materials already bought and work done.");
  await expect(page.getByRole("button", { name: "If you cancel: made to order" })).toBeDisabled();
  await expect(page.getByText(/Clear the title and wording to pick a different one/)).toBeVisible();
  await page.getByLabel("Title (optional)").fill("If you cancel");
  await page.getByRole("checkbox", { name: "Include on new quotes" }).check();
  await page.getByRole("button", { name: "Save term" }).click();
  await expect(page.getByTestId("policy-saved")).toContainText("Saved “If you cancel”");
  const card = page.getByRole("list", { name: "Your terms" }).getByRole("link", { name: /If you cancel/ });
  await expect(card).toContainText("On new quotes");
  await expect(card).toContainText("You pay the deposit of 50%");

  // A term written from scratch, with no example, in the maker's own words.
  await page.getByRole("link", { name: "Add a term" }).click();
  await page.getByLabel("Title (optional)").fill("Our studio rules");
  await page.getByLabel("Wording").fill("Shoes off at the door, please.");
  await page.getByRole("button", { name: "Save term" }).click();
  await expect(page.getByTestId("policy-saved")).toContainText("Saved “Our studio rules”");
  // They stay in the order they were added.
  await expect(page.getByRole("list", { name: "Your terms" }).getByRole("listitem")).toHaveText([/If you cancel/, /Our studio rules/]);

  // A short line with no title, from the quick lines: shown by its wording.
  await page.getByTestId("example-links").getByRole("link", { name: "Lead time" }).click();
  await expect(page.getByLabel("Title (optional)")).toHaveValue("");
  await expect(page.getByLabel("Wording")).toHaveValue("Please allow [2 weeks] to make your order.");
  await page.getByLabel("Wording").fill("Please allow 2 weeks to make your order.");
  await page.getByRole("button", { name: "Save term" }).click();
  await expect(page.getByTestId("policy-saved")).toContainText("Saved “Please allow 2 weeks to make your order.”");
  await expect(page.getByRole("list", { name: "Your terms" }).getByRole("listitem")).toHaveText([
    /If you cancel/,
    /Our studio rules/,
    /Please allow 2 weeks to make your order\./,
  ]);
});

test("terms on a quote: ticked by default, edited for this quote only, one-off terms, shown on the document, frozen from the library", async ({ page }) => {
  // A long walk through the library, a quote, its preview and archiving: it takes ~25 s alone.
  test.setTimeout(60_000);
  await signUpAndOnboard(page, "pol-quote", "Policy Co");
  await openTerms(page);
  await addPolicyFromExample(page, "Changes after you say yes");
  await addPolicyFromExample(page, "Handmade and natural variations", false);
  await addPolicyFromExample(page, "Deposit");

  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();
  // Marked for new quotes: ticked, with its wording. The other is offered, not ticked.
  const changes = page.getByRole("checkbox", { name: /^Changes after you say yes/ });
  await expect(changes).toBeChecked();
  await expect(page.getByLabel("Wording for this quote: Changes after you say yes")).toHaveValue(/any change is quoted again/);
  const variations = page.getByRole("checkbox", { name: /^Handmade and natural variations/ });
  await expect(variations).not.toBeChecked();
  await variations.check();
  await expect(page.getByLabel("Wording for this quote: Handmade and natural variations")).toHaveValue(/Handmade items and natural materials/);

  // An untitled saved term is ticked by its wording.
  await expect(page.getByRole("checkbox", { name: "A deposit is needed to start work." })).toBeChecked();

  // A term just for this quote: a title is optional; with no wording it says how to fix it.
  await page.getByRole("button", { name: "Add a term just for this quote" }).click();
  const own = page.getByRole("group", { name: "Term just for this quote" });
  await own.getByLabel("Title (optional)").fill("Pick-up");

  // Edit the wording for this quote only.
  await page.getByLabel("Wording for this quote: Changes after you say yes").fill("Any change is re-quoted first. Dates move only if you agree.");
  await expect(page.getByRole("button", { name: "Use the saved wording again" })).toBeVisible();

  await fillItem(page, 1, "Wedding cake", "1", "800");
  await addCustomerInSheet(page, "Sarah");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("Pick-up: Write what the term says");
  await page.getByTestId("form-summary").getByRole("link", { name: /Terms/ }).click();
  await expect(own.getByLabel("Wording")).toBeFocused();
  await own.getByLabel("Wording").fill("From the studio in Observatory.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  const quoteUrl = page.url().split("?")[0];
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /^Changes after you say yes/ })).toBeChecked();
  await expect(page.getByLabel("Wording for this quote: Changes after you say yes")).toHaveValue("Any change is re-quoted first. Dates move only if you agree.");
  await expect(own.getByLabel("Title (optional)")).toHaveValue("Pick-up");
  await expect(own.getByLabel("Wording")).toHaveValue("From the studio in Observatory.");

  // The document shows one Terms section: each term under its title, or as a plain paragraph.
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  const text = page.getByRole("region", { name: "The quote as text" });
  const terms = text.getByRole("region", { name: "Terms" });
  await expect(terms.getByRole("heading", { name: "Terms", level: 3 })).toHaveCount(1);
  await expect(text).not.toContainText("Terms and policies");
  await expect(terms.getByRole("heading", { name: "Changes after you say yes", level: 4 })).toHaveCount(1);
  await expect(terms.getByRole("heading", { name: "Pick-up", level: 4 })).toHaveCount(1);
  await expect(terms).toContainText("From the studio in Observatory.");
  await expect(terms).toContainText("A deposit is needed to start work.");
  await expect(terms.getByRole("heading", { level: 4 })).toHaveCount(3);
  await expect(text).toContainText("Any change is re-quoted first. Dates move only if you agree.");
  await expect(text).toContainText("Handmade items and natural materials");

  // The saved term was not changed by editing it on a quote, and the one-off term was not saved to the library.
  await openTerms(page);
  await page.getByRole("list", { name: "Your terms" }).getByRole("link", { name: /^Changes after you say yes/ }).click();
  await expect(page.getByLabel("Wording")).toHaveValue(/Once you have said yes to this quote, any change is quoted again/);
  await page.goBack();
  await expect(page.getByRole("list", { name: "Your terms" }).getByRole("listitem")).toHaveCount(3);
  await page.getByRole("list", { name: "Your terms" }).getByRole("link", { name: /^Changes after you say yes/ }).click();

  // Archiving hides it from new quotes; the quote that has it keeps its copy.
  await page.getByRole("button", { name: "Archive this term" }).click();
  await expect(page).toHaveURL(/\/app\/documents\/policies$/);
  await page.goto("/app/quotes/new");
  await expect(page.getByRole("checkbox", { name: /^Changes after you say yes/ })).toHaveCount(0);
  await page.goto(quoteUrl);
  await expect(page.getByText(/No longer in your saved terms/)).toBeVisible();
  await expect(page.getByLabel("Wording for this quote: Changes after you say yes")).toHaveValue("Any change is re-quoted first. Dates move only if you agree.");
});

test("saving a new term from inside a quote keeps everything typed on the quote and ticks the new term", async ({ page }) => {
  await signUpAndOnboard(page, "pol-sheet", "Policy Co");
  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();
  await expect(page.getByTestId("no-policies")).toBeVisible();
  await page.getByLabel("Quote title (optional)").fill("Wedding cake for Sarah");

  await page.getByRole("button", { name: "Save a new term" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Save a new term");
  await sheet(page).getByRole("button", { name: "Allergies and handling" }).click();
  await sheet(page).getByRole("button", { name: "Save term" }).click();
  await expect(sheet(page)).toHaveCount(0);

  // The quote is as it was, and the new term is ticked on it and saved to the library.
  await expect(page.getByLabel("Quote title (optional)")).toHaveValue("Wedding cake for Sarah");
  await expect(page.getByRole("checkbox", { name: /^Allergies and handling/ })).toBeChecked();
  await expect(page.getByLabel("Wording for this quote: Allergies and handling")).toHaveValue(/tell us about any allergies/);
  await expect(page).toHaveURL(/\/app\/quotes\/new$/);
  await openTerms(page);
  await expect(page.getByRole("list", { name: "Your terms" }).getByRole("link", { name: /Allergies and handling/ })).toContainText("tell us about any allergies");
});
