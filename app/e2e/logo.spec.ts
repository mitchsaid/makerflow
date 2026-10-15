import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { openBusinessProfile, openDocuments, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, openQuotes } from "./quote-helpers";

async function logoFile() {
  return sharp({ create: { width: 400, height: 150, channels: 3, background: "#1e3a8a" } }).png().toBuffer();
}

const chooseLogo = async (page: Page) =>
  page.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: await logoFile() });

/** A saved draft with one item and a customer, opened on its preview. */
async function previewOfNewQuote(page: Page) {
  await openQuotes(page);
  await page.getByRole("link", { name: /Start your first quote|New quote/ }).first().click();
  await fillItem(page, 1, "Wedding cake", "1", "800");
  await addCustomerInSheet(page, "Thandi Nkosi");
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\/preview$/);
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
}

test("the logo is set on the Business profile, and Quotes and invoices says where it went", async ({ page }) => {
  await signUpAndOnboard(page, "logo-profile", "Logo Co");
  await openBusinessProfile(page);
  await expect(page.getByRole("group", { name: "Your logo" })).toBeVisible();
  await chooseLogo(page);
  await expect(page.getByTestId("logoImage-preview")).toBeVisible();
  await page.getByRole("button", { name: "Save logo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("logoImage-preview")).toBeVisible();

  // It can be taken off again.
  await page.getByRole("button", { name: /^Remove/ }).click();
  await page.getByRole("button", { name: "Save logo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("logoImage-preview")).toHaveCount(0);

  // Quotes and invoices no longer holds it, and points to the Business profile.
  await openDocuments(page);
  await expect(page.getByRole("group", { name: "Your logo" })).toHaveCount(0);
  await page.getByRole("link", { name: "Business profile", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Business profile", level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/business#logo$/);
});

test("the quote preview offers the logo while there is none: add it there, or cancel", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "logo-prompt", "Prompt Co");
  await previewOfNewQuote(page);

  const prompt = page.getByTestId("logo-prompt");
  await expect(prompt).toContainText("Add your logo");
  await expect(prompt).toContainText("printed at the top of your quotes");
  const stampBefore = await page.getByTestId("pdf-pages").getAttribute("data-url");

  // The sheet holds the Business profile's logo form: Cancel closes it and the card stays, with focus back on its button.
  await prompt.getByRole("button", { name: "Add your logo" }).click();
  const sheet = page.getByRole("dialog", { name: "Add your logo" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Printed at the top of your quotes")).toBeVisible();
  await expect(sheet.getByRole("group", { name: "Your logo" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(prompt).toBeVisible();
  await expect(prompt.getByRole("button", { name: "Add your logo" })).toBeFocused();

  // Saving closes it, the card goes, focus lands on the page's heading, and the quote is drawn again with the logo.
  await prompt.getByRole("button", { name: "Add your logo" }).click();
  await chooseLogo(page);
  await expect(sheet.getByTestId("logoImage-preview")).toBeVisible();
  await sheet.getByRole("button", { name: "Save logo" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("logo-prompt")).toHaveCount(0);
  await expect(page.locator("#preview-title")).toBeFocused();
  await expect.poll(() => page.getByTestId("pdf-pages").getAttribute("data-url")).not.toBe(stampBefore);
  // It stays gone, because the business has a logo now.
  await page.reload();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await expect(page.getByTestId("logo-prompt")).toHaveCount(0);
  await openBusinessProfile(page);
  await expect(page.getByTestId("logoImage-preview")).toBeVisible();
});

test("'Not now' hides the logo card for this person, and the Business profile still has the section", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "logo-notnow", "Not Now Co");
  await previewOfNewQuote(page);
  await expect(page.getByTestId("logo-prompt")).toBeVisible();
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByTestId("logo-prompt")).toHaveCount(0);
  // Focus goes to the page's heading, not to nowhere.
  await expect(page.locator("#preview-title")).toBeFocused();
  // It is remembered (in the database), so it stays gone after a reload and on the next quote.
  await page.reload();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await expect(page.getByTestId("logo-prompt")).toHaveCount(0);
  await openBusinessProfile(page);
  await expect(page.getByRole("group", { name: "Your logo" })).toBeVisible();
});
