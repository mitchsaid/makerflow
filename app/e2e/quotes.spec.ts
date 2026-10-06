import { devices, expect, test } from "@playwright/test";
import { openBusinessProfile, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, item, openQuotes, rand, sheet } from "./quote-helpers";

test("build a quote: a new customer on the spot, two items, delivery; it saves and comes back", async ({ page }) => {
  await signUpAndOnboard(page, "q-build", "Quote Co");
  await openQuotes(page);
  await expect(page.getByText("No quotes yet")).toBeVisible();
  await page.getByRole("link", { name: "Start your first quote" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/new$/);
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("0"));

  // Type an item first: adding the customer must leave the quote exactly as it is.
  await fillItem(page, 1, "Wedding cake", "1", "800");
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("800"));

  await addCustomerInSheet(page, "Thandi Nkosi", { phone: "021 123 4567" });
  await expect(page.getByTestId("selected-customer-detail")).toHaveText("021 123 4567");
  // Saving the customer did not save the quote, and did not touch it.
  await expect(page).toHaveURL(/\/app\/quotes\/new$/);
  await expect(page.getByTestId("form-summary")).toHaveCount(0);
  await expect(item(page, 1)).toContainText("Wedding cake");
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("800"));
  await fillItem(page, 2, "Cupcakes", "12", "15,50");
  // Back on the quote, focus is on the line just added; it shows how many, the price and the total.
  await expect(item(page, 2).getByRole("button", { name: /Edit/ })).toBeFocused();
  await expect(item(page, 2)).toContainText(/12 × R\s?15,50/);
  await expect(item(page, 2)).toContainText(/R\s?186,00/);
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("986"));

  await page.getByRole("radio", { name: /Delivery/ }).check();
  await page.getByLabel("Delivery fee").fill("50");
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("1 036"));

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Quote/, level: 1 })).toContainText("Draft");

  // Everything is still there after a reload.
  await page.reload();
  await expect(page.getByTestId("selected-customer")).toHaveText("Thandi Nkosi");
  await expect(page.getByTestId("selected-customer-detail")).toHaveText("021 123 4567");
  await expect(item(page, 1)).toContainText("Wedding cake");
  await expect(item(page, 2)).toContainText(/12 × R\s?15,50/);
  // Editing a line opens it with what was saved.
  await item(page, 2).getByRole("button", { name: /Edit/ }).click();
  await expect(sheet(page)).toHaveAccessibleName("Edit item");
  await expect(sheet(page).getByLabel("Quantity")).toHaveValue("12");
  await expect(sheet(page).getByLabel(/^Price/)).toHaveValue("15,50");
  await sheet(page).getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("radio", { name: /Delivery/ })).toBeChecked();
  await expect(page.getByLabel("Delivery fee")).toHaveValue("50");
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("1 036"));

  // Edit: remove the cupcakes and save again.
  await item(page, 2).getByRole("button", { name: /Remove/ }).click();
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("850"));
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.reload();
  await expect(item(page, 2)).toHaveCount(0);
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("850"));

  // The list shows it.
  await openQuotes(page);
  const row = page.getByRole("link", { name: /Thandi Nkosi/ });
  await expect(row).toContainText("Draft");
  await expect(row).toContainText(/R\s?850,00/);
});

test("pressing Save with something missing says what, jumps to it, and keeps what you typed", async ({ page }) => {
  await signUpAndOnboard(page, "q-errors", "Quote Errors Co");
  await page.goto("/app/quotes/new");

  // An item is checked in its own sheet before it goes on the quote.
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /One-off item/ }).click();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Cupcakes");
  await sheet(page).getByLabel("Quantity").fill("0");
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  const sheetSummary = sheet(page).getByTestId("form-summary");
  await expect(sheetSummary).toContainText("2 things need fixing");
  await expect(sheetSummary).toBeFocused();
  await expect(sheet(page).getByLabel("Name", { exact: true })).toHaveValue("Cupcakes");
  await sheetSummary.getByRole("link", { name: /Price/ }).click();
  await expect(sheet(page).getByLabel(/^Price/)).toBeFocused();
  await sheet(page).getByLabel("Quantity").fill("2");
  await sheet(page).getByLabel(/^Price/).fill("10");
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(item(page, 1)).toContainText("Cupcakes");

  // The quote's own fields are checked when saving.
  await page.getByLabel("Quote date", { exact: true }).fill("2026-10-10");
  await page.getByLabel("Valid until").fill("2026-10-01");
  await page.getByRole("button", { name: "Save draft" }).click();
  const summary = page.getByTestId("form-summary");
  await expect(summary).toContainText("1 thing needs fixing");
  await expect(summary).toBeFocused();
  await expect(page.locator("#validUntil-error")).toContainText("can't expire before");
  await expect(item(page, 1)).toContainText("Cupcakes");
  await summary.getByRole("link", { name: /Valid until/ }).click();
  await expect(page.getByLabel("Valid until")).toBeFocused();
  await page.getByLabel("Valid until").fill("2026-10-20");
  // A draft needs no customer.
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  await expect(page.getByTestId("form-summary")).toHaveCount(0);
});

