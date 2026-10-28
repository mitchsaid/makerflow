import { expect, test, type Page } from "@playwright/test";
import { openProductTab, signUpAndOnboard } from "./helpers";

/** The product form's three tabs (docs/plans/product-form-tabs.md). */

const tabs = (page: Page) => page.getByRole("tab");
const sheet = (page: Page) => page.getByRole("dialog");
const costRow = (page: Page, title: string) =>
  page.getByRole("list", { name: "What it costs to make" }).getByRole("listitem").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

test("three tabs, Details first; nothing typed in one is lost on another; one Save keeps all of it", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "tabs-keep", "Tabs Co");
  await page.goto("/app/products/new");

  // Details, Production and Inputs, Details open; the tab list has a name.
  await expect(page.getByRole("tablist", { name: "Parts of the form" })).toBeVisible();
  await expect(tabs(page)).toHaveText([/^Details/, /^Production/, /^Inputs/]);
  await expect(page.getByRole("tab", { name: /^Details/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "What it costs to make" })).toBeHidden();

  await page.getByLabel("Name", { exact: true }).fill("Tabbed cake");
  await page.getByLabel("Price", { exact: true }).fill("120");

  // Production: steps tracked as steps, two of them; the tab shows how many.
  await openProductTab(page, "Production");
  await expect(page.getByLabel("Name", { exact: true })).toBeHidden();
  await page.getByRole("radio", { name: /^As steps/ }).click();
  await page.getByLabel("Step 1", { exact: true }).fill("Bake");
  await page.getByRole("button", { name: "Add another step" }).click();
  await page.getByLabel("Step 2", { exact: true }).fill("Ice");
  await expect(page.getByRole("tab", { name: /^Production/ })).toContainText("2");

  // Inputs: one cost line; the tab shows one.
  await openProductTab(page, "Inputs");
  await page.getByRole("button", { name: "Add other cost", exact: true }).click();
  const row = costRow(page, "Other cost 1");
  await row.getByLabel("What is it").fill("Box");
  await row.getByLabel("What it costs").fill("10");
  await expect(page.getByRole("tab", { name: /^Inputs/ })).toContainText("1");

  // Back on Details, what was typed is still there; the one Save covers every tab.
  await openProductTab(page, "Details");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Tabbed cake");
  await expect(page.getByLabel("Price", { exact: true })).toHaveValue("120");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Tabbed cake.");

  // Opened again: it opens on Details; the counts are on the tabs; the steps and the cost were kept.
  await page.getByRole("link", { name: /Tabbed cake/ }).click();
  await expect(page.getByRole("tab", { name: /^Details/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /^Production/ })).toContainText("2");
  await expect(page.getByRole("tab", { name: /^Inputs/ })).toContainText("1");
  await openProductTab(page, "Production");
  await expect(page.getByLabel("Step 2", { exact: true })).toHaveValue("Ice");
  await openProductTab(page, "Inputs");
  await expect(costRow(page, "Other cost 1").getByLabel("What it costs")).toHaveValue("10");
});

test("the arrow keys, Home and End move between the tabs, and only the open one is in the tab order", async ({ page }) => {
  await signUpAndOnboard(page, "tabs-keys", "Tab Keys Co");
  await page.goto("/app/products/new");
  const [details, production, inputs] = [page.getByRole("tab", { name: /^Details/ }), page.getByRole("tab", { name: /^Production/ }), page.getByRole("tab", { name: /^Inputs/ })];
  await expect(details).toHaveAttribute("tabindex", "0");
  await expect(production).toHaveAttribute("tabindex", "-1");
  await details.focus();
  await page.keyboard.press("ArrowRight");
  await expect(production).toBeFocused();
  await expect(production).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(inputs).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(details).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(inputs).toBeFocused();
  await page.keyboard.press("Home");
  await expect(details).toBeFocused();
  // The open tab names its panel.
  await expect(details).toHaveAttribute("aria-controls", /panel-details/);
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
});

