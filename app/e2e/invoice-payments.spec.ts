import { expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, nav, openQuotes, sheet, startSend } from "./quote-helpers";

/** Invoice payments, slice I2 (docs/plans/invoices-and-payments.md). */

const rand = (whole: string, cents = "00") => new RegExp(`R\\s?${whole.replace(/ /g, "\\s?")},${cents}`);

async function invoiceWithDeposit(page: Page) {
  await signUpAndOnboard(page, "invoice-pay", "Payments Co");
  await openBusinessProfile(page);
  await page.getByLabel("Street address").fill("12 Long Street");
  await page.getByLabel("City or town").fill("Cape Town");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await openQuotes(page);
  await page.getByRole("link", { name: /Start your first quote|New quote/ }).first().click();
  await fillItem(page, 1, "Wedding cake", "1", "2500");
  await addCustomerInSheet(page, "Thandi Nkosi");
  const deposit = page.getByRole("group", { name: "Deposit" });
  await page.getByRole("button", { name: "Add a deposit" }).click();
  await deposit.getByLabel("Percentage (%)").fill("40");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  await startSend(page);
  await sheet(page).getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "They accepted" }).click();
  await sheet(page).getByLabel("How they told you").selectOption("whatsapp");
  await sheet(page).getByRole("button", { name: "Save answer" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Accepted$/, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Create invoice" }).click();
  await sheet(page).getByRole("button", { name: "Issue invoice" }).click();
  await expect(page.getByRole("heading", { name: /^Invoice INV-0001/, level: 1 })).toBeVisible();
}

test("the deposit is the first payment, the rest follows, and a mistake is reversed", async ({ page }) => {
  test.setTimeout(240_000);
  await invoiceWithDeposit(page);
  await expect(page.getByTestId("invoice-status-chip")).toHaveText("Unpaid");
  await expect(page.getByTestId("invoice-owing")).toHaveText(rand("2 500"));
  await expect(page.getByText("Nothing paid yet.")).toBeVisible();

  // The deposit the quote asked for is offered, ready filled in.
  await expect(page.getByTestId("deposit-offer")).toContainText(rand("1 000"));
  await page.getByRole("button", { name: "Record the deposit" }).click();
  await expect(sheet(page).getByLabel("Amount received")).toHaveValue("1000");
  await expect(sheet(page).getByLabel("Note (optional)")).toHaveValue("Deposit");
  await sheet(page).getByLabel("How it was paid (optional)").selectOption("eft");
  await sheet(page).getByRole("button", { name: "Record payment" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId("invoice-paid")).toHaveText(rand("1 000"));
  await expect(page.getByTestId("invoice-owing")).toHaveText(rand("1 500"));
  await expect(page.getByTestId("invoice-status-chip")).toHaveText("Part paid");
  await expect(page.getByTestId("payment")).toHaveCount(1);
  await expect(page.getByTestId("payment").first()).toContainText("EFT");
  await expect(page.getByTestId("payment").first()).toContainText("Deposit");
  // The deposit is no longer offered.
  await expect(page.getByTestId("deposit-offer")).toHaveCount(0);

  // More than is owing is explained at the field, and what was typed stays.
  await page.getByRole("button", { name: "Record a payment" }).click();
  await sheet(page).getByLabel("Amount received").fill("2000");
  await sheet(page).getByLabel("Note (optional)").fill("Final payment");
  await sheet(page).getByRole("button", { name: "Record payment" }).click();
  await expect(sheet(page).getByText(/more than what is owing/).first()).toBeVisible();
  await expect(sheet(page).getByLabel("Note (optional)")).toHaveValue("Final payment");
  await sheet(page).getByLabel("Amount received").fill("1500");
  await sheet(page).getByRole("button", { name: "Record payment" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId("invoice-status-chip")).toHaveText("Paid");
  await expect(page.getByTestId("paid-in-full")).toBeVisible();
  await expect(page.getByRole("button", { name: "Record a payment" })).toHaveCount(0);

  // The PDF shows what was paid, and is still a real PDF.
  const pdf = await page.request.get(`${page.url()}/pdf`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");

  // A wrong payment is reversed, not edited: it stays in the list, marked, and the amount is owing again.
  await expect(page.getByRole("button", { name: /^Edit|^Delete/ })).toHaveCount(0);
  await page.getByTestId("payment").nth(1).getByRole("button", { name: /^Reverse the .* payment of / }).click();
  await sheet(page).getByRole("button", { name: "Reverse payment" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId("payment-reversed")).toHaveCount(1);
  await expect(page.getByTestId("payment")).toHaveCount(2);
  await expect(page.getByTestId("invoice-owing")).toHaveText(rand("1 500"));
  await expect(page.getByTestId("invoice-status-chip")).toHaveText("Part paid");
  await expect(page.getByRole("button", { name: "Record a payment" })).toBeVisible();

  // Home shows what is owing; the list follows, and the Owing link narrows it.
  await nav(page).getByRole("link", { name: "Home" }).click();
  await expect(page.getByTestId("home-owing")).toHaveText(rand("1 500"));
  // Nothing overdue: the tile is left out.
  await expect(page.getByTestId("home-overdue")).toHaveCount(0);
  // What was paid so far this month is beside it.
  await expect(page.getByTestId("home-paid")).toBeVisible();
  await page.getByTestId("home-owing").click();
  await expect(page.getByRole("heading", { name: "Invoices", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Unpaid/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: /Thandi Nkosi/ })).toContainText("owing");
});

test("a payment can't be dated ahead", async ({ page }) => {
  test.setTimeout(240_000);
  await invoiceWithDeposit(page);
  await page.getByRole("button", { name: "Record a payment" }).click();
  await sheet(page).getByLabel("Amount received").fill("100");
  await sheet(page).getByLabel("Date paid").fill("2099-01-01");
  await sheet(page).getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByTestId("form-summary")).toBeVisible();
  await expect(sheet(page).getByText(/hasn't come yet/).first()).toBeVisible();
  await expect(page.getByTestId("payment")).toHaveCount(0);
});
