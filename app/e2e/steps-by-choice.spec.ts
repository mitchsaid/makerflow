import { expect, test, type Locator, type Page } from "@playwright/test";
import { openBusinessProfile, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, nav, openQuotes, sheet, startSend } from "./quote-helpers";

/**
 * Presses a button from the keyboard (focus, then Enter). Buttons below the fold on the phone emulation of the
 * headless browser can be reported as covered by what is next to them when pressed with a pointer.
 */
async function tap(locator: Locator) {
  await locator.focus();
  await locator.press("Enter");
}

const stepRow = (page: Page, n: number) => page.getByRole("list", { name: "Production steps" }).getByRole("listitem").nth(n - 1);

/** Adds the next step with a name, then its conditions: [choice label, "not"?] or ["Quantity", "12", "not"?]. */
async function addStep(
  page: Page,
  n: number,
  name: string,
  conditions: { choice: string; not?: boolean; quantity?: string }[] = [],
  logic?: "all" | "any",
) {
  if (n === 1) await page.getByRole("radio", { name: /^As steps/ }).click();
  else await tap(page.getByRole("button", { name: "Add another step" }));
  await page.getByLabel(`Step ${n}`, { exact: true }).fill(name);
  const row = stepRow(page, n);
  for (const [i, c] of conditions.entries()) {
    await tap(row.getByRole("button", { name: i === 0 ? /^Only for some items/ : /^Add a condition/ }));
    const group = row.getByRole("group", { name: `${name}: condition ${i + 1}` });
    await group.getByLabel("Depends on").selectOption({ label: c.choice });
    if (c.not) await group.getByLabel(/^(It is|The quantity is)$/).selectOption({ label: c.choice === "Quantity" ? "Less than" : "Not chosen" });
    if (c.quantity) await group.getByLabel("Quantity", { exact: true }).fill(c.quantity);
  }
  if (logic) await row.getByLabel("Make this step when").selectOption(logic);
}

async function makeCake(page: Page) {
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await page.getByRole("radio", { name: /^Yes/ }).click();
  await page.getByLabel("Variation name", { exact: true }).fill("Size");
  for (const [i, [name, price]] of [["Small", "300"], ["Large", "600"]].entries()) {
    const row = page.getByRole("listitem").filter({ has: page.getByRole("textbox", { name: `Size ${i + 1}`, exact: true }) });
    await row.getByLabel(`Size ${i + 1}`, { exact: true }).fill(name);
    await row.getByLabel(`Size ${i + 1} price`, { exact: true }).fill(price);
  }
  await page.getByRole("button", { name: "Add an extra" }).click();
  const fresh = page.getByLabel("Extra name").last();
  await expect(fresh).toBeFocused();
  await fresh.fill("Gift wrap");
  await page.getByRole("listitem").filter({ has: page.getByLabel("Extra name") }).getByLabel(/^Price/).fill("30");
  await page.getByRole("button", { name: "Done Gift wrap" }).click();

  await addStep(page, 1, "Bake");
  await addStep(page, 2, "Add a second tier", [{ choice: "Size: Large" }]);
  await addStep(page, 3, "Wrap", [{ choice: "Extra: Gift wrap" }]);
  await addStep(page, 4, "Hand-finish", [{ choice: "Size: Large" }, { choice: "Extra: Gift wrap" }], "any");
  await addStep(page, 5, "Plain box", [{ choice: "Size: Large", not: true }, { choice: "Extra: Gift wrap", not: true }]);
  await addStep(page, 6, "Big-batch check", [{ choice: "Quantity", quantity: "12" }]);
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Cake.");
}

