import { devices, expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

async function openProducts(page: Page) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Products" }).click();
  await expect(page.getByRole("heading", { name: "Products & services", level: 1 })).toBeVisible();
}

async function addProduct(page: Page, name: string, price: string) {
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Price", { exact: true }).fill(price);
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText(`Added ${name}.`);
}

const COMING_SOON = ["Options and extras", "Costs and margin", "Quantity prices", "Production steps", "Stock"];

test("the first product: a name and a price; the later layers are shown but do nothing", async ({ page }) => {
  await signUpAndOnboard(page, "p-first", "Product Co");
  await openProducts(page);
  await expect(page.getByText("No products yet")).toBeVisible();
  await expect(page.getByTestId("coming-soon")).toContainText("Import from Shopify or a CSV");

  await page.getByRole("link", { name: "Add your first product" }).click();
  await expect(page).toHaveURL(/\/app\/products\/new$/);
  const placeholders = page.getByTestId("coming-soon");
  await expect(placeholders).toHaveCount(COMING_SOON.length);
  for (const [i, title] of COMING_SOON.entries()) {
    await expect(placeholders.nth(i)).toContainText(title);
    await expect(placeholders.nth(i)).toContainText("Coming soon");
    // Inactive: nothing in them to type in or press.
    await expect(placeholders.nth(i).locator("input, textarea, select, button, a")).toHaveCount(0);
  }

  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");
  await page.getByLabel("Price", { exact: true }).fill("800");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page).toHaveURL(/\/app\/products\?added=/);
  await expect(page.getByTestId("product-added")).toHaveText("Added Wedding cake.");
  const row = page.getByRole("link", { name: /Wedding cake/ });
  await expect(row).toContainText(/R\s?800,00/);
  await expect(page.getByTestId("product-count")).toHaveText("1 product");
});

