import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard, uniqueEmail, waitForSignInLink } from "./helpers";

/**
 * "Coming from another tool?" (docs/plans/import-onboarding.md, slice 2). The browser tests run with a made-up key and a
 * stand-in for the AI service (e2e/fake-reader.mjs): a document containing BUSY, NOTHING or GARBAGE makes it answer that
 * way; anything else gets a canned reading. When the app was started without the key (a dev server already running),
 * the step is not there and these tests say so instead of failing.
 */
const pdf = (words = "") => ({ name: "quote.pdf", mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4\n${words}`) });

async function signUpToStartStep(page: Page, label: string, businessName: string) {
  const email = uniqueEmail(label);
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.goto(await waitForSignInLink(email));
  await page.getByLabel("Business name").fill(businessName);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  const heading = page.getByRole("heading", { name: "Coming from another tool?", level: 1 });
  await expect(heading.or(page.getByTestId("business-name"))).toBeVisible();
  test.skip(!(await heading.isVisible()), "The app was started without ANTHROPIC_API_KEY: let Playwright start the dev server (pnpm test:e2e), or set ANTHROPIC_API_KEY=test-key ANTHROPIC_BASE_URL=http://127.0.0.1:4010 and run node e2e/fake-reader.mjs.");
}

test("a quote is read, the form is filled in to check and save, and the items go on to the product import", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpToStartStep(page, "reader-ok", "Sweet Things Co");
  await expect(page.getByText("It is sent to our AI provider to be read, and is not kept.")).toBeVisible();

  await page.locator("#document").setInputFiles(pdf());
  await page.getByRole("button", { name: "Read it" }).click();
  await expect(page.getByRole("heading", { name: "Here's what we found" })).toBeVisible();

  // What was found is in the form, to check. The business keeps its own name.
  await expect(page.getByLabel("Business name")).toHaveValue("Sweet Things Co");
  await expect(page.getByText("The document says “Sweet Crumbs Bakery”.")).toBeVisible();
  await expect(page.getByLabel("Phone")).toHaveValue("082 555 1234");
  await expect(page.getByLabel("Email")).toHaveValue("hello@sweetcrumbs.example");
  await expect(page.getByLabel("City or town")).toHaveValue("Cape Town");
  await expect(page.getByLabel("Postal code")).toHaveValue("8001");
  await expect(page.getByRole("checkbox", { name: /registered for VAT/ })).toBeChecked();
  await expect(page.getByLabel("VAT number")).toHaveValue("4123456789");

  // Nothing is saved until Save; then it is, by the ordinary save.
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  // The items found go to the same check as any pasted list.
  await page.getByTestId("review-found-items").click();
  await expect(page).toHaveURL(/\/app\/products\/import\?from=document/);
  await expect(page.getByLabel("Your list")).toHaveValue(/Chocolate cake\t450,00/);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Check the products" }).click();
  await expect(page.getByTestId("import-summary")).toHaveText("2 products are ready to add.");
  await page.getByRole("button", { name: "Add 2 products" }).click();
  await expect(page.getByTestId("products-imported")).toHaveText("Added 2 products.");

  // The business details really were saved.
  await page.goto("/app/business");
  await expect(page.getByLabel("City or town")).toHaveValue("Cape Town");
});

test("when it can't help it says so and how to carry on, and Start fresh goes to Home", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpToStartStep(page, "reader-fail", "Fail Co");

  await page.getByRole("button", { name: "Read it" }).click();
  await expect(page.getByText("Choose a quote or invoice first")).toBeVisible();

  await page.locator("#document").setInputFiles({ name: "page.html", mimeType: "text/html", buffer: Buffer.from("<html><script>alert(1)</script></html>") });
  await page.getByRole("button", { name: "Read it" }).click();
  await expect(page.getByText("We can read a PDF, or a photo or screenshot")).toBeVisible();

  await page.locator("#document").setInputFiles(pdf("BUSY"));
  await page.getByRole("button", { name: "Read it" }).click();
  await expect(page.getByText("The reader is busy right now.")).toBeVisible();

  await page.locator("#document").setInputFiles(pdf("NOTHING"));
  await page.getByRole("button", { name: "Read it" }).click();
  await expect(page.getByText("We couldn't find any business details on that.")).toBeVisible();

  await page.locator("#document").setInputFiles(pdf("GARBAGE"));
  await page.getByRole("button", { name: "Read it" }).click();
  await expect(page.getByText("We couldn't read details from that.")).toBeVisible();

  await page.getByRole("link", { name: "Start fresh" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByTestId("business-name")).toHaveText("Fail Co");
});

test("the Business profile offers it too, and its Back goes back to the profile", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "reader-profile", "Profile Reader Co");
  await page.goto("/app/business");
  const link = page.getByTestId("fill-from-document");
  test.skip((await link.count()) === 0, "The app was started without ANTHROPIC_API_KEY.");
  await link.click();
  await expect(page.getByRole("heading", { name: "Coming from another tool?", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Start fresh" }).click();
  await expect(page).toHaveURL(/\/app\/business$/);
});
