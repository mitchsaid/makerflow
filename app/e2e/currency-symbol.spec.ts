import { expect, test, type Locator, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";
import { openQuotes, rand, sheet } from "./quote-helpers";

/** The text shown before an input (the currency symbol), or null when there is none. */
async function before(input: Locator): Promise<string | null> {
  const text = input.locator("xpath=preceding-sibling::*[@data-slot='input-group-text']");
  return (await text.count()) === 0 ? null : (await text.textContent());
}

async function startQuote(page: Page) {
  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();
  await expect(page.getByRole("heading", { name: "New quote", level: 1 })).toBeVisible();
}

test("prices show the currency symbol before the field, and nothing else does", async ({ page }) => {
  await signUpAndOnboard(page, "currency", "Rand Co");

  // The product form.
  await page.goto("/app/products/new");
  const productPrice = page.getByLabel("Price", { exact: true });
  expect(await before(productPrice)).toBe("R");
  expect(await before(page.getByLabel("Name", { exact: true }))).toBeNull();
  // What is typed is still just the number; the symbol is not part of it.
  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await productPrice.fill("1 250");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();
  await page.goto("/app/products");
  await expect(page.getByRole("link", { name: /Cake/ })).toContainText(/R\s?1\s?250,00/);

  // The item sheet and the quote's own money fields.
  await startQuote(page);
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /One-off item/ }).click();
  expect(await before(sheet(page).getByLabel(/^Price/))).toBe("R");
  expect(await before(sheet(page).getByLabel("Quantity"))).toBeNull();
  await sheet(page).getByLabel("Discount on this item").selectOption("percent");
  expect(await before(sheet(page).getByLabel("Item discount (%)"))).toBeNull();
  await sheet(page).getByLabel("Discount on this item").selectOption("fixed");
  expect(await before(sheet(page).getByLabel("Item discount amount"))).toBe("R");
  await sheet(page).getByLabel("Name", { exact: true }).fill("Cupcakes");
  await sheet(page).getByLabel(/^Price/).fill("15,50");
  await sheet(page).getByLabel("Item discount amount").fill("0,50");
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("15"));

  await page.getByRole("radio", { name: /Delivery/ }).check();
  expect(await before(page.getByLabel(/^Delivery fee/))).toBe("R");
  await page.getByLabel("Discount on the whole quote").selectOption("percent");
  expect(await before(page.getByLabel("Discount (%)"))).toBeNull();
  await page.getByLabel("Discount on the whole quote").selectOption("fixed");
  expect(await before(page.getByLabel("Discount amount"))).toBe("R");
});

test("the symbol does not hide the field's error or its focus", async ({ page }) => {
  await signUpAndOnboard(page, "currency-err", "Rand Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await page.getByLabel("Price", { exact: true }).fill("abc");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("form-summary")).toBeVisible();
  await expect(page.getByLabel("Price", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Price", { exact: true }).focus();
  await expect(page.getByLabel("Price", { exact: true })).toBeFocused();
});
