import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";
import { item, rand, sheet } from "./quote-helpers";

/**
 * Presses a button from the keyboard (focus, then Enter). The small remove buttons sit near the bar pinned
 * at the foot of a phone screen, where a pointer tap in a test can land on something else.
 */
async function tap(locator: import("@playwright/test").Locator) {
  await locator.focus();
  await locator.press("Enter");
}

/** Fills the variation rows on the product form, in order. */
async function fillVariations(page: Page, rows: [string, string][]) {
  for (const [i, [name, price]] of rows.entries()) {
    const row = page.getByRole("listitem").filter({ has: page.getByRole("textbox", { name: `Size ${i + 1}`, exact: true }) });
    await row.getByLabel(`Size ${i + 1}`, { exact: true }).fill(name);
    await row.getByLabel(`Size ${i + 1} price`, { exact: true }).fill(price);
  }
}

test("a product with sizes: each has its price, the usual one comes first, and the quote and document say which", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "var-sizes", "Sizes Co");

  // The product: two rows to start, the list called "Size" (a suggestion), a third added.
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");
  await page.getByRole("radio", { name: /^A price for each/ }).click();
  await expect(page.getByLabel("What do you call them?")).toHaveValue("Size");
  await expect(page.getByLabel(/^Size \d price$/)).toHaveCount(2);
  await expect(page.getByLabel("Price", { exact: true })).toHaveCount(0);
  await fillVariations(page, [["Small", "300"], ["Small", ""]]);

  // Problems are shown at their rows and in the summary, and nothing typed is lost.
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("form-summary")).toBeVisible();
  await expect(page.getByTestId("form-summary")).toContainText("Two have this name");
  await expect(page.getByTestId("form-summary")).toContainText("Enter a price");
  await expect(page.getByLabel("Size 1", { exact: true })).toHaveValue("Small");

  await fillVariations(page, [["Small", "300"], ["Medium", "450"]]);
  await page.getByRole("button", { name: "Add another size" }).click();
  await expect(page.getByRole("textbox", { name: "Size 3", exact: true })).toBeFocused();
  await fillVariations(page, [["Small", "300"], ["Medium", "450"], ["Large", "600"]]);
  await page.getByLabel("Usual size").selectOption({ label: "Medium" });
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Wedding cake.");
  await expect(page.getByRole("link", { name: /Wedding cake/ })).toContainText(/from R\s?300,00/);

  // On a quote: the usual one is chosen, with its price; another can be chosen and the price follows.
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(sheet(page).getByRole("button", { name: /Wedding cake/ })).toContainText(/from R\s?300,00/);
  await sheet(page).getByRole("button", { name: /Wedding cake/ }).click();
  const choose = sheet(page).getByRole("group", { name: "Choose a size" });
  await expect(choose.getByRole("radio", { name: /Medium/ })).toBeChecked();
  await expect(sheet(page).getByLabel(/^Price/)).toHaveValue("450");
  await choose.getByRole("radio", { name: /Large/ }).check();
  await expect(sheet(page).getByLabel(/^Price/)).toHaveValue("600");
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(item(page, 1)).toContainText("Large");
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("600"));

  // A price changed by hand for this quote stays when the size changes.
  await item(page, 1).getByRole("button", { name: /Edit/ }).click();
  await sheet(page).getByLabel(/^Price/).fill("650");
  await sheet(page).getByRole("group", { name: "Choose a size" }).getByRole("radio", { name: /Small/ }).check();
  await expect(sheet(page).getByLabel(/^Price/)).toHaveValue("650");
  await expect(sheet(page).getByTestId("product-price-hint")).toContainText(/price for Small is R\s?300,00/);
  await sheet(page).getByTestId("product-price-hint").getByRole("button").click();
  await expect(sheet(page).getByLabel(/^Price/)).toHaveValue("300");
  await sheet(page).getByRole("group", { name: "Choose a size" }).getByRole("radio", { name: /Large/ }).check();
  await expect(sheet(page).getByLabel(/^Price/)).toHaveValue("600");
  await sheet(page).getByRole("button", { name: "Save item" }).click();

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  const quoteUrl = page.url().split("?")[0];
  await page.goto(`${quoteUrl}/preview`);
  await expect(page.getByRole("region", { name: "The quote as text" })).toContainText("Wedding cake, Large");

  // Without a usual one, a size must be chosen before the item can be added.
  await page.goto("/app/products");
  await page.getByRole("link", { name: /Wedding cake/ }).click();
  await page.getByLabel("Usual size").selectOption({ label: "None: I choose each time" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Wedding cake/ }).click();
  await expect(sheet(page).getByRole("group", { name: "Choose a size" }).getByRole("radio", { checked: true })).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toContainText("Choose a size.");
  await sheet(page).getByRole("group", { name: "Choose a size" }).getByRole("radio", { name: /Small/ }).check();
  await expect(sheet(page).getByLabel(/^Price/)).toHaveValue("300");
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(item(page, 1)).toContainText("Small");

  // Removing a size from the product leaves the saved quote's item as it was.
  await page.goto("/app/products");
  await page.getByRole("link", { name: /Wedding cake/ }).click();
  await tap(page.getByRole("button", { name: "Remove Large" }));
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto(quoteUrl);
  await expect(item(page, 1)).toContainText("Large");
  await item(page, 1).getByRole("button", { name: /Edit/ }).click();
  await expect(sheet(page).getByRole("radio", { name: /Large/ })).toBeChecked();
  await expect(sheet(page).getByRole("group", { name: "Choose a size" })).toContainText("No longer on the product");
});

