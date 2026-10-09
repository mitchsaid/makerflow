import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

const sheet = (page: Page) => page.getByRole("dialog");
const line = (page: Page, n: number) => page.getByTestId("quote-line").nth(n - 1);
const rand = (whole: string, cents = "00") => new RegExp(`R\\s?${whole.replace(/ /g, "\\s")},${cents}`);

async function addProduct(page: Page, name: string, price: string, description = "") {
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Price", { exact: true }).fill(price);
  if (description) await page.getByLabel("Description (optional)").fill(description);
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();
}

test("choose a saved product, configure it for this quote, and edit the line later", async ({ page }) => {
  await signUpAndOnboard(page, "piq-choose", "Choose Co");
  await addProduct(page, "Wedding cake", "800", "Three tiers");
  await addProduct(page, "Cupcakes", "15");
  await page.goto("/app/quotes/new");

  await page.getByRole("button", { name: "Add item" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Add an item");
  await expect(sheet(page).getByTestId("coming-soon")).toContainText("Import from Shopify or a CSV");
  await sheet(page).getByLabel("Search your products and services").fill("wed");
  await sheet(page).getByRole("button", { name: /Wedding cake/ }).click();

  // Configure: the product's name, price and description come with it.
  await expect(sheet(page)).toHaveAccessibleName("Add Wedding cake");
  await expect(sheet(page).getByTestId("configure-name")).toHaveText("Wedding cake");
  await expect(sheet(page).getByLabel(/^Price/)).toHaveValue("800");
  await expect(sheet(page).getByLabel("Description (optional)")).toHaveValue("Three tiers");
  // A product without options or variations has nothing more to choose.
  await expect(sheet(page).getByText("Options and extras")).toHaveCount(0);
  await sheet(page).getByLabel("Quantity").fill("2");
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();

  await expect(line(page, 1)).toContainText("Wedding cake");
  await expect(line(page, 1)).toContainText(/2 × R\s?800,00/);
  await expect(line(page, 1)).not.toContainText("one-off");
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("1 600"));

  // Edit the line: same sheet, with what was chosen.
  await line(page, 1).getByRole("button", { name: /Edit/ }).click();
  await expect(sheet(page)).toHaveAccessibleName("Edit item");
  await expect(sheet(page).getByLabel("Quantity")).toHaveValue("2");
  await sheet(page).getByLabel("Quantity").fill("3");
  await sheet(page).getByRole("button", { name: "Save item" }).click();
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("2 400"));

  // Saved and reloaded, the line still knows its product.
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  await page.reload();
  await expect(line(page, 1)).toContainText(/3 × R\s?800,00/);
  await line(page, 1).getByRole("button", { name: /Edit/ }).click();
  await expect(sheet(page).getByRole("button", { name: "Edit this product" })).toBeVisible();
});

test("a product's new price never moves a line, but is offered", async ({ page }) => {
  await signUpAndOnboard(page, "piq-price", "Price Co");
  await addProduct(page, "Wedding cake", "800");
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Wedding cake/ }).click();
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();

  // Edit the product from inside the quote.
  await line(page, 1).getByRole("button", { name: /Edit/ }).click();
  await sheet(page).getByRole("button", { name: "Edit this product" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Edit product");
  await expect(sheet(page).getByTestId("coming-soon")).toHaveCount(4);
  await sheet(page).getByLabel("Price", { exact: true }).fill("900");
  await sheet(page).getByRole("button", { name: "Save changes" }).click();

  // Back on the line: its price is unchanged, the new price is offered.
  await expect(sheet(page)).toHaveAccessibleName("Edit item");
  await expect(sheet(page).getByLabel(/^Price/)).toHaveValue("800");
  await expect(sheet(page).getByTestId("product-price-hint")).toContainText(rand("900"));
  await sheet(page).getByRole("button", { name: /Use R/ }).click();
  await expect(sheet(page).getByLabel(/^Price/)).toHaveValue("900");
  await sheet(page).getByRole("button", { name: "Save item" }).click();
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("900"));
  // Still the unsaved quote.
  await expect(page).toHaveURL(/\/app\/quotes\/new$/);
});

test("add a new service from inside a quote, then straight on to configuring it", async ({ page }) => {
  await signUpAndOnboard(page, "piq-new", "New Product Co");
  await page.goto("/app/quotes/new");
  await page.getByLabel("Extra details (optional)").fill("Kept while adding a product");

  await page.getByRole("button", { name: "Add item" }).click();
  await expect(sheet(page)).toContainText("Nothing saved yet");
  // Three ways to add: a product, a service, a one-off item.
  await expect(sheet(page).getByRole("button", { name: "Add new product" })).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: /One-off item/ })).toBeVisible();
  await sheet(page).getByRole("button", { name: "Add new service" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Add a service");
  // The full service form, with a service's coming-soon layers.
  await expect(sheet(page).getByTestId("coming-soon")).toHaveCount(3);
  // On a phone the sheet is the whole screen, with Save in reach.
  const box = (await sheet(page).boundingBox())!;
  expect(box.width).toBeGreaterThan(page.viewportSize()!.width - 2);
  await expect(sheet(page).getByRole("button", { name: "Add service" })).toBeInViewport();

  await sheet(page).getByLabel("Name", { exact: true }).fill("Design time");
  await sheet(page).getByLabel("Price", { exact: true }).fill("450");
  await sheet(page).getByRole("button", { name: "Add service" }).click();

  // Straight on to configuring it.
  await expect(sheet(page)).toHaveAccessibleName("Add Design time");
  await sheet(page).getByLabel("Quantity").fill("2,5");
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(line(page, 1)).toContainText(/2,5 × R\s?450,00/);
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("1 125"));
  await expect(page).toHaveURL(/\/app\/quotes\/new$/);
  await expect(page.getByLabel("Extra details (optional)")).toHaveValue("Kept while adding a product");

  // It is a real service, and now offered in the sheet under Services.
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(sheet(page).getByRole("region", { name: "Services" }).getByRole("button", { name: /Design time/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}/);
  await page.goto("/app/products?view=services");
  await expect(page.getByRole("link", { name: /Design time/ })).toBeVisible();
});

