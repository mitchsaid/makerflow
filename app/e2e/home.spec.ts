import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";
import { issuedInvoice } from "./invoice-helpers";
import { nav, sentQuote } from "./quote-helpers";

/** Home says what to do first, then where the quotes stand (docs/ux-review-2026-10-24.md, T6.1). */

test("a new business is told to make its first quote; after one, Home counts the quotes and opens the list at them", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "home-quotes", "Home Quotes Co");

  // Nothing yet: the first thing to do is a quote.
  const first = page.getByTestId("home-first-quote");
  await expect(first).toContainText("Make your first quote");
  await first.getByRole("link", { name: "New quote" }).click();
  await expect(page.getByRole("heading", { name: "New quote", level: 1 })).toBeVisible();

  // A sent quote is waiting for an answer.
  await nav(page).getByRole("link", { name: "Home" }).click();
  await sentQuote(page);
  await nav(page).getByRole("link", { name: "Home" }).click();
  await expect(page.getByTestId("home-first-quote")).toHaveCount(0);
  await expect(page.getByTestId("home-quotes-waiting")).toHaveText("1");
  await expect(page.getByTestId("home-quotes-drafts")).toHaveCount(0);
  await page.getByRole("link", { name: /Waiting for an answer/ }).click();
  await expect(page).toHaveURL(/\/app\/quotes\?status=sent$/);
  await expect(page.getByRole("link", { name: /QT-0001/ })).toBeVisible();
});

test("with nothing owed, waiting or due, Home says so; money owed comes first, overdue before owing", async ({ page }) => {
  test.setTimeout(240_000);
  await issuedInvoice(page, "home-caught", { name: "Shelf", quantity: "1", price: "100" });
  await nav(page).getByRole("link", { name: "Home" }).click();
  // The invoice is owed: money is the first card. The accepted quote is not waiting for an answer.
  const cards = page.locator("main [data-testid^=home-]");
  await expect(cards.first()).toHaveAttribute("data-testid", "home-money");
  await expect(page.getByTestId("home-quotes")).toHaveCount(0);
  // Paid: nothing needs the maker.
  await page.getByRole("link", { name: "See the invoice" }).click();
  await page.getByRole("link", { name: /INV-0001/ }).click();
  await page.getByRole("button", { name: "Record a payment" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByTestId("paid-in-full")).toBeVisible();
  await nav(page).getByRole("link", { name: "Home" }).click();
  await expect(page.getByTestId("home-caught-up")).toContainText("You're all caught up");
  // Nothing is owing, but what came in this month is shown.
  await expect(page.getByTestId("home-owing")).toHaveCount(0);
  await expect(page.getByTestId("home-overdue")).toHaveCount(0);
  await expect(page.getByTestId("home-paid")).toBeVisible();
  await expect(page.getByTestId("home-money")).toContainText("Paid this month");
});

test("Create new on Home asks what to make: a quote, an invoice or a job, each straight to its form", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "home-create", "Create Co");
  const create = page.getByRole("button", { name: "Create new" });
  for (const [name, path, heading] of [
    ["Quote", /\/app\/quotes\/new$/, "New quote"],
    ["Invoice", /\/app\/invoices\/new$/, "New invoice"],
    ["Job", /\/app\/jobs\/new$/, "New job"],
  ] as const) {
    await nav(page).getByRole("link", { name: "Home" }).click();
    await expect(create).toBeVisible();
    // (A tap before the page wakes up does nothing: tap until the sheet is open.)
    await expect(async () => {
      await create.click();
      await expect(page.getByRole("dialog", { name: "Create new" })).toBeVisible({ timeout: 1_000 });
    }).toPass();
    const sheet = page.getByRole("dialog", { name: "Create new" });
    await expect(sheet.getByRole("link")).toHaveText([/Quote/, /Invoice/, /Job/]);
    await sheet.getByRole("link", { name }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  }
});