test("a problem on a closed tab opens that tab, is marked on it in words, and the summary goes to the field", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "tabs-problems", "Tab Problems Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Problem cake");
  await page.getByLabel("Price", { exact: true }).fill("50");

  // A step with no name, then back to Details: nothing is wrong on the tab that is open.
  await openProductTab(page, "Production");
  await page.getByRole("radio", { name: /^As steps/ }).click();
  await openProductTab(page, "Details");
  await page.getByRole("button", { name: "Add product" }).click();
  const summary = page.getByTestId("form-summary");
  await expect(summary).toContainText("1 thing needs fixing");
  // The tab with the problem opens, and says so in words.
  await expect(page.getByRole("tab", { name: /^Production/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /^Production/ })).toContainText("1 to fix");
  await expect(page.getByRole("tab", { name: /^Details/ })).not.toContainText("to fix");
  await expect(page.locator("[data-slot=field-error]", { hasText: "Give the step a name" })).toBeVisible();

  // Two tabs with problems, neither of them the one that is open: the first is opened, and a link in the summary goes to the other.
  await openProductTab(page, "Details");
  await openProductTab(page, "Inputs");
  await page.getByRole("button", { name: "Add other cost", exact: true }).click();
  await openProductTab(page, "Details");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(summary).toContainText("3 things need fixing");
  await expect(page.getByRole("tab", { name: /^Production/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /^Production/ })).toContainText("1 to fix");
  await expect(page.getByRole("tab", { name: /^Inputs/ })).toContainText("to fix");
  await expect(page.getByRole("tab", { name: /^Details/ })).not.toContainText("to fix");
  await summary.getByRole("link", { name: /^Cost 1/ }).first().click();
  await expect(page.getByRole("tab", { name: /^Inputs/ })).toHaveAttribute("aria-selected", "true");
  // Fixing the step drops its marker at once, though that tab is not the one open.
  await openProductTab(page, "Production");
  await page.getByLabel("Step 1", { exact: true }).fill("Bake");
  await expect(page.getByRole("tab", { name: /^Production/ })).not.toContainText("to fix");
  await expect(page.getByRole("tab", { name: /^Inputs/ })).toContainText("to fix");
});

test("a service's middle tab is Steps; the tab bar stays at the top while a tab scrolls", async ({ page }) => {
  await signUpAndOnboard(page, "tabs-service", "Tab Service Co");
  await page.goto("/app/products/new?kind=service");
  await expect(tabs(page)).toHaveText([/^Details/, /^Steps/, /^Inputs/]);

  await page.goto("/app/products/new");
  const bar = page.getByRole("tablist", { name: "Parts of the form" });
  await expect(bar).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  // The pinned strip (the bar and its padding) is at the top edge of the screen.
  const strip = bar.locator("xpath=..");
  await expect.poll(async () => (await strip.boundingBox())!.y).toBeLessThan(2);
  await expect(bar).toBeInViewport();
});

test("editing a product from a quote has the same tabs: steps and costs can be changed there too", async ({ page }) => {
  test.setTimeout(240_000);
  await signUpAndOnboard(page, "tabs-sheet", "Tab Sheet Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Sheet cake");
  await page.getByLabel("Price", { exact: true }).fill("200");
  await openProductTab(page, "Production");
  await page.getByRole("radio", { name: /^As steps/ }).click();
  await page.getByLabel("Step 1", { exact: true }).fill("Bake");
  await openProductTab(page, "Inputs");
  await page.getByRole("button", { name: "Add other cost", exact: true }).click();
  const row = costRow(page, "Other cost 1");
  await row.getByLabel("What is it").fill("Box");
  await row.getByLabel("What it costs").fill("10");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();

  // From a quote: the price, a step and a cost are changed in the sheet.
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Sheet cake/ }).click();
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await page.getByTestId("quote-line").first().getByRole("button", { name: /Edit/ }).click();
  await sheet(page).getByRole("button", { name: "Edit this product" }).click();
  await expect(sheet(page).getByRole("tab")).toHaveText([/^Details/, /^Production/, /^Inputs 1/]);
  await sheet(page).getByLabel("Price", { exact: true }).fill("250");
  await sheet(page).getByRole("tab", { name: /^Production/ }).click();
  await sheet(page).getByRole("button", { name: "Add another step" }).click();
  await sheet(page).getByLabel("Step 2", { exact: true }).fill("Ice");
  await sheet(page).getByRole("tab", { name: /^Inputs/ }).click();
  await sheet(page).getByRole("button", { name: "Add other cost", exact: true }).click();
  const added = sheet(page).getByRole("list", { name: "What it costs to make" }).getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Other cost 2", exact: true }) });
  await added.getByLabel("What is it").fill("Ribbon");
  await added.getByLabel("What it costs").fill("5");
  await sheet(page).getByRole("button", { name: "Save changes" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Edit item");

  // The product has its new price, both steps and both costs.
  await page.goto("/app/products");
  await page.getByRole("link", { name: /Sheet cake/ }).click();
  await expect(page.getByLabel("Price", { exact: true })).toHaveValue("250");
  await expect(page.getByRole("tab", { name: /^Production/ })).toContainText("2");
  await expect(page.getByRole("tab", { name: /^Inputs/ })).toContainText("2");
  await openProductTab(page, "Production");
  await expect(page.getByLabel("Step 1", { exact: true })).toHaveValue("Bake");
  await expect(page.getByLabel("Step 2", { exact: true })).toHaveValue("Ice");
  await openProductTab(page, "Inputs");
  await expect(costRow(page, "Other cost 1").getByLabel("What it costs")).toHaveValue("10");
  await expect(costRow(page, "Other cost 2").getByLabel("What it costs")).toHaveValue("5");
});
