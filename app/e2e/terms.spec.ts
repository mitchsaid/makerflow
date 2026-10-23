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
  await expect(page.getByTestId("examples-advice")).toContainText("not legal advice");

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
  await expect(page.getByText(/Clear the title and wording to pick another example/)).toBeVisible();
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

test("terms on a quote: on by default, added from the saved ones or written in the sheet, edited for this quote only, shown on the document, frozen from the library", async ({ page }) => {
  // A long walk through the library, a quote, its preview and archiving: it takes ~25 s alone.
  test.setTimeout(90_000);
  await signUpAndOnboard(page, "pol-quote", "Policy Co");
  await openTerms(page);
  await addPolicyFromExample(page, "Changes after you say yes");
  await addPolicyFromExample(page, "Handmade and natural variations", false);
  await addPolicyFromExample(page, "Deposit");

  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();
  // Marked for new quotes: on the quote as a row with a glimpse of its wording. The other is offered in the sheet.
  const termRow = (name: string | RegExp) => page.getByTestId("quote-term").filter({ hasText: name });
  await expect(termRow("Changes after you say yes")).toBeVisible();
  await expect(termRow("Changes after you say yes")).toContainText(/any change is quoted again/);
  await expect(termRow("Handmade and natural variations")).toHaveCount(0);
  // An untitled saved term is shown by its wording.
  await expect(termRow("A deposit is needed to start work.")).toBeVisible();

  // One way to add: the sheet lists the saved terms not on the quote; adding one takes it off the list.
  await page.getByRole("button", { name: "Add a term" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Add a term");
  await expect(sheet(page).getByRole("button", { name: /^Add Changes after you say yes/ })).toHaveCount(0);
  await sheet(page).getByRole("button", { name: /^Add Handmade and natural variations/ }).click();
  await expect(sheet(page).getByRole("button", { name: /^Add Handmade and natural variations/ })).toHaveCount(0);

  // A new term written right there is saved to the library and put on the quote.
  await sheet(page).getByRole("button", { name: "New term" }).click();
  await expect(sheet(page)).toHaveAccessibleName("New term");
  await sheet(page).getByLabel("Title (optional)").fill("Pick-up");
  await sheet(page).getByLabel("Wording").fill("From the studio in Observatory.");
  await sheet(page).getByRole("button", { name: "Save term" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(termRow("Pick-up")).toContainText("From the studio in Observatory.");
  // Focus is back on the button that opened the sheet.
  await expect(page.getByRole("button", { name: "Add a term" })).toBeFocused();

  // Edit the wording for this quote only; an empty wording says how to fix it, and the summary goes to it.
  await page.getByRole("button", { name: /^Change the wording for this quote: Changes after you say yes/ }).click();
  const wording = page.getByLabel("Wording for this quote: Changes after you say yes");
  await expect(wording).toHaveValue(/any change is quoted again/);
  await wording.fill("");
  await fillItem(page, 1, "Wedding cake", "1", "800");
  await addCustomerInSheet(page, "Sarah");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("Changes after you say yes");
  await page.getByTestId("form-summary").getByRole("link", { name: /Terms/ }).click();
  await expect(wording).toBeFocused();
  await wording.fill("Any change is re-quoted first. Dates move only if you agree.");
  await expect(page.getByRole("button", { name: "Use the saved wording again" })).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  const quoteUrl = page.url().split("?")[0];
  await page.reload();
  await expect(termRow("Changes after you say yes")).toContainText("Any change is re-quoted first. Dates move only if you agree.");
  await expect(termRow("Pick-up")).toContainText("From the studio in Observatory.");

  // The document shows one Terms section: each term under its title, or as a plain paragraph.
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
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

  // The saved term was not changed by editing it on a quote, and the term written in the sheet is in the library.
  await openTerms(page);
  await page.getByRole("list", { name: "Your terms" }).getByRole("link", { name: /^Changes after you say yes/ }).click();
  await expect(page.getByLabel("Wording")).toHaveValue(/Once you have said yes to this quote, any change is quoted again/);
  await page.goBack();
  await expect(page.getByRole("list", { name: "Your terms" }).getByRole("listitem")).toHaveCount(4);
  await page.getByRole("list", { name: "Your terms" }).getByRole("link", { name: /^Changes after you say yes/ }).click();

  // Archiving hides it from new quotes; the quote that has it keeps its copy.
  await page.getByRole("button", { name: "Archive this term" }).click();
  await expect(page).toHaveURL(/\/app\/documents\/policies$/);
  await page.goto("/app/quotes/new");
  await expect(termRow("Changes after you say yes")).toHaveCount(0);
  await page.goto(quoteUrl);
  await expect(page.getByText(/No longer in your saved terms/)).toBeVisible();
  await page.getByRole("button", { name: /^Change the wording for this quote: Changes after you say yes/ }).click();
  await expect(page.getByLabel("Wording for this quote: Changes after you say yes")).toHaveValue("Any change is re-quoted first. Dates move only if you agree.");
});

test("writing a new term from inside a quote keeps everything typed on the quote and puts the new term on it", async ({ page }) => {
  await signUpAndOnboard(page, "pol-sheet", "Policy Co");
  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();
  await expect(page.getByTestId("no-policies")).toBeVisible();
  await page.getByLabel("Description (optional)").fill("Wedding cake for Sarah");

  // Nothing saved yet: the sheet goes straight to writing one, with a few examples (the rest one tap away).
  await page.getByRole("button", { name: "Add a term" }).click();
  await expect(sheet(page)).toHaveAccessibleName("New term");
  const shown = await sheet(page).getByTestId("examples").getByRole("button").count();
  expect(shown).toBeLessThanOrEqual(4);
  await sheet(page).getByTestId("examples").getByText("More examples").click();
  await sheet(page).getByRole("button", { name: "Allergies and handling" }).click();
  await sheet(page).getByRole("button", { name: "Save term" }).click();
  await expect(sheet(page)).toHaveCount(0);

  // The quote is as it was, and the new term is on it and saved to the library.
  await expect(page.getByLabel("Description (optional)")).toHaveValue("Wedding cake for Sarah");
  await expect(page.getByTestId("quote-term").filter({ hasText: "Allergies and handling" })).toContainText(/tell us about any allergies/);
  await expect(page).toHaveURL(/\/app\/quotes\/new$/);
  await openTerms(page);
  await expect(page.getByRole("list", { name: "Your terms" }).getByRole("link", { name: /Allergies and handling/ })).toContainText("tell us about any allergies");
});
