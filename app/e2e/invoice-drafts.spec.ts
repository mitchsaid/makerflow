import { expect, test, type Page } from "@playwright/test";
import { businessTab, openBusinessProfile, setJobStatus, signUpAndOnboard } from "./helpers";
import { acceptedQuote, businessWithAddress, issueFromQuoteSheet, issuedInvoice } from "./invoice-helpers";
import { addCustomerInSheet, sheet } from "./quote-helpers";

/** Invoices with no quote, and drafts (docs/plans/invoice-i3.md, slice I3b). */

const rand = (whole: string, cents = "00") => new RegExp(`R\\s?${whole.replace(/ /g, "\\s?")},${cents}`);
const previewButton = (page: Page) => page.locator("#preview-invoice");
/** On the preview page. */
const issueButton = (page: Page) => page.locator("#issue-invoice");

/** From the draft: Continue to preview, then issue from the preview (it asks once). */
async function issueFromDraft(page: Page) {
  await previewButton(page).click();
  await expect(page).toHaveURL(/\/preview$/);
  await issueButton(page).click();
  await sheet(page).getByRole("button", { name: "Mark as sent", exact: true }).click();
}

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

  // Nothing filled in: the problems are named at the fields and in a summary, and nothing is kept or previewed.
  await previewButton(page).click();
  const summary = page.getByTestId("form-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("Choose who the invoice is for.");
  await expect(summary).toContainText("Add at least one item.");

  // A customer and an item, in the same pickers as a quote; the total follows.
  await addCustomerInSheet(page, "Thandi Nkosi");
  await addItem(page, "Shelf", "2", "100");
  await expect(page.getByTestId("sticky-total")).toContainText(rand("200"));
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
  await expect(row).toContainText("Not sent");
  await row.getByRole("link").click();
  await expect(page).toHaveURL(draftUrl);

  // Changing it: a bigger price and a discount, the note and the due day.
  await page.getByRole("button", { name: /Edit Shelf/ }).click();
  await sheet(page).getByLabel(/^Price/).fill("150");
  await sheet(page).getByRole("button", { name: "Save item" }).click();
  // (The closing sheet has an "Add a discount" of its own: wait for it to go.)
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId("sticky-total")).toContainText(rand("300"));
  await page.getByRole("button", { name: "Add a discount" }).click();
  await page.getByLabel("Discount (%)").fill("10");
  await expect(page.getByTestId("totals")).toContainText(rand("270"));
  await page.getByLabel("Note (optional)").fill("Thanks for your business");
  await page.getByLabel("Due date").fill("2031-01-31");

  // Continue to preview shows the invoice as it will look, not yet numbered; issuing asks once, says what happens, and then numbers it.
  await previewButton(page).click();
  await expect(page).toHaveURL(/\/preview$/);
  await expect(page.getByRole("heading", { name: "Preview of invoice", level: 1 })).toBeVisible();
  const previewText = page.getByRole("region", { name: "The invoice as text" });
  await expect(previewText).toContainText("Not yet numbered");
  await expect(previewText).toContainText("Shelf");
  await expect(previewText).toContainText("Thanks for your business");
  await expect(previewText).toContainText("Draft copy");
  // A copy can be downloaded before it is issued: a draft, drawn from the kept draft the way the preview is.
  const download = page.getByRole("link", { name: "Download", exact: true });
  await expect(download).toHaveAttribute("href", /\/app\/invoices\/drafts\/[0-9a-f-]{36}\/pdf\?download=1$/);
  const copy = await page.request.get(page.url().replace(/\/preview$/, "/pdf"));
  expect(copy.status()).toBe(200);
  expect(copy.headers()["content-type"]).toBe("application/pdf");
  expect((await copy.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  await issueButton(page).click();
  await expect(sheet(page)).toHaveAccessibleName("Mark this invoice as sent?");
  await expect(sheet(page)).toContainText("can't be changed");
  await sheet(page).getByRole("button", { name: "Cancel" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await issueButton(page).click();
  await sheet(page).getByRole("button", { name: "Mark as sent", exact: true }).click();
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
  await previewButton(page).click();
  // The preview is kept as a draft, and says what is missing before anything is asked.
  await expect(page).toHaveURL(/\/app\/invoices\/drafts\/[0-9a-f-]{36}\/preview$/);
  await expect(page.getByTestId("invoice-problems")).toContainText("Add your business address");
  const draftUrl = page.url().replace(/\/preview$/, "");
  // Issuing anyway is stopped, and the question closes.
  await issueButton(page).click();
  await sheet(page).getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId("invoice-problems")).toContainText("Add your business address");

  await openBusinessProfile(page);
  await page.getByLabel("Street address").fill("12 Long Street");
  await page.getByLabel("City or town").fill("Cape Town");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto(draftUrl);
  await expect(page.getByTestId("selected-customer")).toHaveText("Thandi Nkosi");
  await issueFromDraft(page);
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
  await expect(page).toHaveURL(/\/app\/customers\/[0-9a-f-]{36}$/);
  const customerUrl = page.url();
  await page.getByRole("navigation", { name: /details, quotes, jobs or invoices/ }).getByRole("link", { name: "Invoices" }).click();
  await page.getByRole("link", { name: "New invoice" }).click();
  await expect(page.getByTestId("selected-customer")).toHaveText("Thandi Nkosi");

  await addItem(page, "Shelf", "1", "100");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/invoices\/drafts\/[0-9a-f-]{36}\?saved=1$/);
  const draftUrl = page.url().replace(/\?saved=1$/, "");

  // The draft shows under the customer's Invoices, as not issued.
  await page.goto(`${customerUrl}?section=invoices`);
  await expect(page.getByTestId("invoice-draft-row")).toContainText("Not sent");
  await expect(page.getByText("No invoices yet")).toHaveCount(0);
  await page.getByTestId("invoice-draft-row").getByRole("link").click();
  await expect(page).toHaveURL(draftUrl);

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
  await setJobStatus(page, "Making");
  await setJobStatus(page, "Ready");
  await setJobStatus(page, "Done");
  await expect(page.getByRole("heading", { name: /^Job J-0001 Done$/, level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Start an invoice" }).click();
  await expect(page).toHaveURL(/\/app\/invoices\/drafts\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("selected-customer")).toHaveText("Thandi Nkosi");
  await expect(page.getByRole("button", { name: /Edit Brackets/ })).toContainText("4 pair");

  // No price yet: it says which item needs one, and nothing is issued.
  await previewButton(page).click();
  await expect(page.getByTestId("form-summary")).toContainText("Brackets");
  await page.getByRole("button", { name: /Edit Brackets/ }).click();
  await sheet(page).getByLabel(/^Price/).fill("25");
  await sheet(page).getByRole("button", { name: "Save item" }).click();
  await expect(page.getByTestId("sticky-total")).toContainText(rand("100"));
  await issueFromDraft(page);
  await expect(page.getByRole("heading", { name: /^Invoice INV-0001/, level: 1 })).toBeVisible();
});

test("Adjust before sending starts a draft from the accepted quote, changed and issued, and says so on the invoice", async ({ page }) => {
  test.setTimeout(300_000);
  await acceptedQuote(page, "invoice-adjust", { name: "Cupcakes", quantity: "10", price: "250" });
  const quoteUrl = page.url();

  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(sheet(page).getByRole("button", { name: "Adjust before sending" })).toBeVisible();
  await sheet(page).getByRole("button", { name: "Adjust before sending" }).click();

  // A draft with the quote's customer and items, and a note that says where it came from.
  await expect(page).toHaveURL(/\/app\/invoices\/drafts\/[0-9a-f-]{36}$/);
  const draftUrl = page.url();
  await expect(page.getByTestId("invoice-quote-note")).toContainText("quote QT-0001");
  await expect(page.getByTestId("selected-customer")).toHaveText("Thandi Nkosi");
  await expect(page.getByRole("button", { name: /Edit Cupcakes/ })).toContainText("10");
  await expect(page.getByTestId("sticky-total")).toContainText(rand("2 500"));

  // Asking again reopens the same draft.
  await page.goto(quoteUrl);
  await page.getByRole("button", { name: "Create invoice" }).click();
  await sheet(page).getByRole("button", { name: "Adjust before sending" }).click();
  await expect(page).toHaveURL(draftUrl);

  // On the list it says which quote it is from.
  await page.goto("/app/invoices?show=drafts");
  await expect(page.getByTestId("invoice-draft-row")).toContainText("from quote QT-0001");

  // Change the quantity (a short delivery), issue it, and the invoice says it was changed.
  await page.goto(draftUrl);
  await page.getByRole("button", { name: /Edit Cupcakes/ }).click();
  await sheet(page).getByLabel("Quantity").fill("8");
  await sheet(page).getByRole("button", { name: "Save item" }).click();
  await expect(page.getByTestId("sticky-total")).toContainText(rand("2 000"));
  await issueFromDraft(page);
  await expect(page.getByRole("heading", { name: /^Invoice INV-0001/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("invoice-total")).toHaveText(rand("2 000"));
  const origin = page.getByTestId("invoice-origin");
  await expect(origin).toContainText("Made from");
  await expect(origin).toContainText("quote QT-0001");
  await expect(origin).toContainText("changed before it was sent");

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
  await sheet(page).getByRole("button", { name: "Adjust before sending" }).click();
  await expect(page).toHaveURL(/\/app\/invoices\/drafts\/[0-9a-f-]{36}$/);
  const draftUrl = page.url();

  // The quote is invoiced as agreed instead.
  await page.goto(quoteUrl);
  await page.getByRole("button", { name: "Create invoice" }).click();
  await issueFromQuoteSheet(page);
  await expect(page.getByRole("heading", { name: /^Invoice INV-0001/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("invoice-origin")).not.toContainText("changed before");
  await page.goto(draftUrl);
  await expect(page.getByText("This page could not be found")).toBeVisible();
});

test("fixing what an invoice needs has a way back to the invoice, kept as a draft", async ({ page }) => {
  test.setTimeout(300_000);
  await signUpAndOnboard(page, "invoice-way-back", "Way Back Co");
  await page.goto("/app/invoices/new");
  await addCustomerInSheet(page, "Thandi Nkosi");
  await addItem(page, "Shelf", "1", "100");
  await previewButton(page).click();
  await expect(page.getByTestId("invoice-problems")).toContainText("Add your business address");

  // The link goes to the business profile, which has the way back to the preview; fixing it there keeps everything.
  await page.getByTestId("invoice-problems").getByRole("link", { name: "Open your business profile" }).click();
  await expect(page).toHaveURL(/\/app\/business\?back=/);
  await page.getByLabel("Street address").fill("12 Long Street");
  await page.getByLabel("City or town").fill("Cape Town");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  // The tabs keep the way back too.
  await businessTab(page, "Logo");
  await expect(page.getByTestId("back-link")).toHaveAccessibleName("Back to invoice preview");
  await page.getByTestId("back-link").click();

  await expect(page).toHaveURL(/\/app\/invoices\/drafts\/[0-9a-f-]{36}\/preview$/);
  await expect(page.getByTestId("invoice-problems")).toHaveCount(0);
  await issueButton(page).click();
  await sheet(page).getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Invoice INV-0001/, level: 1 })).toBeVisible();
});

test("an invoice shows a quantity price when the maker turns it on, on the item, as a quote does", async ({ page }) => {
  test.setTimeout(240_000);
  await businessWithAddress(page, "invoice-qprice", "Invoice Quantity Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cupcakes");
  await page.getByLabel("Price", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Add a quantity price" }).click();
  await page.getByLabel("From (quantity)").fill("10");
  await page.getByLabel("Percent off (%)").fill("10");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();

  await page.goto("/app/invoices/new");
  await addCustomerInSheet(page, "Thandi Nkosi");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Cupcakes/ }).click();
  // Nothing to decide until the price came from a quantity price; then it is asked under the price, and says "invoice".
  await expect(sheet(page).getByRole("checkbox", { name: "Show quantity prices on this invoice" })).toHaveCount(0);
  await sheet(page).getByLabel("Quantity", { exact: true }).fill("12");
  const show = sheet(page).getByRole("checkbox", { name: "Show quantity prices on this invoice" });
  await expect(show).not.toBeChecked();
  await show.check();
  await sheet(page).getByRole("button", { name: "Add to invoice" }).click();
  await expect(sheet(page)).toHaveCount(0);

  await previewButton(page).click();
  await expect(page).toHaveURL(/\/preview$/);
  await expect(page.getByRole("region", { name: "The invoice as text" })).toContainText(/Quantity price: 10 or more: 10% off \(usually R\s?100,00\)/);
});

test("an invoice picks a theme on its preview, the next invoice starts with it, and the sent invoice keeps it", async ({ page }) => {
  test.setTimeout(300_000);
  await businessWithAddress(page, "invoice-theme", "Invoice Theme Co");

  // A first draft, previewed: it starts on Classic, and the strip is the quote's.
  await page.goto("/app/invoices/new");
  await addCustomerInSheet(page, "Thandi Nkosi");
  await addItem(page, "Shelf", "1", "100");
  await previewButton(page).click();
  await expect(page).toHaveURL(/\/preview$/);
  const warm = page.getByRole("button", { name: "Warm", exact: true });
  await expect(page.getByTestId("current-design")).toHaveText("Classic");
  await warm.click();
  await expect(warm).toHaveAttribute("aria-pressed", "true");
  // It is saved quietly: it is still chosen after a reload.
  await expect(page.getByTestId("design-save-status")).toHaveText("");
  await page.reload();
  await expect(page.getByRole("button", { name: "Warm", exact: true })).toHaveAttribute("aria-pressed", "true");
  const firstPreview = page.url();

  // A new invoice starts with the theme chosen last (one default for quotes and invoices).
  await page.goto("/app/invoices/new");
  await addCustomerInSheet(page, "Sipho Dlamini");
  await addItem(page, "Table", "1", "200");
  await previewButton(page).click();
  await expect(page).toHaveURL(/\/preview$/);
  await expect(page.getByRole("button", { name: "Warm", exact: true })).toHaveAttribute("aria-pressed", "true");

  // Sent from the first one: the invoice page says which theme it is locked to.
  await page.goto(firstPreview);
  await issueButton(page).click();
  await sheet(page).getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/invoices\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("current-design")).toHaveText("Warm");
  await expect(page.getByText("The look this invoice was sent with.")).toBeVisible();
});

test("a sent invoice and a draft can each be duplicated from their card into a new draft", async ({ page }) => {
  test.setTimeout(300_000);
  await issuedInvoice(page, "invoice-duplicate", { name: "Cupcakes", quantity: "10", price: "250" });
  await page.goto("/app/invoices");
  const card = (name: string | RegExp) => page.getByRole("button", { name });

  // A sent invoice: asks first, then opens a new DRAFT (not a numbered invoice) with the same customer and total.
  await expect(card(/^More for Thandi Nkosi, invoice INV-0001/)).toBeVisible();
  await card(/^More for Thandi Nkosi, invoice INV-0001/).click();
  await page.getByRole("dialog", { name: /Thandi Nkosi · INV-0001/ }).getByRole("button", { name: /Duplicate/ }).click();
  await expect(sheet(page)).toHaveAccessibleName("Duplicate this invoice?");
  await sheet(page).getByRole("button", { name: "Not now" }).click();
  await expect(page.getByRole("button", { name: /^Drafts/ })).toHaveCount(0);
  await card(/^More for Thandi Nkosi, invoice INV-0001/).click();
  await page.getByRole("dialog", { name: /Thandi Nkosi · INV-0001/ }).getByRole("button", { name: /Duplicate/ }).click();
  await sheet(page).getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/invoices\/drafts\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("selected-customer")).toHaveText("Thandi Nkosi");
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("2 500"));
  await expect(page.getByText("Cupcakes")).toBeVisible();

  // The list has the new draft (under Drafts), and the invoice is still the only numbered one.
  await page.goto("/app/invoices");
  await expect(page.getByRole("link", { name: /INV-0001/ })).toHaveCount(1);
  await expect(page.getByRole("link", { name: /INV-0002/ })).toHaveCount(0);
  // The click can land before the list has hydrated and do nothing: click again until the drafts are shown.
  await expect(async () => {
    await page.getByRole("button", { name: /^Drafts \(1\)/ }).click();
    await expect(page.getByTestId("invoice-draft-row")).toHaveCount(1, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });

  // A draft can be duplicated too.
  await card(/^More for Thandi Nkosi, draft/).click();
  await page.getByRole("dialog", { name: /Thandi Nkosi · draft/ }).getByRole("button", { name: /Duplicate/ }).click();
  await expect(sheet(page)).toHaveAccessibleName("Duplicate this draft?");
  await sheet(page).getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/invoices\/drafts\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("2 500"));
  await page.goto("/app/invoices");
  // The click can land before the list has hydrated and do nothing: click again until the drafts are shown.
  await expect(async () => {
    await page.getByRole("button", { name: /^Drafts \(2\)/ }).click();
    await expect(page.getByTestId("invoice-draft-row")).toHaveCount(2, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
});
