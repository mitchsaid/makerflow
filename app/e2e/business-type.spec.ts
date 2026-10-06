import { expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, uniqueEmail, waitForSignInLink } from "./helpers";

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
  await expect(page.getByText(/We use this to show examples that fit your business, and nothing else/)).toBeVisible();
  await page.getByRole("checkbox", { name: "Food and baking" }).check();
  await page.getByRole("checkbox", { name: "Workshops and classes" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/app$/);
  // Asked once: going back to it goes straight to Home.
  await page.goto("/onboarding/type");
  await expect(page).toHaveURL(/\/app$/);

  await openBusinessProfile(page);
  await page.getByRole("link", { name: "Manage quote policies" }).click();
  await expect(page.getByTestId("showing-types")).toContainText("Showing examples for food and baking and workshops and classes");
  // No prompt: they answered.
  await expect(page.getByTestId("business-type-prompt")).toHaveCount(0);
  // Theirs first, the rest kept under "More examples".
  const first = exampleLinks(page).locator("ul").first().getByRole("link").first();
  await expect(first).toContainText(/made to order|Storage and serving|Handmade|Allergies|Collection|bookings|Changes after/i);
  await expect(exampleLinks(page).getByRole("link", { name: "Storage and serving" })).toBeVisible();
  await expect(exampleLinks(page).getByRole("link", { name: "Seasonal substitutions" })).toBeHidden();
  await page.getByTestId("more-examples").locator("summary").click();
  await expect(exampleLinks(page).getByRole("link", { name: "Seasonal substitutions" })).toBeVisible();

  // The new policy form orders them the same way, and the units suggest what fits.
  await page.getByRole("link", { name: "Add a policy" }).click();
  await expect(page.getByTestId("examples").getByRole("button", { name: "Storage and serving" })).toBeVisible();
  await expect(page.getByTestId("examples").getByRole("button", { name: "Seasonal substitutions" })).toBeHidden();
  await page.goto("/app/products/new");
  const units = await page.locator("datalist option").evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
  expect(units).toContain("dozen");
  expect(units.indexOf("dozen")).toBeLessThan(units.indexOf("stem"));
});

test("skipping asks again once on the policies page, and Not now is remembered; the profile can set it later", async ({ page }) => {
  await signUpToTypeStep(page, "Skip Co");
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/app$/);

  await openBusinessProfile(page);
  await page.getByRole("link", { name: "Manage quote policies" }).click();
  // No answer: today's list, in its usual order, and a friendly card.
  await expect(page.getByTestId("showing-types")).toHaveCount(0);
  await expect(exampleLinks(page).getByRole("link")).toHaveCount(13);
  await expect(page.getByTestId("business-type-prompt")).toBeVisible();
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByTestId("business-type-prompt")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("business-type-prompt")).toHaveCount(0);

  // It can still be answered in the Business profile.
  await openBusinessProfile(page);
  await page.getByRole("checkbox", { name: "Flowers and plants" }).check();
  await page.getByRole("button", { name: "Save what you make" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." }).last()).toBeVisible();
  await page.getByRole("link", { name: "Manage quote policies" }).click();
  await expect(page.getByTestId("showing-types")).toContainText("Showing examples for flowers and plants");
  await expect(exampleLinks(page).locator("ul").first().getByRole("link").first()).toContainText(/Seasonal substitutions|Handmade|made to order|Changes after/);
});

test("the prompt on the policies page saves what they tick, and 'Something else' is not asked again", async ({ page }) => {
  await signUpToTypeStep(page, "Prompt Co");
  await page.getByRole("button", { name: "Skip for now" }).click();
  await openBusinessProfile(page);
  await page.getByRole("link", { name: "Manage quote policies" }).click();
  await page.getByTestId("business-type-prompt").getByRole("checkbox", { name: "Something else" }).check();
  await page.getByRole("button", { name: "Show examples for me" }).click();
  await expect(page.getByTestId("business-type-prompt")).toHaveCount(0);
  // "Something else" says nothing about which examples fit: the usual list, no "showing" line.
  await expect(page.getByTestId("showing-types")).toHaveCount(0);
  await expect(exampleLinks(page).getByRole("link")).toHaveCount(13);
});
