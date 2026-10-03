import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, openMore, openSettings, signUpAndOnboard } from "./helpers";

// Automated accessibility checks (axe): contrast, labels, headings, names, tap-target
// basics. They catch a lot but not everything; a screen-reader pass is still worth doing.
async function expectNoViolations(page: Page, where: string) {
  // The page title streams in just after the page itself; checking before it arrives reports a
  // missing title that is not really missing.
  await expect(page).toHaveTitle(/.+/);
  // Sheets fade in; colours measured halfway through a fade are not the colours people see.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
  );
  expect(summary, `accessibility problems on ${where}`).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test("signed-out pages", async ({ page }) => {
      await page.goto("/");
      await expectNoViolations(page, "landing page");

      await page.goto("/sign-in");
      await expectNoViolations(page, "sign-in");

      await page.goto("/sign-in?error=link");
      await expect(page.getByText("expired or was already used")).toBeVisible();
      await expectNoViolations(page, "sign-in with an error");
    });

    test("signed-in pages", async ({ page }) => {
      // One long walk through every screen (and their error states); it grows with the app.
      test.setTimeout(120_000);
      await signUpAndOnboard(page, `a11y-${scheme}`, "Axe Co");
      await expectNoViolations(page, "home");

      await openMore(page);
      await expectNoViolations(page, "more");

      await openSettings(page);
      await expectNoViolations(page, "settings");

      await page.getByRole("link", { name: "Customers" }).click();
      await expect(page.getByRole("heading", { name: "Customers", level: 1 })).toBeVisible();
      await expectNoViolations(page, "customers, empty");

      await page.getByRole("link", { name: "Add your first customer" }).click();
      await expect(page.getByRole("heading", { name: "Add a customer", level: 1 })).toBeVisible();
      await expectNoViolations(page, "add customer");
      await page.getByRole("checkbox", { name: "This is a business" }).check();
      await page.getByRole("button", { name: "Add address, delivery details or notes" }).click();
      await expectNoViolations(page, "add customer, business with all sections");
      await page.getByLabel("Phone", { exact: true }).fill("bad");
      await page.getByRole("button", { name: "Add customer" }).click();
      await expect(page.getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "add customer with errors");

      await page.getByLabel("Name", { exact: true }).fill("Axe Customer");
      await page.getByLabel("Phone", { exact: true }).fill("021 123 4567");
      await page.getByRole("button", { name: "Add customer" }).click();
      await expect(page.getByTestId("customer-added")).toBeVisible();
      await expectNoViolations(page, "customers, with a customer");

      await page.getByRole("link", { name: /Axe Customer/ }).click();
      await expect(page.getByRole("heading", { name: "Axe Customer", level: 1 })).toBeVisible();
      await expectNoViolations(page, "edit customer");

      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Quotes" }).click();
      await expect(page.getByRole("heading", { name: "Quotes", level: 1 })).toBeVisible();
      await expectNoViolations(page, "quotes, empty");

      await page.getByRole("link", { name: "Start your first quote" }).click();
      await expect(page.getByRole("heading", { name: "New quote", level: 1 })).toBeVisible();
      await expectNoViolations(page, "new quote");
      await page.getByLabel("Customer", { exact: true }).fill("Axe");
      await expect(page.getByRole("option", { name: /Add “Axe”/ })).toBeVisible();
      await expectNoViolations(page, "new quote, customer list open");
      await page.getByRole("option", { name: /Add “Axe”/ }).click();
      await expect(page.getByRole("dialog", { name: "Add a customer" })).toBeVisible();
      await expectNoViolations(page, "new quote, add customer sheet");
      await page.getByRole("dialog").getByRole("button", { name: "Add customer" }).click();
      await expect(page.getByTestId("selected-customer")).toBeVisible();
      await page.getByRole("button", { name: /Edit details/ }).click();
      await expect(page.getByRole("dialog", { name: "Customer details" })).toBeVisible();
      await expectNoViolations(page, "new quote, edit customer sheet");
      await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByLabel("Discount on the whole quote").selectOption("percent");
      await page.getByRole("radio", { name: /Delivery/ }).check();
      await expectNoViolations(page, "new quote, all sections open");

      // The item sheet: pick, one-off configure (with errors), product form.
      await page.getByRole("button", { name: "Add item" }).click();
      await expect(page.getByRole("dialog", { name: "Add an item" })).toBeVisible();
      await expectNoViolations(page, "item sheet, pick");
      await page.getByRole("dialog").getByRole("button", { name: "Add new product" }).click();
      await expect(page.getByRole("dialog", { name: "Add a product" })).toBeVisible();
      await expectNoViolations(page, "item sheet, add product");
      await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
      await page.getByRole("dialog").getByRole("button", { name: /One-off item/ }).click();
      await expect(page.getByRole("dialog", { name: "One-off item" })).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: "Add to quote" }).click();
      await expect(page.getByRole("dialog").getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "item sheet, configure with errors");
      await page.getByRole("dialog").getByLabel("Name", { exact: true }).fill("Axe item");
      await page.getByRole("dialog").getByLabel(/^Price/).fill("10");
      await page.getByRole("dialog").getByRole("button", { name: "Add to quote" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "new quote with errors");
      await page.getByLabel("Discount (%)").first().fill("5");
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByText("Draft saved.")).toBeVisible();
      await expectNoViolations(page, "saved quote");

      // Sending: what is missing (the business has no phone or email yet), then the choice.
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Before you can send this quote" })).toBeVisible();
      await expectNoViolations(page, "send sheet, something missing");
      await page.getByRole("dialog").getByLabel(/^Phone/).fill("bad");
      await page.getByRole("dialog").getByRole("button", { name: "Save and continue" }).click();
      await expect(page.getByRole("dialog").getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "send sheet, contact error");
      await page.getByRole("dialog").getByLabel(/^Phone/).fill("011 555 0101");
      await page.getByRole("dialog").getByRole("button", { name: "Save and continue" }).click();
      await expect(page.getByRole("dialog", { name: "Send this quote" })).toContainText("QT-0001");
      await expectNoViolations(page, "send sheet, ready");
      await page.getByRole("dialog").getByRole("button", { name: "Mark as sent" }).click();
      await expect(page.getByTestId("sent-banner")).toBeVisible();
      await expectNoViolations(page, "sent quote");
      await page.getByRole("button", { name: "Revise this quote" }).click();
      await expect(page.getByTestId("revising-note")).toBeVisible();
      await expectNoViolations(page, "quote being revised");
      await page.getByRole("link", { name: "View version 1" }).click();
      await expect(page.getByTestId("editing-note")).toBeVisible();
      await expectNoViolations(page, "the sent version of a quote being revised");
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Quotes" }).click();
      await expect(page.getByRole("heading", { name: "Quotes", level: 1 })).toBeVisible();
      await expectNoViolations(page, "quotes, with a quote");

      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Products" }).click();
      await expect(page.getByRole("heading", { name: "Products & services", level: 1 })).toBeVisible();
      await expectNoViolations(page, "products, empty");
      await page.getByRole("link", { name: "Add your first product" }).click();
      await expect(page.getByRole("heading", { name: "Add a product", level: 1 })).toBeVisible();
      await expectNoViolations(page, "add product");
      await page.getByRole("button", { name: "Add product" }).click();
      await expect(page.getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "add product with errors");
      await page.getByLabel("Name", { exact: true }).fill("Axe product");
      await page.getByLabel("Price", { exact: true }).fill("10");
      await page.getByRole("button", { name: "Add product" }).click();
      await expect(page.getByTestId("product-added")).toBeVisible();
      await expectNoViolations(page, "products, with a product");
      await page.getByRole("navigation", { name: "Products or services" }).getByRole("link", { name: "Services" }).click();
      await expect(page.getByText("No services yet")).toBeVisible();
      await expectNoViolations(page, "services, empty");
      await page.getByRole("link", { name: "Add your first service" }).click();
      await expect(page.getByRole("heading", { name: "Add a service", level: 1 })).toBeVisible();
      await expectNoViolations(page, "add service");
      await page.goto("/app/products");
      await page.getByRole("link", { name: /Axe product/ }).click();
      await expect(page.getByRole("heading", { name: "Axe product", level: 1 })).toBeVisible();
      await expectNoViolations(page, "edit product");

      await openBusinessProfile(page);
      await expectNoViolations(page, "business profile");

      // Error state: bad phone and a VAT number that is too short.
      await page.getByLabel("Phone", { exact: true }).fill("bad");
      await page.getByRole("checkbox", { name: "I'm registered for VAT" }).check();
      await page.getByRole("button", { name: "Save details" }).click();
      await expect(page.getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "business profile with errors");

      // Quote numbers, with a number that has already been used.
      await page.getByLabel("Next number", { exact: true }).fill("1");
      await page.getByRole("button", { name: "Save quote numbers" }).click();
      await expect(page.getByTestId("form-summary").first()).toBeVisible();
      await expectNoViolations(page, "business profile, quote numbers with an error");
    });
  });
}