test("choosing an existing customer by keyboard, and changing it", async ({ page }) => {
  await signUpAndOnboard(page, "q-picker", "Picker Co");
  for (const name of ["Alice Baker", "Bongani Dube"]) {
    await page.goto("/app/customers/new");
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Add customer" }).click();
    await expect(page.getByTestId("customer-added")).toBeVisible();
  }
  await page.goto("/app/quotes/new");

  const input = page.getByLabel("Customer name", { exact: true });
  const options = page.getByRole("listbox", { name: "Customers" }).getByRole("option");
  await input.fill("bong");
  // The match, then the offer to add "bong" as someone new; Enter takes the first.
  await expect(options).toHaveCount(2);
  await expect(options.first()).toContainText("Bongani Dube");
  // The list is part of the page, not floating inside the card, so nothing in it is cut off.
  const card = page.getByRole("group", { name: "Customer" });
  const cardBox = (await card.boundingBox())!;
  const lastBox = (await options.last().boundingBox())!;
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height);
  await input.press("Enter");
  await expect(page.getByTestId("selected-customer")).toHaveText("Bongani Dube");
  // Focus moves to the customer card instead of being lost.
  await expect(page.getByRole("button", { name: /Edit details/ })).toBeFocused();

  await page.getByRole("button", { name: "Change customer" }).click();
  // ...and back to the search box when changing.
  await expect(page.getByLabel("Customer name", { exact: true })).toBeFocused();
  // Enter in the search box never saves the quote.
  await page.getByLabel("Customer name", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/app\/quotes\/new$/);
  await expect(page.getByTestId("form-summary")).toHaveCount(0);

  await page.getByLabel("Customer name", { exact: true }).fill("Bongani Dube");
  // An exact match offers no "Add" option: no accidental duplicate.
  await expect(page.getByRole("option", { name: /Add “/ })).toHaveCount(0);
  await page.getByLabel("Customer name", { exact: true }).fill("Carla");
  await expect(page.getByRole("option", { name: /Add “Carla”/ })).toBeVisible();
  await page.getByLabel("Customer name", { exact: true }).press("Escape");
  await expect(options).toHaveCount(0);
});

test("adding a customer never depends on pressing Enter or finding the option", async ({ page }) => {
  await signUpAndOnboard(page, "q-addbtn", "Add Button Co");
  await page.goto("/app/quotes/new");

  // The button is there before anything is typed.
  await page.getByRole("button", { name: "Add new customer" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a customer" });
  await expect(sheet.getByLabel("Name", { exact: true })).toHaveValue("");
  // On a phone the sheet is the whole screen, with Save in reach without scrolling.
  const box = (await sheet.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.width).toBeGreaterThan(viewport.width - 2);
  expect(box.height).toBeGreaterThan(viewport.height - 2);
  await expect(sheet.getByRole("button", { name: "Add customer" })).toBeInViewport();
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Typing a name and walking away does not quietly leave a name that isn't a customer.
  await page.getByLabel("Customer name", { exact: true }).fill("Lerato Mokoena");
  await page.getByLabel("Quote date", { exact: true }).click();
  await expect(page.getByTestId("customer-not-chosen")).toContainText("“Lerato Mokoena” isn't chosen yet");
  await page.getByRole("button", { name: "Add “Lerato Mokoena” as a new customer" }).click();
  await expect(sheet.getByLabel("Name", { exact: true })).toHaveValue("Lerato Mokoena");
  await sheet.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByTestId("selected-customer")).toHaveText("Lerato Mokoena");
  await expect(page.getByTestId("customer-not-chosen")).toHaveCount(0);
});

test("the chosen customer can be configured from the quote, and the customer is real and saved", async ({ page }) => {
  await signUpAndOnboard(page, "q-config", "Config Co");
  await page.goto("/app/quotes/new");
  await fillItem(page, 1, "Cupcakes", "12", "15");
  await addCustomerInSheet(page, "Cape Cakes");

  // Edit from the quote: make it a business with a contact and a phone.
  await page.getByRole("button", { name: /Edit details/ }).click();
  const sheet = page.getByRole("dialog", { name: "Customer details" });
  await expect(sheet.getByLabel("Name", { exact: true })).toHaveValue("Cape Cakes");
  await sheet.getByRole("checkbox", { name: "This is a business" }).check();
  await sheet.getByLabel("Contact person").fill("Sam Jacobs");
  await sheet.getByLabel("Phone", { exact: true }).fill("021 555 0000");
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("selected-customer-detail")).toHaveText("Sam Jacobs · 021 555 0000");
  // Still on the unsaved quote, with its items.
  await expect(page).toHaveURL(/\/app\/quotes\/new$/);
  await expect(item(page, 1)).toContainText("Cupcakes");

  // Cancelling closes without changing anything.
  await page.getByRole("button", { name: /Edit details/ }).click();
  await page.getByRole("dialog").getByLabel("Phone", { exact: true }).fill("000");
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("selected-customer-detail")).toHaveText("Sam Jacobs · 021 555 0000");

  // The customer is a real, saved customer.
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}/);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Customers" }).click();
  const row = page.getByRole("link", { name: /Cape Cakes/ });
  await expect(row).toContainText("Business");
  await row.click();
  await expect(page.getByLabel("Contact person")).toHaveValue("Sam Jacobs");
  await expect(page.getByLabel("Phone", { exact: true })).toHaveValue("021 555 0000");
});

