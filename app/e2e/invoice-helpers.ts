// Steps shared by the invoice browser tests.
import { expect, type Page } from "@playwright/test";
import { openBusinessProfile, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, openQuotes, sheet, startSend } from "./quote-helpers";

/** A new business with the address an invoice must show. Ends on the Business profile. */
export async function businessWithAddress(page: Page, label: string, name: string) {
  await signUpAndOnboard(page, label, name);
  await openBusinessProfile(page);
  await page.getByLabel("Street address").fill("12 Long Street");
  await page.getByLabel("City or town").fill("Cape Town");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
}

/**
 * A new business (with the address an invoice needs) and an accepted quote QT-0001 for one item (quantity x price),
 * optionally asking a deposit first. Ends on the accepted quote's page.
 */
export async function acceptedQuote(
  page: Page,
  label: string,
  item: { name: string; quantity: string; price: string; depositPercent?: string },
) {
  await businessWithAddress(page, label, "Credit Co");

  await openQuotes(page);
  await page.getByRole("link", { name: /Start your first quote|New quote/ }).first().click();
  await fillItem(page, 1, item.name, item.quantity, item.price);
  await addCustomerInSheet(page, "Thandi Nkosi");
  if (item.depositPercent) {
    const deposit = page.getByRole("group", { name: "Deposit" });
    await page.getByRole("button", { name: "Add a deposit" }).click();
    await deposit.getByLabel("Percentage (%)").fill(item.depositPercent);
  }
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  await startSend(page);
  await sheet(page).getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "They accepted" }).click();
  await sheet(page).getByLabel("How they told you").selectOption("whatsapp");
  await sheet(page).getByRole("button", { name: "Save answer" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Accepted$/, level: 1 })).toBeVisible();
}

/**
 * A new business with an issued invoice INV-0001 for one item (quantity x price), optionally asking a deposit first. Ends
 * on the invoice's page.
 */
export async function issuedInvoice(
  page: Page,
  label: string,
  item: { name: string; quantity: string; price: string; depositPercent?: string },
) {
  await acceptedQuote(page, label, item);
  await page.getByRole("button", { name: "Create invoice" }).click();
  await sheet(page).getByRole("button", { name: "Issue invoice" }).click();
  await expect(page.getByRole("heading", { name: /^Invoice INV-0001/, level: 1 })).toBeVisible();
}
