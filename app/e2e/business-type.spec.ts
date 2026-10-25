import { expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, openDocuments, uniqueEmail, waitForSignInLink } from "./helpers";

/** Signs up and stops on the "what do you make?" step. */
async function signUpToTypeStep(page: Page, businessName: string) {
  const email = uniqueEmail("types");
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.goto(await waitForSignInLink(email));
  await page.getByLabel("Business name").fill(businessName);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/onboarding\/type$/);
}

const exampleLinks = (page: Page) => page.getByTestId("example-links");

test("picking what you make puts the examples that fit first, and nothing is hidden", async ({ page }) => {
  await signUpToTypeStep(page, "Type Co");
  await expect(page.getByRole("heading", { name: "What do you make or sell?", level: 1 })).toBeVisible();
  await expect(page.getByText(/Used only to show fitting examples/)).toBeVisible();
  await page.getByRole("checkbox", { name: "Food and baking" }).check();
  await page.getByRole("checkbox", { name: "Workshops and classes" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/app$/);
  // Asked once: going back to it goes straight to Home.
  await page.goto("/onboarding/type");
  await expect(page).toHaveURL(/\/app$/);

  await openDocuments(page);
  await page.getByRole("link", { name: "Manage your terms" }).click();
  await expect(page.getByTestId("showing-types")).toContainText("Showing examples for food and baking and workshops and classes");
  // Nothing asked: they answered.
  await expect(page.getByTestId("types-link")).toHaveCount(0);
  // Theirs first, the rest kept under "More examples".
  const first = exampleLinks(page).locator("ul").first().getByRole("link").first();
  await expect(first).toContainText(/made to order|Storage and serving|Handmade|Allergies|Collection|bookings|Changes after/i);
  await expect(exampleLinks(page).getByRole("link", { name: "Storage and serving" })).toBeVisible();
  await expect(exampleLinks(page).getByRole("link", { name: "Seasonal substitutions" })).toBeHidden();
  await page.getByTestId("more-examples").locator("summary").click();
  await expect(exampleLinks(page).getByRole("link", { name: "Seasonal substitutions" })).toBeVisible();

  // The new term form orders them the same way, and the units suggest what fits.
  await page.getByRole("link", { name: "Add a term" }).click();
  await expect(page.getByTestId("examples").getByRole("button", { name: "Storage and serving" })).toBeVisible();
  await expect(page.getByTestId("examples").getByRole("button", { name: "Seasonal substitutions" })).toBeHidden();
  await page.goto("/app/products/new");
  const units = await page.locator("datalist option").evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
  expect(units).toContain("dozen");
  expect(units.indexOf("dozen")).toBeLessThan(units.indexOf("stem"));
});

test("skipping shows every example, and the terms page links to the Business profile, where it is asked", async ({ page }) => {
  await signUpToTypeStep(page, "Skip Co");
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/app$/);

  await openDocuments(page);
  await page.getByRole("link", { name: "Manage your terms" }).click();
  // No answer: today's list, in its usual order. It is not asked here: a link goes to where it is.
  await expect(page.getByTestId("showing-types")).toHaveCount(0);
  await expect(exampleLinks(page).getByRole("link")).toHaveCount(18);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByTestId("types-link").getByRole("link", { name: "say what you make" }).click();
  await expect(page.getByRole("heading", { name: "Business profile", level: 1 })).toBeVisible();

  // What you make is part of the details, saved with them.
  await page.getByRole("checkbox", { name: "Flowers and plants" }).check();
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Flowers and plants" })).toBeChecked();
  await openDocuments(page);
  await page.getByRole("link", { name: "Manage your terms" }).click();
  await expect(page.getByTestId("showing-types")).toContainText("Showing examples for flowers and plants");
  await expect(exampleLinks(page).locator("ul").first().getByRole("link").first()).toContainText(/Seasonal substitutions|Handmade|made to order|Changes after/);
});

test("'Something else' says nothing about which examples fit", async ({ page }) => {
  await signUpToTypeStep(page, "Other Co");
  await page.getByRole("button", { name: "Skip for now" }).click();
  await openBusinessProfile(page);
  await page.getByRole("checkbox", { name: "Something else" }).check();
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await openDocuments(page);
  await page.getByRole("link", { name: "Manage your terms" }).click();
  // The usual list, no "showing" line, and the link to say more.
  await expect(page.getByTestId("showing-types")).toHaveCount(0);
  await expect(page.getByTestId("types-link")).toBeVisible();
  await expect(exampleLinks(page).getByRole("link")).toHaveCount(18);
});
