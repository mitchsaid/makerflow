import { expect, test, type Locator, type Page } from "@playwright/test";
import { openBusinessProfile, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, sheet } from "./quote-helpers";

/** Costing and margin, slice A (docs/plans/costing-and-margin.md). */

async function tap(locator: Locator) {
  await locator.focus();
  await locator.press("Enter");
}

const costRow = (page: Page, title: string) => page.getByRole("list", { name: "What it costs to make" }).getByRole("listitem").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

async function setHourlyRate(page: Page, rate: string) {
  await openBusinessProfile(page);
  await page.getByLabel("Price of an hour of your time").fill(rate);
  await page.getByRole("button", { name: "Save hourly rate" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
}

async function addFlour(page: Page) {
  await page.goto("/app/products/materials/new");
  await page.getByLabel("Name", { exact: true }).fill("Cake flour");
  await page.getByLabel("Unit", { exact: true }).selectOption("kg");
  await page.getByLabel("How much you bought").fill("12,5");
  await page.getByLabel("What you paid for it").fill("187,50");
  await page.getByRole("button", { name: "Add material" }).click();
  await expect(page.getByTestId("material-added")).toBeVisible();
}

async function addKind(page: Page, kind: "A material" | "Your time" | "Another cost") {
  const label = { "A material": "Add a material", "Your time": "Add your time", "Another cost": "Add other cost" }[kind];
  await tap(page.getByRole("button", { name: label, exact: true }));
}

test("what it costs to make is set on a product, worked out for each size, and kept", async ({ page }) => {
  test.setTimeout(240_000);
  await signUpAndOnboard(page, "cost-product", "Costing Co");
  await setHourlyRate(page, "120");
  await addFlour(page);

  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await page.getByRole("radio", { name: /^Yes/ }).click();
  await page.getByLabel("Variation name", { exact: true }).fill("Size");
  for (const [i, [name, price]] of [["Small", "150"], ["Large", "300"]].entries()) {
    const row = page.getByRole("listitem").filter({ has: page.getByRole("textbox", { name: `Size ${i + 1}`, exact: true }) });
    await row.getByLabel(`Size ${i + 1}`, { exact: true }).fill(name);
    await row.getByLabel(`Size ${i + 1} price`, { exact: true }).fill(price);
  }

  // Nothing yet: an invitation, no numbers.
  await expect(page.getByRole("button", { name: "Add a material", exact: true })).toBeVisible();
  await expect(page.getByTestId("cost-summary")).toHaveCount(0);

  // 600 g of flour (R15 a kg, so R9), half an hour of your time (R60), and a box only for the Large (R10).
  await addKind(page, "A material");
  let row = costRow(page, "Material 1");
  await row.getByLabel("Material", { exact: true }).selectOption({ label: "Cake flour" });
  // The unit starts as the material's own.
  await expect(row.getByLabel("Unit", { exact: true })).toHaveValue("kg");
  await row.getByLabel("How much goes in").fill("600");
  await row.getByLabel("Unit", { exact: true }).selectOption("g");
  await addKind(page, "Your time");
  row = costRow(page, "Your time 1");
  await row.getByLabel("How long it takes").fill("30");
  await addKind(page, "Another cost");
  row = costRow(page, "Other cost 1");
  await row.getByLabel("What is it").fill("Box");
  await row.getByLabel("What it costs").fill("10");
  await tap(row.getByRole("button", { name: /^Only for some items/ }));
  await row.getByRole("group", { name: "Other cost 1: condition 1" }).getByLabel("Depends on").selectOption({ label: "Size: Large" });

  // Costs without VAT, for each size.
  const summary = page.getByTestId("cost-summary-row");
  await expect(summary).toHaveCount(2);
  await expect(summary.nth(0)).toContainText(/Small: Costs R\s?69,00 to make one\. Sells for R\s?150,00\. Margin 54%/);
  await expect(summary.nth(1)).toContainText(/Large: Costs R\s?79,00 to make one\. Sells for R\s?300,00\. Margin 73,67%/);
  await expect(page.getByTestId("cost-summary")).toContainText("without VAT");

  // Makes 12 at a time: a twelfth of each cost.
  await page.getByLabel("How many one batch makes").fill("12");
  await expect(summary.nth(0)).toContainText(/Costs R\s?5,75 to make one/);

  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Cake.");

  // Opened again, it is all as it was left.
  await page.getByRole("link", { name: /Cake/ }).click();
  await expect(page.getByLabel("How many one batch makes")).toHaveValue("12");
  await expect(costRow(page, "Material 1").getByLabel("Material", { exact: true }).locator("option:checked")).toHaveText("Cake flour");
  await expect(costRow(page, "Material 1").getByLabel("How much goes in")).toHaveValue("600");
  await expect(costRow(page, "Material 1").getByLabel("Unit", { exact: true })).toHaveValue("g");
  await expect(costRow(page, "Your time 1").getByLabel("How long it takes")).toHaveValue("30");
  await expect(costRow(page, "Other cost 1").getByLabel("Depends on").locator("option:checked")).toHaveText("Size: Large");
  await expect(page.getByTestId("cost-summary-row").nth(0)).toContainText(/Costs R\s?5,75 to make one/);
});

test("a cost line says how to fix it, and nothing typed is lost", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "cost-errors", "Errors Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Soap");
  await page.getByLabel("Price", { exact: true }).fill("40");
  // With no materials, a material line says where to add one.
  await addKind(page, "A material");
  await expect(costRow(page, "Material 1").getByRole("link", { name: "Add a material" })).toBeVisible();
  await addKind(page, "Your time");
  // With no hourly rate, time says where to set it.
  await expect(costRow(page, "Your time 1").getByRole("link", { name: /Set what an hour of your time is worth/ })).toBeVisible();
  // An unfinished material line is a problem too, said at its fields.
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("Cost 1: material");
  await expect(page.getByTestId("form-summary")).toContainText("Cost 2: how long");
  await costRow(page, "Material 1").getByRole("button", { name: "Remove Material 1" }).click();
  await costRow(page, "Your time 1").getByLabel("How long it takes").fill("0,5");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("Cost 1: how long");
  await expect(costRow(page, "Your time 1").getByText(/whole minutes/)).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Soap");
  // Fixed, it saves.
  await costRow(page, "Your time 1").getByLabel("How long it takes").fill("30");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Soap.");
});

