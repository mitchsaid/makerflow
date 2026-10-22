import { expect, test, type Locator, type Page } from "@playwright/test";
import { openBusinessProfile, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, sheet } from "./quote-helpers";

/** Costing slice C: the margin a maker aims for, and what to charge to reach it (docs/plans/costing-slice-c.md). */

const rand = (whole: string, cents = "00") => new RegExp(`R\\s?${whole.replace(/ /g, "\\s?")},${cents}`);

async function tap(locator: Locator) {
  await locator.focus();
  await locator.press("Enter");
}

const costRow = (page: Page, title: string) =>
  page.getByRole("list", { name: "What it costs to make" }).getByRole("listitem").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

async function setTarget(page: Page, text: string) {
  await openBusinessProfile(page);
  await page.getByLabel("Margin you aim for (%)").fill(text);
  await page.getByRole("button", { name: "Save margin" }).click();
}

test("the target margin is set in the profile, judged on a product and a quote, and a price is suggested", async ({ page }) => {
  test.setTimeout(300_000);
  await signUpAndOnboard(page, "target-margin", "Target Co");

  // The target says how to fix it, and can be cleared.
  await openBusinessProfile(page);
  await page.getByLabel("Price of an hour of your time").fill("120");
  await page.getByRole("button", { name: "Save hourly rate" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await setTarget(page, "150");
  await expect(page.getByText("Enter a margin from 1 to 99 percent, like 40.")).toBeVisible();
  await expect(page.getByLabel("Margin you aim for (%)")).toHaveValue("150");
  await setTarget(page, "70");
  await expect(page.getByRole("status").filter({ hasText: "Saved." }).last()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Margin you aim for (%)")).toHaveValue("70");

  // A product that costs R60 to make and sells for R150: a 60% margin, below 70%. For 70% it would be R200.
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await page.getByLabel("Price", { exact: true }).fill("150");
  await tap(page.getByRole("button", { name: "Add your time", exact: true }));
  await page.getByRole("list", { name: "What it costs to make" }).getByLabel("How long it takes").fill("30");
  const note = page.getByTestId("cost-summary").getByTestId("target-note");
  await expect(note).toContainText("Below your 70% target");
  await expect(note).toContainText(rand("200"));
  // A price that reaches it meets it.
  await page.getByLabel("Price", { exact: true }).fill("200");
  await expect(note).toContainText("Meets your 70% target");
  await page.getByLabel("Price", { exact: true }).fill("150");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Cake.");

  // On a quote: a one-off item that costs R40 is offered the price for 70% (R133,34), and Use fills the price in.
  await page.goto("/app/quotes/new");
  await tap(page.getByRole("button", { name: "Add item" }));
  await sheet(page).getByRole("button", { name: /Cake/ }).click();
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await tap(page.getByRole("button", { name: "Add item" }));
  await sheet(page).getByRole("button", { name: /One-off item/ }).click();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Shelf");
  await sheet(page).getByLabel("Quantity").fill("1");
  await sheet(page).getByLabel(/^Price/).fill("100");
  await expect(sheet(page).getByTestId("target-price-hint")).toHaveCount(0);
  await sheet(page).getByLabel("What it costs you").fill("40");
  const hint = sheet(page).getByTestId("target-price-hint");
  await expect(hint).toContainText("For your 70% target, charge");
  await expect(hint).toContainText(rand("133", "34"));
  await hint.getByRole("button", { name: /^Use/ }).click();
  await expect(sheet(page).getByLabel(/^Price/)).toHaveValue("133,34");
  await expect(sheet(page).getByTestId("target-price-hint")).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(sheet(page)).toHaveCount(0);

  // The quote: R283,34 sells for R100 of cost, 64%: below 70%. The cake says what to sell it for.
  await expect(page.getByTestId("margin-standing")).toContainText("below your 70% target");
  await page.getByTestId("margin-panel").locator("summary").click();
  const hints = page.getByTestId("margin-item-hint");
  await expect(hints).toHaveCount(1);
  await expect(hints.first()).toContainText("For 70%, sell it for");
  await expect(hints.first()).toContainText(rand("200"));

  // Saved as a draft, then judged against a lower target (met), and against none (nothing said).
  await addCustomerInSheet(page, "Sam Jacobs", { phone: "021 555 0000" });
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  const quoteUrl = page.url();
  await setTarget(page, "50");
  await expect(page.getByRole("status").filter({ hasText: "Saved." }).last()).toBeVisible();
  await page.goto(quoteUrl);
  await expect(page.getByTestId("margin-standing")).toContainText("meets your 50% target");
  await setTarget(page, "");
  await expect(page.getByRole("status").filter({ hasText: "Saved." }).last()).toBeVisible();
  await page.goto(quoteUrl);
  await expect(page.getByTestId("margin-summary")).toBeVisible();
  await expect(page.getByTestId("margin-standing")).toHaveCount(0);
});

test("a margin of 40 percent is a price of cost over 0,6, and a business with no target sees none of it", async ({ page }) => {
  test.setTimeout(240_000);
  await signUpAndOnboard(page, "target-margin-none", "No Target Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await page.getByLabel("Price", { exact: true }).fill("150");
  await tap(page.getByRole("button", { name: "Add other cost", exact: true }));
  const row = costRow(page, "Other cost 1");
  await row.getByLabel("What is it").fill("Box");
  await row.getByLabel("What it costs").fill("60");
  await expect(page.getByTestId("cost-summary")).toContainText(/Margin 60/);
  await expect(page.getByTestId("target-note")).toHaveCount(0);

  await setTarget(page, "40");
  await expect(page.getByRole("status").filter({ hasText: "Saved." }).last()).toBeVisible();
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cake");
  await page.getByLabel("Price", { exact: true }).fill("90");
  await tap(page.getByRole("button", { name: "Add other cost", exact: true }));
  const row2 = costRow(page, "Other cost 1");
  await row2.getByLabel("What is it").fill("Box");
  await row2.getByLabel("What it costs").fill("60");
  // Margin 33%: below 40, and R60 at 40% is R100.
  await expect(page.getByTestId("target-note")).toContainText("Below your 40% target");
  await expect(page.getByTestId("target-note")).toContainText(rand("100"));
});
