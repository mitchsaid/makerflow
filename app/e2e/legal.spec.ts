import { expect, test } from "@playwright/test";
import { openMore, signUpAndOnboard } from "./helpers";

/** The privacy policy and terms (docs/plans/legal-pages.md): public draft pages, linked from where people need them. */
test("the privacy policy and terms are public, say they are a draft, and name the services", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy policy", level: 1 })).toBeVisible();
  await expect(page.getByTestId("legal-draft")).toContainText("not yet been checked by a lawyer");
  await expect(page.getByRole("heading", { name: "Uploading a quote or invoice" })).toBeVisible();
  const services = page.getByRole("list", { name: "Services we use" });
  await expect(services).toContainText("Supabase");
  await expect(services).toContainText("Vercel");
  await expect(services).toContainText("Anthropic");
  await expect(page.getByTestId("legal-contact")).toBeVisible();

  await page.getByRole("link", { name: "Read the terms of use" }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { name: "Terms of use", level: 1 })).toBeVisible();
  await expect(page.getByText("not tax, legal or accounting advice")).toBeVisible();
  await expect(page.getByTestId("legal-draft")).toBeVisible();
});

test("they are linked from the landing page, the sign-in page and the More tab", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page).toHaveURL(/\/privacy$/);

  await page.goto("/sign-in");
  await expect(page.getByText("By continuing you agree to the")).toBeVisible();
  await page.getByRole("link", { name: "terms", exact: true }).click();
  await expect(page).toHaveURL(/\/terms$/);

  await signUpAndOnboard(page, "legal-links", "Legal Co");
  await openMore(page);
  await page.getByRole("link", { name: /Privacy and terms/ }).click();
  await expect(page).toHaveURL(/\/privacy$/);
});

test("the document reader's screen links to how a document is handled", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "legal-reader", "Reader Legal Co");
  await page.goto("/onboarding/start?from=business");
  test.skip(!/onboarding\/start/.test(page.url()), "The app was started without ANTHROPIC_API_KEY.");
  const link = page.getByRole("link", { name: "How it is handled" });
  await expect(link).toHaveAttribute("href", "/privacy#documents");
});
