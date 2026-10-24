import { expect, test, type Page } from "@playwright/test";
import { openMore } from "./helpers";
import { issuedInvoice } from "./invoice-helpers";
import { sheet } from "./quote-helpers";

/** Customer statements of account (docs/plans/customer-statements.md). */

const rand = (whole: string, cents = "00") => new RegExp(`R\\s?${whole.replace(/ /g, "\\s?")},${cents}`);

/** An invoice of R2 500 with R1 000 paid and R500 credited, ending on its page. */
async function invoiceWithPaymentAndCredit(page: Page, label: string) {
  await issuedInvoice(page, label, { name: "Cupcakes", quantity: "10", price: "250" });
  await page.getByRole("button", { name: "Record a payment" }).click();
  await sheet(page).getByLabel("Amount received").fill("1000");
  await sheet(page).getByLabel("How it was paid (optional)").selectOption("eft");
  await sheet(page).getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByTestId("invoice-paid")).toHaveText(rand("1 000"));
  await page.getByRole("button", { name: "Issue a credit note" }).click();
  await sheet(page).getByRole("checkbox", { name: /Cupcakes/ }).click();
  await sheet(page).getByLabel("How many").fill("2");
  await sheet(page).getByLabel("Reason", { exact: true }).selectOption({ label: "Goods returned or defective" });
  await sheet(page).getByLabel("Explanation").fill("Two came back cracked");
  await sheet(page).getByRole("button", { name: "Issue credit note" }).click();
  await expect(page.getByRole("heading", { name: /^Credit note CN-0001/, level: 1 })).toBeVisible();
}

async function openStatement(page: Page) {
  await openMore(page);
  await page.getByRole("link", { name: /^Customers/ }).click();
  await page.getByRole("link", { name: /Thandi Nkosi/ }).first().click();
  await page.getByRole("link", { name: "Statement of account" }).click();
  await expect(page.getByRole("heading", { name: "Statement of account", level: 1 })).toBeVisible();
}

test("a customer's statement shows what was invoiced, credited and paid, and what is owing", async ({ page }) => {
  test.setTimeout(300_000);
  await invoiceWithPaymentAndCredit(page, "statement-flow");
  await openStatement(page);
  const statementUrl = page.url();

  // The balance is what the invoice, the credit note and the payment leave.
  await expect(page.getByTestId("statement-balance")).toHaveText(rand("1 000"));
  await expect(page.getByTestId("statement-summary")).toContainText(rand("2 500"));
  // A new invoice is not yet due: ageing counts days past the due day.
  await expect(page.getByTestId("statement-ageing")).toContainText("Not yet due");
  await expect(page.getByTestId("statement-ageing")).toContainText(rand("1 000"));

  // The same statement as text: one row each, in date order, each leading to its document.
  const text = page.getByRole("region", { name: "The statement as text" });
  await expect(text.getByRole("row")).toHaveCount(4);
  await expect(text).toContainText("Payment received, EFT");
  await expect(text).toContainText("Goods returned or defective");
  // The text version is for screen readers (visually hidden), so its links are followed by address.
  await expect(text.getByRole("link", { name: "CN-0001" })).toHaveAttribute("href", /\/app\/credit-notes\/[0-9a-f-]{36}$/);
  await page.goto((await text.getByRole("link", { name: "CN-0001" }).getAttribute("href"))!);
  await expect(page.getByRole("heading", { name: /^Credit note CN-0001/, level: 1 })).toBeVisible();
  await page.goto(statementUrl);

  // It is a real PDF, and the period and "only what is owing" carry into it.
  const pdf = await page.request.get(`${statementUrl}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  const owingPdf = await page.request.get(`${statementUrl}/pdf?period=this_month&owing=1`);
  expect(owingPdf.status()).toBe(200);

  // A period that starts after everything keeps the balance as brought forward.
  await page.getByRole("link", { name: "This month", exact: true }).click();
  await expect(page).toHaveURL(/period=this_month/);
  await expect(page.getByTestId("statement-balance")).toHaveText(rand("1 000"));

  // Only what is owing: this invoice is still owing, so it stays.
  await page.getByRole("link", { name: "Only what is owing" }).click();
  await expect(page).toHaveURL(/owing=1/);
  await expect(page.getByTestId("statement-balance")).toHaveText(rand("1 000"));

  // Pay the rest: nothing is owing any more.
  await page.goto(statementUrl);
  await page.goto((await text.getByRole("link", { name: "INV-0001" }).first().getAttribute("href"))!);
  await page.getByRole("button", { name: "Record a payment" }).click();
  await sheet(page).getByLabel("Amount received").fill("1000");
  await sheet(page).getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByTestId("invoice-status-chip")).toHaveText("Paid");
  await page.goto(`${statementUrl}?owing=1`);
  await expect(page.getByText("Nothing owing")).toBeVisible();
  await page.goto(statementUrl);
  await expect(page.getByTestId("statement-balance")).toHaveText(rand("0"));
});

test("a statement over a recent period still shows the balance", async ({ page }) => {
  test.setTimeout(120_000);
  await issuedInvoice(page, "statement-empty", { name: "Cupcakes", quantity: "1", price: "100" });
  await openStatement(page);
  await page.getByRole("link", { name: "Last 30 days", exact: true }).click();
  await expect(page.getByTestId("statement-balance")).toHaveText(rand("100"));
});
