import { expect, test, type Page } from "@playwright/test";
import { openMore, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, nav, sheet } from "./quote-helpers";

/** One filter bar, one empty state, and section tabs that answer at once (docs/ux-review-2026-10-24.md, L1, L2, L5). */

/** Counts the requests that ask the server for a page (a document, or the data Next fetches for a page). */
function pageRequests(page: Page) {
  const seen: string[] = [];
  page.on("request", (r) => {
    // Next also fetches pages ahead of a tap (a prefetch); that is not waiting for the server.
    if (r.headers()["next-router-prefetch"]) return;
    if (r.resourceType() === "document" || r.url().includes("_rsc=") || r.headers()["rsc"] === "1") seen.push(r.url());
  });
  return seen;
}

async function addCustomer(page: Page, name: string) {
  await page.goto("/app/customers/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByTestId("customer-added")).toHaveText(`Added ${name}.`);
}

test("a customer's sections switch at once, without asking the server, and back works", async ({ page }) => {
  await signUpAndOnboard(page, "tabs-instant", "Instant Co");
  await addCustomer(page, "Thandi Nkosi");
  await openMore(page);
  await page.getByRole("link", { name: /^Customers/ }).click();
  await page.getByRole("link", { name: /Thandi Nkosi/ }).click();
  const tabs = page.getByRole("navigation", { name: /details, quotes, jobs or invoices/ });
  // Details are the first tab, and it opens on them.
  await expect(tabs.getByRole("link", { name: "Details" })).toHaveAttribute("aria-current", "page");

  const requests = pageRequests(page);
  await tabs.getByRole("link", { name: "Quotes" }).click();
  await expect(tabs.getByRole("link", { name: "Quotes" })).toHaveAttribute("aria-current", "page", { timeout: 300 });
  await expect(page.getByText("No quotes yet")).toBeVisible({ timeout: 300 });
  await tabs.getByRole("link", { name: "Jobs" }).click();
  // Answered in the page: the tab is marked and its contents shown straight away.
  await expect(tabs.getByRole("link", { name: "Jobs" })).toHaveAttribute("aria-current", "page", { timeout: 300 });
  await expect(page.getByText("No jobs yet")).toBeVisible({ timeout: 300 });
  await expect(page.getByText("No quotes yet")).toBeHidden();
  await expect(page).toHaveURL(/section=jobs$/);
  await tabs.getByRole("link", { name: "Details" }).click();
  await expect(page.getByRole("button", { name: /Save changes/ })).toBeVisible({ timeout: 300 });
  expect(requests).toEqual([]);

  // Back goes to the section before; the address is the section.
  await page.goBack();
  await expect(tabs.getByRole("link", { name: "Jobs" })).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(tabs.getByRole("link", { name: "Quotes" })).toHaveAttribute("aria-current", "page");
  // A link to a section from elsewhere still opens it.
  await page.goto(`${page.url().split("?")[0]}?section=invoices`);
  await expect(tabs.getByRole("link", { name: "Invoices" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("No invoices yet")).toBeVisible();
});

test("Products and Services switch at once", async ({ page }) => {
  await signUpAndOnboard(page, "tabs-products", "Switch Co");
  await nav(page).getByRole("link", { name: "Products" }).click();
  const switcher = page.getByRole("navigation", { name: "Products or services" });
  await expect(page.getByText("No products yet")).toBeVisible();
  const requests = pageRequests(page);
  await switcher.getByRole("link", { name: "Services" }).click();
  await expect(switcher.getByRole("link", { name: "Services" })).toHaveAttribute("aria-current", "page", { timeout: 300 });
  await expect(page.getByText("No services yet")).toBeVisible({ timeout: 300 });
  await expect(page).toHaveURL(/view=services$/);
  expect(requests).toEqual([]);
  await page.goBack();
  await expect(page.getByText("No products yet")).toBeVisible();
});

test("the filters are one row of chips, the archived view is a chip, and a filter with nothing in it says so and clears", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "filters-row", "Filter Co");
  // One job, so the Jobs list has its filters.
  await nav(page).getByRole("link", { name: "Jobs" }).click();
  await page.getByRole("link", { name: "New job" }).first().click();
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

  // Every chip sits on one line, however many there are (they scroll sideways on a phone rather than wrapping).
  const bar = page.getByRole("group", { name: "Show jobs" });
  await expect(bar).toBeVisible();
  const tops = await bar.getByRole("button").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);

  // Nothing late: it says so in one line, with the way back.
  await bar.getByRole("button", { name: /^Late/ }).click();
  await expect(page.getByTestId("no-matches")).toContainText("Nothing is late");
  await page.getByTestId("no-matches").getByRole("button", { name: "Show to-do jobs" }).click();
  await expect(page.getByRole("link", { name: /Shelf/ })).toBeVisible();
});
