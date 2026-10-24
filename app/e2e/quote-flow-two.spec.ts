import { expect, test } from "@playwright/test";
import { openBusinessProfile, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, openQuotes, sentQuote, sheet } from "./quote-helpers";

/** The quote flow, round two, slice 1 (docs/plans/quote-form-feedback-2.md). */

test("Mark as sent opens one short confirmation from the bottom, which Cancel closes", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "qf2-mark", "Confirm Co");
  await openBusinessProfile(page);
  await page.getByLabel("Phone", { exact: true }).fill("011 555 0101");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await openQuotes(page);
  await page.getByRole("link", { name: /Start your first quote|New quote/ }).first().click();
  await fillItem(page, 1, "Wedding cake", "1", "800");
  await addCustomerInSheet(page, "Thandi Nkosi");
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();

  await page.getByRole("button", { name: "Mark as sent", exact: true }).click();
  const confirm = sheet(page);
  await expect(confirm).toHaveAccessibleName("Mark this quote as sent");
  await expect(confirm).toContainText("That locks this version");
  // A short sheet at the bottom of the screen, not a whole screen.
  await expect(confirm.getByRole("button", { name: "Mark as sent", exact: true })).toBeVisible();
  const [box, viewport] = [await confirm.boundingBox(), page.viewportSize()!];
  expect(box!.y).toBeGreaterThan(viewport.height * 0.25);
  expect(box!.y + box!.height).toBeGreaterThanOrEqual(viewport.height - 1);

  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark as sent", exact: true })).toBeFocused();
});

test("on a sent quote, what to do next comes before the PDF, and the coming-soon cards come after it", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "qf2-next", "Next Co");
  await sentQuote(page);

  const next = page.getByRole("heading", { name: "What you can do next" });
  await expect(next).toBeVisible();
  await expect(page.getByTestId("pdf-pages")).toBeVisible();
  const y = async (locator: ReturnType<typeof page.locator>) => (await locator.boundingBox())!.y;
  const nextY = await y(next);
  const pdfY = await y(page.getByTestId("pdf-pages"));
  const soonY = await y(page.getByTestId("coming-soon").first());
  expect(nextY).toBeLessThan(pdfY);
  expect(soonY).toBeGreaterThan(pdfY);
  // The way to a job is said where the answer is asked for.
  await expect(page.getByText(/An accepted quote can become a job/)).toBeVisible();
});

test("a new quote shows the number it will get, and the numbering can be changed from the quote", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "qf2-number", "Number Co");
  await page.goto("/app/quotes/new");

  // The number it is about to get, and that it is given on the first save.
  await expect(page.getByTestId("quote-number")).toHaveText("QT-0001");
  await expect(page.getByText("Given when you first save it.")).toBeVisible();

  // Change numbering opens the same prefix and next-number form as Quotes and invoices, in a sheet.
  await page.getByRole("button", { name: /Change how quotes are numbered/ }).click();
  const numbering = sheet(page);
  await expect(numbering).toHaveAccessibleName("Quote numbers");
  await numbering.getByLabel("Prefix").fill("CAKE-");
  await numbering.getByLabel("Next number").fill("42");
  await expect(numbering.getByTestId("number-preview")).toContainText("CAKE-0042");
  // Cancel keeps what was there.
  await numbering.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("quote-number")).toHaveText("QT-0001");

  // Saving closes the sheet and the number on the quote follows. What was typed on the quote is kept.
  await page.getByLabel("Intro (optional)").fill("For Sarah's birthday");
  await page.getByRole("button", { name: /Change how quotes are numbered/ }).click();
  await sheet(page).getByLabel("Prefix").fill("CAKE-");
  await sheet(page).getByLabel("Next number").fill("42");
  await sheet(page).getByRole("button", { name: "Save quote numbers" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("quote-number")).toHaveText("CAKE-0042");
  await expect(page.getByLabel("Intro (optional)")).toHaveValue("For Sarah's birthday");
  await expect(page.getByRole("button", { name: /Change how quotes are numbered/ })).toBeFocused();

  // The quote gets that number when it is first saved, and then it is just its number.
  await fillItem(page, 1, "Wedding cake", "1", "800");
  await addCustomerInSheet(page, "Thandi Nkosi");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  await expect(page.getByRole("heading", { name: /Quote CAKE-0042/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("quote-number")).toHaveCount(0);
});

test("the balance can be due 'another time', in the maker's own words, and it prints on the quote", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "qf2-balance", "Balance Co");
  await openQuotes(page);
  await page.getByRole("link", { name: /Start your first quote|New quote/ }).first().click();
  await fillItem(page, 1, "Wedding cake", "1", "800");
  await addCustomerInSheet(page, "Thandi Nkosi");

  const deposit = page.getByRole("group", { name: "Deposit" });
  await deposit.getByRole("checkbox", { name: "Ask for a deposit to start work" }).check();
  await deposit.getByLabel("Percentage (%)").fill("50");
  await deposit.getByLabel("Balance due", { exact: true }).selectOption("other");

  // Empty words say how to fix it, at the field and in the summary.
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  await expect(page.getByTestId("form-summary")).toBeVisible();
  await expect(deposit.getByText(/Say when the balance is due/)).toBeVisible();

  // Typing clears it; the preview and the quote as text say it.
  await deposit.getByLabel("When is the balance due?").fill("within 14 days of delivery");
  await expect(deposit.getByText(/Say when the balance is due/)).toHaveCount(0);
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await expect(page.getByTestId("quote-document")).toContainText("due within 14 days of delivery");

  // Back on the quote it is still there, and it can go back to collection or delivery.
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("group", { name: "Deposit" }).getByLabel("Balance due", { exact: true })).toHaveValue("other");
  await expect(page.getByRole("group", { name: "Deposit" }).getByLabel("When is the balance due?")).toHaveValue("within 14 days of delivery");
  await page.getByRole("group", { name: "Deposit" }).getByLabel("Balance due", { exact: true }).selectOption("handover");
  await expect(page.getByLabel("When is the balance due?")).toHaveCount(0);
});

