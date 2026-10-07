import { expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, openQuotes, startSend } from "./quote-helpers";

const sheet = (page: Page) => page.getByRole("dialog");

/** A quote for the customer with one item, sent (marked as sent). The business gets a phone first. */
async function sentQuote(page: Page, customer = "Thandi Nkosi") {
  await openBusinessProfile(page);
  await page.getByLabel("Phone", { exact: true }).fill("011 555 0101");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await openQuotes(page);
  await page.getByRole("link", { name: /Start your first quote|New quote/ }).first().click();
  await fillItem(page, 1, "Wedding cake", "1", "800");
  await addCustomerInSheet(page, customer);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  await startSend(page);
  await sheet(page).getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();
}

test("the customer accepts, the maker changes the answer, then they decline", async ({ page }) => {
  await signUpAndOnboard(page, "out-answer", "Answer Co");
  await sentQuote(page);
  const activity = page.getByTestId("activity");

  // Accept: the day is today, how is needed, the note is optional.
  await page.getByRole("button", { name: "They accepted" }).click();
  await expect(sheet(page)).toHaveAccessibleName("They accepted");
  await sheet(page).getByRole("button", { name: "Save answer" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toContainText("Choose how they told you.");
  await expect(sheet(page).getByText("Choose how they told you.")).toHaveCount(2);

  // A day that hasn't happened is refused with a way to fix it, and what was typed stays.
  await sheet(page).getByLabel("How they told you").selectOption("whatsapp");
  await sheet(page).getByLabel("Note (optional)").fill("Wants it for Saturday");
  await sheet(page).getByLabel("Day they told you").fill("2099-01-01");
  await sheet(page).getByRole("button", { name: "Save answer" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toContainText("hasn't happened yet");
  await expect(sheet(page).getByLabel("Note (optional)")).toHaveValue("Wants it for Saturday");

  const today = new Date().toISOString().slice(0, 10);
  await sheet(page).getByLabel("Day they told you").fill(today);
  await sheet(page).getByRole("button", { name: "Save answer" }).click();
  await expect(sheet(page)).toHaveCount(0);

  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Accepted$/, level: 1 })).toBeVisible();
  const banner = page.getByTestId("outcome-banner");
  await expect(banner).toContainText("Accepted on");
  await expect(banner).toContainText("WhatsApp");
  await expect(banner).toContainText("Wants it for Saturday");
  await expect(activity).toContainText("Accepted on");
  // An accepted quote is not answered again or revised until the maker changes the answer.
  await expect(page.getByRole("button", { name: "They accepted" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Revise this quote" })).toHaveCount(0);
  await expect(page.getByTestId("coming-soon").filter({ hasText: "Create a job" })).toBeVisible();

  // It shows in the list under its own filter.
  await openQuotes(page);
  await expect(page.getByRole("link", { name: /Thandi Nkosi/ })).toContainText("Accepted");
  await page.getByRole("link", { name: "Thandi Nkosi" }).click();

  // Changing the answer puts it back to sent, and the earlier answer stays in the activity.
  await page.getByRole("button", { name: "Change the answer" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("outcome-banner")).toHaveCount(0);
  await expect(activity).toContainText("Answer changed, back to sent");
  await expect(activity).toContainText("Accepted on");

  await page.getByRole("button", { name: "They declined" }).click();
  await expect(sheet(page)).toHaveAccessibleName("They declined");
  await sheet(page).getByLabel("How they told you").selectOption("in_person");
  await sheet(page).getByRole("button", { name: "Save answer" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Declined$/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("outcome-banner")).toContainText("In person");
  await expect(activity.getByRole("listitem")).toHaveCount(5);
});

test("withdrawing a quote is final, keeps a note, and a new quote can start from it", async ({ page }) => {
  await signUpAndOnboard(page, "out-withdraw", "Withdraw Co");
  await sentQuote(page);

  await page.getByRole("button", { name: "Withdraw this quote" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Withdraw this quote");
  await sheet(page).getByLabel("Why? (optional)").fill("Flour went up, I need to reprice");
  await sheet(page).getByRole("button", { name: "Withdraw quote" }).click();
  await expect(sheet(page)).toHaveCount(0);

  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Withdrawn$/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("outcome-banner")).toContainText("Flour went up");
  await expect(page.getByTestId("activity")).toContainText("Withdrawn");
  // Final: nothing to answer, change or revise.
  for (const name of ["They accepted", "They declined", "Change the answer", "Revise this quote"]) {
    await expect(page.getByRole("button", { name })).toHaveCount(0);
  }

  // Quote again copies it into a new draft with a new number, and leaves this one alone.
  await page.getByRole("button", { name: "Quote again" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  await expect(page.getByRole("heading", { name: /^Quote QT-0002 Draft$/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("selected-customer")).toHaveText("Thandi Nkosi");
  await expect(page.getByTestId("quote-line")).toContainText("Wedding cake");

  await openQuotes(page);
  await expect(page.getByRole("link", { name: /QT-0001/ })).toContainText("Withdrawn");
  await expect(page.getByRole("link", { name: /QT-0002/ })).toContainText("Draft");
  await page.getByRole("link", { name: "Withdrawn (1)" }).click();
  await expect(page.getByRole("link", { name: /QT-0001/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /QT-0002/ })).toHaveCount(0);
});
