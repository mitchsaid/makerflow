import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";
import { item, rand, sheet } from "./quote-helpers";

/** Adds an option of a kind on the product form and opens it. */
async function addOption(page: Page, kind: "Choose one" | "Choose any" | "Type something", name: string) {
  await page.getByRole("button", { name: "Add an option" }).click();
  await page.getByRole("group", { name: "What kind of option?" }).getByRole("button", { name: new RegExp(kind) }).click();
  await expect(page.getByLabel("Option name").last()).toBeFocused();
  await page.getByLabel("Option name").last().fill(name);
}

test("options and extras: chosen on a quote, charged per item or once, and printed under the item", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "opt-extras", "Extras Co");

  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cupcakes");
  await page.getByLabel("Price", { exact: true }).fill("15");

  // Choose one: Flavour, Vanilla usual, Red velvet +R5 each.
  await addOption(page, "Choose one", "Flavour");
  await page.getByLabel("Flavour: choice 1", { exact: true }).fill("Vanilla");
  await page.getByLabel("Flavour: choice 2", { exact: true }).fill("Red velvet");
  await page.getByLabel("Flavour: choice 2 adds", { exact: true }).fill("5");
  await page.getByLabel("Usual flavour").selectOption({ label: "Vanilla" });
  await page.getByRole("button", { name: "Done Flavour" }).click();

  // Choose any: Extras per item (sprinkles +R2), with an empty second choice to show the problem.
  await addOption(page, "Choose any", "Toppings");
  await page.getByLabel("Toppings: choice 1", { exact: true }).fill("Gold sprinkles");
  await page.getByLabel("Toppings: choice 1 adds", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("Toppings: choice 2");
  await page.getByRole("button", { name: "Remove Toppings: choice 2" }).click();
  await page.getByRole("button", { name: "Done Toppings" }).click();

  // Choose any, once per line: Packaging, gift box +R30.
  await addOption(page, "Choose any", "Packaging");
  await page.getByLabel("How is the price added?").last().selectOption("line");
  await page.getByLabel("Packaging: choice 1", { exact: true }).fill("Gift box");
  await page.getByLabel("Packaging: choice 1 adds", { exact: true }).fill("30");
  await page.getByRole("button", { name: "Remove Packaging: choice 2" }).click();
  await page.getByRole("button", { name: "Done Packaging" }).click();

  // Type something, once per line, +R25.
  await addOption(page, "Type something", "Message");
  await page.getByLabel("How is the price added?").last().selectOption("line");
  await page.getByLabel(/^Price when typed/).fill("25");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Cupcakes.");

  // On a quote: Vanilla is chosen; the extras add up as they are chosen.
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Cupcakes/ }).click();
  await expect(sheet(page).getByRole("group", { name: "Flavour" }).getByRole("radio", { name: /Vanilla/ })).toBeChecked();
  await sheet(page).getByLabel("Quantity").fill("12");
  await sheet(page).getByRole("group", { name: "Flavour" }).getByRole("radio", { name: /Red velvet/ }).check();
  await sheet(page).getByRole("checkbox", { name: /Gold sprinkles/ }).check();
  await sheet(page).getByRole("checkbox", { name: /Gift box/ }).check();
  await sheet(page).getByLabel(/^Message/).fill("Happy 40th Thandi");
  // 12 × (R15 + R5 + R2) = R264, plus R30 and R25 once = R319.
  await expect(sheet(page).getByTestId("line-sum")).toHaveText(/12 × R\s?22,00 \+ R\s?55,00 once = R\s?319,00/);
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(item(page, 1)).toContainText("4 options");
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("319"));

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  const quoteUrl = page.url().split("?")[0];

  // Saved and read back the same, then printed under the item.
  await page.reload();
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("319"));
  await page.goto(`${quoteUrl}/preview`);
  const text = page.getByRole("region", { name: "The quote as text" });
  await expect(text).toContainText("Flavour: Red velvet");
  await expect(text).toContainText("Toppings: Gold sprinkles");
  await expect(text).toContainText(/Packaging: Gift box \(\+R\s?30,00 once\)/);
  await expect(text).toContainText(/Message: “Happy 40th Thandi” \(\+R\s?25,00 once\)/);

  // A required option with no usual one must be answered; a removed choice is kept on the item until removed.
  await page.goto("/app/products");
  await page.getByRole("link", { name: /Cupcakes/ }).click();
  await page.getByRole("button", { name: "Edit Flavour" }).click();
  await page.getByLabel("Usual flavour").selectOption({ label: "None" });
  await page.getByRole("button", { name: "Edit Toppings" }).click();
  await page.getByRole("button", { name: "Remove Gold sprinkles" }).click();
  await page.getByRole("button", { name: "Add a choice to Toppings" }).click();
  await page.getByLabel("Toppings: choice 1", { exact: true }).fill("Pearls");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto(quoteUrl);
  await item(page, 1).getByRole("button", { name: /Edit/ }).click();
  await expect(sheet(page).getByText("Kept as they were")).toBeVisible();
  await expect(sheet(page).getByText(/Toppings: Gold sprinkles/)).toBeVisible();
  await sheet(page).getByRole("button", { name: "Remove Gold sprinkles" }).click();
  await expect(sheet(page).getByTestId("line-sum")).toHaveText(/12 × R\s?20,00 \+ R\s?55,00 once = R\s?295,00/);
  await sheet(page).getByRole("button", { name: "Save item" }).click();
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("295"));

  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Cupcakes/ }).click();
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toContainText("Choose a flavour.");
  await sheet(page).getByRole("group", { name: "Flavour" }).getByRole("radio", { name: /Vanilla/ }).check();
  await expect(sheet(page).getByTestId("form-summary")).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(item(page, 2)).toContainText("1 option");
});

test("editing a product from a new item's sheet updates the options chosen on it", async ({ page }) => {
  await signUpAndOnboard(page, "opt-follow", "Follow Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cupcakes");
  await page.getByLabel("Price", { exact: true }).fill("15");
  await addOption(page, "Choose any", "Toppings");
  await page.getByLabel("Toppings: choice 1", { exact: true }).fill("Sprinkles");
  await page.getByLabel("Toppings: choice 1 adds", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Remove Toppings: choice 2" }).click();
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();

  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Cupcakes/ }).click();
  await sheet(page).getByLabel("Quantity").fill("10");
  await sheet(page).getByRole("checkbox", { name: /Sprinkles/ }).check();
  await expect(sheet(page).getByTestId("line-sum")).toHaveText(/10 × R\s?17,00 = R\s?170,00/);
  await sheet(page).getByRole("button", { name: "Edit this product" }).click();
  await sheet(page).getByRole("button", { name: "Edit Toppings" }).click();
  await sheet(page).getByLabel("Toppings: choice 1", { exact: true }).fill("Rainbow sprinkles");
  await sheet(page).getByLabel("Toppings: choice 1 adds", { exact: true }).fill("3");
  await sheet(page).getByRole("button", { name: "Save changes" }).click();
  await expect(sheet(page).getByRole("checkbox", { name: /Rainbow sprinkles/ })).toBeChecked();
  await expect(sheet(page).getByTestId("line-sum")).toHaveText(/10 × R\s?18,00 = R\s?180,00/);
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("180"));
});
