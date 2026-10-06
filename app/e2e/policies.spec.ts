import { expect, test, type Page } from "@playwright/test";
import { openDocuments, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, openQuotes, sheet } from "./quote-helpers";

async function openPolicies(page: Page) {
  await openDocuments(page);
  await page.getByRole("link", { name: "Manage quote policies" }).click();
  await expect(page.getByRole("heading", { name: "Quote policies", level: 1 })).toBeVisible();
}

/** Adds a policy from one of the examples on the library page. */
async function addPolicyFromExample(page: Page, example: string, includeByDefault = true) {
  await page.getByTestId("example-links").getByRole("link", { name: example }).click();
  if (includeByDefault) await page.getByRole("checkbox", { name: "Include on new quotes" }).check();
  await page.getByRole("button", { name: "Save policy" }).click();
  await expect(page.getByTestId("policy-saved")).toBeVisible();
}

test("the policy library: your own title and wording, examples to start from, good to know, saving", async ({ page }) => {
  await signUpAndOnboard(page, "pol-library", "Policy Co");
  await openPolicies(page);
  // No fixed headings: an empty list, a way to add your own, and examples to start from.
  await expect(page.getByTestId("no-policies")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Expected variations", level: 2 })).toHaveCount(0);
  await expect(page.getByTestId("example-links").getByRole("link")).toHaveCount(13);

  await page.getByRole("link", { name: "Add a policy" }).click();
  await expect(page.getByRole("heading", { name: "Add a policy", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("");
  await expect(page.getByText(/not legal advice/)).toBeVisible();
  await expect(page.getByTestId("good-to-know")).toHaveCount(0);

  // Saving with nothing says how to fix it, at the field and in a summary.
  await page.getByRole("button", { name: "Save policy" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("Give the policy a title");
  await expect(page.getByTestId("form-summary")).toContainText("Write what the policy says");
  await expect(page.getByLabel("Wording")).toHaveAttribute("aria-invalid", "true");

  // An example fills in the title and the wording, with a plain note; its blanks are in square brackets.
  await page.getByRole("button", { name: "If you cancel: made to order" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("If you cancel: made to order");
  await expect(page.getByLabel("Wording")).toHaveValue(/This is made to order for you\.[\s\S]*\[amount or %\]/);
  await expect(page.getByTestId("good-to-know")).toContainText("real costs");
  await expect(page.getByTestId("coming-soon").filter({ hasText: "Cancellation stages" })).toBeVisible();
  // Another example can replace it while it is still untouched.
  await page.getByRole("button", { name: "If you cancel: bookings and services" }).click();
  await expect(page.getByTestId("good-to-know")).toContainText("hospital or has died");

  // Once it is edited, examples no longer overwrite it.
  await page.getByLabel("Wording").fill("You pay the deposit of 50%, plus materials already bought and work done.");
  await expect(page.getByRole("button", { name: "If you cancel: made to order" })).toBeDisabled();
  await expect(page.getByText(/Clear the title and wording to pick a different one/)).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("If you cancel");
  await page.getByRole("checkbox", { name: "Include on new quotes" }).check();
  await page.getByRole("button", { name: "Save policy" }).click();
  await expect(page.getByTestId("policy-saved")).toContainText("Saved “If you cancel”");
  const card = page.getByRole("list", { name: "Your policies" }).getByRole("link", { name: /If you cancel/ });
  await expect(card).toContainText("On new quotes");
  await expect(card).toContainText("You pay the deposit of 50%");

  // A policy written from scratch, with no example, in the maker's own words.
  await page.getByRole("link", { name: "Add a policy" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Our studio rules");
  await page.getByLabel("Wording").fill("Shoes off at the door, please.");
  await page.getByRole("button", { name: "Save policy" }).click();
  await expect(page.getByTestId("policy-saved")).toContainText("Saved “Our studio rules”");
  // They stay in the order they were added.
  await expect(page.getByRole("list", { name: "Your policies" }).getByRole("listitem")).toHaveText([/If you cancel/, /Our studio rules/]);
});

test("policies on a quote: ticked by default, edited for this quote only, shown on the document, frozen from the library", async ({ page }) => {
  // A long walk through the library, a quote, its preview and archiving: it takes ~25 s alone.
  test.setTimeout(60_000);
  await signUpAndOnboard(page, "pol-quote", "Policy Co");
  await openPolicies(page);
  await addPolicyFromExample(page, "Changes after you say yes");
  await addPolicyFromExample(page, "Handmade and natural variations", false);

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

  // Edit the wording for this quote only.
  await page.getByLabel("Wording for this quote: Changes after you say yes").fill("Any change is re-quoted first. Dates move only if you agree.");
  await expect(page.getByRole("button", { name: "Use the saved wording again" })).toBeVisible();

  await fillItem(page, 1, "Wedding cake", "1", "800");
  await addCustomerInSheet(page, "Sarah");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  const quoteUrl = page.url().split("?")[0];
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /^Changes after you say yes/ })).toBeChecked();
  await expect(page.getByLabel("Wording for this quote: Changes after you say yes")).toHaveValue("Any change is re-quoted first. Dates move only if you agree.");

  // The document shows each policy under its own title, then the small print.
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  const text = page.getByRole("region", { name: "The quote as text" });
  await expect(text).toContainText("Terms and policies");
  await expect(text.getByRole("heading", { name: "Changes after you say yes", level: 4 })).toHaveCount(1);
  await expect(text).toContainText("Any change is re-quoted first. Dates move only if you agree.");
  await expect(text).toContainText("Handmade items and natural materials");

  // The saved policy was not changed by editing it on a quote.
  await openPolicies(page);
  await page.getByRole("list", { name: "Your policies" }).getByRole("link", { name: /^Changes after you say yes/ }).click();
  await expect(page.getByLabel("Wording")).toHaveValue(/Once you have said yes to this quote, any change is quoted again/);

  // Archiving hides it from new quotes; the quote that has it keeps its copy.
  await page.getByRole("button", { name: "Archive this policy" }).click();
  await expect(page).toHaveURL(/\/app\/documents\/policies$/);
  await page.goto("/app/quotes/new");
  await expect(page.getByRole("checkbox", { name: /^Changes after you say yes/ })).toHaveCount(0);
  await page.goto(quoteUrl);
  await expect(page.getByText(/No longer in your saved policies/)).toBeVisible();
  await expect(page.getByLabel("Wording for this quote: Changes after you say yes")).toHaveValue("Any change is re-quoted first. Dates move only if you agree.");
});

test("adding a policy from inside a quote keeps everything typed on the quote and ticks the new policy", async ({ page }) => {
  await signUpAndOnboard(page, "pol-sheet", "Policy Co");
  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();
  await expect(page.getByTestId("no-policies")).toBeVisible();
  await page.getByLabel("Quote title (optional)").fill("Wedding cake for Sarah");

  await page.getByRole("button", { name: "Add a policy" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Add a policy");
  await sheet(page).getByRole("button", { name: "Allergies and handling" }).click();
  await sheet(page).getByRole("button", { name: "Save policy" }).click();
  await expect(sheet(page)).toHaveCount(0);

  // The quote is as it was, and the new policy is ticked on it and saved to the library.
  await expect(page.getByLabel("Quote title (optional)")).toHaveValue("Wedding cake for Sarah");
  await expect(page.getByRole("checkbox", { name: /^Allergies and handling/ })).toBeChecked();
  await expect(page.getByLabel("Wording for this quote: Allergies and handling")).toHaveValue(/tell us about any allergies/);
  await expect(page).toHaveURL(/\/app\/quotes\/new$/);
  await openPolicies(page);
  await expect(page.getByRole("list", { name: "Your policies" }).getByRole("link", { name: /Allergies and handling/ })).toContainText("tell us about any allergies");
});
