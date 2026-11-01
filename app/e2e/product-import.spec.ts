import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

/** Importing a list of products (docs/plans/import-onboarding.md, slice 1). */
test("a pasted list is checked, the bad rows are left out with how to fix them, and the ticked ones are added", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "import-paste", "Import Paste Co");
  await page.goto("/app/products");
  await page.getByTestId("import-link").click();
  await expect(page.getByRole("heading", { name: "Import products", level: 1 })).toBeVisible();

  // Nothing pasted: the problem is said at the box, after pressing Continue.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Paste your list or choose a file first.")).toBeVisible();

  const list = [
    "Product\tPrice",
    "Chocolate cake\tR450",
    "Wedding cake\tR1 450,50",
    "Coffee table\tfrom R3 500",
    "Bookshelf\tR2 800–R4 500",
    "Chocolate cake\tR460",
    "No price here\t",
  ].join("\n");
  await page.getByLabel("Your list").fill(list);
  await page.getByRole("button", { name: "Continue" }).click();

  // The columns were found from the headings.
  await expect(page.getByText("Which column is which?")).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toContainText("Product");
  await page.getByRole("button", { name: "Check the products" }).click();

  await expect(page.getByTestId("import-summary")).toHaveText("3 products are ready to add, 3 left out.");
  const problems = page.getByTestId("import-row-problem");
  await expect(problems).toHaveCount(3);
  await expect(problems.filter({ hasText: "This is a range" })).toHaveCount(1);
  await expect(problems.filter({ hasText: "Same name as row 1" })).toHaveCount(1);
  await expect(problems.filter({ hasText: "No price" })).toHaveCount(1);
  await expect(page.getByTestId("import-row").filter({ hasText: "Priced “from”" })).toHaveCount(1);
  await expect(page.getByTestId("import-row").filter({ hasText: /1[\s\u00a0\u202f]450,50/ })).toHaveCount(1);

  // Untick one: it is not added.
  await page.getByRole("checkbox", { name: "Add Coffee table" }).click();
  await expect(page.getByRole("button", { name: "Add 2 products" })).toBeVisible();
  await page.getByRole("button", { name: "Add 2 products" }).click();

  await expect(page).toHaveURL(/\/app\/products\?imported=2/);
  await expect(page.getByTestId("products-imported")).toHaveText("Added 2 products.");
  await expect(page.getByText("Chocolate cake")).toBeVisible();
  await expect(page.getByText("Wedding cake")).toBeVisible();
  await expect(page.getByText("Coffee table")).toHaveCount(0);
  await expect(page.getByTestId("product-count")).toHaveText("2 products");

  // Importing the same list again adds nothing twice: those names are now left out.
  await page.getByTestId("import-link").click();
  await page.getByLabel("Your list").fill("Product\tPrice\nChocolate cake\tR450\nTart\tR90");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Check the products" }).click();
  await expect(page.getByTestId("import-summary")).toHaveText("1 product is ready to add, 1 left out.");
  await expect(page.getByTestId("import-row-problem")).toContainText("You already have one with this name");
});

test("a QuickBooks-style file: Type says which rows are services, and /hour becomes the unit", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "import-file", "Import File Co");
  await page.goto("/app/products/import");
  await page.locator("#import-file").setInputFiles({
    name: "products.csv",
    mimeType: "text/csv",
    buffer: Buffer.from('Product/Service Name,SKU,Sales description,Sales price/rate,Type\nWedding cake,WC1,"Three tiers",3200,Inventory\nDecorating time,DT,,R250/hour,Service\n'),
  });
  await expect(page.getByLabel("Your list")).toHaveValue(/Wedding cake/);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Check the products" }).click();
  await expect(page.getByTestId("import-row").filter({ hasText: "Decorating time" })).toContainText("/ hour");
  await expect(page.getByTestId("import-row").filter({ hasText: "Decorating time" })).toContainText("Service");
  await page.getByRole("button", { name: "Add 2 products" }).click();
  await expect(page).toHaveURL(/imported=2/);
  await expect(page.getByText("Wedding cake")).toBeVisible();
  await page.getByRole("tab", { name: "Services" }).or(page.getByRole("link", { name: "Services" })).first().click();
  await expect(page.getByText("Decorating time")).toBeVisible();
});

