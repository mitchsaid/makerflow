import { expect, test } from "@playwright/test";
import { existingEmailIds, signOut, uniqueEmail, waitForSignInLink } from "./helpers";

test("visitor can sign up by email link, name their business, and land in their workspace", async ({
  page,
}) => {
  const email = uniqueEmail("maker");

  await page.goto("/");
  await page.getByRole("link", { name: "Get started" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");

  // Open the link in a brand-new browser context, as if from a phone's mail app.
  const link = await waitForSignInLink(email);
  const other = await page.context().browser()!.newContext();
  const phone = await other.newPage();
  await phone.goto(link);

  await expect(phone).toHaveURL(/\/onboarding$/);
  await phone.getByLabel("Business name").fill("  Sweet   Nothings  ");
  await phone.getByRole("button", { name: "Continue" }).click();

  await expect(phone).toHaveURL(/\/app$/);
  await expect(phone.getByTestId("business-name")).toHaveText("Sweet Nothings");

  // Survives a reload, and returning users skip onboarding.
  await phone.reload();
  await expect(phone.getByTestId("business-name")).toHaveText("Sweet Nothings");
  await phone.goto("/onboarding");
  await expect(phone).toHaveURL(/\/app$/);

  // Sign out puts the protected pages out of reach again.
  await signOut(phone);
  await phone.goto("/app");
  await expect(phone).toHaveURL(/\/sign-in$/);
  await other.close();
});

test("returning user signs in again by email link and skips onboarding", async ({ browser }) => {
  const email = uniqueEmail("returning");

  async function requestLink(page: import("@playwright/test").Page) {
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByRole("status")).toContainText("Check your email");
  }

  // First visit: sign up and finish onboarding.
  const first = await browser.newContext();
  const p1 = await first.newPage();
  await requestLink(p1);
  const seen = await existingEmailIds(email);
  await p1.goto(await waitForSignInLink(email));
  await p1.getByLabel("Business name").fill("Returning Co");
  await p1.getByRole("button", { name: "Continue" }).click();
  await expect(p1.getByTestId("business-name")).toHaveText("Returning Co");
  await signOut(p1);
  await first.close();

  // Later visit, fresh browser: a different kind of email, straight to the workspace.
  const second = await browser.newContext();
  const p2 = await second.newPage();
  await requestLink(p2);
  await p2.goto(await waitForSignInLink(email, seen));
  await expect(p2).toHaveURL(/\/app$/);
  await expect(p2.getByTestId("business-name")).toHaveText("Returning Co");
  await second.close();
});

test("blank business name is rejected with a friendly message", async ({ browser, page }) => {
  const email = uniqueEmail("blank");
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(await waitForSignInLink(email));
  await expect(p).toHaveURL(/\/onboarding$/);
  await p.getByLabel("Business name").fill("   ");
  await p.getByRole("button", { name: "Continue" }).click();
  await expect(p.getByText("Please tell us what your business is called.")).toBeVisible();
  await expect(p).toHaveURL(/\/onboarding$/);
  await ctx.close();
});

test("signed-out visitors cannot reach protected pages", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("expired or reused sign-in link shows a clear message", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=not-a-real-token&type=email");
  await expect(page).toHaveURL(/\/sign-in\?error=link$/);
  await expect(page.getByText(/expired or was already used/)).toBeVisible();
});

test("open-redirect attempts are ignored", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=x&type=email&next=https://evil.example");
  await expect(page).toHaveURL(/localhost:3000\/sign-in/);
});