test("adding someone who already exists offers to use them instead", async ({ page }) => {
  await signUpAndOnboard(page, "q-dup", "Dup Quote Co");
  await page.goto("/app/customers/new");
  await page.getByLabel("Name", { exact: true }).fill("Thandi Nkosi");
  await page.getByLabel("Phone", { exact: true }).fill("021 123 4567");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByTestId("customer-added")).toBeVisible();

  await page.goto("/app/quotes/new");
  await page.getByLabel("Customer name", { exact: true }).fill("Thandi N");
  await page.getByRole("option", { name: /Add “Thandi N”/ }).click();
  const sheet = page.getByRole("dialog", { name: "Add a customer" });
  await sheet.getByLabel("Name", { exact: true }).fill("thandi nkosi");
  await sheet.getByRole("button", { name: "Add customer" }).click();
  await expect(sheet.getByTestId("duplicate-warning")).toBeVisible();
  await sheet.getByRole("button", { name: "Use Thandi Nkosi instead" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("selected-customer")).toHaveText("Thandi Nkosi");
  await expect(page.getByTestId("selected-customer-detail")).toHaveText("021 123 4567");
});

test("the sheet's fields do not collide with the quote's, and a lost connection keeps the quote", async ({ page, context }) => {
  await signUpAndOnboard(page, "q-offline", "Offline Co");
  await page.goto("/app/quotes/new");
  await fillItem(page, 1, "Cupcakes", "12", "15");
  await page.getByLabel("Extra details (optional)").fill("Quote notes");

  await page.getByLabel("Customer name", { exact: true }).fill("Someone");
  await page.getByRole("option", { name: /Add “Someone”/ }).click();
  const sheet = page.getByRole("dialog", { name: "Add a customer" });
  await sheet.getByRole("button", { name: "Add address, delivery details or notes" }).click();
  // The customer's notes field has its own label and its own id, apart from the quote's notes.
  await sheet.getByLabel("Anything to remember (optional)").fill("Customer notes");
  await expect(page.getByLabel("Extra details (optional)")).toHaveValue("Quote notes");
  await expect(sheet.getByLabel("Anything to remember (optional)")).toHaveValue("Customer notes");
  const ids = await page.locator("[id]").evaluateAll((els) => els.map((e) => e.id).filter(Boolean));
  expect(ids.length).toBe(new Set(ids).size);

  // Lose the connection while saving the customer: a message, the sheet and the quote stay.
  await context.setOffline(true);
  await sheet.getByRole("button", { name: "Add customer" }).click();
  await expect(sheet.getByText(/Couldn't reach the server/)).toBeVisible();
  await expect(sheet.getByLabel("Name", { exact: true })).toHaveValue("Someone");
  await context.setOffline(false);
  await sheet.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByTestId("selected-customer")).toHaveText("Someone");
  await expect(item(page, 1)).toContainText("Cupcakes");

  // And the same for saving the quote itself.
  await context.setOffline(true);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText(/Couldn't reach the server, so the draft was not saved/)).toBeVisible();
  await expect(item(page, 1)).toContainText("Cupcakes");
  await context.setOffline(false);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}/);
});

