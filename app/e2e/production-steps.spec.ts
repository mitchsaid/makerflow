import { expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, openProductTab, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, nav, openQuotes, sheet, startSend } from "./quote-helpers";

async function addProductWithSteps(page: Page, name: string, price: string, steps: string[]) {
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Price", { exact: true }).fill(price);
  await openProductTab(page, "Production");
  await page.getByRole("radio", { name: /^As steps/ }).click();
  for (const [i, step] of steps.entries()) {
    if (i > 0) await page.getByRole("button", { name: "Add another step" }).click();
    await page.getByLabel(`Step ${i + 1}`, { exact: true }).fill(step);
  }
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();
}

/** Types how many have been through a step (the box under the step's name) and leaves it. */

test("a product's steps are kept in the order they are moved to, and a blank step says how to fix it", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "ps-form", "Steps Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cupcakes");
  await page.getByLabel("Price", { exact: true }).fill("15");

  // Tracked as a whole is the default: no steps are asked for until "As steps" is chosen.
  await expect(page.getByRole("tab", { name: /^Production/ })).toHaveAttribute("aria-selected", "false");
  await openProductTab(page, "Production");
  await expect(page.getByRole("radio", { name: /^As a whole/ })).toBeChecked();
  await expect(page.getByLabel(/^Step \d$/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Add (a|another) step$/ })).toHaveCount(0);
  await page.getByRole("radio", { name: /^As steps/ }).click();
  await expect(page.getByLabel("Step 1", { exact: true })).toBeVisible();
  await page.getByLabel("Step 1", { exact: true }).fill("Ice");
  await page.getByRole("button", { name: "Add another step" }).click();
  await page.getByLabel("Step 2", { exact: true }).fill("Bake");
  await page.getByRole("button", { name: "Add another step" }).click();
  // The first cannot go up, the last cannot go down.
  await expect(page.getByRole("button", { name: "Move Ice up" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Move step 3 down" })).toBeDisabled();
  await page.getByRole("button", { name: "Move Bake up" }).click();
  await expect(page.getByLabel("Step 1", { exact: true })).toHaveValue("Bake");
  await expect(page.getByLabel("Step 2", { exact: true })).toHaveValue("Ice");
  // Focus stays with the step that moved.
  await expect(page.getByLabel("Step 1", { exact: true })).toBeFocused();

  // The third step has no name yet.
  await page.getByRole("button", { name: "Add product" }).click();
  const summary = page.getByTestId("form-summary");
  await expect(summary).toContainText("1 thing needs fixing");
  await expect(page.locator("[data-slot=field-error]", { hasText: "Give the step a name" })).toBeVisible();
  await summary.getByRole("link", { name: "Step 3" }).click();
  await expect(page.getByLabel("Step 3", { exact: true })).toBeFocused();
  await page.getByLabel("Step 3", { exact: true }).fill("Box");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();

  // Opened again, in the same order; one is removed.
  await page.getByRole("link", { name: /Cupcakes/ }).click();
  // The count on the tab says how many steps there are, before it is opened.
  await expect(page.getByRole("tab", { name: /^Production/ })).toContainText("3");
  await openProductTab(page, "Production");
  await expect(page.getByLabel(/^Step \d$/)).toHaveCount(3);
  await expect(page.getByLabel("Step 1", { exact: true })).toHaveValue("Bake");
  await expect(page.getByLabel("Step 2", { exact: true })).toHaveValue("Ice");
  await expect(page.getByLabel("Step 3", { exact: true })).toHaveValue("Box");
  await page.getByRole("button", { name: "Remove Ice" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await openProductTab(page, "Production");
  await expect(page.getByLabel(/^Step \d$/)).toHaveCount(2);
  await expect(page.getByLabel("Step 2", { exact: true })).toHaveValue("Box");

  // Switched back to tracking as a whole, the steps are hidden, kept if it is switched again before saving, and
  // gone once saved.
  await page.getByRole("radio", { name: /^As a whole/ }).click();
  await expect(page.getByLabel(/^Step \d$/)).toHaveCount(0);
  await page.getByRole("radio", { name: /^As steps/ }).click();
  await expect(page.getByLabel(/^Step \d$/)).toHaveCount(2);
  await page.getByRole("radio", { name: /^As a whole/ }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await openProductTab(page, "Production");
  await expect(page.getByRole("radio", { name: /^As a whole/ })).toBeChecked();
  await expect(page.getByLabel(/^Step \d$/)).toHaveCount(0);
});

test("steps come from the product into the job, each counted on its own, and the job starts on the first one", async ({ page }) => {
  test.setTimeout(240_000);
  await signUpAndOnboard(page, "ps-job", "Steps Job Co");
  await addProductWithSteps(page, "Cupcakes", "15", ["Bake", "Ice", "Box"]);

  // A quote for 12, sent and accepted, then made into a job.
  await openBusinessProfile(page);
  await page.getByLabel("Phone", { exact: true }).fill("011 555 0101");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await openQuotes(page);
  await page.getByRole("link", { name: /Start your first quote|New quote/ }).first().click();
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Cupcakes/ }).click();
  await sheet(page).getByLabel("Quantity").fill("12");
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

  // The product's steps change after the quote went out; the job takes the steps as they are when it is made.
  await page.goto("/app/products");
  await page.getByRole("link", { name: /Cupcakes/ }).click();
  await openProductTab(page, "Production");
  await page.getByRole("button", { name: "Add another step" }).click();
  await page.getByLabel("Step 4", { exact: true }).fill("Deliver");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await nav(page).getByRole("link", { name: "Quotes" }).click();
  await page.getByRole("link", { name: /QT-0001/ }).click();
  await page.getByRole("button", { name: "Create a job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /^Job J-0001 Not started$/, level: 1 })).toBeVisible();

  const steps = page.getByTestId("item-steps");
  await expect(steps.getByTestId("item-made")).toHaveText("Made 0 of 12");
  const rows = steps.getByTestId("step-progress");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("Bake: 0 of 12");
  await expect(rows.nth(1)).toContainText("Ice: 0 of 12");
  await expect(rows.nth(2)).toContainText("Box: 0 of 12");
  await expect(rows.nth(3)).toContainText("Deliver: 0 of 12");

  // The first unit through any step starts the job.
  await page.getByRole("button", { name: "One more Bake for Cupcakes" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Making$/, level: 1 })).toBeVisible();
  await expect(rows.nth(0)).toContainText("Bake: 1 of 12");

  // The item is made up to the fewest any step has reached.
  await page.getByLabel("How many of Cupcakes have been through Bake").fill("12");
  await page.getByLabel("How many of Cupcakes have been through Bake").press("Enter");
  await expect(rows.nth(0)).toContainText("Bake: all done");
  await page.getByLabel("How many of Cupcakes have been through Ice").fill("5");
  await page.getByLabel("How many of Cupcakes have been through Ice").press("Enter");
  await expect(rows.nth(1)).toContainText("Ice: 5 of 12");
  await expect(steps.getByTestId("item-made")).toHaveText("Made 0 of 12");
  await expect(page.getByTestId("job-progress")).toContainText("0 of 1 item made");

  // More than were ordered is refused with a way to fix it.
  await page.getByLabel("How many of Cupcakes have been through Box").fill("13");
  await page.getByLabel("How many of Cupcakes have been through Box").press("Enter");
  await expect(rows.nth(2)).toContainText("more than the 12 ordered");

  // Every step done: the item is made, and the job offers Ready.
  for (const step of ["Ice", "Box", "Deliver"]) {
    await page.getByRole("checkbox", { name: new RegExp(`^All done.*${step}`) }).check();
  }
  await expect(steps.getByTestId("item-made")).toHaveText("All made");
  await expect(page.getByTestId("job-progress")).toContainText("All 1 item made".replace("All 1 item made", "1 of 1 item made"));
  await page.reload();
  await expect(steps.getByTestId("item-made")).toHaveText("All made");
  // Taking a step back lowers the item's count again.
  // (By keyboard: in the phone emulation of the headless browser the page is drawn a few pixels off from where it
  // hit-tests after scrolling, so a 44 px button below the fold can be reported as covered by what is next to it.)
  const lessDeliver = page.getByRole("button", { name: "One less Deliver for Cupcakes" });
  await lessDeliver.focus();
  await page.keyboard.press("Enter");
  await expect(steps.getByTestId("item-made")).toHaveText("Made 11 of 12");
  await page.getByRole("checkbox", { name: /^All done.*Deliver/ }).check();
  await page.getByRole("button", { name: "Mark ready", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Ready$/, level: 1 })).toBeVisible();
});

test("a job made by hand, and an item added later, take the product's steps too; a one-off item has none", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "ps-manual", "Steps Manual Co");
  await addProductWithSteps(page, "Candles", "50", ["Pour", "Cure"]);

  await nav(page).getByRole("link", { name: "Jobs" }).click();
  await page.getByRole("link", { name: "New job" }).click();
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Candles/ }).click();
  await sheet(page).getByLabel("Quantity").fill("6");
  await sheet(page).getByRole("button", { name: "Add to job" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: "One-off item (just for this job)" }).click();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Gift tags");
  await sheet(page).getByLabel("Quantity").fill("20");
  await sheet(page).getByRole("button", { name: "Add to job" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await addCustomerInSheet(page, "Sam Jacobs");
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);

  // The candles have steps; the one-off item is counted as a whole.
  await expect(page.getByTestId("item-steps")).toHaveCount(1);
  await expect(page.getByTestId("step-progress")).toHaveCount(2);
  await expect(page.getByTestId("item-progress")).toHaveCount(1);
  await expect(page.getByTestId("item-progress")).toContainText("Made 0 of 20");

  // An item added to the job later takes the steps too.
  await page.getByRole("link", { name: "Add an item" }).click();
  await sheet(page).getByRole("button", { name: /Candles/ }).click();
  await sheet(page).getByLabel("Quantity").fill("3");
  await sheet(page).getByRole("button", { name: "Add to job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("item-steps")).toHaveCount(2);
  await expect(page.getByTestId("step-progress")).toHaveCount(4);
});