test("a step can depend on what was chosen: a size, an extra, a quantity, with all or any of several, and 'not'", async ({ page }) => {
  test.setTimeout(240_000);
  await signUpAndOnboard(page, "sbc-job", "Choice Steps Co");
  await makeCake(page);

  // Opened again, every condition is as it was left.
  await page.getByRole("link", { name: /Cake/ }).click();
  await expect(stepRow(page, 1).getByRole("group")).toHaveCount(0);
  await expect(stepRow(page, 2).getByLabel("Depends on")).toHaveValue(/^variation:/);
  await expect(stepRow(page, 2).getByLabel("Depends on").locator("option:checked")).toHaveText("Size: Large");
  await expect(stepRow(page, 3).getByLabel("Depends on").locator("option:checked")).toHaveText("Extra: Gift wrap");
  await expect(stepRow(page, 4).getByLabel("Make this step when")).toHaveValue("any");
  await expect(stepRow(page, 4).getByLabel("Depends on")).toHaveCount(2);
  await expect(stepRow(page, 5).getByLabel("Make this step when")).toHaveValue("all");
  await expect(stepRow(page, 5).getByLabel("It is").first()).toHaveValue("not");
  await expect(stepRow(page, 6).getByLabel("Depends on").locator("option:checked")).toHaveText("Quantity");
  await expect(stepRow(page, 6).getByLabel("Quantity", { exact: true })).toHaveValue("12");

  // A job: a small plain cake, then a large one with gift wrap, 12 of them.
  await page.goto("/app/jobs/new");
  await tap(page.getByRole("button", { name: "Add item" }));
  await sheet(page).getByRole("button", { name: /Cake/ }).click();
  await sheet(page).getByRole("group", { name: "Choose a size" }).getByRole("radio", { name: /Small/ }).check();
  await sheet(page).getByLabel("Quantity").fill("2");
  await sheet(page).getByRole("button", { name: "Add to job" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await tap(page.getByRole("button", { name: "Add item" }));
  await sheet(page).getByRole("button", { name: /Cake/ }).click();
  await sheet(page).getByRole("group", { name: "Choose a size" }).getByRole("radio", { name: /Large/ }).check();
  await sheet(page).getByRole("checkbox", { name: /Gift wrap/ }).check();
  await sheet(page).getByLabel("Quantity").fill("12");
  await sheet(page).getByRole("button", { name: "Add to job" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await addCustomerInSheet(page, "Sam Jacobs", { phone: "021 555 0000" });
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);

  const items = page.getByTestId("item-steps");
  await expect(items).toHaveCount(2);
  const small = items.nth(0).getByTestId("step-progress");
  await expect(small).toHaveCount(2);
  await expect(small.nth(0)).toContainText("Bake: 0 of 2");
  await expect(small.nth(1)).toContainText("Plain box: 0 of 2");
  const large = items.nth(1).getByTestId("step-progress");
  await expect(large).toHaveCount(5);
  await expect(large.nth(0)).toContainText("Bake");
  await expect(large.nth(1)).toContainText("Add a second tier");
  await expect(large.nth(2)).toContainText("Wrap");
  await expect(large.nth(3)).toContainText("Hand-finish");
  await expect(large.nth(4)).toContainText("Big-batch check: 0 of 12");
});

test("a step that depends on a choice that was taken off the product says so, and nothing is lost", async ({ page }) => {
  test.setTimeout(240_000);
  await signUpAndOnboard(page, "sbc-gone", "Gone Choice Co");
  await makeCake(page);
  await page.getByRole("link", { name: /Cake/ }).click();

  // The extra goes; its steps' conditions say they lost it.
  await tap(page.getByRole("button", { name: "Edit Gift wrap" }));
  await tap(page.getByRole("button", { name: /Remove this extra/ }));
  await expect(stepRow(page, 3).getByLabel("Depends on").locator("option:checked")).toHaveText("A choice that was removed");
  await page.getByRole("button", { name: "Save changes" }).click();
  const summary = page.getByTestId("form-summary");
  await expect(summary).toContainText("depends on a choice that was removed");
  await expect(page.locator("[data-slot=field-error]", { hasText: "depends on a choice that was removed" })).toHaveCount(3);
  // The summary jumps to the first one.
  await summary.getByRole("link", { name: "Step 3: condition 1" }).click();
  await expect(stepRow(page, 3).getByLabel("Depends on")).toBeFocused();

  // Pointing it at something else, and taking the other conditions off, saves.
  await stepRow(page, 3).getByLabel("Depends on").selectOption({ label: "Size: Large" });
  await tap(stepRow(page, 4).getByRole("button", { name: /^Remove condition 2/ }));
  await tap(stepRow(page, 5).getByRole("button", { name: /^Remove condition 2/ }));
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(stepRow(page, 3).getByLabel("Depends on").locator("option:checked")).toHaveText("Size: Large");
  await expect(stepRow(page, 4).getByLabel("Depends on")).toHaveCount(1);
});

test("a job made from a quote takes the steps for what the quote chose", async ({ page }) => {
  test.setTimeout(240_000);
  await signUpAndOnboard(page, "sbc-quote", "Quote Choice Co");
  await makeCake(page);

  await openBusinessProfile(page);
  await page.getByLabel("Phone", { exact: true }).fill("011 555 0101");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await openQuotes(page);
  await page.getByRole("link", { name: /Start your first quote|New quote/ }).first().click();
  await tap(page.getByRole("button", { name: "Add item" }));
  await sheet(page).getByRole("button", { name: /Cake/ }).click();
  await sheet(page).getByRole("group", { name: "Choose a size" }).getByRole("radio", { name: /Large/ }).check();
  await sheet(page).getByLabel("Quantity").fill("3");
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await addCustomerInSheet(page, "Thandi Nkosi");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  await startSend(page);
  await sheet(page).getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "They accepted" }).click();
  await sheet(page).getByLabel("How they told you").selectOption("whatsapp");
  await sheet(page).getByRole("button", { name: "Save answer" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Accepted$/, level: 1 })).toBeVisible();

  await nav(page).getByRole("link", { name: "Quotes" }).click();
  await page.getByRole("link", { name: /QT-0001/ }).click();
  await tap(page.getByRole("button", { name: "Create a job" }));
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);

  // Large, no gift wrap, 3: Bake, the second tier and the hand-finish (large, or wrapped); no wrap, no plain box, no batch check.
  const rows = page.getByTestId("item-steps").getByTestId("step-progress");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Bake");
  await expect(rows.nth(1)).toContainText("Add a second tier");
  await expect(rows.nth(2)).toContainText("Hand-finish");
});