test("sizes added from inside a quote start the item with the usual one, and saving twice never doubles them", async ({ page }) => {
  await signUpAndOnboard(page, "var-sheet", "Sheet Sizes Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Candle");
  await page.getByLabel("Price", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();

  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Candle/ }).click();
  await expect(sheet(page).getByLabel(/^Price/)).toHaveValue("100");
  await sheet(page).getByRole("button", { name: "Edit this product" }).click();
  await sheet(page).getByRole("radio", { name: /^A price for each/ }).click();
  await fillVariations(page, [["Small", "80"], ["Large", "150"]]);
  await sheet(page).getByLabel("Usual size").selectOption({ label: "Large" });
  await sheet(page).getByRole("button", { name: "Save changes" }).click();
  await expect(sheet(page).getByRole("group", { name: "Choose a size" }).getByRole("radio", { name: /Large/ })).toBeChecked();
  await expect(sheet(page).getByLabel(/^Price/)).toHaveValue("150");
  await page.keyboard.press("Escape");

  // Saving the product twice keeps the same two sizes.
  await page.goto("/app/products");
  await page.getByRole("link", { name: /Candle/ }).click();
  await page.getByRole("button", { name: "Add another size" }).click();
  await fillVariations(page, [["Small", "80"], ["Large", "150"], ["Jar", "200"]]);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.getByLabel("Size 3 price", { exact: true }).fill("210");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/^Size \d price$/)).toHaveCount(3);
  await expect(page.getByLabel("Size 3 price", { exact: true })).toHaveValue("210");
});

test("the price typed first moves into the first size, and back when the sizes are removed", async ({ page }) => {
  await signUpAndOnboard(page, "var-carry", "Carry Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");
  await page.getByLabel("Price", { exact: true }).fill("350");
  await page.getByRole("radio", { name: /^A price for each/ }).click();
  await expect(page.getByLabel("Size 1 price", { exact: true })).toHaveValue("350");
  await expect(page.getByLabel("Size 2 price", { exact: true })).toHaveValue("");

  // Changed, then every size removed: the first size's price is the product's price again.
  await page.getByLabel("Size 1 price", { exact: true }).fill("400");
  await tap(page.getByRole("button", { name: "Remove Size 2" }));
  await tap(page.getByRole("button", { name: "Remove Size 1" }));
  await expect(page.getByRole("radio", { name: /^One price/ })).toBeFocused();
  await expect(page.getByLabel("Price", { exact: true })).toHaveValue("400");
});

test("going back to one price puts the sizes aside, and choosing prices for each again brings them back", async ({ page }) => {
  await signUpAndOnboard(page, "var-aside", "Aside Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");

  // One price is the answer to start with: no sizes are shown.
  await expect(page.getByRole("radio", { name: /^One price/ })).toBeChecked();
  await expect(page.getByLabel(/^Size \d price$/)).toHaveCount(0);

  await page.getByRole("radio", { name: /^A price for each/ }).click();
  await expect(page.getByLabel("Price", { exact: true })).toHaveCount(0);
  await fillVariations(page, [["Small", "300"], ["Large", "600"]]);

  await page.getByRole("radio", { name: /^One price/ }).click();
  await expect(page.getByLabel(/^Size \d price$/)).toHaveCount(0);
  await expect(page.getByLabel("Price", { exact: true })).toHaveValue("300");
  // A price typed meanwhile is the first size's price when the sizes come back.
  await page.getByLabel("Price", { exact: true }).fill("350");

  await page.getByRole("radio", { name: /^A price for each/ }).click();
  await expect(page.getByLabel("Size 1", { exact: true })).toHaveValue("Small");
  await expect(page.getByLabel("Size 1 price", { exact: true })).toHaveValue("350");
  await expect(page.getByLabel("Size 2 price", { exact: true })).toHaveValue("600");
});

test("lists added before and after the sizes stay separate, and save as two lists", async ({ page }) => {
  await signUpAndOnboard(page, "var-lists", "Lists Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");
  await page.getByLabel("Price", { exact: true }).fill("350");

  // A list first, then sizes (the lists move into the sizes' section), then a second list.
  await page.getByRole("button", { name: /^Add (a|another) variation$/ }).click();
  await page.getByLabel("Variation name").last().fill("Flavour");
  await page.getByLabel("Flavour: choice 1", { exact: true }).fill("Vanilla");
  await page.getByLabel("Flavour: choice 2", { exact: true }).fill("Chocolate");
  await page.getByRole("radio", { name: /^A price for each/ }).click();
  await fillVariations(page, [["Small", "300"], ["Large", "500"]]);
  await page.getByRole("button", { name: /^Add (a|another) variation$/ }).click();
  await page.getByLabel("Variation name").last().fill("Filling");
  await page.getByLabel("Filling: choice 1", { exact: true }).fill("Jam");
  await page.getByLabel("Filling: choice 2", { exact: true }).fill("Cream");
  await expect(page.getByRole("button", { name: /^(Edit|Done) (Flavour|Filling)$/ })).toHaveCount(2);

  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Wedding cake.");
  await page.getByRole("link", { name: /Wedding cake/ }).click();
  await page.getByRole("button", { name: "Edit Flavour" }).click();
  await expect(page.getByLabel("Flavour: choice 2", { exact: true })).toHaveValue("Chocolate");
  await page.getByRole("button", { name: "Edit Filling" }).click();
  await expect(page.getByLabel("Filling: choice 1", { exact: true })).toHaveValue("Jam");
});
