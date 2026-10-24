import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, openQuotes } from "./quote-helpers";

/** Optional sections (discount, deposit) are added with a button, taken away with Remove, and dropped if left empty (docs/ux-review-2026-10-24.md, T1). */

test("a discount and a deposit are added with a button, removed with Remove, and left empty they are dropped on save", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "optional-sections", "Optional Co");
  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();
  await fillItem(page, 1, "Wedding cake", "1", "1000");
  await addCustomerInSheet(page, "Thandi Nkosi");

  // Both start as buttons, the same way: no tick for one and a button for the other.
  const addDiscount = page.getByRole("button", { name: "Add a discount" });
  const addDeposit = page.getByRole("button", { name: "Add a deposit" });
  await expect(addDiscount).toBeVisible();
  await expect(addDeposit).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /deposit/i })).toHaveCount(0);

  // Opened: the section shows, takes focus, and offers Remove. Remove puts the button back.
  await addDeposit.click();
  const deposit = page.getByRole("group", { name: "Deposit" });
  await expect(deposit.getByLabel("Percentage (%)")).toBeFocused();
  await deposit.getByRole("button", { name: "Remove deposit" }).click();
  await expect(addDeposit).toBeVisible();
  await expect(page.getByRole("group", { name: "Deposit" })).toHaveCount(0);

  await addDiscount.click();
  await expect(page.getByLabel("Discount (%)")).toBeFocused();
  await page.getByRole("group", { name: "Discount" }).getByRole("button", { name: "Remove discount" }).click();
  await expect(addDiscount).toBeVisible();

  // Opened and left empty: Save is not refused; the empty sections are dropped.
  await addDiscount.click();
  await addDeposit.click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  await expect(page.getByTestId("form-summary")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add a discount" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a deposit" })).toBeVisible();

  // One that was filled in is kept.
  await page.getByRole("button", { name: "Add a deposit" }).click();
  await page.getByRole("group", { name: "Deposit" }).getByLabel("Percentage (%)").fill("30");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("group", { name: "Deposit" }).getByLabel("Percentage (%)")).toHaveValue("30");
});