test("a column with no price says so at the field, and the empty Products page offers the import", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "import-empty", "Import Empty Co");
  await page.goto("/app/products");
  await page.getByTestId("import-link").click();
  await expect(page).toHaveURL(/\/app\/products\/import$/);
  await page.getByLabel("Your list").fill("Cake\nTart");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Check the products" }).click();
  await expect(page.getByText("Choose which column has the price.")).toBeVisible();
});

test("rows that look like one product with choices are offered as one, and can be kept separate", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "import-group", "Import Group Co");
  await page.goto("/app/products/import");
  const list = ["Product\tScent\tSize\tPrice", "Soy candle\tLavender\t200ml\tR149", "Soy candle\tVanilla\t200ml\tR149", "Soy candle\tLavender\t400ml\tR249", "Soy candle\tVanilla\t400ml\tR249", "Gift wrap\t\t\tR35", "Cake - small\tR100".replace("\t", "\t\t\t"), "Cake - large\t\t\tR180"].join("\n");
  await page.getByLabel("Your list").fill(list);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Check the products" }).click();

  // Two groups and a single: three products, none left out.
  await expect(page.getByTestId("import-summary")).toHaveText("3 products are ready to add.");
  const candles = page.getByTestId("import-group").filter({ hasText: "Soy candle" });
  await expect(candles).toContainText("One product with 4 choices (scent and size)");
  await expect(candles.getByRole("list", { name: "Choices for Soy candle" }).getByRole("listitem")).toHaveCount(4);
  await expect(candles).toContainText("from");

  // Say they are separate: the repeated names are left out again, as before.
  await candles.getByRole("button", { name: /These are separate products/ }).click();
  await expect(page.getByTestId("import-group")).toHaveCount(1);
  await expect(page.getByTestId("import-row-problem")).toHaveCount(3);
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Check the products" }).click();
  await expect(page.getByTestId("import-group")).toHaveCount(2);

  // Added, they are products with choices.
  await page.getByRole("button", { name: "Add 3 products" }).click();
  await expect(page).toHaveURL(/imported=3/);
  await page.getByRole("link", { name: /Soy candle/ }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Soy candle");
  await expect(page.getByLabel("Variation name").first()).toHaveValue("Scent and Size");
  await expect(page.locator('input[value="Lavender, 200ml"]')).toBeVisible();
  await expect(page.locator('input[value="Vanilla, 400ml"]')).toBeVisible();
});

test("a Shopify product export: the rows of one product arrive as one suggested product with choices", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "import-shopify", "Import Shopify Co");
  await page.goto("/app/products/import");
  await page.locator("#import-file").setInputFiles({
    name: "products_export.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "Handle,Title,Body (HTML),Vendor,Option1 Name,Option1 Value,Variant SKU,Variant Price,Image Src,Status",
        'lavender-candle,Lavender candle,"<p>Hand-poured <strong>soy</strong> wax.</p>",Wick & Co,Size,200ml,LC200,180.00,https://example.test/a.jpg,active',
        "lavender-candle,,,,Size,400ml,LC400,320.00,,",
        "lavender-candle,,,,,,,,https://example.test/b.jpg,",
        "gift-card,Gift card,,Wick & Co,Title,Default Title,,500.00,,active",
        "old-candle,Old candle,,Wick & Co,Title,Default Title,,99.00,,archived",
      ].join("\n"),
    ),
  });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Check the products" }).click();
  await expect(page.getByTestId("import-summary")).toHaveText("2 products are ready to add.");
  const group = page.getByTestId("import-group");
  await expect(group).toContainText("Lavender candle");
  await expect(group).toContainText("One product with 2 choices (size)");
  await expect(group).toContainText("200ml");
  await expect(group).toContainText("400ml");
  await expect(page.getByText("Old candle")).toHaveCount(0);
  await page.getByRole("button", { name: "Add 2 products" }).click();
  await expect(page.getByTestId("products-imported")).toHaveText("Added 2 products.");
  await expect(page.getByText("Lavender candle")).toBeVisible();
});
