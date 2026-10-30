import { expect, test, type Page } from "@playwright/test";
import { openMore } from "./helpers";
import { issuedInvoice } from "./invoice-helpers";

/** A customer's page in sections (docs/plans/customer-page.md). */

const rand = (whole: string, cents = "00") => new RegExp(`R\\s?${whole.replace(/ /g, "\\s?")},${cents}`);
const switchOf = (page: Page) => page.getByRole("navigation", { name: /details, quotes, jobs or invoices/ });

async function openCustomer(page: Page, name: string) {
  await openMore(page);
  await page.getByRole("link", { name: /^Customers/ }).click();
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

test("a customer's page says what they owe and lists their quotes, jobs and invoices", async ({ page }) => {
  test.setTimeout(300_000);
  await issuedInvoice(page, "customer-page", { name: "Cupcakes", quantity: "10", price: "250" });

  // Make a job from the accepted quote, so the customer has one of each.
  await page.getByRole("link", { name: "quote QT-0001", exact: true }).click();
  await page.getByRole("button", { name: "Create a job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);

  await openCustomer(page, "Thandi Nkosi");
  const customerUrl = page.url();

  // The top: what they owe, what is waiting, what is being made.
  await expect(page.getByTestId("customer-owing")).toContainText(rand("2 500"));
  // (A count of nothing is left out.)
  await expect(page.getByTestId("customer-open-quotes")).toHaveCount(0);
  await expect(page.getByTestId("customer-jobs-in-progress")).toHaveText("1");
  await expect(page.getByRole("link", { name: "Statement of account" })).toBeVisible();

  // Details come first and it opens on them; each other section lists its rows, which open the document.
  await expect(switchOf(page).getByRole("link").first()).toHaveText("Details");
  await expect(switchOf(page).getByRole("link", { name: "Details" })).toHaveAttribute("aria-current", "page");
  await switchOf(page).getByRole("link", { name: "Quotes" }).click();
  await expect(page).toHaveURL(/section=quotes$/);
  await expect(page.getByRole("link", { name: /QT-0001/ })).toBeVisible();
  await switchOf(page).getByRole("link", { name: "Jobs" }).click();
  await expect(page).toHaveURL(/section=jobs$/);
  await expect(page.getByRole("link", { name: /J-0001/ })).toContainText("Cupcakes");
  await switchOf(page).getByRole("link", { name: "Invoices" }).click();
  const invoice = page.getByRole("link", { name: /INV-0001/ });
  await expect(invoice).toContainText(rand("2 500"));
  await expect(invoice).toContainText("Unpaid");
  await invoice.click();
  await expect(page.getByRole("heading", { name: /^Invoice INV-0001/, level: 1 })).toBeVisible();

  // The owing figure leads to their invoices.
  await page.goto(customerUrl);
  await page.getByTestId("customer-owing").getByRole("link").click();
  await expect(page).toHaveURL(/section=invoices$/);
  await expect(page.getByRole("link", { name: /INV-0001/ })).toBeVisible();

  // A quote or a job started from here has the customer chosen already.
  await page.goto(`${customerUrl}`);
  await page.getByRole("link", { name: "New quote" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/new\?customer=/);
  await expect(page.getByTestId("selected-customer")).toHaveText("Thandi Nkosi");
  await page.goto(`${customerUrl}?section=jobs`);
  await page.getByRole("link", { name: "New job" }).click();
  await expect(page.getByTestId("selected-customer")).toHaveText("Thandi Nkosi");
  // A made-up customer in the address chooses nobody.
  await page.goto("/app/jobs/new?customer=00000000-0000-0000-0000-000000000000");
  await expect(page.getByTestId("selected-customer")).toHaveCount(0);
});

test("a customer with nothing yet has plain empty sections, and Details still saves", async ({ page }) => {
  test.setTimeout(120_000);
  await issuedInvoice(page, "customer-page-empty", { name: "Cupcakes", quantity: "1", price: "100" });
  // A second customer, added on its own, has no history.
  await page.goto("/app/customers/new");
  await page.getByLabel("Name", { exact: true }).fill("Newcomer Dlamini");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByTestId("customer-added")).toBeVisible();
  await page.getByRole("link", { name: /Newcomer Dlamini/ }).click();

  await expect(page.getByTestId("customer-overview")).toHaveText("Nothing owing, waiting or being made.");
  await switchOf(page).getByRole("link", { name: "Quotes" }).click();
  await expect(page.getByText("No quotes yet")).toBeVisible();
  await switchOf(page).getByRole("link", { name: "Jobs" }).click();
  await expect(page.getByText("No jobs yet")).toBeVisible();
  await switchOf(page).getByRole("link", { name: "Invoices" }).click();
  await expect(page.getByText("No invoices yet")).toBeVisible();

  await switchOf(page).getByRole("link", { name: "Details" }).click();
  await page.getByLabel("Phone", { exact: true }).fill("021 555 0101");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page).toHaveURL(/section=details$/);
  // The number is a tap-to-call link at the top.
  await expect(page.getByRole("link", { name: "021 555 0101" })).toHaveAttribute("href", "tel:0215550101");
});