test("a failed save says what to fix and keeps what you typed", async ({ page }) => {
  await signUpAndOnboard(page, "p-errors", "Product Errors Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Description (optional)").fill("Three tiers");
  await page.getByRole("button", { name: "Add product" }).click();

  const summary = page.getByTestId("form-summary");
  await expect(summary).toContainText("2 things need fixing");
  await expect(summary).toBeFocused();
  await expect(page.locator("#unitPrice-error")).toContainText("Use 0 if it is free");
  await expect(page.getByLabel("Description (optional)")).toHaveValue("Three tiers");
  await summary.getByRole("link", { name: "Name" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();

  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await page.getByLabel("Price", { exact: true }).fill("12x");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.locator("#unitPrice-error")).toBeVisible();
  await page.getByLabel("Price", { exact: true }).fill("120");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();
});

test("services are their own list, with their own form, and save, edit and come back", async ({ page }) => {
  await signUpAndOnboard(page, "p-edit", "Service Co");
  await openProducts(page);
  const switcher = page.getByRole("navigation", { name: "Products or services" });
  await expect(switcher.getByRole("link", { name: "Products" })).toHaveAttribute("aria-current", "page");
  await switcher.getByRole("link", { name: "Services" }).click();
  await expect(page).toHaveURL(/view=services/);
  await expect(page.getByText("No services yet")).toBeVisible();
  // The Shopify import is about products only.
  await expect(page.getByTestId("coming-soon")).toHaveCount(0);

  await page.getByRole("link", { name: "Add your first service" }).click();
  await expect(page.getByRole("heading", { name: "Add a service", level: 1 })).toBeVisible();
  // A service's own coming-soon layers: no photo or stock.
  const placeholders = page.getByTestId("coming-soon");
  await expect(placeholders).toHaveCount(4);
  for (const title of ["Options and extras", "Costs and margin", "Quantity prices", "Steps"]) {
    await expect(placeholders.filter({ hasText: title })).toHaveCount(1);
  }
  await expect(page.getByText("Stock")).toHaveCount(0);

  await page.getByLabel("Name", { exact: true }).fill("Design time");
  await page.getByLabel("Price", { exact: true }).fill("450,50");
  await page.getByLabel("Description (optional)").fill("Per hour\nMinimum one hour");
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();
  await expect(page).toHaveURL(/view=services/);

  const row = page.getByRole("link", { name: /Design time/ });
  await expect(row).toContainText(/R\s?450,50/);
  // Not in the products list.
  await switcher.getByRole("link", { name: "Products" }).click();
  await expect(page.getByText("No products yet")).toBeVisible();
  await switcher.getByRole("link", { name: "Services" }).click();

  await page.getByRole("link", { name: /Design time/ }).click();
  await expect(page.getByRole("heading", { name: "Design time", level: 1 })).toBeVisible();
  await expect(page.getByTestId("coming-soon")).toHaveCount(4);
  await expect(page.getByLabel("Price", { exact: true })).toHaveValue("450,50");
  await expect(page.getByLabel("Description (optional)")).toHaveValue("Per hour\nMinimum one hour");
  await page.getByLabel("Price", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Price", { exact: true })).toHaveValue("500");

  // Archiving a service returns to the services list.
  await page.getByRole("button", { name: "Archive service" }).click();
  await expect(page).toHaveURL(/\/app\/products\?view=services$/);
});

test("the price label follows the business's VAT setting", async ({ page }) => {
  await signUpAndOnboard(page, "p-vat", "Vat Product Co");
  await page.goto("/app/more");
  await page.getByRole("link", { name: /Business profile/ }).click();
  await page.getByRole("checkbox", { name: "I'm registered for VAT" }).check();
  await page.getByLabel("VAT number").fill("4123456789");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/app/products/new");
  await expect(page.getByLabel("Price (including VAT)")).toBeVisible();
});

test("search, archive and restore", async ({ page }) => {
  await signUpAndOnboard(page, "p-arch", "Arch Product Co");
  await addProduct(page, "Wedding cake", "800");
  await addProduct(page, "Cupcakes", "15");
  await addProduct(page, "Tasting box", "120");

  await page.getByLabel("Search products").fill("cup");
  await expect(page.getByTestId("product-count")).toHaveText("1 product");
  await page.getByLabel("Search products").fill("zzz");
  await expect(page.getByText("No products match")).toBeVisible();
  await page.getByLabel("Search products").fill("");

  await page.getByRole("link", { name: /Tasting box/ }).click();
  await page.getByRole("button", { name: "Archive product" }).click();
  await expect(page).toHaveURL(/\/app\/products$/);
  await expect(page.getByRole("link", { name: /Tasting box/ })).toHaveCount(0);
  await page.getByRole("checkbox", { name: /Show archived \(1\)/ }).check();
  await expect(page.getByRole("link", { name: /Tasting box/ })).toContainText("Archived");
  await page.getByRole("link", { name: /Tasting box/ }).click();
  await expect(page.getByTestId("archived-notice")).toBeVisible();
  await page.getByRole("button", { name: "Restore product" }).click();
  await expect(page.getByTestId("archived-notice")).toHaveCount(0);
  await openProducts(page);
  await expect(page.getByTestId("product-count")).toHaveText("3 products");
});

test("each business only ever sees its own products", async ({ page, browser }) => {
  await signUpAndOnboard(page, "p-a", "Business A");
  await addProduct(page, "A's secret recipe", "100");
  await page.getByRole("link", { name: /A's secret recipe/ }).click();
  await expect(page).toHaveURL(/\/app\/products\/[0-9a-f-]{36}$/);
  const productUrl = page.url();

  const other = await browser.newContext({ ...devices["Pixel 7"] });
  const pageB = await other.newPage();
  await signUpAndOnboard(pageB, "p-b", "Business B");
  await openProducts(pageB);
  await expect(pageB.getByText("No products yet")).toBeVisible();
  await pageB.goto(productUrl);
  await expect(pageB.getByText("This page could not be found")).toBeVisible();
  await expect(pageB.getByText("A's secret recipe")).toHaveCount(0);
  await other.close();

  await page.goto("/app/products/not-an-id");
  await expect(page.getByText("This page could not be found")).toBeVisible();
});
