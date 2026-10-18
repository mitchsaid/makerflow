import { expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, openDocuments, openMore, signUpAndOnboard } from "./helpers";
import { sentQuote } from "./quote-helpers";

/** Invoices, slice I1 (docs/plans/invoices-and-payments.md). */

const sheet = (page: Page) => page.getByRole("dialog");

async function accept(page: Page) {
  await page.getByRole("button", { name: "They accepted" }).click();
  await sheet(page).getByLabel("How they told you").selectOption("whatsapp");
  await sheet(page).getByRole("button", { name: "Save answer" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Accepted$/, level: 1 })).toBeVisible();
}

test("an accepted quote becomes a numbered invoice that cannot be changed", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "invoice-flow", "Invoice Co");
  await sentQuote(page);

  // Only an accepted quote can be invoiced.
  await expect(page.getByRole("button", { name: "Create invoice" })).toHaveCount(0);
  await accept(page);

  // The business has no address yet: an invoice has to show it, so the sheet says so and points to the fix.
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(sheet(page).getByText(/Add your business address/)).toBeVisible();
  await expect(sheet(page).getByRole("link", { name: "Open your business profile" })).toBeVisible();
  await sheet(page).getByRole("button", { name: "Issue invoice" }).click();
  await expect(sheet(page)).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Invoice INV-/ })).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  await openBusinessProfile(page);
  await page.getByLabel("Street address").fill("12 Long Street");
  await page.getByLabel("City or town").fill("Cape Town");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Carrying on from another system: invoices continue from the number set here, and it can't go back.
  await openDocuments(page);
  await expect(page.getByLabel("Invoice prefix", { exact: true })).toHaveValue("INV-");
  await page.getByLabel("Invoice next number", { exact: true }).fill("41");
  await page.getByRole("button", { name: "Save invoice numbers" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await expect(page.getByTestId("invoice-number-preview").filter({ hasText: "INV-0041" })).toBeVisible();

  await page.goto("/app/quotes");
  await page.getByRole("link", { name: /QT-0001/ }).first().click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Accepted$/, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(sheet(page).getByText(/Add your business address/)).toHaveCount(0);

  // A due day before the invoice day is caught at the field, and what was typed stays.
  await sheet(page).getByLabel("Invoice date").fill("2026-10-20");
  await sheet(page).getByLabel("Due day").fill("2026-10-10");
  await sheet(page).getByLabel("Note (optional)").fill("Thanks for your order!");
  await sheet(page).getByRole("button", { name: "Issue invoice" }).click();
  await expect(sheet(page).getByText("The due day can't be before the invoice date.").first()).toBeVisible();
  await expect(sheet(page).getByLabel("Note (optional)")).toHaveValue("Thanks for your order!");

  await sheet(page).getByLabel("Due day").fill("2026-11-03");
  await sheet(page).getByRole("button", { name: "Issue invoice" }).click();
  await expect(page).toHaveURL(/\/app\/invoices\/[0-9a-f-]{36}$/);
  const url = page.url();

  // It has the first number, says what it is, and is for the whole of the quote.
  await expect(page.getByRole("heading", { name: /^Invoice INV-0041/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("invoice-status-chip")).toHaveText(/Unpaid|Overdue/);
  await expect(page.getByTestId("invoice-total")).toHaveText(/^R\s?800,00$/);
  await expect(page.getByTestId("invoice-owing")).toHaveText(/^R\s?800,00$/);
  await expect(page.getByText("Thandi Nkosi").first()).toBeVisible();
  await expect(page.getByTestId("activity")).toContainText("Issued as INV-0041");
  await expect(page.getByRole("link", { name: "quote QT-0001" })).toBeVisible();

  // The document is a real PDF; the page has no way to edit or delete it, and shows what is still to come.
  const pdf = await page.request.get(`${url}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  await expect(page.getByRole("button", { name: /Delete|Edit|Change/ })).toHaveCount(0);
  await expect(page.getByTestId("coming-soon").filter({ hasText: "Credit note" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Record a payment" })).toBeVisible();

  // The text version of the document is there for screen readers, with the invoice's own words.
  const text = page.getByRole("region", { name: "The invoice as text" });
  await expect(text).toContainText("Billed to");
  await expect(text).toContainText("Thanks for your order!");
  await expect(text).not.toContainText("not a tax invoice");

  // The quote now points at its invoice, offers no second one, and keeps its answer.
  await page.getByRole("link", { name: "quote QT-0001" }).click();
  await expect(page.getByRole("button", { name: "Create invoice" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Change the answer" })).toHaveCount(0);
  await page.getByRole("link", { name: "Open the invoice" }).click();
  await expect(page.getByRole("heading", { name: /^Invoice INV-0041/, level: 1 })).toBeVisible();

  // The list (behind More on a phone) shows it, and finds it by customer.
  await openMore(page);
  await page.getByRole("link", { name: /^Invoices/ }).click();
  await expect(page.getByRole("heading", { name: "Invoices", level: 1 })).toBeVisible();
  await expect(page.getByTestId("invoice-count")).toHaveText("1 invoice");
  await page.getByLabel("Search invoices").fill("nobody");
  await expect(page.getByText(/No invoices match/)).toBeVisible();
  await page.getByLabel("Search invoices").fill("thandi");
  await page.getByRole("link", { name: /Thandi Nkosi/ }).click();
  await expect(page).toHaveURL(url);
});

test("a new business sees an empty list with the way to its first invoice", async ({ page }) => {
  await signUpAndOnboard(page, "invoice-empty", "Empty Co");
  await openMore(page);
  await page.getByRole("link", { name: /^Invoices/ }).click();
  await expect(page.getByText("No invoices yet")).toBeVisible();
  await page.getByRole("link", { name: "Go to your quotes" }).click();
  await expect(page.getByRole("heading", { name: "Quotes", level: 1 })).toBeVisible();
});

test("invoice numbering never goes back", async ({ page }) => {
  await signUpAndOnboard(page, "invoice-numbering", "Numbering Co");
  await openDocuments(page);
  await page.getByLabel("Invoice next number", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Save invoice numbers" }).click();
  await expect(page.getByTestId("form-summary")).toBeVisible();
  await page.getByLabel("Invoice prefix", { exact: true }).fill("FAC/");
  await page.getByLabel("Invoice next number", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Save invoice numbers" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Invoice prefix", { exact: true })).toHaveValue("FAC/");
  await expect(page.getByLabel("Invoice next number", { exact: true })).toHaveValue("7");
  // The quote numbers are a separate run.
  await expect(page.getByLabel("Prefix", { exact: true })).toHaveValue("QT-");
});
