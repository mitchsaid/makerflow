import { expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, openQuotes, sheet } from "./quote-helpers";

async function openPolicies(page: Page) {
  await openBusinessProfile(page);
  await page.getByRole("link", { name: "Manage quote policies" }).click();
  await expect(page.getByRole("heading", { name: "Quote policies", level: 1 })).toBeVisible();
}

/** Adds a policy under a heading using one of its starters. */
async function addPolicyFromStarter(page: Page, kindLink: string, starter: string, includeByDefault = true) {
  await page.getByRole("link", { name: kindLink }).click();
  await page.getByRole("button", { name: starter }).click();
  if (includeByDefault) await page.getByRole("checkbox", { name: "Include on new quotes" }).check();
  await page.getByRole("button", { name: "Save policy" }).click();
  await expect(page.getByTestId("policy-saved")).toBeVisible();
}

test("the policy library: starters, good to know, saving, and the headings", async ({ page }) => {
  await signUpAndOnboard(page, "pol-library", "Policy Co");
  await openPolicies(page);
  // The five headings are there, each with what it is for, and nothing is forced.
  for (const heading of ["Changes", "Cancellation", "Expected variations", "Client responsibilities", "Liability, warranty and aftercare"]) {
    await expect(page.getByRole("heading", { name: heading, level: 2 })).toBeVisible();
  }
  await expect(page.getByText("No policy here yet.")).toHaveCount(5);

  await page.getByRole("link", { name: "Add a cancellation policy" }).click();
  await expect(page.getByRole("heading", { name: "Add a policy", level: 1 })).toBeVisible();
  // Cancellation offers two starters, a plain note, the not-legal-advice line, and the stages table as coming soon.
  await expect(page.getByRole("button", { name: "Made-to-order items" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bookings and services" })).toBeVisible();
  await expect(page.getByTestId("good-to-know")).toContainText("hospital or has died");
  await expect(page.getByText(/not legal advice/)).toBeVisible();
  await expect(page.getByTestId("coming-soon").filter({ hasText: "Cancellation stages" })).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Cancellation");

  // Saving with nothing written says how to fix it, at the field and in a summary.
  await page.getByRole("button", { name: "Save policy" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("Write what the policy says");
  await expect(page.getByLabel("Wording")).toHaveAttribute("aria-invalid", "true");

  // A starter fills the wording; its blanks are in square brackets; it can be edited; not added twice.
  await page.getByRole("button", { name: "Made-to-order items" }).click();
  await expect(page.getByLabel("Wording")).toHaveValue(/This is made to order for you\.[\s\S]*\[amount or %\]/);
  await expect(page.getByRole("button", { name: "Made-to-order items" })).toBeDisabled();
  await page.getByLabel("Wording").fill("You pay the deposit of 50%, plus materials already bought and work done.");
  await page.getByLabel("Title", { exact: true }).fill("If you cancel");
  await page.getByRole("checkbox", { name: "Include on new quotes" }).check();
  await page.getByRole("button", { name: "Save policy" }).click();
  await expect(page.getByTestId("policy-saved")).toContainText("Saved “If you cancel”");
  const card = page.getByRole("link", { name: /If you cancel/ });
  await expect(card).toContainText("On new quotes");
  await expect(card).toContainText("You pay the deposit of 50%");

  // Changing the heading renames a title that still has the old heading's name.
  await page.getByRole("link", { name: "Add a changes policy" }).click();
  await page.getByLabel("Heading").selectOption("variations");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Expected variations");
  await expect(page.getByTestId("good-to-know")).toContainText("Say this before the customer agrees");
});

test("policies on a quote: ticked by default, edited for this quote only, shown on the document, frozen from the library", async ({ page }) => {
  await signUpAndOnboard(page, "pol-quote", "Policy Co");
  await openPolicies(page);
  await addPolicyFromStarter(page, "Add a changes policy", "Re-quote changes");
  await addPolicyFromStarter(page, "Add a expected variations policy", "Handmade and natural", false);

  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();
  // Marked for new quotes: ticked, with its wording. The other is offered, not ticked.
  const changes = page.getByRole("checkbox", { name: /^Changes/ });
  await expect(changes).toBeChecked();
  await expect(page.getByLabel("Wording for this quote: Changes")).toHaveValue(/any change is quoted again/);
  const variations = page.getByRole("checkbox", { name: /^Expected variations/ });
  await expect(variations).not.toBeChecked();
  await variations.check();
  await expect(page.getByLabel("Wording for this quote: Expected variations")).toHaveValue(/Handmade items and natural materials/);

  // Edit the wording for this quote only.
  await page.getByLabel("Wording for this quote: Changes").fill("Any change is re-quoted first. Dates move only if you agree.");
  await expect(page.getByRole("button", { name: "Use the saved wording again" })).toBeVisible();

  await fillItem(page, 1, "Wedding cake", "1", "800");
  await addCustomerInSheet(page, "Sarah");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  const quoteUrl = page.url().split("?")[0];
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /^Changes/ })).toBeChecked();
  await expect(page.getByLabel("Wording for this quote: Changes")).toHaveValue("Any change is re-quoted first. Dates move only if you agree.");

  // The document shows the policies under their own headings, then other terms.
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  const text = page.getByRole("region", { name: "The quote as text" });
  await expect(text).toContainText("Terms and policies");
  await expect(text.getByRole("heading", { name: "Changes", level: 4 })).toHaveCount(1);
  await expect(text).toContainText("Any change is re-quoted first. Dates move only if you agree.");
  await expect(text).toContainText("Handmade items and natural materials");

  // The saved policy was not changed by editing it on a quote.
  await openPolicies(page);
  await page.getByRole("link", { name: /^Changes/ }).first().click();
  await expect(page.getByLabel("Wording")).toHaveValue(/Once you have said yes to this quote, any change is quoted again/);

  // Archiving hides it from new quotes; the quote that has it keeps its copy.
  await page.getByRole("button", { name: "Archive this policy" }).click();
  await expect(page).toHaveURL(/\/app\/business\/policies$/);
  await page.goto("/app/quotes/new");
  await expect(page.getByRole("checkbox", { name: /^Changes/ })).toHaveCount(0);
  await page.goto(quoteUrl);
  await expect(page.getByText(/no longer in your saved policies/)).toBeVisible();
  await expect(page.getByLabel("Wording for this quote: Changes")).toHaveValue("Any change is re-quoted first. Dates move only if you agree.");
});

test("adding a policy from inside a quote keeps everything typed on the quote and ticks the new policy", async ({ page }) => {
  await signUpAndOnboard(page, "pol-sheet", "Policy Co");
  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();
  await expect(page.getByTestId("no-policies")).toBeVisible();
  await page.getByLabel("Quote title (optional)").fill("Wedding cake for Sarah");

  await page.getByRole("button", { name: "Add a policy" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Add a policy");
  await sheet(page).getByLabel("Heading").selectOption("client_responsibilities");
  await sheet(page).getByRole("button", { name: "Allergies and handling" }).click();
  await sheet(page).getByRole("button", { name: "Save policy" }).click();
  await expect(sheet(page)).toHaveCount(0);

  // The quote is as it was, and the new policy is ticked on it and saved to the library.
  await expect(page.getByLabel("Quote title (optional)")).toHaveValue("Wedding cake for Sarah");
  await expect(page.getByRole("checkbox", { name: /^Client responsibilities/ })).toBeChecked();
  await expect(page.getByLabel("Wording for this quote: Client responsibilities")).toHaveValue(/tell us about any allergies/);
  await expect(page).toHaveURL(/\/app\/quotes\/new$/);
  await openPolicies(page);
  await expect(page.getByRole("link", { name: /Client responsibilities/ }).first()).toContainText("tell us about any allergies");
});
