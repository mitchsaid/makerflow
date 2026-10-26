import { expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, openDocuments, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, sheet, startSend } from "./quote-helpers";

/** Who signs a quote: the business name, the owner's name, or no name (docs/plans/quote-sign-off-name.md). */

const signOff = (page: Page) => page.getByRole("region", { name: "The quote as text" }).getByTestId("sign-off");

test("the owner's name, set in the Business profile and chosen as the usual, signs new quotes, and a sent quote keeps it", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "sign-owner", "Sweet Co");

  // The owner's name is a fact about the business.
  await openBusinessProfile(page);
  await page.getByLabel("Owner's name (optional)").fill("Thandi Nkosi");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  // Quote settings: sign with it from now on.
  await openDocuments(page);
  const signWith = page.getByLabel("Sign with", { exact: true });
  await expect(signWith).toHaveValue("business");
  await expect(signWith.locator("option")).toHaveText(["The business name (Sweet Co)", "The owner's name (Thandi Nkosi)", "Another name", "No name"]);
  await signWith.selectOption("owner");
  await page.getByRole("button", { name: "Save quote wording" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  // A new quote starts with it, and the preview signs with the owner's name under the message.
  await page.goto("/app/quotes/new");
  await expect(page.getByLabel("Sign with", { exact: true })).toHaveValue("owner");
  await fillItem(page, 1, "Wedding cake", "1", "800");
  await addCustomerInSheet(page, "Lerato Dlamini");
  await page.getByLabel("Sign-off (optional)").fill("Yours in sweetness");
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  await expect(signOff(page)).toContainText("Yours in sweetness");
  await expect(signOff(page)).toContainText("Thandi Nkosi");
  await expect(signOff(page)).not.toContainText("Sweet Co");
  await startSend(page);
  await sheet(page).getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();
  const quoteUrl = page.url().split("?")[0];

  // Changing the name later never changes a quote that was sent.
  await openBusinessProfile(page);
  await page.getByLabel("Owner's name (optional)").fill("T. Nkosi");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await page.goto(quoteUrl);
  await expect(signOff(page)).toContainText("Thandi Nkosi");
  await expect(signOff(page)).not.toContainText("T. Nkosi");
});

test("no name prints the message alone, and the owner's name with none saved holds sending and says how to fix it", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "sign-none", "Sweet Co");
  await page.goto("/app/quotes/new");
  await expect(page.getByLabel("Sign with", { exact: true })).toHaveValue("business");
  await fillItem(page, 1, "Cupcakes", "12", "15");
  await addCustomerInSheet(page, "Sam Jacobs");
  await page.getByLabel("Sign-off (optional)").fill("Kind regards");
  await page.getByLabel("Sign with", { exact: true }).selectOption("none");
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  await expect(signOff(page)).toHaveText("Kind regards");

  // The owner's name, with none saved: the form says so, and Mark as sent lists it with a way to fix it.
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByLabel("Sign with", { exact: true }).selectOption("owner");
  await expect(page.getByTestId("no-owner-name")).toContainText("No owner's name is saved yet.");
  await expect(page.getByTestId("no-owner-name").getByRole("link", { name: "Add it in the Business profile" })).toHaveAttribute("href", "/app/business");
  await startSend(page);
  await expect(sheet(page)).toContainText("No owner's name is saved yet. Add it in the Business profile, or choose another name.");
  await expect(sheet(page).getByRole("button", { name: "Change who signs" })).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "Mark as sent", exact: true })).toHaveCount(0);
});

test("another name: typed once in Quote settings, new quotes sign with it, and it is asked for when chosen without one", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "sign-other", "Sweet Co");

  await openDocuments(page);
  await page.getByLabel("Sign with", { exact: true }).selectOption("other");
  // Saving without the name says what to do, at the field.
  await page.getByRole("button", { name: "Save quote wording" }).click();
  await expect(page.locator("#wordingSignOffOther-error")).toHaveText("Enter the name to sign with, or choose another option.");
  await page.getByLabel("Name to sign with").fill("Studio Nkosi");
  await page.getByRole("button", { name: "Save quote wording" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  await page.goto("/app/quotes/new");
  await expect(page.getByLabel("Sign with", { exact: true })).toHaveValue("other");
  await expect(page.getByLabel("Name to sign with")).toHaveValue("Studio Nkosi");
  await fillItem(page, 1, "Bouquet", "1", "350");
  await addCustomerInSheet(page, "Ayanda Mokoena");
  await page.getByLabel("Sign-off (optional)").fill("With love");
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  await expect(signOff(page)).toContainText("With love");
  await expect(signOff(page)).toContainText("Studio Nkosi");
});
