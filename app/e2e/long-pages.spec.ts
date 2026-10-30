import { expect, test, type Locator, type Page } from "@playwright/test";
import { businessTab, openBusinessProfile, openDocuments, openProductSettings, quoteSettingsTab, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, nav, sentQuote, sheet } from "./quote-helpers";

/**
 * Long pages in tabs, one Save each, and "coming soon" at the end (docs/plans/ux-pass-2.md, E; review T5, T7).
 */

/** The Save buttons a person can see now. */
const visibleSaves = (page: Page) => page.locator("main").getByRole("button", { name: /^Save/ }).locator("visible=true");

/** What each button says on the screen, leaving out the words only a screen reader hears. */
const shownText = (buttons: Locator) =>
  buttons.evaluateAll((els) =>
    els.map((el) => {
      const copy = el.cloneNode(true) as HTMLElement;
      copy.querySelectorAll(".sr-only").forEach((s) => s.remove());
      return copy.textContent?.trim();
    }),
  );

test("the Business profile is three tabs, each with one full-width Save, and holds no pricing", async ({ page }) => {
  await signUpAndOnboard(page, "long-business", "Long Co");
  await openBusinessProfile(page);
  const tabs = page.getByRole("navigation", { name: "Business profile" });
  await expect(tabs.getByRole("link")).toHaveText(["Details", "Logo", "Ways to pay"]);
  await expect(tabs.getByRole("link", { name: "Details", exact: true })).toHaveAttribute("aria-current", "page");

  // Details: the business, how to reach it, the address, VAT and what you make, with one Save.
  await expect(page.getByRole("checkbox", { name: "Food and baking" })).toBeVisible();
  await expect(visibleSaves(page)).toHaveCount(1);
  expect(await shownText(visibleSaves(page))).toEqual(["Save"]);
  await expect(visibleSaves(page)).toHaveAccessibleName("Save details");
  const save = await visibleSaves(page).boundingBox();
  const main = await page.locator("main").boundingBox();
  expect(save!.width).toBeGreaterThan(main!.width - 64);
  // The pricing preferences moved to Products.
  await expect(page.getByLabel("Price of an hour of your time")).toHaveCount(0);
  await expect(page.getByLabel("Margin you aim for (%)")).toHaveCount(0);

  await businessTab(page, "Logo");
  await expect(page).toHaveURL(/\/app\/business\?section=logo$/);
  await expect(page.getByRole("group", { name: "Your logo" })).toBeVisible();
  await expect(visibleSaves(page)).toHaveCount(1);
  await expect(visibleSaves(page)).toHaveAccessibleName("Save logo");

  await businessTab(page, "Ways to pay");
  await expect(page.getByRole("group", { name: "EFT", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a way to pay" })).toBeVisible();

  // Back goes to the tab before; a link to a tab opens it.
  await page.goBack();
  await expect(page.getByRole("group", { name: "Your logo" })).toBeVisible();
  await page.goto("/app/business?section=bank");
  await expect(page.getByRole("group", { name: "EFT", exact: true })).toBeVisible();
});

test("Quote settings: terms and themes at the top, then Wording, Starting values and Numbers", async ({ page }) => {
  await signUpAndOnboard(page, "long-quotes", "Long Quotes Co");
  await openDocuments(page);
  await expect(page.getByRole("link", { name: "Manage your terms" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage themes" })).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Quote settings" });
  await expect(tabs.getByRole("link")).toHaveText(["Wording", "Starting values", "Numbers"]);

  await expect(page.getByLabel("Intro (optional)")).toBeVisible();
  await expect(visibleSaves(page)).toHaveCount(1);
  await expect(visibleSaves(page)).toHaveAccessibleName("Save quote wording");

  await quoteSettingsTab(page, "Starting values");
  await expect(page.getByRole("group", { name: "Deposit" })).toBeVisible();
  await expect(page.getByLabel("Intro (optional)")).toBeHidden();
  // Each says only "Save"; a screen reader hears what it saves.
  expect(await shownText(visibleSaves(page))).toEqual(["Save", "Save", "Save"]);
  await expect(visibleSaves(page).nth(0)).toHaveAccessibleName("Save deposit");
  await expect(visibleSaves(page).nth(1)).toHaveAccessibleName("Save discount");
  await expect(visibleSaves(page).nth(2)).toHaveAccessibleName("Save delivery or collection");

  await quoteSettingsTab(page, "Numbers");
  await expect(page.getByLabel("Next number", { exact: true })).toBeVisible();
  await expect(visibleSaves(page)).toHaveCount(1);
  await expect(visibleSaves(page)).toHaveAccessibleName("Save quote numbers");
});

test("Product settings hold the hourly rate and the margin, saved together, and nothing is saved while one is wrong", async ({ page }) => {
  await signUpAndOnboard(page, "long-pricing", "Pricing Co");
  await openProductSettings(page);
  await expect(visibleSaves(page)).toHaveCount(1);
  await page.getByLabel("Price of an hour of your time").fill("120");
  await page.getByLabel("Margin you aim for (%)").fill("150");
  await page.getByRole("button", { name: "Save pricing" }).click();
  await expect(page.locator("#targetMargin-error")).toHaveText("Enter a margin from 1 to 99 percent, like 40.");
  await expect(page.getByTestId("form-summary")).toBeVisible();
  await expect(page.getByLabel("Price of an hour of your time")).toHaveValue("120");
  await page.reload();
  await expect(page.getByLabel("Price of an hour of your time")).toHaveValue("");

  await page.getByLabel("Price of an hour of your time").fill("120");
  await page.getByLabel("Margin you aim for (%)").fill("40");
  await page.getByRole("button", { name: "Save pricing" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Price of an hour of your time")).toHaveValue("120");
  await expect(page.getByLabel("Margin you aim for (%)")).toHaveValue("40");
});

test("what is coming later sits at the end of the term form, never between the fields", async ({ page }) => {
  await signUpAndOnboard(page, "long-later", "Later Co");
  // The quote form has no "coming later" at all (the online-acceptance card was taken out, founder 2026-10-30).
  await page.goto("/app/quotes/new");
  await expect(page.getByTestId("coming-later")).toHaveCount(0);

  await page.goto("/app/quotes/settings/policies/new");
  const laterOnTerm = page.getByTestId("coming-later");
  await expect(laterOnTerm).toContainText("Only on certain products");
  const saveBox = await page.getByRole("button", { name: "Save term" }).boundingBox();
  const laterBox = await laterOnTerm.boundingBox();
  expect(laterBox!.y).toBeGreaterThan(saveBox!.y);
});

test("the filter bar starts at the first chip and shows that it scrolls", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "long-filter", "Filter Co");
  await nav(page).getByRole("link", { name: "Jobs" }).click();
  await page.getByRole("link", { name: "New job" }).click();
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: "One-off item (just for this job)" }).click();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Shelf");
  await sheet(page).getByLabel("Quantity").fill("1");
  await sheet(page).getByRole("button", { name: "Add to job" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await addCustomerInSheet(page, "Sam Jacobs");
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);

  await nav(page).getByRole("link", { name: "Jobs" }).click();
  const bar = page.getByRole("group", { name: "Show jobs" });
  await expect(bar).toBeVisible();
  expect(await bar.evaluate((el) => el.scrollLeft)).toBe(0);
  // The first chip is whole on the screen.
  const first = await bar.getByRole("button").first().boundingBox();
  expect(first!.x).toBeGreaterThanOrEqual(0);
  // More chips beyond the edge: that edge fades.
  if (await bar.evaluate((el) => el.scrollWidth > el.clientWidth)) {
    await expect(bar).toHaveAttribute("data-more", "after");
    expect(await bar.evaluate((el) => getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage)).toContain("gradient");
  }
});

test("on Quotes, Invoices and Products the main action comes first and settings is a gear after it", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "long-gear", "Gear Co");
  // Something in each list, so each page has its main action.
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await page.getByLabel("Price", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();
  await sentQuote(page);

  for (const [path, action, settings] of [
    ["/app/products", "Add product", "Product settings"],
    ["/app/quotes", "New quote", "Quote settings"],
  ] as const) {
    await page.goto(path);
    const add = page.getByRole("link", { name: action, exact: true });
    const gear = page.getByRole("link", { name: settings });
    await expect(add).toBeVisible();
    const [a, g] = [await add.boundingBox(), await gear.boundingBox()];
    // The action is first (to the left), and the gear is a whole 44 px tap target with no words on it.
    expect(a!.x).toBeLessThan(g!.x);
    expect(g!.width).toBeGreaterThanOrEqual(44);
    expect(g!.height).toBeGreaterThanOrEqual(44);
    await expect(gear).toHaveText("");
    await expect(gear).toHaveAttribute("title", settings);
  }

  // Invoices show their action once there is an invoice or a draft; the gear is there either way.
  await page.goto("/app/invoices");
  const gear = page.getByRole("link", { name: "Invoice settings" });
  await expect(gear).toBeVisible();
  expect((await gear.boundingBox())!.width).toBeGreaterThanOrEqual(44);
});