test("fixing a product's name from a line: a new line follows it, a line already on the quote is offered it", async ({ page }) => {
  await signUpAndOnboard(page, "piq-typo", "Typo Co");
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: "Add new product" }).click();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Weding cake");
  await sheet(page).getByLabel("Price", { exact: true }).fill("800");
  await sheet(page).getByRole("button", { name: "Add product" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Add Weding cake");
  await sheet(page).getByLabel("Quantity").fill("2");

  // Fix the typo before the line is added: the line follows, and keeps the quantity typed.
  await sheet(page).getByRole("button", { name: "Edit this product" }).click();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Wedding cake");
  await sheet(page).getByLabel("Price", { exact: true }).fill("850");
  await sheet(page).getByRole("button", { name: "Save changes" }).click();
  await expect(sheet(page).getByTestId("configure-name")).toHaveText("Wedding cake");
  await expect(sheet(page).getByLabel("Quantity")).toHaveValue("2");
  await expect(sheet(page).getByLabel(/^Price/)).toHaveValue("850");
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(line(page, 1)).toContainText("Wedding cake");

  // Once on the quote, a change to the product is offered, not applied.
  await line(page, 1).getByRole("button", { name: /Edit/ }).click();
  await sheet(page).getByRole("button", { name: "Edit this product" }).click();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Wedding cake (3 tiers)");
  await sheet(page).getByRole("button", { name: "Save changes" }).click();
  await expect(sheet(page).getByTestId("configure-name")).toHaveText("Wedding cake");
  await sheet(page).getByRole("button", { name: "Use the new name" }).click();
  await expect(sheet(page).getByTestId("configure-name")).toHaveText("Wedding cake (3 tiers)");
  await sheet(page).getByRole("button", { name: "Save item" }).click();
  await expect(line(page, 1)).toContainText("Wedding cake (3 tiers)");
});

test("an archived product is not offered for new lines", async ({ page }) => {
  await signUpAndOnboard(page, "piq-arch", "Archive Co");
  await addProduct(page, "Old cake", "100");
  await addProduct(page, "New cake", "200");
  await page.getByRole("link", { name: /Old cake/ }).click();
  await page.getByRole("button", { name: "Archive product" }).click();
  await expect(page).toHaveURL(/\/app\/products$/);

  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(sheet(page).getByRole("button", { name: /New cake/ })).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: /Old cake/ })).toHaveCount(0);
});

test("a product's VAT treatment is only for VAT-registered businesses, and its quote items start with it", async ({ page }) => {
  await signUpAndOnboard(page, "piq-vat", "Vat Default Co");

  // Not registered: no choice on the product.
  await page.goto("/app/products/new");
  await expect(page.getByLabel("VAT on this")).toHaveCount(0);

  await page.goto("/app/more");
  await page.getByRole("link", { name: /Business profile/ }).click();
  await page.getByRole("checkbox", { name: "I'm registered for VAT" }).check();
  await page.getByLabel("VAT number").fill("4123456789");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // A zero-rated product.
  await page.goto("/app/products/new");
  await expect(page.getByLabel("VAT on this")).toHaveValue("");
  await page.getByLabel("Name", { exact: true }).fill("Brown bread");
  await page.getByLabel("Price (including VAT)").fill("30");
  await page.getByLabel("VAT on this").selectOption("zero");
  await expect(page.getByLabel("VAT on this")).toHaveAccessibleDescription(/VAT at 0%/);
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");
  await page.getByLabel("Price (including VAT)").fill("115");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();

  // It comes back when the product is opened.
  await page.getByRole("link", { name: /Brown bread/ }).first().click();
  await expect(page.getByLabel("VAT on this")).toHaveValue("zero");

  // Quote items made from products start with their treatment, and can still be changed.
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Brown bread/ }).click();
  await expect(sheet(page).getByLabel("VAT on this item")).toHaveValue("zero");
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(line(page, 1)).toContainText("Zero-rated");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Wedding cake/ }).click();
  await expect(sheet(page).getByLabel("VAT on this item")).toHaveValue("");
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(line(page, 2)).not.toContainText("Zero-rated");
  // 30 (no VAT) + 115 (15 of it VAT).
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("145"));
  await expect(page.getByTestId("totals")).toContainText(rand("15"));

  // Changing a product's treatment from inside the item sheet carries to the item being added.
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Wedding cake/ }).click();
  await expect(sheet(page).getByLabel("VAT on this item")).toHaveValue("");
  await sheet(page).getByRole("button", { name: "Edit this product" }).click();
  await sheet(page).getByLabel("VAT on this", { exact: true }).selectOption("zero");
  await sheet(page).getByRole("button", { name: "Save changes" }).click();
  await expect(sheet(page).getByLabel("VAT on this item")).toHaveValue("zero");
});
