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

test("a product with sizes: each has its price, the default one comes first, and the quote and document say which", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "var-sizes", "Sizes Co");

  // The product: the variation is named and two choices made, a third added.
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");
  await page.getByRole("radio", { name: /^Yes/ }).click();
  await page.getByLabel("Variation name", { exact: true }).fill("Size");
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
  await page.getByRole("button", { name: "Add another choice" }).click();
  await expect(page.getByRole("textbox", { name: "Size 3", exact: true })).toBeFocused();
  await fillVariations(page, [["Small", "300"], ["Medium", "450"], ["Large", "600"]]);
  await page.getByLabel("Default size").selectOption({ label: "Medium" });
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Wedding cake.");
  await expect(page.getByRole("link", { name: /Wedding cake/ })).toContainText(/from R\s?300,00/);

  // On a quote: the default one is chosen, with its price; another can be chosen and the price follows.
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

  // Without a default one, a size must be chosen before the item can be added.
  await page.goto("/app/products");
  await page.getByRole("link", { name: /Wedding cake/ }).click();
  await page.getByLabel("Default size").selectOption({ label: "None: I choose each time" });
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

test("sizes added from inside a quote start the item with the default one, and saving twice never doubles them", async ({ page }) => {
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
  await sheet(page).getByRole("radio", { name: /^Yes/ }).click();
  await sheet(page).getByLabel("Variation name", { exact: true }).fill("Size");
  await fillVariations(page, [["Small", "80"], ["Large", "150"]]);
  await sheet(page).getByLabel("Default size").selectOption({ label: "Large" });
  await sheet(page).getByRole("button", { name: "Save changes" }).click();
  await expect(sheet(page).getByRole("group", { name: "Choose a size" }).getByRole("radio", { name: /Large/ })).toBeChecked();
  await expect(sheet(page).getByLabel(/^Price/)).toHaveValue("150");
  await page.keyboard.press("Escape");

  // Saving the product twice keeps the same two sizes.
  await page.goto("/app/products");
  await page.getByRole("link", { name: /Candle/ }).click();
  await page.getByRole("button", { name: "Add another choice" }).click();
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
  await page.getByRole("radio", { name: /^Yes/ }).click();
  await page.getByLabel("Variation name", { exact: true }).fill("Size");
  await expect(page.getByLabel("Size 1 price", { exact: true })).toHaveValue("350");
  await expect(page.getByLabel("Size 2 price", { exact: true })).toHaveValue("");

  // Changed, then every size removed: the first size's price is the product's price again.
  await page.getByLabel("Size 1 price", { exact: true }).fill("400");
  await tap(page.getByRole("button", { name: "Remove Size 2" }));
  await tap(page.getByRole("button", { name: "Remove Size 1" }));
  await expect(page.getByRole("radio", { name: /^No/ })).toBeFocused();
  await expect(page.getByLabel("Price", { exact: true })).toHaveValue("400");
});

test("going back to one price puts the sizes aside, and choosing prices for each again brings them back", async ({ page }) => {
  await signUpAndOnboard(page, "var-aside", "Aside Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");

  // "No" is the answer to start with: no sizes are shown.
  await expect(page.getByRole("radio", { name: /^No/ })).toBeChecked();
  await expect(page.getByLabel(/^Size \d price$/)).toHaveCount(0);

  await page.getByRole("radio", { name: /^Yes/ }).click();
  await page.getByLabel("Variation name", { exact: true }).fill("Size");
  await expect(page.getByLabel("Price", { exact: true })).toHaveCount(0);
  await fillVariations(page, [["Small", "300"], ["Large", "600"]]);

  await page.getByRole("radio", { name: /^No/ }).click();
  await expect(page.getByLabel(/^Size \d price$/)).toHaveCount(0);
  await expect(page.getByLabel("Price", { exact: true })).toHaveValue("300");
  // A price typed meanwhile is the first size's price when the sizes come back.
  await page.getByLabel("Price", { exact: true }).fill("350");

  await page.getByRole("radio", { name: /^Yes/ }).click();
  await expect(page.getByLabel("Size 1", { exact: true })).toHaveValue("Small");
  await expect(page.getByLabel("Size 1 price", { exact: true })).toHaveValue("350");
  await expect(page.getByLabel("Size 2 price", { exact: true })).toHaveValue("600");
});

