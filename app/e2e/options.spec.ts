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

/** Adds a list (to pick one from) on the product form and opens it. */
async function addList(page: Page, name: string) {
  await page.getByRole("button", { name: /^Add (a|another) list$/ }).click();
  await expect(page.getByLabel("List name").last()).toBeFocused();
  await page.getByLabel("List name").last().fill(name);
}

/**
 * Adds an extra on the product form and opens it. With saved extras to offer, "Add an extra" shows them first:
 * this makes a new one either way.
 */
async function addExtra(page: Page, name: string, options: { price?: string; wording?: boolean; productOnly?: boolean } = {}) {
  await page.getByRole("button", { name: "Add an extra" }).click();
  const fresh = page.getByLabel("Extra name").last();
  const make = page.getByRole("button", { name: "Make a new extra" });
  await expect(fresh.or(make)).toBeVisible();
  if (await make.isVisible()) await make.click();
  await expect(fresh).toBeFocused();
  await fresh.fill(name);
  const card = page.getByRole("listitem").filter({ has: page.getByLabel("Extra name") });
  if (options.price) await card.getByLabel(/^Price/).fill(options.price);
  if (options.wording) await card.getByRole("checkbox", { name: "Ask for wording" }).check();
  if (options.productOnly) await card.getByLabel("Where does it apply?").selectOption({ label: "This product only" });
}

test("extras: ticked on a quote with how many and their wording, lists picked, and printed under the item", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "ext-main", "Extras Co");

  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cupcakes");
  await page.getByLabel("Price", { exact: true }).fill("15");

  // A list: Flavour, Vanilla usual, Red velvet +R5 each. It asks no kind and no charge.
  await addList(page, "Flavour");
  await expect(page.getByLabel("Kind", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("How is the price added?")).toHaveCount(0);
  await expect(page.getByText("One is always chosen. To make it optional, add a choice like “None”.")).toBeVisible();
  await page.getByLabel("Flavour: choice 1", { exact: true }).fill("Vanilla");
  await page.getByLabel("Flavour: choice 2", { exact: true }).fill("Red velvet");
  await page.getByLabel("Flavour: choice 2 adds", { exact: true }).fill("5");
  await page.getByLabel("Usual flavour").selectOption({ label: "Vanilla" });
  await page.getByRole("button", { name: "Done Flavour" }).click();

  // Extras: sprinkles +R2, a gift box +R30, and a message on the cake that asks for wording (+R2).
  await addExtra(page, "Gold sprinkles", { price: "2" });
  await page.getByRole("button", { name: "Done Gold sprinkles" }).click();
  await addExtra(page, "Gift box", { price: "30" });
  await page.getByRole("button", { name: "Done Gift box" }).click();
  await addExtra(page, "Message on the cake", { price: "2", wording: true });
  await expect(page.getByLabel("Longest (optional)")).toHaveValue("");
  await page.getByRole("button", { name: "Done Message on the cake" }).click();
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Cupcakes.");

  // On a quote: Vanilla is chosen; the extras add up as they are ticked.
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Cupcakes/ }).click();
  await expect(sheet(page).getByRole("group", { name: "Flavour" }).getByRole("radio", { name: /Vanilla/ })).toBeChecked();
  await sheet(page).getByLabel("Quantity").fill("12");
  await sheet(page).getByRole("group", { name: "Flavour" }).getByRole("radio", { name: /Red velvet/ }).check();
  await sheet(page).getByRole("checkbox", { name: /Gold sprinkles/ }).check();
  await sheet(page).getByRole("checkbox", { name: /Gift box/ }).check();
  // One gift box, not one for each cupcake.
  await sheet(page).getByLabel("Gift box: how many (optional)").fill("1");
  await sheet(page).getByRole("checkbox", { name: /Message on the cake/ }).check();
  // Ticked without its wording: it says so, at the field and in the summary.
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toContainText("Type what the message on the cake should say.");
  await sheet(page).getByLabel("Message on the cake: what should it say?").fill("Happy 40th Thandi");
  await expect(sheet(page).getByTestId("form-summary")).toHaveCount(0);
  // 12 × (R15 + R5 + R2 + R2) = R288, plus one gift box R30 = R318.
  await expect(sheet(page).getByTestId("line-sum")).toHaveText(/12 × R\s?24,00 \+ R\s?30,00 = R\s?318,00/);
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(item(page, 1)).toContainText("4 options");
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("318"));

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  const quoteUrl = page.url().split("?")[0];

  // Saved and read back the same, then printed under the item.
  await page.reload();
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("318"));
  await item(page, 1).getByRole("button", { name: /Edit/ }).click();
  await expect(sheet(page).getByLabel("Gift box: how many (optional)")).toHaveValue("1");
  await expect(sheet(page).getByLabel("Message on the cake: what should it say?")).toHaveValue("Happy 40th Thandi");
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  await page.goto(`${quoteUrl}/preview`);
  const text = page.getByRole("region", { name: "The quote as text" });
  await expect(text).toContainText("Flavour: Red velvet");
  await expect(text).toContainText(/Extras: Gold sprinkles, Gift box \(\+R\s?30,00 once\)/);
  await expect(text).toContainText("Message on the cake: “Happy 40th Thandi”");

  // An extra taken off the product stays on the item as it was, until it is removed.
  await page.goto("/app/products");
  await page.getByRole("link", { name: /Cupcakes/ }).click();
  await page.getByRole("button", { name: "Edit Gold sprinkles" }).click();
  await page.getByRole("button", { name: /Remove this extra/ }).click();
  await page.getByRole("button", { name: "Edit Flavour" }).click();
  await page.getByLabel("Usual flavour").selectOption({ label: "No usual one" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto(quoteUrl);
  await item(page, 1).getByRole("button", { name: /Edit/ }).click();
  await expect(sheet(page).getByText("Kept as they were")).toBeVisible();
  await expect(sheet(page).getByText(/Extras: Gold sprinkles/)).toBeVisible();
  await tap(sheet(page).getByRole("button", { name: "Remove Gold sprinkles" }));
  // 12 × (R15 + R5 + R2) = R264, plus R30 = R294.
  await expect(sheet(page).getByTestId("line-sum")).toHaveText(/12 × R\s?22,00 \+ R\s?30,00 = R\s?294,00/);
  await sheet(page).getByRole("button", { name: "Save item" }).click();
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("294"));

  // A list with nothing chosen must be answered.
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Cupcakes/ }).click();
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toContainText("Choose a flavour.");
  await sheet(page).getByRole("group", { name: "Flavour" }).getByRole("radio", { name: /Vanilla/ }).check();
  await expect(sheet(page).getByTestId("form-summary")).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(item(page, 2)).toContainText("1 option");
});

