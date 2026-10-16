import { devices, expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

async function openCustomers(page: Page) {
  // Customers sit behind "More" on a phone (the Jobs tab took its place).
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "More" }).click();
  await page.getByRole("link", { name: /^Customers/ }).click();
  await expect(page.getByRole("heading", { name: "Customers", level: 1 })).toBeVisible();
}

/** Adds a customer from the list's "Add" screen, with whatever fields are given. */
async function addCustomer(page: Page, name: string, phone?: string) {
  await page.goto("/app/customers/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  if (phone) await page.getByLabel("Phone", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByTestId("customer-added")).toHaveText(`Added ${name}.`);
}

test("the first customer: a name is enough", async ({ page }) => {
  await signUpAndOnboard(page, "cust-first", "Cust Co");
  await openCustomers(page);

  await expect(page.getByText("No customers yet")).toBeVisible();
  await page.getByRole("link", { name: "Add your first customer" }).click();
  await expect(page).toHaveURL(/\/app\/customers\/new$/);

  await page.getByLabel("Name", { exact: true }).fill("Thandi Nkosi");
  await page.getByRole("button", { name: "Add customer" }).click();

  await expect(page).toHaveURL(/\/app\/customers\?added=/);
  await expect(page.getByTestId("customer-added")).toHaveText("Added Thandi Nkosi.");
  await expect(page.getByRole("link", { name: "Thandi Nkosi" })).toBeVisible();
  await expect(page.getByTestId("customer-count")).toHaveText("1 customer");
});

test("a failed save lists what to fix and keeps what you typed", async ({ page }) => {
  await signUpAndOnboard(page, "cust-errors", "Cust Errors Co");
  await page.goto("/app/customers/new");

  await page.getByLabel("Phone", { exact: true }).fill("abc");
  await page.getByLabel("Email", { exact: true }).fill("not-an-email");
  await page.getByRole("button", { name: "Add customer" }).click();

  const summary = page.getByTestId("form-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("3 things need fixing");
  await expect(summary).toBeFocused();
  await expect(page.locator("#name-error")).toContainText("name");
  await expect(page.getByLabel("Phone", { exact: true })).toHaveValue("abc");

  await summary.getByRole("link", { name: "Name" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();

  await page.getByLabel("Name", { exact: true }).fill("Fixed Customer");
  await page.getByLabel("Phone", { exact: true }).fill("021 123 4567");
  await page.getByLabel("Email", { exact: true }).fill("fixed@example.test");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByTestId("customer-added")).toBeVisible();
});

test("a business customer keeps its details, and they persist after editing", async ({ page }) => {
  await signUpAndOnboard(page, "cust-biz", "Biz Co");
  await page.goto("/app/customers/new");

  // Business details only appear once it is a business.
  await expect(page.getByLabel("Contact person")).toHaveCount(0);
  await page.getByLabel("Name", { exact: true }).fill("Cape Cakes");
  await page.getByRole("checkbox", { name: "This is a business" }).check();
  await page.getByLabel("Contact person").fill("Sam Jacobs");
  await page.getByLabel("VAT number").fill("4123456789");
  await page.getByLabel("Company registration number").fill("2020/123456/07");
  await page.getByLabel("Phone", { exact: true }).fill("021 555 0000");
  await page.getByRole("button", { name: "Add address, delivery details or notes" }).click();
  const address = page.getByRole("group", { name: "Address", exact: true });
  await address.getByLabel("Street address").fill("1 Main Road");
  await address.getByLabel("City or town").fill("Cape Town");
  await address.getByLabel("Province").selectOption("Western Cape");
  await address.getByLabel("Postal code").fill("8001");
  // Delivery is the same address by default; a different one has the same fields as the first.
  const delivery = page.getByRole("group", { name: "Delivery" });
  await expect(delivery.getByRole("checkbox", { name: "Same as the address above" })).toBeChecked();
  await expect(delivery.getByLabel("Street address")).toHaveCount(0);
  await delivery.getByRole("checkbox", { name: "Same as the address above" }).uncheck();
  await delivery.getByLabel("Street address").fill("Dock 4");
  await delivery.getByLabel("City or town").fill("Durban");
  await delivery.getByLabel("Province").selectOption("KwaZulu-Natal");
  await delivery.getByLabel("Postal code").fill("4001");
  await page.getByLabel("Anything to remember (optional)").fill("Pays on 30 days");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByTestId("customer-added")).toBeVisible();

  // The list shows what matters; the customer page has everything.
  await expect(page.getByRole("link", { name: /Cape Cakes/ })).toContainText("Business");
  await page.getByRole("link", { name: /Cape Cakes/ }).click();
  await expect(page.getByRole("heading", { name: "Cape Cakes", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Contact person")).toHaveValue("Sam Jacobs");
  await expect(page.getByLabel("VAT number")).toHaveValue("4123456789");
  const saved = page.getByRole("group", { name: "Address", exact: true });
  await expect(saved.getByLabel("Province")).toHaveValue("Western Cape");
  const savedDelivery = page.getByRole("group", { name: "Delivery" });
  await expect(savedDelivery.getByRole("checkbox", { name: "Same as the address above" })).not.toBeChecked();
  await expect(savedDelivery.getByLabel("Street address")).toHaveValue("Dock 4");
  await expect(savedDelivery.getByLabel("Province")).toHaveValue("KwaZulu-Natal");

  await page.getByLabel("Phone", { exact: true }).fill("021 555 9999");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Phone", { exact: true })).toHaveValue("021 555 9999");
  await expect(page.getByLabel("Anything to remember (optional)")).toHaveValue("Pays on 30 days");

  // Turning "business" off drops the business-only details.
  await page.getByRole("checkbox", { name: "This is a business" }).uncheck();
  await expect(page.getByLabel("Contact person")).toHaveCount(0);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "This is a business" })).not.toBeChecked();
  await page.getByRole("checkbox", { name: "This is a business" }).check();
  await expect(page.getByLabel("VAT number")).toHaveValue("");
});

test("adding someone who looks like an existing customer warns, then lets you go on", async ({ page }) => {
  await signUpAndOnboard(page, "cust-dup", "Dup Co");
  await addCustomer(page, "Thandi", "021 123 4567");

  // Same name, different spacing and case.
  await page.goto("/app/customers/new");
  await page.getByLabel("Name", { exact: true }).fill("  thandi ");
  await page.getByRole("button", { name: "Add customer" }).click();
  const warning = page.getByTestId("duplicate-warning");
  await expect(warning).toContainText("You may already have this customer");
  await expect(warning.getByRole("link", { name: "Thandi" })).toBeVisible();
  await expect(page).toHaveURL(/\/customers\/new$/);

  // Changing a detail withdraws the warning; going on anyway adds them.
  await page.getByRole("button", { name: "Add anyway" }).click();
  await expect(page.getByTestId("customer-added")).toBeVisible();
  await expect(page.getByTestId("customer-count")).toHaveText("2 customers");

  // Same phone number written differently.
  await page.goto("/app/customers/new");
  await page.getByLabel("Name", { exact: true }).fill("Someone Else");
  await page.getByLabel("Phone", { exact: true }).fill("(021) 123-4567");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByTestId("duplicate-warning")).toBeVisible();
  // Editing the name clears the warning, so the next click checks again.
  await page.getByLabel("Phone", { exact: true }).fill("011 000 1111");
  await expect(page.getByTestId("duplicate-warning")).toHaveCount(0);
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByTestId("customer-added")).toHaveText("Added Someone Else.");
});