test("a draft quote shows the margin only to you, following the size, the quantity and the discount", async ({ page }) => {
  test.setTimeout(300_000);
  await signUpAndOnboard(page, "cost-quote", "Margin Co");
  await setHourlyRate(page, "120");
  await addFlour(page);

  // A cake with sizes, and a candle with no costs.
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await page.getByRole("radio", { name: /^Yes/ }).click();
  await page.getByLabel("Variation name", { exact: true }).fill("Size");
  for (const [i, [name, price]] of [["Small", "150"], ["Large", "300"]].entries()) {
    const r = page.getByRole("listitem").filter({ has: page.getByRole("textbox", { name: `Size ${i + 1}`, exact: true }) });
    await r.getByLabel(`Size ${i + 1}`, { exact: true }).fill(name);
    await r.getByLabel(`Size ${i + 1} price`, { exact: true }).fill(price);
  }
  await addKind(page, "A material");
  let row = costRow(page, "Material 1");
  await row.getByLabel("Material", { exact: true }).selectOption({ label: "Cake flour" });
  await row.getByLabel("How much goes in").fill("600");
  await row.getByLabel("Unit", { exact: true }).selectOption("g");
  await addKind(page, "Your time");
  await costRow(page, "Your time 1").getByLabel("How long it takes").fill("30");
  await addKind(page, "Another cost");
  row = costRow(page, "Other cost 1");
  await row.getByLabel("What is it").fill("Box");
  await row.getByLabel("What it costs").fill("10");
  await tap(row.getByRole("button", { name: /^Only for some items/ }));
  await row.getByRole("group", { name: "Other cost 1: condition 1" }).getByLabel("Depends on").selectOption({ label: "Size: Large" });
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Cake.");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Candle");
  await page.getByLabel("Price", { exact: true }).fill("80");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Candle.");

  await page.goto("/app/quotes/new");
  // Nothing on the quote yet: nothing to say.
  await expect(page.getByTestId("margin-panel")).toHaveCount(0);

  const addCake = async (size: string, quantity: string) => {
    await tap(page.getByRole("button", { name: "Add item" }));
    await sheet(page).getByRole("button", { name: /Cake/ }).click();
    await sheet(page).getByRole("group", { name: "Choose a size" }).getByRole("radio", { name: new RegExp(size) }).check();
    await sheet(page).getByLabel("Quantity").fill(quantity);
    await sheet(page).getByRole("button", { name: "Add to quote" }).click();
    await expect(sheet(page)).toHaveCount(0);
  };

  // One large cake: R300 less R79 (flour R9, an hour's half R60, box R10).
  await addCake("Large", "1");
  const summary = page.getByTestId("margin-summary");
  await expect(summary).toHaveText(/^R\s?221,00 · 73,67%$/);
  // Two of the small: R300, costing 2 × R69.
  await addCake("Small", "2");
  await expect(summary).toHaveText(/R\s?383,00 · /);
  // An item with no costs is named, and left out of the figure, and the figure says so.
  await tap(page.getByRole("button", { name: "Add item" }));
  await sheet(page).getByRole("button", { name: /Candle/ }).click();
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId("margin-panel")).toContainText("costed items only, 2 of 3");
  await expect(summary).toHaveText(/R\s?383,00 · /);

  // The breakdown is behind the line; it says without VAT, and where to add the missing costs.
  await page.getByTestId("margin-panel").locator("summary").click();
  await expect(page.getByTestId("margin-item")).toHaveCount(3);
  await expect(page.getByTestId("margin-item").nth(2)).toContainText("No costs yet");
  await expect(page.getByTestId("margin-item").nth(2).getByRole("link", { name: "Add what it costs to make" })).toBeVisible();
  await expect(page.getByTestId("margin-panel")).toContainText("without VAT");

  // Never on the customer's side: not on the preview of the quote.
  await addCustomerInSheet(page, "Sam Jacobs", { phone: "021 555 0000" });
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\/preview$/);
  await expect(page.getByRole("button", { name: "Mark as sent", exact: true })).toBeVisible();
  await expect(page.getByText(/Only you see this/)).toHaveCount(0);
  await expect(page.getByText(/73,67|No costs yet|costed items/)).toHaveCount(0);
});

