import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";
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
  await expect(page.getByTestId("home-quotes-drafts")).toHaveText("0");
  await page.getByRole("link", { name: /Waiting for an answer/ }).click();
  await expect(page).toHaveURL(/\/app\/quotes\?status=sent$/);
  await expect(page.getByRole("link", { name: /QT-0001/ })).toBeVisible();
});