test("search, archive and restore", async ({ page }) => {
  await signUpAndOnboard(page, "cust-arch", "Arch Co");
  await addCustomer(page, "Alice Baker", "021 111 1111");
  await addCustomer(page, "Bongani Dube", "082 222 2222");
  await addCustomer(page, "Carla Smit");
  await expect(page.getByTestId("customer-count")).toHaveText("3 customers");

  // Search by name and by phone digits.
  await page.getByLabel("Search customers").fill("bong");
  await expect(page.getByTestId("customer-count")).toHaveText("1 customer");
  await expect(page.getByRole("link", { name: /Bongani Dube/ })).toBeVisible();
  await page.getByLabel("Search customers").fill("0211111");
  await expect(page.getByRole("link", { name: /Alice Baker/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Carla Smit/ })).toHaveCount(0);
  await page.getByLabel("Search customers").fill("zzz");
  await expect(page.getByText("No customers match")).toBeVisible();
  await page.getByLabel("Search customers").fill("");

  // Archive hides from the list; it can be shown and restored.
  await page.getByRole("link", { name: /Carla Smit/ }).click();
  await page.getByRole("button", { name: "Archive customer" }).click();
  await expect(page).toHaveURL(/\/app\/customers$/);
  await expect(page.getByRole("link", { name: /Carla Smit/ })).toHaveCount(0);
  await expect(page.getByTestId("customer-count")).toHaveText("2 customers");

  await page.getByRole("checkbox", { name: /Show archived \(1\)/ }).check();
  await expect(page.getByRole("link", { name: /Carla Smit/ })).toContainText("Archived");
  await page.getByRole("link", { name: /Carla Smit/ }).click();
  await expect(page.getByTestId("archived-notice")).toBeVisible();
  await page.getByRole("button", { name: "Restore customer" }).click();
  await expect(page.getByTestId("archived-notice")).toHaveCount(0);

  await openCustomers(page);
  await expect(page.getByRole("link", { name: /Carla Smit/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Show archived/ })).toHaveCount(0);
});