test("discounts come off in the right order", async ({ page }) => {
  await signUpAndOnboard(page, "q-discount", "Discount Co");
  await page.goto("/app/quotes/new");

  await fillItem(page, 1, "Cake", "1", "1000", "10");
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("900"));

  await page.getByLabel("Discount on the whole quote").selectOption("fixed");
  await page.getByLabel("Discount amount").fill("100");
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("800"));
  await expect(page.getByTestId("totals")).toContainText("Items before discount");

  // A discount bigger than the quote is refused when saving.
  await page.getByLabel("Discount amount").fill("5000");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.locator("#discountValue-error")).toContainText("more than the quote total");
});

test("valid-for shortcuts set the date, and prices follow the business's VAT setting", async ({ page }) => {
  await signUpAndOnboard(page, "q-vat", "Vat Quote Co");

  // Not registered: no VAT anywhere.
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /One-off item/ }).click();
  await expect(sheet(page).getByLabel("Price", { exact: true })).toBeVisible();
  await sheet(page).getByRole("button", { name: "Back" }).click();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId("totals")).not.toContainText("VAT");

  const issue = await page.getByLabel("Quote date", { exact: true }).inputValue();
  await page.getByRole("button", { name: "Valid for 30 days" }).click();
  const until = await page.getByLabel("Valid until").inputValue();
  const days = (new Date(until).getTime() - new Date(issue).getTime()) / 86_400_000;
  expect(days).toBe(30);
  await expect(page.getByRole("button", { name: "Valid for 30 days" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Registered, prices typed including VAT (the default).
  await openBusinessProfile(page);
  await page.getByRole("checkbox", { name: "I'm registered for VAT" }).check();
  await page.getByLabel("VAT number").fill("4123456789");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /One-off item/ }).click();
  await expect(sheet(page).getByLabel("Price (including VAT)")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  await fillItem(page, 1, "Cake", "1", "115");
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("115"));
  await expect(page.getByTestId("totals")).toContainText("Includes VAT (15%)");
  await expect(page.getByTestId("totals")).toContainText(/R\s?15,00/);

  // Prices typed excluding VAT: VAT is added on top.
  await openBusinessProfile(page);
  await page.getByLabel("When I type a price, it is").selectOption("exclusive");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/app/quotes/new");
  await fillItem(page, 1, "Cake", "1", "100");
  await page.getByRole("radio", { name: /Delivery/ }).check();
  await page.getByLabel("Delivery fee (excluding VAT)").fill("50");
  // 150 + 15% = 172,50
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("172", "50"));
  await expect(page.getByTestId("totals")).toContainText("Total excluding VAT");
  await expect(page.getByTestId("totals")).toContainText(/R\s?22,50/);
});

test("delete a draft, after being asked", async ({ page }) => {
  await signUpAndOnboard(page, "q-delete", "Delete Co");
  await page.goto("/app/quotes/new");
  await fillItem(page, 1, "Cake", "1", "100");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}/);

  await page.getByRole("button", { name: "Delete draft" }).click();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByRole("button", { name: "Delete draft" })).toBeVisible();

  await page.getByRole("button", { name: "Delete draft" }).click();
  await page.getByRole("button", { name: "Yes, delete the draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes$/);
  await expect(page.getByText("No quotes yet")).toBeVisible();
});

test("each business only ever sees its own quotes", async ({ page, browser }) => {
  await signUpAndOnboard(page, "q-a", "Business A");
  await page.goto("/app/quotes/new");
  await fillItem(page, 1, "A's secret cake", "1", "100");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}/);
  const quoteUrl = page.url().split("?")[0]!;

  const other = await browser.newContext({ ...devices["Pixel 7"] });
  const pageB = await other.newPage();
  await signUpAndOnboard(pageB, "q-b", "Business B");
  await openQuotes(pageB);
  await expect(pageB.getByText("No quotes yet")).toBeVisible();

  await pageB.goto(quoteUrl);
  await expect(pageB.getByText("This page could not be found")).toBeVisible();
  await expect(pageB.getByText("A's secret cake")).toHaveCount(0);
  await other.close();
});

test("a quote id that is not an id is a plain not-found page", async ({ page }) => {
  await signUpAndOnboard(page, "q-404", "Nf Quote Co");
  await page.goto("/app/quotes/not-an-id");
  await expect(page.getByText("This page could not be found")).toBeVisible();
});

test("the quotes page links to the quote settings", async ({ page }) => {
  await signUpAndOnboard(page, "q-settings-link", "Link Co");
  await openQuotes(page);
  await page.getByRole("link", { name: "Quote settings" }).click();
  await expect(page).toHaveURL(/\/app\/documents$/);
  await expect(page.getByRole("heading", { name: "Quotes and invoices", level: 1 })).toBeVisible();
});