test("a one-off item can say what it costs, and a sent quote keeps its margin when prices change later", async ({ page }) => {
  test.setTimeout(300_000);
  await signUpAndOnboard(page, "cost-frozen", "Frozen Co");
  await setHourlyRate(page, "120");

  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await page.getByLabel("Price", { exact: true }).fill("150");
  await addKind(page, "Your time");
  await costRow(page, "Your time 1").getByLabel("How long it takes").fill("30");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Cake.");

  await page.goto("/app/quotes/new");
  await tap(page.getByRole("button", { name: "Add item" }));
  await sheet(page).getByRole("button", { name: /Cake/ }).click();
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(sheet(page)).toHaveCount(0);

  // A one-off item says what it costs you; the field is not on an item from a product.
  await tap(page.getByRole("button", { name: "Add item" }));
  await sheet(page).getByRole("button", { name: /One-off item/ }).click();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Shelf");
  await sheet(page).getByLabel("Quantity").fill("1");
  await sheet(page).getByLabel(/^Price/).fill("100");
  await sheet(page).getByLabel("What it costs you").fill("40");
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(sheet(page)).toHaveCount(0);

  // R150 − R60 and R100 − R40: R150 on R250.
  await expect(page.getByTestId("margin-summary")).toHaveText(/^R\s?150,00 · 60%$/);
  await addCustomerInSheet(page, "Sam Jacobs", { phone: "021 555 0000" });
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\/preview$/);
  await page.getByRole("button", { name: "Mark as sent", exact: true }).click();
  await sheet(page).getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(page.getByTestId("sent-banner")).toBeVisible();

  // The sent quote shows the margin it was sent with, and says so.
  const panel = page.getByTestId("margin-panel");
  await expect(panel.getByTestId("margin-summary")).toHaveText(/^R\s?150,00 · 60%$/);
  await panel.locator("summary").click();
  await expect(panel).toContainText("Worked out when you sent this version");
  await expect(page.getByTestId("margin-item")).toHaveCount(2);

  // An hour of your time doubles in price: the sent quote does not move.
  await setHourlyRate(page, "240");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Quotes" }).click();
  await page.getByRole("link", { name: /Sam Jacobs/ }).first().click();
  await expect(page.getByTestId("margin-panel").getByTestId("margin-summary")).toHaveText(/^R\s?150,00 · 60%$/);
});

