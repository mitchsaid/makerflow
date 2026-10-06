// Steps shared by the quote browser tests.
import { expect, type Page } from "@playwright/test";

export const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

export async function openQuotes(page: Page) {
  await nav(page).getByRole("link", { name: "Quotes" }).click();
  await expect(page.getByRole("heading", { name: "Quotes", level: 1 })).toBeVisible();
}

/** The nth line on the quote (1-based). */
export const item = (page: Page, n: number) => page.getByTestId("quote-line").nth(n - 1);
export const sheet = (page: Page) => page.getByRole("dialog");

/** Adds a one-off item through the item sheet, as the nth line. */
export async function fillItem(
  page: Page,
  n: number,
  name: string,
  quantity: string,
  price: string,
  discountPercent?: string,
) {
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /One-off item/ }).click();
  await expect(sheet(page)).toHaveAccessibleName("One-off item");
  await sheet(page).getByLabel("Name", { exact: true }).fill(name);
  await sheet(page).getByLabel("Quantity").fill(quantity);
  await sheet(page).getByLabel(/^Price/).fill(price);
  if (discountPercent) {
    await sheet(page).getByLabel("Discount on this item").selectOption("percent");
    await sheet(page).getByLabel("Item discount (%)").fill(discountPercent);
  }
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(item(page, n)).toContainText(name);
}

/** "R 1 036,00" in any of the spacing characters the browser might use. */
export const rand = (whole: string, cents = "00") =>
  new RegExp(`^R\\s?${whole.replace(/ /g, "\\s")},${cents}$`);

/** Types a new name in the picker and adds them through the full customer form in the sheet. */
export async function addCustomerInSheet(page: Page, name: string, details: { phone?: string } = {}) {
  await page.getByLabel("Customer name", { exact: true }).fill(name);
  await page.getByRole("option", { name: new RegExp(`Add “${name}”`) }).click();
  const sheet = page.getByRole("dialog", { name: "Add a customer" });
  await expect(sheet.getByLabel("Name", { exact: true })).toHaveValue(name);
  if (details.phone) await sheet.getByLabel("Phone", { exact: true }).fill(details.phone);
  await sheet.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("selected-customer")).toHaveText(name);
}


/**
 * Presses Send. From the draft that means going through the preview first (Preview saves what
 * is on screen); on the preview itself it is just the Send button.
 */
export async function startSend(page: Page) {
  if (!/\/preview$/.test(new URL(page.url()).pathname)) {
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\/preview$/);
  }
  await page.getByRole("button", { name: "Send", exact: true }).click();
}
