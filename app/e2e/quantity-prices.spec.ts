import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";
import { item, rand, sheet } from "./quote-helpers";

async function addProductWithQuantityPrices(page: Page) {
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cupcakes");
  await page.getByLabel("Price", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Add a quantity price" }).click();
  await page.getByLabel("From (quantity)").fill("10");
  await page.getByLabel("Percent off (%)").fill("10");
  // The price that leaves is written beside the box.
  await expect(page.getByTestId("quantity-price-final").first()).toHaveText(/R\s?90,00 each/);
  await page.getByRole("button", { name: "Add another quantity price" }).click();
  await page.getByLabel("From (quantity)").nth(1).fill("50");
  await page.getByLabel("Percent off (%)").nth(1).fill("25");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();
}

test("quantity prices: set on a product, followed by the quote's price, left alone when typed, put back on request", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "qp-quote", "Quantity Co");
  await addProductWithQuantityPrices(page);

  // They are kept, in order, when the product is opened again.
  await page.getByRole("link", { name: /Cupcakes/ }).click();
  await expect(page.getByLabel("From (quantity)")).toHaveCount(2);
  await expect(page.getByLabel("From (quantity)").nth(0)).toHaveValue("10");
  await expect(page.getByLabel("Percent off (%)").nth(1)).toHaveValue("25");

  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Cupcakes/ }).click();
  const price = sheet(page).getByLabel(/^Price/);
  // One cupcake: the full price, and nothing said about quantity.
  await expect(price).toHaveValue("100");
  await expect(sheet(page).getByText(/Quantity price:/)).toHaveCount(0);

  // The price follows the quantity, and says why (the hint sits under the label).
  await sheet(page).getByLabel("Quantity").fill("12");
  await expect(price).toHaveValue("90");
  await expect(sheet(page).getByText("Quantity price: 10 or more: 10% off.")).toBeVisible();
  await sheet(page).getByLabel("Quantity").fill("60");
  await expect(price).toHaveValue("75");
  await expect(sheet(page).getByText("Quantity price: 50 or more: 25% off.")).toBeVisible();
  await sheet(page).getByLabel("Quantity").fill("9");
  await expect(price).toHaveValue("100");
  await expect(sheet(page).getByText(/Quantity price:/)).toHaveCount(0);

  // A price typed by hand is left alone as the quantity changes; the quantity price is offered back.
  await price.fill("80");
  await sheet(page).getByLabel("Quantity").fill("12");
  await expect(price).toHaveValue("80");
  await expect(sheet(page).getByTestId("product-price-hint")).toContainText(/R\s?90,00/);
  await sheet(page).getByRole("button", { name: /Use R/ }).click();
  await expect(price).toHaveValue("90");

  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(item(page, 1)).toContainText(/12 × R\s?90,00/);
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("1 080"));
});

test("a quantity price needs a quantity and a percent, and says how to fix it", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "qp-errors", "Quantity Errors Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Candles");
  await page.getByLabel("Price", { exact: true }).fill("50");
  await page.getByRole("button", { name: "Add a quantity price" }).click();
  await page.getByLabel("From (quantity)").fill("5");
  await page.getByLabel("Percent off (%)").fill("100");
  await page.getByRole("button", { name: "Add product" }).click();

  const summary = page.getByTestId("form-summary");
  await expect(summary).toContainText("1 thing needs fixing");
  await expect(page.locator("[data-slot=field-error]", { hasText: "Enter a percentage above 0 and below 100." })).toBeVisible();
  // What was typed is kept; the summary takes you to the field.
  await expect(page.getByLabel("From (quantity)")).toHaveValue("5");
  await summary.getByRole("link", { name: /percent off/i }).click();
  await expect(page.getByLabel("Percent off (%)")).toBeFocused();

  await page.getByLabel("Percent off (%)").fill("5");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();

  // Removing the only row leaves the product with none.
  await page.getByRole("link", { name: /Candles/ }).click();
  await page.getByRole("button", { name: "Remove quantity price 1" }).click();
  await expect(page.getByLabel("From (quantity)")).toHaveCount(0);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("From (quantity)")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add a quantity price" })).toBeVisible();
});

test("quantity prices sit with each variation's price, as a percent or an amount, and the quote follows the one chosen", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "qp-variations", "Quantity Sizes Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");
  await page.getByRole("radio", { name: /^Yes/ }).click();
  await page.getByLabel("Variation name", { exact: true }).fill("Size");
  for (const [i, [name, price]] of [["Small", "300"], ["Large", "600"]].entries()) {
    const li = page.getByRole("listitem").filter({ has: page.getByRole("textbox", { name: `Size ${i + 1}`, exact: true }) });
    await li.getByLabel(`Size ${i + 1}`, { exact: true }).fill(name);
    await li.getByLabel(`Size ${i + 1} price`, { exact: true }).fill(price);
  }
  // The product has no price of its own now, so no quantity price sits under one.
  await expect(page.getByRole("group", { name: "Quantity prices", exact: true })).toHaveCount(0);
  const small = page.getByRole("group", { name: "Quantity prices for Small" });
  const large = page.getByRole("group", { name: "Quantity prices for Large" });

  // Small: 10% off from 2. Large: an amount off from 2, which must be less than the price.
  await small.getByRole("button", { name: /^Add a quantity price/ }).click();
  await small.getByLabel("From (quantity)").fill("2");
  await small.getByLabel("Percent off (%)").fill("10");
  await expect(small.getByTestId("quantity-price-final")).toHaveText(/R\s?270,00 each/);
  await large.getByRole("button", { name: /^Add a quantity price/ }).click();
  await large.getByLabel("From (quantity)").fill("2");
  await large.getByLabel("Take off").selectOption("amount");
  await large.getByLabel("Amount off").fill("700");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("Take off less than the price.");
  await large.getByLabel("Amount off").fill("100");
  await expect(large.getByTestId("quantity-price-final")).toHaveText(/R\s?500,00 each/);
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();

  // Kept with their variations when the product is opened again.
  await page.getByRole("link", { name: /Wedding cake/ }).click();
  await expect(page.getByRole("group", { name: "Quantity prices for Small" }).getByLabel("Percent off (%)")).toHaveValue("10");
  await expect(page.getByRole("group", { name: "Quantity prices for Large" }).getByLabel("Take off")).toHaveValue("amount");
  await expect(page.getByRole("group", { name: "Quantity prices for Large" }).getByLabel("Amount off")).toHaveValue("100");

  // On a quote each size follows its own rows.
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Wedding cake/ }).click();
  const price = sheet(page).getByLabel(/^Price/);
  const choose = sheet(page).getByRole("group", { name: "Choose a size" });
  await choose.getByRole("radio", { name: /Large/ }).check();
  await expect(price).toHaveValue("600");
  await sheet(page).getByLabel("Quantity").fill("2");
  await expect(price).toHaveValue("500");
  await expect(sheet(page).getByText(/Quantity price: 2 or more: R\s?100,00 off\./)).toBeVisible();
  await choose.getByRole("radio", { name: /Small/ }).check();
  await expect(price).toHaveValue("270");
  await expect(sheet(page).getByText("Quantity price: 2 or more: 10% off.")).toBeVisible();
  await sheet(page).getByLabel("Quantity").fill("1");
  await expect(price).toHaveValue("300");
});