test("each business only ever sees its own customers", async ({ page, browser }) => {
  await signUpAndOnboard(page, "cust-a", "Business A");
  await addCustomer(page, "A's Customer");
  await page.getByRole("link", { name: "A's Customer" }).click();
  await expect(page).toHaveURL(/\/app\/customers\/[0-9a-f-]{36}$/);
  const customerUrl = page.url();

  const other = await browser.newContext({ ...devices["Pixel 7"] });
  const pageB = await other.newPage();
  await signUpAndOnboard(pageB, "cust-b", "Business B");
  await openCustomers(pageB);
  await expect(pageB.getByText("No customers yet")).toBeVisible();

  // A direct link to A's customer shows B a not-found page, never A's data.
  await pageB.goto(customerUrl);
  await expect(pageB.getByText("This page could not be found")).toBeVisible();
  await expect(pageB.getByText("A's Customer")).toHaveCount(0);
  await other.close();
});

test("a customer id that is not an id is a plain not-found page", async ({ page }) => {
  await signUpAndOnboard(page, "cust-404", "Nf Co");
  await page.goto("/app/customers/not-an-id");
  await expect(page.getByText("This page could not be found")).toBeVisible();
});

test("a separate delivery address must be filled in, and ticking 'same as above' again takes it away", async ({ page }) => {
  await signUpAndOnboard(page, "cust-deliv", "Deliveries Co");
  await page.goto("/app/customers/new");
  await page.getByLabel("Name", { exact: true }).fill("Thandi Nkosi");
  await page.getByRole("button", { name: "Add address, delivery details or notes" }).click();
  const delivery = page.getByRole("group", { name: "Delivery" });
  await delivery.getByRole("checkbox", { name: "Same as the address above" }).uncheck();

  // Nothing typed: it says how to fix it, at the field and in the summary.
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByTestId("form-summary")).toBeVisible();
  await expect(delivery.getByText(/Enter the delivery address, or tick/)).toBeVisible();

  // Typing clears it; it saves, and the customer page shows it.
  await delivery.getByLabel("Street address").fill("4 Dock Road");
  await expect(delivery.getByText(/Enter the delivery address, or tick/)).toHaveCount(0);
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByTestId("customer-added")).toBeVisible();
  await page.getByRole("link", { name: /Thandi Nkosi/ }).click();
  const saved = page.getByRole("group", { name: "Delivery" });
  await expect(saved.getByRole("checkbox", { name: "Same as the address above" })).not.toBeChecked();
  await expect(saved.getByLabel("Street address")).toHaveValue("4 Dock Road");

  // Same as above again: the separate address is gone, not just hidden.
  await saved.getByRole("checkbox", { name: "Same as the address above" }).check();
  await expect(saved.getByLabel("Street address")).toHaveCount(0);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("group", { name: "Delivery" }).getByRole("checkbox", { name: "Same as the address above" })).toBeChecked();
});
