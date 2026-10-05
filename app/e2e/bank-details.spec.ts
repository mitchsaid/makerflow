import { expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, openQuotes, sheet } from "./quote-helpers";

const BANK = {
  "Account holder": "Sweet Co",
  Bank: "FNB",
  "Account number": "62 123 456 789",
  "Branch code": "250655",
};

async function fillBank(page: Page, scope: ReturnType<Page["locator"]> | Page, over: Record<string, string> = {}) {
  const values = { ...BANK, ...over };
  for (const [label, value] of Object.entries(values)) await scope.getByLabel(label, { exact: true }).fill(value);
  await scope.getByLabel("Account type").selectOption("Cheque or current");
}

test("the owner saves bank details in the Business profile, checked for this country", async ({ page }) => {
  await signUpAndOnboard(page, "bank-profile", "Sweet Co");
  await openBusinessProfile(page);
  const bank = page.getByRole("group", { name: "Bank details" });
  await expect(bank.getByRole("checkbox", { name: /document number as their payment reference/ })).toBeChecked();

  // Saving with nothing says how to fix each field, at the field and in a summary.
  await page.getByRole("button", { name: "Save bank details" }).click();
  await expect(page.getByTestId("form-summary").filter({ hasText: "Enter the account holder" })).toBeVisible();
  await expect(bank.getByLabel("Account holder")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("button", { name: "Save bank details" })).toBeEnabled();

  // Wrong numbers are explained; nothing typed is lost.
  await fillBank(page, bank, { "Account number": "12ab", "Branch code": "123" });
  await page.getByRole("button", { name: "Save bank details" }).click();
  await expect(page.getByText(/digits only, 7 to 16/).first()).toBeVisible();
  await expect(page.getByText(/Branch codes have 6 digits/).first()).toBeVisible();
  await expect(bank.getByLabel("Account holder")).toHaveValue("Sweet Co");

  await fillBank(page, bank);
  await page.getByRole("button", { name: "Save bank details" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await expect(page.getByText(/Last changed /)).toBeVisible();

  // It is still there on a fresh load, with the account number tidied to digits.
  await page.reload();
  await expect(bank.getByLabel("Account number")).toHaveValue("62123456789");
  await expect(bank.getByLabel("Account type")).toHaveValue("Cheque or current");
  await expect(bank.getByLabel("Branch code")).toHaveValue("250655");
});

test("a quote shows the bank details by default, can leave them off, and the owner can add them from the quote", async ({ page }) => {
  await signUpAndOnboard(page, "bank-quote", "Sweet Co");
  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();

  // None saved yet: the owner is offered to add them, in a sheet over the quote.
  await expect(page.getByTestId("no-bank-details")).toContainText("haven't saved your bank details");
  await page.getByLabel("Quote title (optional)").fill("Cake for Sarah");
  await page.getByRole("button", { name: "Add bank details" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Add bank details");
  await sheet(page).getByRole("button", { name: "Save bank details" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toBeVisible();
  await fillBank(page, sheet(page));
  await sheet(page).getByRole("button", { name: "Save bank details" }).click();
  await expect(sheet(page)).toHaveCount(0);
  // Back on the quote with nothing lost, and the details on by default.
  await expect(page.getByLabel("Quote title (optional)")).toHaveValue("Cake for Sarah");
  await expect(page.getByTestId("bank-summary")).toHaveText("FNB, ending 6789");
  await expect(page.getByRole("checkbox", { name: /Show my bank details on this quote/ })).toBeChecked();

  await fillItem(page, 1, "Cake", "1", "500");
  await addCustomerInSheet(page, "Sarah");
  await page.getByLabel("Other ways to pay (optional)").fill("SnapScan also works");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  const text = page.getByRole("region", { name: "The quote as text" });
  await expect(text).toContainText("How to pay");
  await expect(text).toContainText("Sweet Co");
  await expect(text).toContainText("62123456789");
  await expect(text).toContainText("250655");
  await expect(text).toContainText(/Reference\s*QT-0001/);
  await expect(text).toContainText("SnapScan also works");

  // The switch on this quote leaves them off, and the other ways to pay still print.
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByRole("checkbox", { name: /Show my bank details on this quote/ }).uncheck();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await expect(text).not.toContainText("62123456789");
  await expect(text).toContainText("SnapScan also works");

  // A new quote starts with them on again.
  await page.goto("/app/quotes/new");
  await expect(page.getByRole("checkbox", { name: /Show my bank details on this quote/ })).toBeChecked();
});

test("a sent quote keeps the bank details it showed when they change later", async ({ page }) => {
  await signUpAndOnboard(page, "bank-sent", "Sweet Co");
  await openBusinessProfile(page);
  await page.getByLabel("Phone", { exact: true }).fill("011 555 0101");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." }).first()).toBeVisible();
  const bank = page.getByRole("group", { name: "Bank details" });
  await fillBank(page, bank);
  await page.getByRole("button", { name: "Save bank details" }).click();
  await expect(page.getByText(/Last changed /)).toBeVisible();

  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();
  await fillItem(page, 1, "Cake", "1", "500");
  await addCustomerInSheet(page, "Sarah");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await sheet(page).getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByTestId("sent-banner")).toBeVisible();
  const quoteUrl = page.url().split("?")[0];

  // The owner changes the account afterwards.
  await openBusinessProfile(page);
  await fillBank(page, page.getByRole("group", { name: "Bank details" }), { Bank: "Capitec", "Account number": "1234567890" });
  await page.getByRole("button", { name: "Save bank details" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." }).last()).toBeVisible();

  // The sent quote still shows what it showed.
  await page.goto(quoteUrl);
  const document = page.getByTestId("quote-document");
  await expect(document).toContainText("FNB");
  await expect(document).toContainText("62123456789");
  await expect(document).not.toContainText("Capitec");
});
