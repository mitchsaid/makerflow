import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, nav, openQuotes, sentQuote, sheet } from "./quote-helpers";

/** The ⋯ on a card: what can be done without opening it (docs/plans/ux-pass-3.md, slice 4). */

/** Opens a card's menu. (A tap before the list wakes up does nothing: tap until the sheet is open.) */
async function openMenu(page: Page, name: string | RegExp, title: string | RegExp) {
  const button = page.getByRole("button", { name });
  await expect(button).toBeVisible();
  await expect(async () => {
    await button.click();
    await expect(page.getByRole("dialog", { name: title })).toBeVisible({ timeout: 1_000 });
  }).toPass();
}

test("a draft's card can delete it, after a question, and offers no job", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "menu-draft", "Menu Co");
  await openQuotes(page);
  await page.getByRole("link", { name: /Start your first quote|New quote/ }).first().click();
  await fillItem(page, 1, "Cake", "1", "500");
  await addCustomerInSheet(page, "Sarah");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);

  await openQuotes(page);
  await openMenu(page, "More for Sarah, quote QT-0001", /Sarah · QT-0001/);
  const menu = page.getByRole("dialog", { name: /Sarah · QT-0001/ });
  await expect(menu.getByRole("list").getByRole("button")).toHaveText([/Duplicate/, /Delete draft/]);
  await menu.getByRole("button", { name: /Delete draft/ }).click();
  await expect(sheet(page)).toHaveAccessibleName("Delete this draft?");
  // Keeping it changes nothing.
  await sheet(page).getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByRole("link", { name: /Sarah/ })).toBeVisible();
  await openMenu(page, "More for Sarah, quote QT-0001", /Sarah · QT-0001/);
  await page.getByRole("dialog").getByRole("button", { name: /Delete draft/ }).click();
  await sheet(page).getByRole("button", { name: "Yes, delete the draft" }).click();
  await expect(page.getByText("No quotes yet")).toBeVisible();
});

test("a sent quote becomes a job from its card, recording the yes; then the card opens the job", async ({ page }) => {
  test.setTimeout(240_000);
  await signUpAndOnboard(page, "menu-sent", "Menu Sent Co");
  await sentQuote(page);
  await openQuotes(page);
  await openMenu(page, /^More for Thandi Nkosi, quote QT-0001/, /Thandi Nkosi · QT-0001/);
  await page.getByRole("dialog", { name: /Thandi Nkosi · QT-0001/ }).getByRole("button", { name: /Turn into a job/ }).click();

  // The yes is recorded the usual way, then the job is made and opened.
  await sheet(page).getByRole("button", { name: "Save answer and create job" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toBeVisible();
  await sheet(page).getByLabel("How they told you").selectOption("whatsapp");
  await sheet(page).getByRole("button", { name: "Save answer and create job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /^Job J-0001 Not started$/, level: 1 })).toBeVisible();

  // The quote's card now opens the job.
  await openQuotes(page);
  await openMenu(page, /^More for Thandi Nkosi, quote QT-0001/, /Thandi Nkosi · QT-0001/);
  await page.getByRole("dialog", { name: /Thandi Nkosi · QT-0001/ }).getByRole("link", { name: /Open job J-0001/ }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Not started$/, level: 1 })).toBeVisible();
});

test("an accepted quote makes a job from its card, and a job's card can delete it", async ({ page }) => {
  test.setTimeout(240_000);
  await signUpAndOnboard(page, "menu-accepted", "Menu Accepted Co");
  await sentQuote(page);
  await page.getByRole("button", { name: "They accepted" }).click();
  await sheet(page).getByLabel("How they told you").selectOption("whatsapp");
  await sheet(page).getByRole("button", { name: "Save answer" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Accepted$/, level: 1 })).toBeVisible();

  await openQuotes(page);
  await openMenu(page, /^More for Thandi Nkosi, quote QT-0001/, /Thandi Nkosi · QT-0001/);
  await page.getByRole("dialog", { name: /Thandi Nkosi · QT-0001/ }).getByRole("button", { name: /Create a job/ }).click();
  await expect(sheet(page)).toHaveAccessibleName("Create a job?");
  await sheet(page).getByRole("button", { name: "Create the job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /^Job J-0001 Not started$/, level: 1 })).toBeVisible();

  // The job's card: delete it, after a question.
  await nav(page).getByRole("link", { name: "Jobs" }).click();
  await openMenu(page, /^More for Thandi Nkosi, job J-0001/, /Job J-0001 · Thandi Nkosi/);
  await page.getByRole("dialog", { name: /Job J-0001/ }).getByRole("button", { name: /Delete this job/ }).click();
  await expect(sheet(page)).toHaveAccessibleName("Delete this job?");
  await sheet(page).getByRole("button", { name: "Delete the job" }).click();
  await expect(page.getByTestId("job-deleted-notice")).toContainText("Job J-0001 deleted.");
  await expect(page.getByRole("link", { name: /J-0001/ })).toHaveCount(0);
});

test("any quote can be duplicated from its card into a new draft, leaving the original as it is", async ({ page }) => {
  test.setTimeout(240_000);
  await signUpAndOnboard(page, "menu-duplicate", "Menu Duplicate Co");
  await sentQuote(page);
  await openQuotes(page);

  // A sent quote: ask first, and a new draft opens with the same customer and items and the next number.
  await openMenu(page, /^More for Thandi Nkosi, quote QT-0001/, /Thandi Nkosi · QT-0001/);
  await page.getByRole("dialog", { name: /Thandi Nkosi · QT-0001/ }).getByRole("button", { name: /Duplicate/ }).click();
  await expect(sheet(page)).toHaveAccessibleName("Duplicate this quote?");
  // Not now changes nothing.
  await sheet(page).getByRole("button", { name: "Not now" }).click();
  await expect(page.getByRole("link", { name: /QT-0002/ })).toHaveCount(0);
  await openMenu(page, /^More for Thandi Nkosi, quote QT-0001/, /Thandi Nkosi · QT-0001/);
  await page.getByRole("dialog", { name: /Thandi Nkosi · QT-0001/ }).getByRole("button", { name: /Duplicate/ }).click();
  await sheet(page).getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  await expect(page.getByText("QT-0002", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("selected-customer")).toHaveText("Thandi Nkosi");

  // Both are in the list: the new one a draft, the original still sent.
  await openQuotes(page);
  await expect(page.getByRole("link", { name: /QT-0002/ })).toContainText("Draft");
  await expect(page.getByRole("link", { name: /QT-0001/ })).toContainText("Sent");

  // A draft can be duplicated too.
  await openMenu(page, /^More for Thandi Nkosi, quote QT-0002/, /Thandi Nkosi · QT-0002/);
  await page.getByRole("dialog", { name: /Thandi Nkosi · QT-0002/ }).getByRole("button", { name: /Duplicate/ }).click();
  await sheet(page).getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  await expect(page.getByText("QT-0003", { exact: true }).first()).toBeVisible();
});