test("a saved extra on a second product: one price everywhere, until a product goes its own way", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "ext-reuse", "Reuse Co");

  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await page.getByLabel("Price", { exact: true }).fill("300");
  await addExtra(page, "Gift wrap", { price: "30" });
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Cake.");

  // Another product picks it from the saved extras instead of making it again.
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cupcakes");
  await page.getByLabel("Price", { exact: true }).fill("15");
  await page.getByRole("button", { name: "Add an extra" }).click();
  const offered = page.getByRole("group", { name: "Add an extra" });
  await expect(offered.getByRole("button", { name: /Gift wrap/ })).toContainText(/\+R\s?30,00/);
  await offered.getByRole("button", { name: /Gift wrap/ }).click();
  await page.getByRole("button", { name: "Edit Gift wrap" }).click();
  await expect(page.getByText("Also on 1 other product. Changing it changes it there too.")).toBeVisible();
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Cupcakes.");

  // The price changed on one product is the price on the other.
  await page.goto("/app/products");
  await page.getByRole("link", { name: /Cake/ }).click();
  await page.getByRole("button", { name: "Edit Gift wrap" }).click();
  await page.getByLabel(/^Price/).last().fill("35");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto("/app/products");
  await page.getByRole("link", { name: /Cupcakes/ }).click();
  await page.getByRole("button", { name: "Edit Gift wrap" }).click();
  await expect(page.getByLabel(/^Price/).last()).toHaveValue("35");

  // "This product only": the cupcakes get their own gift wrap, and the cake keeps the shared one.
  await page.getByLabel("Where does it apply?").selectOption({ label: "This product only" });
  await page.getByLabel(/^Price/).last().fill("10");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto("/app/products");
  await page.getByRole("link", { name: /Cake/ }).click();
  await page.getByRole("button", { name: "Edit Gift wrap" }).click();
  await expect(page.getByLabel(/^Price/).last()).toHaveValue("35");
  await expect(page.getByLabel("Where does it apply?")).toHaveValue("");

  // A new saved extra can't take a name another one has.
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Candles");
  await page.getByLabel("Price", { exact: true }).fill("20");
  await addExtra(page, "Gift wrap", { price: "5" });
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("You already have a saved extra with that name");
  await expect(page.getByLabel("Extra name")).toHaveValue("Gift wrap");
});

