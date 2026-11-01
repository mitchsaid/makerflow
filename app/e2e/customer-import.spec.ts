import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

/** Importing a list of customers (docs/plans/import-onboarding.md, slice 3). */
test("a Xero-style contacts list: bad details are left out of that customer, rows with no name or a repeated name are left out, and the ticked ones are added", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "import-customers", "Import Customers Co");
  await page.goto("/app/customers");
  await page.getByTestId("import-link").click();
  await expect(page.getByRole("heading", { name: "Import customers", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Paste your list or choose a file first.")).toBeVisible();

  const list = [
    "*ContactName,EmailAddress,POAddressLine1,POCity,PORegion,POPostalCode,PhoneNumber",
    "Lindiwe Dlamini,lindiwe@example.test,4 Kloof Road,Cape Town,Western Cape,8001,082 555 0111",
    "Pieter van Wyk,not-an-email,88 Main Road,Claremont,Narnia,77x,082 555 0112",
    ",nobody@example.test,,,,,",
    "lindiwe dlamini,dup@example.test,,,,,",
  ].join("\n");
  await page.getByLabel("Your list").fill(list);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Which column is which?")).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toContainText("*ContactName");
  await page.getByRole("button", { name: "Check the customers" }).click();

  await expect(page.getByTestId("import-summary")).toHaveText("2 customers are ready to add, 2 left out.");
  await expect(page.getByTestId("import-row-problem").filter({ hasText: "No name" })).toHaveCount(1);
  await expect(page.getByTestId("import-row-problem").filter({ hasText: "Same name as row 1" })).toHaveCount(1);
  await expect(page.getByTestId("import-row").filter({ hasText: "Pieter van Wyk" })).toContainText("Left out, as it could not be read: the email address, the province, the postal code.");

  await page.getByRole("button", { name: "Add 2 customers" }).click();
  await expect(page).toHaveURL(/\/app\/customers\?imported=2/);
  await expect(page.getByTestId("customers-imported")).toHaveText("Added 2 customers.");
  await expect(page.getByTestId("customer-count")).toHaveText("2 customers");
  await expect(page.getByText("Lindiwe Dlamini")).toBeVisible();

  // Importing the same list again adds nothing twice.
  await page.getByTestId("import-link").click();
  await page.getByLabel("Your list").fill("Name,Email\nLindiwe Dlamini,x@example.test\nSipho Mokoena,sipho@example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Check the customers" }).click();
  await expect(page.getByTestId("import-summary")).toHaveText("1 customer is ready to add, 1 left out.");
  await expect(page.getByTestId("import-row-problem")).toContainText("already have a customer with this name");
});
