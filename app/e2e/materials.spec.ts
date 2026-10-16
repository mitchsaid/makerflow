import { devices, expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, signUpAndOnboard } from "./helpers";

/** Materials: the third switch on the Products tab (docs/plans/costs-and-recipes.md, slice 1). */

async function openMaterials(page: Page) {
  await page.goto("/app/products");
  await page.getByRole("navigation", { name: "Products, services or materials" }).getByRole("link", { name: "Materials" }).click();
  await expect(page).toHaveURL(/\/app\/products\/materials$/);
}

async function fillMaterial(page: Page, m: { name: string; unit: string; quantity: string; price: string; supplier?: string }) {
  await page.getByLabel("Name", { exact: true }).fill(m.name);
  await page.getByLabel("Unit", { exact: true }).selectOption(m.unit);
  await page.getByLabel("How much you bought").fill(m.quantity);
  await page.getByLabel("What you paid for it").fill(m.price);
  if (m.supplier) await page.getByLabel("Supplier (optional)").fill(m.supplier);
}

test("add, find, edit and archive a material; the cost of one unit is worked out as you type", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "mat-main", "Materials Co");

  // The third switch beside Products and Services, with an empty state that says why.
  await openMaterials(page);
  await expect(page.getByRole("heading", { name: "No materials yet" })).toHaveCount(0);
  await expect(page.getByText("No materials yet")).toBeVisible();
  await expect(page.getByRole("link", { name: "Materials" }).first()).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Add your first material" }).click();

  // A business that is not registered for VAT is never asked about it: the price paid is the cost.
  await expect(page.getByText(/Does that price include/)).toHaveCount(0);

  // Problems at the fields and in a summary, and nothing typed is lost.
  await page.getByLabel("Name", { exact: true }).fill("Cake flour");
  await page.getByRole("button", { name: "Add material" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("3 things need fixing");
  await expect(page.getByTestId("form-summary")).toContainText("Choose a unit");
  await expect(page.getByTestId("form-summary")).toContainText("Enter how much you bought");
  await expect(page.getByTestId("form-summary")).toContainText("Enter what you paid");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Cake flour");

  // The cost of one unit appears as soon as it can be worked out.
  await expect(page.getByTestId("cost-preview")).toContainText("Fill in the unit");
  await fillMaterial(page, { name: "Cake flour", unit: "kg", quantity: "12,5", price: "187,50", supplier: "Makro" });
  await expect(page.getByTestId("cost-preview")).toContainText(/R\s?15,00 per kg/);
  await page.getByRole("button", { name: "Add material" }).click();
  await expect(page).toHaveURL(/\/app\/products\/materials\?added=/);
  await expect(page.getByTestId("material-added")).toHaveText("Added Cake flour.");

  // The list says what it holds and what a unit costs.
  const row = page.getByRole("link", { name: /Cake flour/ });
  await expect(row).toContainText(/12,5 kg for R\s?187,50/);
  await expect(row).toContainText("Makro");
  await expect(row).toContainText(/R\s?15,00 per kg/);

  // Names are unique (ignoring case and spacing), with a message that says how to fix it.
  await page.getByRole("link", { name: "Add material" }).click();
  await fillMaterial(page, { name: "  cake FLOUR ", unit: "g", quantity: "500", price: "20" });
  await page.getByRole("button", { name: "Add material" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("You already have a material with that name");

  // A second, found by searching the name or the supplier.
  await fillMaterial(page, { name: "Silver wire", unit: "m", quantity: "5", price: "250", supplier: "Metalcraft" });
  await page.getByRole("button", { name: "Add material" }).click();
  await expect(page.getByTestId("material-added")).toHaveText("Added Silver wire.");
  await page.getByLabel("Search materials").fill("metalcraft");
  await expect(page.getByRole("link", { name: /Silver wire/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Cake flour/ })).toHaveCount(0);
  await page.getByLabel("Search materials").fill("nothing like this");
  await expect(page.getByText("No materials match")).toBeVisible();
  await page.getByLabel("Search materials").fill("");

  // Edit: saved and kept, and the cost follows.
  await page.getByRole("link", { name: /Cake flour/ }).click();
  await expect(page.getByLabel("How much you bought")).toHaveValue("12,5");
  await expect(page.getByLabel("What you paid for it")).toHaveValue("187,50");
  await page.getByLabel("What you paid for it").fill("250");
  await expect(page.getByTestId("cost-preview")).toContainText(/R\s?20,00 per kg/);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("What you paid for it")).toHaveValue("250");

  // Archive hides it from the list, and it can be shown and restored.
  await page.getByRole("button", { name: "Archive material" }).click();
  await expect(page).toHaveURL(/\/app\/products\/materials$/);
  await expect(page.getByRole("link", { name: /Cake flour/ })).toHaveCount(0);
  await page.getByRole("checkbox", { name: /Show archived/ }).check();
  await page.getByRole("link", { name: /Cake flour/ }).click();
  await expect(page.getByTestId("archived-notice")).toBeVisible();
  await page.getByRole("button", { name: "Restore material" }).click();
  await expect(page.getByTestId("archived-notice")).toHaveCount(0);
});

test("a VAT-registered business says what the price includes, and costs are worked out without VAT", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "mat-vat", "Materials VAT Co");
  await openBusinessProfile(page);
  await page.getByRole("checkbox", { name: "I'm registered for VAT" }).check();
  await page.getByLabel("VAT number").fill("412 345 6789");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/app/products/materials/new");
  await fillMaterial(page, { name: "Cake flour", unit: "kg", quantity: "12,5", price: "187,50" });
  // Includes VAT is chosen to start (what a shop till shows): 15% comes out, so R13,04 a kg, and it says so.
  await expect(page.getByRole("radio", { name: /^Includes VAT/ })).toBeChecked();
  await expect(page.getByTestId("cost-preview")).toContainText(/R\s?13,04 per kg \(without VAT\)/);
  await expect(page.getByTestId("vat-note")).toContainText("Costs and margins exclude VAT");
  await expect(page.getByTestId("vat-note")).toContainText("We don't work out what you can claim");

  // Excluding VAT or no VAT charged: the price paid already is the cost.
  await page.getByRole("radio", { name: /^Excludes VAT/ }).click();
  await expect(page.getByTestId("cost-preview")).toContainText(/R\s?15,00 per kg/);
  await page.getByRole("radio", { name: /^No VAT charged/ }).click();
  await expect(page.getByTestId("cost-preview")).toContainText(/R\s?15,00 per kg/);
  await page.getByRole("radio", { name: /^Includes VAT/ }).click();

  await page.getByRole("button", { name: "Add material" }).click();
  await expect(page.getByTestId("material-added")).toHaveText("Added Cake flour.");
  // The list shows the cost without VAT, and says so; the answer is kept when it is opened again.
  await expect(page.getByRole("link", { name: /Cake flour/ })).toContainText(/R\s?13,04 per kg \(without VAT\)/);
  await page.getByRole("link", { name: /Cake flour/ }).click();
  await expect(page.getByRole("radio", { name: /^Includes VAT/ })).toBeChecked();
});

