import { expect, test, type Page } from "@playwright/test";
import { openDocuments, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, openQuotes, sheet, startSend } from "./quote-helpers";

async function startQuote(page: Page) {
  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();
}

test("a deposit on a quote: worked out live, shown on the document in plain words, balance by date", async ({ page }) => {
  await signUpAndOnboard(page, "dep-quote", "Deposit Co");
  await startQuote(page);
  await fillItem(page, 1, "Wedding cake", "1", "2500");
  await addCustomerInSheet(page, "Sarah");

  // Nothing is asked for until it is ticked.
  const section = page.getByRole("group", { name: "Deposit" });
  await expect(section.getByLabel("Worked out as")).toHaveCount(0);
  await section.getByRole("checkbox", { name: "Ask for a deposit to start work" }).check();
  await section.getByLabel("Percentage (%)").fill("50");
  await expect(page.getByTestId("deposit-summary")).toContainText(/Deposit\s+R\s?1\s?250,00\s*·\s*Balance\s+R\s?1\s?250,00/);

  // The balance follows the quote's own delivery or collection.
  await expect(section.getByLabel("Balance due")).toContainText("On collection or delivery");
  await page.getByRole("radio", { name: /Collection/ }).check();
  await expect(section.getByLabel("Balance due").locator("option").first()).toHaveText("On collection");

  // A fixed amount; and an amount above the total is explained (it blocks sending, not saving).
  await section.getByLabel("Worked out as").selectOption("fixed");
  await section.getByLabel("Amount").fill("3000");
  await expect(page.getByTestId("deposit-summary")).toContainText("more than the quote total");
  await section.getByLabel("Amount").fill("1000");
  await expect(page.getByTestId("deposit-summary")).not.toContainText("more than the quote total");

  // Errors at the field and in the summary; typed data is kept.
  await section.getByLabel("Amount").fill("");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("Enter an amount");
  await expect(section.getByLabel("Amount")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Customer name", { exact: true })).toHaveCount(0);

  // A balance by a date.
  await section.getByLabel("Amount").fill("1000");
  await section.getByLabel("Balance due").selectOption("date");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("Choose the date the balance is due");
  await section.getByLabel("Balance due by").fill("2026-12-24");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  const text = page.getByRole("region", { name: "The quote as text" });
  await expect(text.getByTestId("deposit-lines")).toContainText("Deposit to start work");
  await expect(text.getByTestId("deposit-lines")).toContainText(/R\s?1\s?000,00/);
  await expect(text.getByTestId("deposit-lines")).toContainText(/Balance, due by 24 Dec 2026/);
  await expect(text.getByTestId("deposit-lines")).toContainText(/R\s?1\s?500,00/);
  // Plain words: no jargon about part payments on the quote.
  await expect(text).not.toContainText(/part payment/i);

  // Back on the draft it is all still there; unticking removes it from the document.
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(section.getByLabel("Amount")).toHaveValue("1000");
  await section.getByRole("checkbox", { name: "Ask for a deposit to start work" }).uncheck();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "The quote as text" }).getByTestId("deposit-lines")).toHaveCount(0);
});

test("the business sets a default deposit; new quotes start with it; a too-big deposit stops sending; a sent quote keeps its deposit", async ({ page }) => {
  await signUpAndOnboard(page, "dep-default", "Default Co");
  await openDocuments(page);
  const deposit = page.getByRole("group", { name: "Deposit" });
  // Errors at the field, then saved.
  await deposit.getByRole("checkbox", { name: "Ask for a deposit on new quotes" }).check();
  await page.getByRole("button", { name: "Save deposit" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("Enter a percentage");
  await deposit.getByLabel("Percentage (%)").fill("40");
  await page.getByRole("button", { name: "Save deposit" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  // The business has a phone so quotes can be sent.
  await page.goto("/app/business");
  await page.getByLabel("Phone", { exact: true }).fill("011 555 0101");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." }).first()).toBeVisible();

  // A new quote starts with the default ticked, and can change it.
  await page.goto("/app/quotes/new");
  const section = page.getByRole("group", { name: "Deposit" });
  await expect(section.getByRole("checkbox", { name: "Ask for a deposit to start work" })).toBeChecked();
  await expect(section.getByLabel("Percentage (%)")).toHaveValue("40");
  await fillItem(page, 1, "Cake", "1", "500");
  await addCustomerInSheet(page, "Thandi");
  await expect(page.getByTestId("deposit-summary")).toContainText(/Deposit\s+R\s?200,00\s*·\s*Balance\s+R\s?300,00/);

  // A fixed deposit above the total saves, but sending says what to fix.
  await section.getByLabel("Worked out as").selectOption("fixed");
  await section.getByLabel("Amount").fill("900");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(sheet(page)).toHaveAccessibleName("Before you can send this quote");
  await expect(sheet(page).getByRole("list", { name: "What is missing" })).toContainText("The deposit is more than the quote total");
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);

  // Fix it, send, and change the default afterwards: the sent quote keeps what it said.
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await section.getByLabel("Amount").fill("100");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await startSend(page);
  await sheet(page).getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByTestId("sent-banner")).toBeVisible();
  const quoteUrl = page.url().split("?")[0];
  await openDocuments(page);
  await deposit.getByLabel("Percentage (%)").fill("10");
  await page.getByRole("button", { name: "Save deposit" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await page.goto(quoteUrl);
  await expect(page.getByTestId("quote-document").getByTestId("deposit-lines")).toContainText(/R\s?100,00/);
  await expect(page.getByTestId("quote-document").getByTestId("deposit-lines")).toContainText(/R\s?400,00/);
});