test("more variations are added under the first, each its own, and save as two more", async ({ page }) => {
  await signUpAndOnboard(page, "var-lists", "Lists Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");

  // There is no way to add another variation before the first exists.
  await expect(page.getByRole("button", { name: /^Add (a|another) variation$/ })).toHaveCount(0);
  await page.getByRole("radio", { name: /^Yes/ }).click();
  await page.getByLabel("Variation name", { exact: true }).fill("Size");
  await fillVariations(page, [["Small", "300"], ["Large", "500"]]);

  // Under the first one, after its default setting.
  await expect(page.getByLabel("Default size")).toBeVisible();
  await page.getByRole("button", { name: /^Add (a|another) variation$/ }).click();
  await page.getByLabel("Name of this variation").last().fill("Flavour");
  await page.getByLabel("Flavour: choice 1", { exact: true }).fill("Vanilla");
  await page.getByLabel("Flavour: choice 2", { exact: true }).fill("Chocolate");
  await page.getByRole("button", { name: /^Add (a|another) variation$/ }).click();
  await page.getByLabel("Name of this variation").last().fill("Filling");
  await page.getByLabel("Filling: choice 1", { exact: true }).fill("Jam");
  await page.getByLabel("Filling: choice 2", { exact: true }).fill("Cream");
  await expect(page.getByRole("button", { name: /^(Edit|Done) (Flavour|Filling)$/ })).toHaveCount(2);

  // No takes them all away from the form, and Yes brings them back as they were.
  await page.getByRole("radio", { name: "No" }).click();
  await expect(page.getByRole("button", { name: /^(Edit|Done) (Flavour|Filling)$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Add (a|another) variation$/ })).toHaveCount(0);
  await page.getByRole("radio", { name: "Yes" }).click();
  await expect(page.getByRole("button", { name: /^(Edit|Done) (Flavour|Filling)$/ })).toHaveCount(2);
  await expect(page.getByLabel("Size 1", { exact: true })).toHaveValue("Small");

  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Wedding cake.");
  await page.getByRole("link", { name: /Wedding cake/ }).click();
  await page.getByRole("button", { name: "Edit Flavour" }).click();
  await expect(page.getByLabel("Flavour: choice 2", { exact: true })).toHaveValue("Chocolate");
  await page.getByRole("button", { name: "Edit Filling" }).click();
  await expect(page.getByLabel("Filling: choice 1", { exact: true })).toHaveValue("Jam");
});

test("answering Yes starts with nothing filled in: an empty name with an example, two empty choices, and clear problems on save", async ({ page }) => {
  await signUpAndOnboard(page, "var-pristine", "Pristine Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");
  await expect(page.getByText(/^Does this product come in any variations \(e\.g\. .+\)\?$/)).toBeVisible();
  await expect(page.getByRole("radio", { name: "No" })).toBeChecked();

  await page.getByRole("radio", { name: "Yes" }).click();
  await expect(page.getByLabel("Variation name", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Variation name", { exact: true })).toHaveAttribute("placeholder", /^e\.g\. .+/);
  await expect(page.getByLabel(/^Choice \d price$/)).toHaveCount(2);
  await expect(page.getByRole("group", { name: "Suggestions" })).toHaveCount(0);

  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("form-summary")).toBeVisible();
  await expect(page.getByTestId("form-summary")).toContainText("Name this variation");
  await expect(page.getByTestId("form-summary")).toContainText("Give it a name");
  await expect(page.getByTestId("form-summary")).toContainText("Enter a price");
});

test("with only further variations left, the first variation can be added again, and focus is never lost", async ({ page }) => {
  await signUpAndOnboard(page, "var-only-further", "Further Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");
  await page.getByRole("radio", { name: /^Yes/ }).click();
  await page.getByLabel("Variation name", { exact: true }).fill("Size");
  await fillVariations(page, [["Small", "300"], ["Large", "500"]]);
  await page.getByRole("button", { name: /^Add (a|another) variation$/ }).click();
  await page.getByLabel("Name of this variation").last().fill("Flavour");
  await page.getByLabel("Flavour: choice 1", { exact: true }).fill("Vanilla");
  await page.getByLabel("Flavour: choice 2", { exact: true }).fill("Chocolate");

  // Every size removed: the answer stays Yes (a flavour is left), and focus goes to the way back.
  await tap(page.getByRole("button", { name: "Remove Large" }));
  await tap(page.getByRole("button", { name: "Remove Small" }));
  await expect(page.getByRole("radio", { name: /^Yes/ })).toBeChecked();
  await expect(page.getByRole("button", { name: "Add choices with their own prices" })).toBeFocused();
  await expect(page.getByLabel("Price", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add choices with their own prices" }).click();
  await expect(page.getByLabel(/^Size \d price$/)).toHaveCount(2);

  // Take the sizes away again and then the flavour: nothing left means No, with focus on it.
  await page.getByLabel("Variation name", { exact: true }).fill("Size");
  await tap(page.getByRole("button", { name: "Remove Size 2" }));
  await tap(page.getByRole("button", { name: "Remove Size 1" }));
  await tap(page.getByRole("button", { name: /^Remove this variation\s*: Flavour$/ }));
  await expect(page.getByRole("radio", { name: /^No/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /^No/ })).toBeFocused();
});
