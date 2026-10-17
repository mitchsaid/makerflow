import { expect, test, type Locator, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, nav, sheet } from "./quote-helpers";

/** Presses a button from the keyboard (focus, then Enter): buttons below the fold of the headless phone emulation can be reported as covered. */
async function tap(locator: Locator) {
  await locator.focus();
  await locator.press("Enter");
}

async function addProduct(page: Page, name: string, steps: string[]) {
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Price", { exact: true }).fill("50");
  if (steps.length > 0) {
    await page.getByRole("radio", { name: /^As steps/ }).click();
    for (const [i, step] of steps.entries()) {
      if (i > 0) await page.getByRole("button", { name: "Add another step" }).click();
      await page.getByLabel(`Step ${i + 1}`, { exact: true }).fill(step);
    }
  }
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();
}

test("one item's steps can be added to, taken off and reset, without touching the product", async ({ page }) => {
  test.setTimeout(240_000);
  await signUpAndOnboard(page, "jis-edit", "Item Steps Co");
  await addProduct(page, "Cupcakes", ["Bake", "Ice", "Box"]);
  await addProduct(page, "Tea", []);

  // A job by hand: cupcakes (steps), tea (counted as a whole), and a one-off item.
  await nav(page).getByRole("link", { name: "Jobs" }).click();
  await page.getByRole("link", { name: "New job" }).click();
  for (const [name, quantity] of [["Cupcakes", "12"], ["Tea", "10"]] as const) {
    await page.getByRole("button", { name: "Add item" }).click();
    await sheet(page).getByRole("button", { name: new RegExp(name) }).click();
    await sheet(page).getByLabel("Quantity").fill(quantity);
    await sheet(page).getByRole("button", { name: "Add to job" }).click();
    await expect(sheet(page)).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: "One-off item (just for this job)" }).click();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Gift tags");
  await sheet(page).getByLabel("Quantity").fill("20");
  await sheet(page).getByRole("button", { name: "Add to job" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await addCustomerInSheet(page, "Sam Jacobs");
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);
  const jobUrl = page.url();

  // Cupcakes and tea can be changed; the one-off item cannot.
  await expect(page.getByRole("button", { name: /Change steps/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Add steps/ })).toHaveCount(1);
  const cupcakes = page.getByTestId("item-steps");
  await expect(cupcakes.getByTestId("step-progress")).toHaveCount(3);

  // Nothing to reset until something is changed. Adding a step puts it last, at none.
  await tap(page.getByRole("button", { name: "Change steps for Cupcakes" }));
  const editor = page.getByRole("group", { name: "Change the steps of Cupcakes" });
  await expect(editor).toContainText("The product keeps its steps");
  await expect(editor.getByRole("button", { name: /Reset to the product/ })).toHaveCount(0);
  await tap(editor.getByRole("button", { name: "Add a step to Cupcakes" }));
  await tap(editor.getByRole("button", { name: "Save step" }));
  await expect(editor.getByText("Give the step a name")).toBeVisible();
  await editor.getByLabel("New step").fill("Attach name tags");
  await tap(editor.getByRole("button", { name: "Save step" }));
  await expect(cupcakes.getByTestId("step-progress")).toHaveCount(4);
  await expect(cupcakes.getByTestId("step-progress").nth(3)).toContainText("Attach name tags: 0 of 12");
  await expect(editor.getByRole("button", { name: /Reset to the product/ })).toBeVisible();

  // A step with nothing counted comes off at once; one with a count asks first.
  await tap(editor.getByRole("button", { name: "Remove Box from Cupcakes" }));
  await expect(cupcakes.getByTestId("step-progress")).toHaveCount(3);
  await tap(editor.getByRole("button", { name: "Done changing steps" }));
  await page.getByRole("button", { name: "One more Bake for Cupcakes" }).click();
  await expect(cupcakes.getByTestId("step-progress").first()).toContainText("Bake: 1 of 12");
  // (the count is saved in the background: reload so the page has what the server has)
  await page.reload();
  await expect(cupcakes.getByTestId("step-progress").first()).toContainText("Bake: 1 of 12");
  await tap(page.getByRole("button", { name: "Change steps for Cupcakes" }));
  await tap(editor.getByRole("button", { name: "Remove Bake from Cupcakes" }));
  const ask = editor.getByRole("alertdialog", { name: "Remove Bake?" });
  await expect(ask).toContainText("What has been counted for it goes too");
  await tap(ask.getByRole("button", { name: "Keep it" }));
  await expect(cupcakes.getByTestId("step-progress")).toHaveCount(3);
  await tap(editor.getByRole("button", { name: "Remove Bake from Cupcakes" }));
  await tap(editor.getByRole("alertdialog", { name: "Remove Bake?" }).getByRole("button", { name: "Yes, remove it" }));
  await expect(cupcakes.getByTestId("step-progress")).toHaveCount(2);

  // The product kept its steps.
  await page.goto("/app/products");
  await page.getByRole("link", { name: /Cupcakes/ }).click();
  await expect(page.getByLabel(/^Step \d$/)).toHaveCount(3);

  // Reset puts the item back to the product's steps, each at none, after asking.
  await page.goto(jobUrl);
  await tap(page.getByRole("button", { name: "Change steps for Cupcakes" }));
  await tap(editor.getByRole("button", { name: "Reset to the product's steps for Cupcakes" }));
  const reset = editor.getByRole("alertdialog", { name: "Reset the steps?" });
  await expect(reset).toContainText("goes back to none");
  await tap(reset.getByRole("button", { name: "Keep my changes" }));
  await expect(cupcakes.getByTestId("step-progress")).toHaveCount(2);
  await tap(editor.getByRole("button", { name: "Reset to the product's steps for Cupcakes" }));
  await tap(editor.getByRole("alertdialog", { name: "Reset the steps?" }).getByRole("button", { name: "Yes, reset it" }));
  await expect(cupcakes.getByTestId("step-progress")).toHaveCount(3);
  await expect(cupcakes.getByTestId("step-progress").nth(0)).toContainText("Bake: 0 of 12");
  await expect(editor.getByRole("button", { name: /Reset to the product/ })).toHaveCount(0);
  await tap(editor.getByRole("button", { name: "Done changing steps" }));

  // An item counted as a whole can be given steps; its count is kept by the first one.
  await tap(page.getByRole("button", { name: "Add steps for Tea" }));
  const tea = page.getByRole("group", { name: "Change the steps of Tea" });
  await expect(tea).toContainText("No steps: the item is counted as a whole");
  await tap(tea.getByRole("button", { name: "Add a step to Tea" }));
  await tea.getByLabel("New step").fill("Pack");
  await tap(tea.getByRole("button", { name: "Save step" }));
  await expect(page.getByTestId("item-steps")).toHaveCount(2);
  await expect(page.getByRole("list", { name: "Steps for Tea" }).getByTestId("step-progress")).toContainText("Pack: 0 of 10");
});
