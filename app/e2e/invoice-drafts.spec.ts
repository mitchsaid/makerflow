import { expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, signUpAndOnboard } from "./helpers";
import { acceptedQuote, businessWithAddress } from "./invoice-helpers";
import { addCustomerInSheet, sheet } from "./quote-helpers";

/** Invoices with no quote, and drafts (docs/plans/invoice-i3.md, slice I3b). */

const rand = (whole: string, cents = "00") => new RegExp(`R\\s?${whole.replace(/ /g, "\\s?")},${cents}`);
const issueButton = (page: Page) => page.locator("#issue-invoice");

/** Adds a one-off item through the item sheet the way a quote does. */
async function addItem(page: Page, name: string, quantity: string, price: string) {
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /One-off item/ }).click();
  await sheet(page).getByLabel("Name", { exact: true }).fill(name);
  await sheet(page).getByLabel("Quantity").fill(quantity);
  await sheet(page).getByLabel(/^Price/).fill(price);
  await sheet(page).getByRole("button", { name: "Add to invoice" }).click();
  await expect(sheet(page)).toHaveCount(0);
}

test("an invoice with no quote is kept as a draft, changed, and issued", async ({ page }) => {
  test.setTimeout(300_000);
  await businessWithAddress(page, "invoice-draft", "Draft Co");

  await page.goto("/app/invoices");
  await expect(page.getByText("No invoices yet")).toBeVisible();
  await page.getByRole("link", { name: "New invoice" }).click();
  await expect(page.getByRole("heading", { name: "New invoice", level: 1 })).toBeVisible();

  // Nothing filled in: the problems are named at the fields and in a summary, and nothing is kept or issued.
  await issueButton(page).click();
  const summary = page.getByTestId("form-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("Choose who the invoice is for.");
  await expect(summary).toContainText("Add at least one item.");

  // A customer and an item, in the same pickers as a quote; the total follows.
  await addCustomerInSheet(page, "Thandi Nkosi");
  await addItem(page, "Shelf", "2", "100");
  await expect(page.getByTestId("totals")).toContainText(rand("200"));
  await expect(page.getByTestId("sticky-total")).toContainText(rand("200"));

  // Save draft keeps it and opens its own page.
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/invoices\/drafts\/[0-9a-f-]{36}\?saved=1$/);
  await expect(page.getByRole("heading", { name: "Invoice draft", level: 1 })).toBeVisible();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  const draftUrl = page.url().replace("?saved=1", "");

  // It is on the list under Drafts, not among the invoices.
  await page.goto("/app/invoices");
  await expect(page.getByTestId("invoice-count")).toHaveText("0 invoices");
  await page.getByRole("button", { name: /^Drafts \(1\)/ }).click();
  const row = page.getByTestId("invoice-draft-row");
  await expect(row).toContainText("Thandi Nkosi");
  await expect(row).toContainText("1 item");
  await expect(row).toContainText("Not issued");
  await row.getByRole("link").click();
  await expect(page).toHaveURL(draftUrl);

  // Changing it: a bigger price and a discount, the note and the due day.
  await page.getByRole("button", { name: /Edit Shelf/ }).click();
  await sheet(page).getByLabel(/^Price/).fill("150");
  await sheet(page).getByRole("button", { name: "Save item" }).click();
  await expect(page.getByTestId("totals")).toContainText(rand("300"));
  await page.getByRole("button", { name: "Add a discount" }).click();
  await page.getByLabel("Discount (%)").fill("10");
  await expect(page.getByTestId("totals")).toContainText(rand("270"));
  await page.getByLabel("Note (optional)").fill("Thanks for your business");
  await page.getByLabel("Due day").fill("2031-01-31");

  // Issuing asks once, says what happens, and then numbers it.
  await issueButton(page).click();
  await expect(sheet(page)).toHaveAccessibleName("Issue this invoice?");
  await expect(sheet(page)).toContainText("can't be changed");
  await sheet(page).getByRole("button", { name: "Keep editing" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await issueButton(page).click();
  await sheet(page).getByRole("button", { name: "Issue invoice", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Invoice INV-0001/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("invoice-total")).toHaveText(rand("270"));
  await expect(page.getByTestId("invoice-origin")).toContainText("Made without a quote");
  await expect(page.getByTestId("invoice-status-chip")).toHaveText("Unpaid");
  const text = page.getByRole("region", { name: "The invoice as text" });
  await expect(text).toContainText("Thanks for your business");
  await expect(text).toContainText("Shelf");
  await expect(text).not.toContainText("Quote");
  const pdf = await page.request.get(`${page.url()}/pdf`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");

  // The draft is gone, and an issued invoice is not editable.
  await page.goto("/app/invoices");
  await expect(page.getByRole("button", { name: /^Drafts/ })).toHaveCount(0);
  await expect(page.getByTestId("invoice-count")).toHaveText("1 invoice");
  await page.goto(draftUrl);
  await expect(page.getByText("This page could not be found")).toBeVisible();
});

test("what an invoice still needs is said, the draft is kept meanwhile, and it can be issued after", async ({ page }) => {
  test.setTimeout(300_000);
  // No business address yet: an invoice has to show one.
  await signUpAndOnboard(page, "invoice-draft-problem", "Needs Address Co");
  await page.goto("/app/invoices/new");
  await addCustomerInSheet(page, "Thandi Nkosi");
  await addItem(page, "Shelf", "1", "100");
  await issueButton(page).click();
  await sheet(page).getByRole("button", { name: "Issue invoice", exact: true }).click();
  await expect(page.getByTestId("invoice-problems")).toContainText("Add your business address");
  await expect(page.getByTestId("form-summary")).toContainText("Before you can issue it");
  // The draft was kept all the same, so nothing typed is lost.
  await expect(page).toHaveURL(/\/app\/invoices\/drafts\/[0-9a-f-]{36}$/);
  const draftUrl = page.url();

  await openBusinessProfile(page);
  await page.getByLabel("Street address").fill("12 Long Street");
  await page.getByLabel("City or town").fill("Cape Town");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto(draftUrl);
  await expect(page.getByTestId("selected-customer")).toHaveText("Thandi Nkosi");
  await issueButton(page).click();
  await sheet(page).getByRole("button", { name: "Issue invoice", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Invoice INV-0001/, level: 1 })).toBeVisible();
});

test("a draft can be discarded, and a customer's page starts an invoice for them", async ({ page }) => {
  test.setTimeout(240_000);
  await businessWithAddress(page, "invoice-draft-discard", "Discard Co");
  await page.goto("/app/customers/new");
  await page.getByLabel("Name", { exact: true }).fill("Thandi Nkosi");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByTestId("customer-added")).toBeVisible();
  await page.getByRole("link", { name: /Thandi Nkosi/ }).click();
  await page.getByRole("navigation", { name: /quotes, jobs, invoices or details/ }).getByRole("link", { name: "Invoices" }).click();
  await page.getByRole("link", { name: "New invoice" }).click();
  await expect(page.getByTestId("selected-customer")).toHaveText("Thandi Nkosi");

  await addItem(page, "Shelf", "1", "100");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/invoices\/drafts\/[0-9a-f-]{36}\?saved=1$/);

  // Asked once; "Keep it" keeps it.
  await page.getByRole("button", { name: "Discard draft" }).click();
  await expect(page.getByTestId("discard-question")).toContainText("Nothing has been issued");
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByTestId("discard-question")).toHaveCount(0);
  await page.getByRole("button", { name: "Discard draft" }).click();
  await page.getByRole("button", { name: "Yes, discard it" }).click();
  await expect(page).toHaveURL(/\/app\/invoices\?show=drafts$/);
  await expect(page.getByText("No invoices yet")).toBeVisible();
});