test("each business only ever sees its own materials", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "mat-own", "Own Materials Co");
  await page.goto("/app/products/materials/new");
  await fillMaterial(page, { name: "Private beeswax", unit: "g", quantity: "500", price: "450" });
  await page.getByRole("button", { name: "Add material" }).click();
  await expect(page.getByTestId("material-added")).toBeVisible();
  const url = (await page.getByRole("link", { name: /Private beeswax/ }).getAttribute("href")) ?? "";

  const other = await browser.newContext({ ...devices["Pixel 7"] });
  const second = await other.newPage();
  await signUpAndOnboard(second, "mat-other", "Other Materials Co");
  await second.goto("/app/products/materials");
  await expect(second.getByText("No materials yet")).toBeVisible();
  await second.goto(url);
  await expect(second.getByText("This page could not be found")).toBeVisible();
  await expect(second.getByText("Private beeswax")).toHaveCount(0);
  await other.close();
});

test("when every material is archived, the list says so instead of looking empty or broken", async ({ page }) => {
  await signUpAndOnboard(page, "mat-allarch", "All Archived Co");
  await page.goto("/app/products/materials/new");
  await fillMaterial(page, { name: "Old stock", unit: "each", quantity: "100", price: "50" });
  await page.getByRole("button", { name: "Add material" }).click();
  await page.getByRole("link", { name: /Old stock/ }).click();
  await page.getByRole("button", { name: "Archive material" }).click();
  await expect(page).toHaveURL(/\/app\/products\/materials$/);
  await expect(page.getByText("All your materials are archived. Tick Show archived to see them.")).toBeVisible();
  await page.getByRole("checkbox", { name: /Show archived/ }).check();
  await expect(page.getByRole("link", { name: /Old stock/ })).toBeVisible();
});
