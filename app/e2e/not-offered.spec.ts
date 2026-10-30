import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";
import { sheet } from "./quote-helpers";

test("a choice that is not offered for a size is left out of that size's list on a quote", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "not-offered", "Not Offered Co");

  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await page.getByRole("radio", { name: /^Yes/ }).click();
  await page.getByLabel("Variation name", { exact: true }).fill("Size");
  for (const [i, [name, price]] of ([["Small", "300"], ["Large", "600"]] as const).entries()) {
    await page.getByRole("textbox", { name: `Size ${i + 1}`, exact: true }).fill(name);
    await page.getByLabel(`Size ${i + 1} price`, { exact: true }).fill(price);
  }
  await page.getByLabel("Default size").selectOption({ label: "Small" });
  await page.getByRole("button", { name: /^Add (a|another) variation$/ }).click();
  await page.getByLabel("Name of this variation").last().fill("Flavour");
  await page.getByLabel("Flavour: choice 1", { exact: true }).fill("Vanilla");
  await page.getByLabel("Flavour: choice 2", { exact: true }).fill("Red velvet");
  await page.getByLabel("Default flavour").selectOption({ label: "Vanilla" });

  // Nothing is asked until the list says some choices do not come in every size.
  await expect(page.getByRole("checkbox", { name: /for Red velvet/ })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Not every choice comes in every size" }).check();
  await expect(page.getByRole("checkbox", { name: "Small for Red velvet" })).toBeChecked();
  await page.getByRole("checkbox", { name: "Small for Red velvet" }).uncheck();

  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();

  // It comes back as saved.
  await page.getByRole("link", { name: /Cake/ }).click();
  await page.getByRole("button", { name: "Edit Flavour" }).click();
  await expect(page.getByRole("checkbox", { name: "Not every choice comes in every size" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Small for Red velvet" })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Large for Red velvet" })).toBeChecked();

  // On a quote: Small has only Vanilla, Large has both, and going back to Small swaps Red velvet for Vanilla.
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Cake/ }).click();
  const flavours = sheet(page).getByRole("group", { name: "Flavour" });
  await expect(flavours.getByRole("radio")).toHaveCount(1);
  await expect(flavours.getByRole("radio", { name: /Vanilla/ })).toBeChecked();
  const sizes = sheet(page).getByRole("group", { name: "Choose a size" });
  await sizes.getByRole("radio", { name: /Large/ }).check();
  await expect(flavours.getByRole("radio")).toHaveCount(2);
  await flavours.getByRole("radio", { name: /Red velvet/ }).check();
  await sizes.getByRole("radio", { name: /Small/ }).check();
  await expect(flavours.getByRole("radio")).toHaveCount(1);
  await expect(flavours.getByRole("radio", { name: /Vanilla/ })).toBeChecked();
});

test("every size needs a choice to pick, and a choice needs at least one size", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "not-offered-errors", "Not Offered Errors Co");

  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await page.getByRole("radio", { name: /^Yes/ }).click();
  await page.getByLabel("Variation name", { exact: true }).fill("Size");
  for (const [i, [name, price]] of ([["Small", "300"], ["Large", "600"]] as const).entries()) {
    await page.getByRole("textbox", { name: `Size ${i + 1}`, exact: true }).fill(name);
    await page.getByLabel(`Size ${i + 1} price`, { exact: true }).fill(price);
  }
  await page.getByLabel("Default size").selectOption({ label: "Small" });
  await page.getByRole("button", { name: /^Add (a|another) variation$/ }).click();
  await page.getByLabel("Name of this variation").last().fill("Flavour");
  await page.getByLabel("Flavour: choice 1", { exact: true }).fill("Vanilla");
  await page.getByLabel("Flavour: choice 2", { exact: true }).fill("Red velvet");
  await page.getByLabel("Default flavour").selectOption({ label: "Vanilla" });
  await page.getByRole("checkbox", { name: "Not every choice comes in every size" }).check();

  await page.getByRole("checkbox", { name: "Small for Red velvet" }).uncheck();
  await page.getByRole("checkbox", { name: "Small for Vanilla" }).uncheck();
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByText(/Nothing here is offered for Small/).first()).toBeVisible();

  await page.getByRole("checkbox", { name: "Small for Vanilla" }).check();
  await page.getByRole("checkbox", { name: "Large for Red velvet" }).uncheck();
  await page.getByRole("checkbox", { name: "Small for Red velvet" }).uncheck();
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByText("Offer it in at least one, or remove it.").first()).toBeVisible();
});
