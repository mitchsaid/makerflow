import { expect, test } from "@playwright/test";
import { openDocuments, openMore } from "./helpers";
import { issuedInvoice } from "./invoice-helpers";
import { sheet } from "./quote-helpers";

/** Credit notes, slice I4 (docs/plans/credit-notes.md). */

const rand = (whole: string, cents = "00") => new RegExp(`R\\s?${whole.replace(/ /g, "\\s?")},${cents}`);

test("a credit note corrects an invoice without changing it, and the rest can be credited after", async ({ page }) => {
  test.setTimeout(300_000);
  await issuedInvoice(page, "credit-flow", { name: "Cupcakes", quantity: "10", price: "250" });
  const invoiceUrl = page.url();
  await expect(page.getByTestId("invoice-total")).toHaveText(rand("2 500"));
  await expect(page.getByText(/None\. Issue one/)).toBeVisible();

  // Nothing chosen: the problems are named at the fields and in the summary, and nothing is issued.
  await page.getByRole("button", { name: "Issue a credit note" }).click();
  await sheet(page).getByRole("button", { name: "Issue credit note" }).click();
  await expect(page.getByTestId("form-summary")).toBeVisible();
  await expect(sheet(page).getByText("Choose why you are crediting this invoice.").first()).toBeVisible();
  await expect(sheet(page).getByText("Tick at least one item to credit.").first()).toBeVisible();
  await expect(sheet(page).getByText(/Say in a few words/).first()).toBeVisible();

  // Ticking an item fills in all that is left; a smaller quantity fills in its share of the amount.
  await sheet(page).getByRole("checkbox", { name: /Cupcakes/ }).click();
  await expect(sheet(page).getByLabel("How many")).toHaveValue("10");
  await expect(sheet(page).getByLabel("Amount credited", { exact: true })).toHaveValue("2500");
  await sheet(page).getByLabel("How many").fill("2");
  await expect(sheet(page).getByLabel("Amount credited", { exact: true })).toHaveValue("500");
  await expect(page.getByTestId("credit-total")).toContainText(rand("500"));
  await sheet(page).getByLabel("Why", { exact: true }).selectOption({ label: "Goods returned or defective" });
  await sheet(page).getByLabel("Why it is being credited").fill("Two came back cracked");
  await expect(sheet(page).getByTestId("coming-soon").filter({ hasText: "back in stock" })).toBeVisible();
  await sheet(page).getByRole("button", { name: "Issue credit note" }).click();

  // The credit note: numbered, a real document, naming the invoice and why; nothing edits it.
  await expect(page).toHaveURL(/\/app\/credit-notes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /^Credit note CN-0001/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("credit-note-total")).toHaveText(rand("500"));
  const pdf = await page.request.get(`${page.url()}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  const text = page.getByRole("region", { name: "The credit note as text" });
  await expect(text).toContainText("Credit issued to");
  await expect(text).toContainText("INV-0001");
  await expect(text).toContainText("Goods returned or defective");
  await expect(text).toContainText("Two came back cracked");
  await expect(page.getByRole("button", { name: /Delete|Edit|Change/ })).toHaveCount(0);

  // The invoice stays as it was; what is owing drops, and the note is listed.
  await page.getByRole("link", { name: "invoice INV-0001", exact: true }).click();
  await expect(page).toHaveURL(invoiceUrl);
  await expect(page.getByTestId("invoice-total")).toHaveText(rand("2 500"));
  await expect(page.getByTestId("invoice-credited")).toHaveText(rand("500"));
  await expect(page.getByTestId("invoice-owing")).toHaveText(rand("2 000"));
  await expect(page.getByTestId("credit-notes")).toContainText("CN-0001");

  // The customer's page says how many credit notes their invoices carry.
  await page.goto("/app/customers");
  await page.getByRole("link", { name: /Thandi Nkosi/ }).click();
  await expect(page).toHaveURL(/\/app\/customers\/[0-9a-f-]{36}$/);
  await page.goto(`${page.url()}?section=invoices`);
  await expect(page.getByTestId("customer-credit-notes")).toHaveText("1 credit note on these invoices");
  await page.goto(invoiceUrl);

  // More than is left of an item is explained at the field, and what was typed stays.
  await page.getByRole("button", { name: "Issue a credit note" }).click();
  await sheet(page).getByLabel("Why", { exact: true }).selectOption({ label: "Price or billing correction" });
  await sheet(page).getByLabel("Why it is being credited").fill("Agreed a lower price");
  await sheet(page).getByRole("checkbox", { name: /Cupcakes/ }).click();
  await expect(sheet(page).getByLabel("How many")).toHaveValue("8");
  await sheet(page).getByLabel("How many").fill("9");
  await sheet(page).getByLabel("Amount credited", { exact: true }).fill("2001");
  await sheet(page).getByRole("button", { name: "Issue credit note" }).click();
  await expect(sheet(page).getByText("Only 8 left to credit.").first()).toBeVisible();
  await expect(sheet(page).getByText(/Only R\s?2\s?000,00 left to credit/).first()).toBeVisible();
  await expect(sheet(page).getByLabel("Why it is being credited")).toHaveValue("Agreed a lower price");

  // Credit everything left: the invoice is credited in full, nothing is owing, and no more can be credited.
  await sheet(page).getByRole("button", { name: "Credit everything left" }).click();
  await expect(page.getByTestId("credit-total")).toContainText(rand("2 000"));
  await sheet(page).getByRole("button", { name: "Issue credit note" }).click();
  await expect(page.getByRole("heading", { name: /^Credit note CN-0002/, level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "invoice INV-0001", exact: true }).click();
  await expect(page.getByTestId("invoice-status-chip")).toHaveText("Credited");
  await expect(page.getByTestId("invoice-credited")).toHaveText(rand("2 500"));
  await expect(page.getByTestId("invoice-owing")).toHaveText(rand("0"));
  await expect(page.getByTestId("fully-credited")).toBeVisible();
  await expect(page.getByTestId("nothing-owing")).toBeVisible();
  await expect(page.getByRole("button", { name: "Issue a credit note" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Record a payment" })).toHaveCount(0);

  // The list shows it under Credited; Home has nothing owing from it.
  await openMore(page);
  await page.getByRole("link", { name: /^Invoices/ }).click();
  await page.getByRole("button", { name: /^Credited/ }).click();
  await expect(page.getByTestId("invoice-count")).toHaveText("1 invoice");
  await expect(page.getByRole("link", { name: /Thandi Nkosi/ })).toContainText("credited");
  await page.goto("/app");
  await expect(page.getByTestId("home-owing")).toHaveCount(0);
});

test("crediting an invoice that was paid says what the customer is owed back", async ({ page }) => {
  test.setTimeout(240_000);
  await issuedInvoice(page, "credit-refund", { name: "Shelf", quantity: "1", price: "1000", depositPercent: "50" });
  await page.getByRole("button", { name: "Record the deposit" }).click();
  await sheet(page).getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByTestId("invoice-paid")).toHaveText(rand("500"));

  await page.getByRole("button", { name: "Issue a credit note" }).click();
  await sheet(page).getByLabel("Why", { exact: true }).selectOption({ label: "Order cancelled or reduced" });
  await sheet(page).getByLabel("Why it is being credited").fill("They cancelled");
  await sheet(page).getByRole("button", { name: "Credit everything left" }).click();
  await sheet(page).getByRole("button", { name: "Issue credit note" }).click();
  await expect(page.getByRole("heading", { name: /^Credit note CN-0001/, level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "invoice INV-0001", exact: true }).click();
  await expect(page.getByTestId("invoice-status-chip")).toHaveText("Credited");
  await expect(page.getByTestId("refund-due")).toContainText(rand("500"));
  await expect(page.getByTestId("refund-due").getByTestId("coming-soon")).toContainText("Record a refund");
});

test("credit note numbers are set with the others and never go back", async ({ page }) => {
  await issuedInvoice(page, "credit-numbering", { name: "Shelf", quantity: "1", price: "100" });
  await openDocuments(page);
  await expect(page.getByLabel("Credit note prefix", { exact: true })).toHaveValue("CN-");
  await page.getByLabel("Credit note prefix", { exact: true }).fill("CR/");
  await page.getByLabel("Credit note next number", { exact: true }).fill("50");
  await page.getByRole("button", { name: "Save credit note numbers" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await expect(page.getByTestId("credit-note-number-preview")).toContainText("CR/0050");

  await page.goBack();
  await page.goto("/app/invoices");
  await page.getByRole("link", { name: /Thandi Nkosi/ }).click();
  await page.getByRole("button", { name: "Issue a credit note" }).click();
  await sheet(page).getByLabel("Why", { exact: true }).selectOption({ label: "Something else" });
  await sheet(page).getByLabel("Why it is being credited").fill("Goodwill");
  await sheet(page).getByRole("button", { name: "Credit everything left" }).click();
  await sheet(page).getByRole("button", { name: "Issue credit note" }).click();
  await expect(page.getByRole("heading", { name: /^Credit note CR\/0050/, level: 1 })).toBeVisible();
});
