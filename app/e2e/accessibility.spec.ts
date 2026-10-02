import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

// Automated accessibility checks (axe): contrast, labels, headings, names, tap-target
// basics. They catch a lot but not everything; a screen-reader pass is still worth doing.
async function expectNoViolations(page: Page, where: string) {
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
      await signUpAndOnboard(page, `a11y-${scheme}`, "Axe Co");
      await expectNoViolations(page, "home");

      await page.getByRole("link", { name: "Settings" }).click();
      await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
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

      await page.getByRole("link", { name: "Business" }).click();
      await expect(page.getByRole("heading", { name: "Business profile", level: 1 })).toBeVisible();
      await expectNoViolations(page, "business profile");

      // Error state: bad phone and a VAT number that is too short.
      await page.getByLabel("Phone", { exact: true }).fill("bad");
      await page.getByRole("checkbox", { name: "I'm registered for VAT" }).check();
      await page.getByRole("button", { name: "Save details" }).click();
      await expect(page.getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "business profile with errors");
    });
  });
}
