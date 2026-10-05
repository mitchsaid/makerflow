import { expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, item, openQuotes, sheet } from "./quote-helpers";

async function addProduct(page: Page, name: string, price: string, unit: string) {
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Price", { exact: true }).fill(price);
  await page.getByLabel("Unit (optional)").fill(unit);
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();
}

test("the business sets its quote wording once, and each new quote starts with it", async ({ page }) => {
  await signUpAndOnboard(page, "w-defaults", "Sweet Co");
  await openBusinessProfile(page);
  await page.getByLabel("Sign-off (optional)").fill("Yours in sweetness");
  await page.getByLabel("How to pay (optional)").fill("EFT to Sweet Co, FNB 123456");
  // Starting lines are one tap, can be edited, and are not added twice.
  await page.getByRole("button", { name: "Deposit" }).click();
  await expect(page.getByLabel("Terms (optional)")).toHaveValue("A deposit is needed to start work.");
  await expect(page.getByRole("button", { name: "Deposit" })).toBeDisabled();
  await page.getByRole("button", { name: "Lead time" }).click();
  await expect(page.getByLabel("Terms (optional)")).toHaveValue(
    "A deposit is needed to start work.\nPlease allow 2 weeks to make your order.",
  );
  await page.getByRole("button", { name: "Save quote wording" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  // A new quote starts with it, and the quote can change its own copy.
  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();
  await expect(page.getByLabel("Sign-off (optional)")).toHaveValue("Yours in sweetness");
  await expect(page.getByLabel("How to pay (optional)")).toHaveValue("EFT to Sweet Co, FNB 123456");
  await expect(page.getByLabel("Terms (optional)")).toHaveValue(/A deposit is needed to start work\./);
  await page.getByLabel("Sign-off (optional)").fill("With love");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  const quoteUrl = page.url().split("?")[0];

  // Changing the business's wording afterwards does not change a quote that exists.
  await openBusinessProfile(page);
  await page.getByLabel("Sign-off (optional)").fill("Warmly");
  await page.getByRole("button", { name: "Save quote wording" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await page.goto(quoteUrl);
  await expect(page.getByLabel("Sign-off (optional)")).toHaveValue("With love");
  // A new one starts with the new wording.
  await page.goto("/app/quotes/new");
  await expect(page.getByLabel("Sign-off (optional)")).toHaveValue("Warmly");
});

test("units, a title and a description: set on the quote, shown on the preview", async ({ page }) => {
  await signUpAndOnboard(page, "w-units", "Sweet Co");
  await addProduct(page, "Cupcakes", "80", "dozen");
  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();

  // Choosing a product fills its unit; the price is per that unit.
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Cupcakes/ }).click();
  await expect(sheet(page).getByLabel("Unit (optional)")).toHaveValue("dozen");
  await expect(sheet(page).getByLabel(/^Price/)).toHaveAccessibleName(/per dozen/);
  await sheet(page).getByLabel("Quantity").fill("2");
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(item(page, 1)).toContainText(/2 dozen × R\s?80,00/);
  await expect(page.getByTestId("sticky-total")).toHaveText(/R\s?160,00/);

  // A one-off item can have its own unit, typed or suggested.
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /One-off item/ }).click();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Flour for the class");
  await sheet(page).getByLabel("Unit (optional)").fill("kg");
  await sheet(page).getByLabel("Quantity").fill("2,5");
  await sheet(page).getByLabel(/^Price/).fill("30");
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(item(page, 2)).toContainText(/2,5 kg × R\s?30,00/);
  await expect(page.getByTestId("sticky-total")).toHaveText(/R\s?235,00/);

  await addCustomerInSheet(page, "Sarah");
  await page.getByLabel("Quote title (optional)").fill("Cupcakes for Sarah's party");
  await page.getByLabel("Description (optional)").fill("Thank you for asking about cupcakes for the party.");
  await page.getByLabel("How to pay (optional)").fill("Pay on collection");
  await page.getByLabel("Terms (optional)").fill("Orders need two days' notice.");
  await page.getByLabel("Sign-off (optional)").fill("Yours in sweetness");

  // The preview shows it all: the picture of the real document, and its text version.
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  const text = page.getByRole("region", { name: "The quote as text" });
  await expect(text).toContainText("Cupcakes for Sarah's party");
  await expect(text).toContainText("Thank you for asking about cupcakes for the party.");
  await expect(text).toContainText(/2\s+dozen/);
  await expect(text).toContainText(/2,5\s+kg/);
  await expect(text).toContainText("Pay on collection");
  await expect(text).toContainText("Orders need two days' notice.");
  await expect(text).toContainText("Yours in sweetness");
  await expect(text).toContainText("Sweet Co");

  // And it all comes back when the draft is opened again.
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Quote title (optional)")).toHaveValue("Cupcakes for Sarah's party");
  await expect(item(page, 1)).toContainText(/2 dozen/);
  await expect(item(page, 2)).toContainText(/2,5 kg/);
});