test("an extra has its own costs, counted for each one on the quote, and kept", async ({ page }) => {
  test.setTimeout(300_000);
  await signUpAndOnboard(page, "cost-extra", "Extra Costs Co");

  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await page.getByLabel("Price", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Add an extra" }).click();
  const fresh = page.getByLabel("Extra name").last();
  await expect(fresh).toBeFocused();
  await fresh.fill("Gift wrap");
  await page.getByRole("listitem").filter({ has: page.getByLabel("Extra name") }).getByLabel(/^Price/).fill("30");

  // What goes into one gift wrap: paper (R4) and five minutes of your time (at the rate, none set yet).
  const adders = page.getByRole("group", { name: "Add a cost (Gift wrap)" });
  await tap(adders.getByRole("button", { name: "Add other cost" }));
  const paper = page.getByRole("list", { name: "What Gift wrap costs" }).getByRole("listitem").first();
  await paper.getByLabel("What is it", { exact: true }).fill("Paper");
  await paper.getByLabel("What it costs", { exact: true }).fill("4");
  await expect(page.getByTestId("extra-cost-note")).toContainText(/Costs R\s?4,00 each\./);
  await page.getByRole("button", { name: "Done Gift wrap" }).click();
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Cake.");

  // Opened again, the extra's costs are as they were left.
  await page.getByRole("link", { name: /Cake/ }).click();
  await page.getByRole("button", { name: "Edit Gift wrap" }).click();
  const again = page.getByRole("list", { name: "What Gift wrap costs" }).getByRole("listitem").first();
  await expect(again.getByLabel("What is it", { exact: true })).toHaveValue("Paper");
  await expect(again.getByLabel("What it costs", { exact: true })).toHaveValue("4");

  // Made "this product only" (a copy on save), it keeps its costs.
  await page.getByLabel("Where does it apply?").selectOption("only");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Edit Gift wrap" }).click();
  await expect(page.getByRole("list", { name: "What Gift wrap costs" }).getByRole("listitem").first().getByLabel("What it costs", { exact: true })).toHaveValue("4");

  // On a quote: two cakes, each with gift wrap. R260 less 2 × R4.
  await page.goto("/app/quotes/new");
  await tap(page.getByRole("button", { name: "Add item" }));
  await sheet(page).getByRole("button", { name: /Cake/ }).click();
  await sheet(page).getByRole("checkbox", { name: /Gift wrap/ }).check();
  await sheet(page).getByLabel("Quantity").fill("2");
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId("margin-summary")).toHaveText(/^R\s?252,00 · 96,92%$/);
  // Without the wrap, the cake has no costs at all.
  await page.getByTestId("quote-line").first().getByRole("button", { name: /Edit/ }).click();
  await sheet(page).getByRole("checkbox", { name: /Gift wrap/ }).uncheck();
  await sheet(page).getByRole("button", { name: /Save|Update|Add to quote/ }).first().click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId("margin-panel")).toContainText("add what a product costs");
});