test("a finished job made by hand starts an invoice with its customer and items, ready for prices", async ({ page }) => {
  test.setTimeout(300_000);
  await acceptedQuote(page, "invoice-draft-job", { name: "Cupcakes", quantity: "1", price: "100" });
  await page.goto("/app/jobs/new");
  await page.getByLabel("Customer name", { exact: true }).fill("Thandi");
  await page.getByRole("option", { name: /Thandi Nkosi/ }).click();
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: "One-off item (just for this job)" }).click();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Brackets");
  await sheet(page).getByLabel("Quantity").fill("4");
  await sheet(page).getByLabel("Unit (optional)").fill("pair");
  await sheet(page).getByRole("button", { name: "Add to job" }).click();
  await page.getByRole("button", { name: "Create job" }).click();
  await page.getByRole("button", { name: "Start making" }).click();
  await page.getByRole("button", { name: "Mark ready", exact: true }).click();
  await page.getByRole("button", { name: "Mark done", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Done$/, level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Start an invoice" }).click();
  await expect(page).toHaveURL(/\/app\/invoices\/drafts\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("selected-customer")).toHaveText("Thandi Nkosi");
  await expect(page.getByRole("button", { name: /Edit Brackets/ })).toContainText("4 pair");

  // No price yet: it says which item needs one, and nothing is issued.
  await issueButton(page).click();
  await expect(page.getByTestId("form-summary")).toContainText("Brackets");
  await page.getByRole("button", { name: /Edit Brackets/ }).click();
  await sheet(page).getByLabel(/^Price/).fill("25");
  await sheet(page).getByRole("button", { name: "Save item" }).click();
  await expect(page.getByTestId("totals")).toContainText(rand("100"));
  await issueButton(page).click();
  await sheet(page).getByRole("button", { name: "Issue invoice", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Invoice INV-0001/, level: 1 })).toBeVisible();
});