test("How to pay says what each part is: bank details, then notes about paying", async ({ page }) => {
  await signUpAndOnboard(page, "qf2-pay", "Pay Co");
  await page.goto("/app/quotes/new");
  const pay = page.getByRole("group", { name: "How to pay" });

  // Two parts, named: the bank details (with the way to add them), then free notes.
  await expect(pay.getByRole("heading", { name: "Bank details", level: 3 })).toBeVisible();
  await expect(pay.getByRole("button", { name: "Add bank details" })).toBeVisible();
  const notes = pay.getByLabel("Other ways to pay (optional)");
  await expect(notes).toBeVisible();
  await expect(pay.getByText(/Printed under your bank details\. For example/)).toBeVisible();
  // The old name, which read as a note about the bank details, is gone.
  await expect(page.getByText("Other ways to pay")).toHaveCount(0);
  // The notes come after the bank details.
  const [bankY, notesY] = [await pay.getByRole("heading", { name: "Bank details" }).boundingBox(), await notes.boundingBox()];
  expect(notesY!.y).toBeGreaterThan(bankY!.y);
});

test("the first New quote goes straight to the form: no setup questions", async ({ page }) => {
  await signUpAndOnboard(page, "qf2-first", "First Co");
  await page.goto("/app/quotes/new");
  await expect(page.getByRole("heading", { name: "New quote", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();
  await expect(page.getByRole("form", { name: "Two quick questions" })).toHaveCount(0);
  await expect(page.getByText("Skip for now")).toHaveCount(0);
});

test("the sign-off is a box for several lines, kept as typed, and printed on the quote", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "qf2-signoff", "Signoff Co");
  await openQuotes(page);
  await page.getByRole("link", { name: /Start your first quote|New quote/ }).first().click();
  const signOff = page.getByLabel("Message (optional)");
  // A box for lines, with room to see them: not a one-line field.
  expect(await signOff.evaluate((el) => el.tagName)).toBe("TEXTAREA");
  expect((await signOff.boundingBox())!.height).toBeGreaterThan(60);
  await signOff.fill("Thank you so much for asking.\nKind regards,\nThandi");
  await fillItem(page, 1, "Wedding cake", "1", "800");
  await addCustomerInSheet(page, "Sarah Jacobs");
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  const document = page.getByTestId("quote-document");
  await expect(document).toContainText("Thank you so much for asking.");
  await expect(document).toContainText("Kind regards,");
  // Back on the quote, the lines are still lines.
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Message (optional)")).toHaveValue("Thank you so much for asking.\nKind regards,\nThandi");
  // Too many lines say how to fix it.
  await page.getByLabel("Message (optional)").fill("1\n2\n3\n4\n5\n6");
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  await expect(page.getByTestId("form-summary")).toBeVisible();
  // At the field and in the summary.
  await expect(page.getByText(/up to 5 lines/)).toHaveCount(2);
});

test("helper text sits under the label, above the field; an error sits under the field", async ({ page }) => {
  await signUpAndOnboard(page, "qf2-helper", "Helper Co");
  await page.goto("/app/products/new");
  const y = async (locator: ReturnType<typeof page.locator>) => (await locator.boundingBox())!.y;

  // Label, then its helper text, then the field.
  const label = page.getByText("Intro (optional)", { exact: true });
  const hint = page.getByText("Shown on your quotes under the name.");
  const field = page.getByLabel("Intro (optional)");
  expect(await y(label)).toBeLessThan(await y(hint));
  expect(await y(hint)).toBeLessThan(await y(field));

  // The error comes after the field, as before.
  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await page.getByLabel("Price", { exact: true }).fill("abc");
  await page.getByRole("button", { name: "Add product" }).click();
  const price = page.getByLabel("Price", { exact: true });
  const error = page.locator("#unitPrice-error");
  await expect(error).toBeVisible();
  expect(await y(error)).toBeGreaterThan(await y(price));
});