test("editing a product from a new item's sheet updates the extras ticked on it", async ({ page }) => {
  await signUpAndOnboard(page, "ext-follow", "Follow Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cupcakes");
  await page.getByLabel("Price", { exact: true }).fill("15");
  await addExtra(page, "Sprinkles", { price: "2" });
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();

  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Cupcakes/ }).click();
  await sheet(page).getByLabel("Quantity").fill("10");
  await sheet(page).getByRole("checkbox", { name: /Sprinkles/ }).check();
  await expect(sheet(page).getByTestId("line-sum")).toHaveText(/10 × R\s?17,00 = R\s?170,00/);
  await sheet(page).getByRole("button", { name: "Edit this product" }).click();
  await sheet(page).getByRole("button", { name: "Edit Sprinkles" }).click();
  await sheet(page).getByLabel("Extra name").fill("Rainbow sprinkles");
  await sheet(page).getByLabel(/^Price/).last().fill("3");
  await sheet(page).getByRole("button", { name: "Save changes" }).click();
  await expect(sheet(page).getByRole("checkbox", { name: /Rainbow sprinkles/ })).toBeChecked();
  await expect(sheet(page).getByTestId("line-sum")).toHaveText(/10 × R\s?18,00 = R\s?180,00/);
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("180"));
});

test("an extra for one product can cost more on a bigger size, and follows the size chosen", async ({ page }) => {
  await signUpAndOnboard(page, "ext-by-size", "By Size Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await page.getByRole("button", { name: "Add variations" }).click();
  for (const [i, [name, price]] of ([["Small", "300"], ["Large", "600"]] as const).entries()) {
    await page.getByRole("textbox", { name: `Size ${i + 1}`, exact: true }).fill(name);
    await page.getByLabel(`Size ${i + 1} price`, { exact: true }).fill(price);
  }
  await page.getByLabel("Usual size").selectOption({ label: "Small" });
  await addExtra(page, "Gold leaf", { productOnly: true });
  // A saved extra has one price everywhere; only "this product only" can depend on the size.
  await page.getByRole("checkbox", { name: "Price depends on the size" }).check();
  await page.getByLabel("Gold leaf adds for Small", { exact: true }).fill("50");
  await page.getByLabel("Gold leaf adds for Large", { exact: true }).fill("120");
  await tap(page.getByRole("button", { name: "Add product" }));
  await expect(page.getByTestId("product-added")).toBeVisible();

  // It comes back as typed.
  await page.getByRole("link", { name: /Cake/ }).click();
  await page.getByRole("button", { name: "Edit Gold leaf" }).click();
  await expect(page.getByLabel("Gold leaf adds for Large", { exact: true })).toHaveValue("120");

  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Cake/ }).click();
  await expect(sheet(page).getByText(/\+R\s?50,00 each/)).toBeVisible();
  await sheet(page).getByRole("checkbox", { name: /Gold leaf/ }).check();
  await expect(sheet(page).getByTestId("line-sum")).toHaveText(/1 × R\s?350,00 = R\s?350,00/);
  await sheet(page).getByRole("group", { name: "Choose a size" }).getByRole("radio", { name: /Large/ }).check();
  await expect(sheet(page).getByTestId("line-sum")).toHaveText(/1 × R\s?720,00 = R\s?720,00/);
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("720"));
});