test("Adjust before issuing starts a draft from the accepted quote, changed and issued, and says so on the invoice", async ({ page }) => {
  test.setTimeout(300_000);
  await acceptedQuote(page, "invoice-adjust", { name: "Cupcakes", quantity: "10", price: "250" });
  const quoteUrl = page.url();

  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(sheet(page).getByRole("button", { name: "Adjust before issuing" })).toBeVisible();
  await sheet(page).getByRole("button", { name: "Adjust before issuing" }).click();

  // A draft with the quote's customer and items, and a note that says where it came from.
  await expect(page).toHaveURL(/\/app\/invoices\/drafts\/[0-9a-f-]{36}$/);
  const draftUrl = page.url();
  await expect(page.getByTestId("invoice-quote-note")).toContainText("quote QT-0001");
  await expect(page.getByTestId("selected-customer")).toHaveText("Thandi Nkosi");
  await expect(page.getByRole("button", { name: /Edit Cupcakes/ })).toContainText("10");
  await expect(page.getByTestId("totals")).toContainText(rand("2 500"));

  // Asking again reopens the same draft.
  await page.goto(quoteUrl);
  await page.getByRole("button", { name: "Create invoice" }).click();
  await sheet(page).getByRole("button", { name: "Adjust before issuing" }).click();
  await expect(page).toHaveURL(draftUrl);

  // On the list it says which quote it is from.
  await page.goto("/app/invoices?show=drafts");
  await expect(page.getByTestId("invoice-draft-row")).toContainText("from quote QT-0001");

  // Change the quantity (a short delivery), issue it, and the invoice says it was changed.
  await page.goto(draftUrl);
  await page.getByRole("button", { name: /Edit Cupcakes/ }).click();
  await sheet(page).getByLabel("Quantity").fill("8");
  await sheet(page).getByRole("button", { name: "Save item" }).click();
  await expect(page.getByTestId("totals")).toContainText(rand("2 000"));
  await issueButton(page).click();
  await sheet(page).getByRole("button", { name: "Issue invoice", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Invoice INV-0001/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("invoice-total")).toHaveText(rand("2 000"));
  const origin = page.getByTestId("invoice-origin");
  await expect(origin).toContainText("Made from");
  await expect(origin).toContainText("quote QT-0001");
  await expect(origin).toContainText("changed before it was issued");

  // The quote is as it was agreed, and now points to its invoice; the draft is gone.
  await page.goto(quoteUrl);
  await expect(page.getByRole("heading", { name: "Invoice INV-0001", level: 3 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the invoice" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create invoice" })).toHaveCount(0);
  await page.goto(draftUrl);
  await expect(page.getByText("This page could not be found")).toBeVisible();
});

test("a quote invoiced the plain way leaves no draft behind to issue twice", async ({ page }) => {
  test.setTimeout(300_000);
  await acceptedQuote(page, "invoice-adjust-plain", { name: "Cupcakes", quantity: "10", price: "250" });
  const quoteUrl = page.url();
  await page.getByRole("button", { name: "Create invoice" }).click();
  await sheet(page).getByRole("button", { name: "Adjust before issuing" }).click();
  await expect(page).toHaveURL(/\/app\/invoices\/drafts\/[0-9a-f-]{36}$/);
  const draftUrl = page.url();

  // The quote is invoiced as agreed instead.
  await page.goto(quoteUrl);
  await page.getByRole("button", { name: "Create invoice" }).click();
  await sheet(page).getByRole("button", { name: "Issue invoice", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Invoice INV-0001/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("invoice-origin")).not.toContainText("changed before");
  await page.goto(draftUrl);
  await expect(page.getByText("This page could not be found")).toBeVisible();
});
