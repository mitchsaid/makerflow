import { expect, test, type Page } from "@playwright/test";
import { acceptedQuote, issueFromQuoteSheet } from "./invoice-helpers";
import { sheet } from "./quote-helpers";

/** The prompt to invoice a finished job (docs/plans/invoice-i3.md, slice I3a). */

async function finishedJob(page: Page, label: string) {
  await acceptedQuote(page, label, { name: "Cupcakes", quantity: "10", price: "250" });
  await page.getByRole("button", { name: "Create a job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);
  // Nothing to invoice yet while it is being made.
  await expect(page.getByTestId("invoice-job-nudge")).toHaveCount(0);
  await page.getByRole("button", { name: "Start making" }).click();
  await page.getByRole("button", { name: "Mark ready", exact: true }).click();
  await expect(page.getByTestId("invoice-job-nudge")).toHaveCount(0);
  await page.getByRole("button", { name: "Mark done", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Done$/, level: 1 })).toBeVisible();
}

test("a finished job offers to invoice its quote, and the invoice is then shown on the job", async ({ page }) => {
  test.setTimeout(300_000);
  await finishedJob(page, "job-invoice");
  const jobUrl = page.url();

  const card = page.getByTestId("invoice-job-nudge");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Invoice this job?");
  await expect(card).toContainText("QT-0001");

  // Create invoice opens the quote with its own sheet ready; issuing makes the invoice.
  await card.getByRole("link", { name: "Create invoice" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?next=invoice$/);
  await expect(sheet(page).getByRole("button", { name: "Continue to preview" })).toBeVisible();
  await issueFromQuoteSheet(page);
  await expect(page.getByRole("heading", { name: /^Invoice INV-0001/, level: 1 })).toBeVisible();

  // The job now says it is invoiced, and no longer asks.
  await page.goto(jobUrl);
  await expect(page.getByTestId("invoice-job-nudge")).toHaveCount(0);
  await expect(page.getByText("Invoiced:")).toBeVisible();
  await page.getByRole("link", { name: "INV-0001", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Invoice INV-0001/, level: 1 })).toBeVisible();
});

test("Not now closes the card for the visit, Don't ask me again for good, and the plain button stays", async ({ page }) => {
  test.setTimeout(300_000);
  await finishedJob(page, "job-invoice-no");
  const jobUrl = page.url();

  // Not now: gone for this visit, the plain Invoice section is there instead, and the card is back next visit.
  await page.getByTestId("invoice-job-nudge").getByRole("button", { name: "Not now" }).click();
  await expect(page.getByTestId("invoice-job-nudge")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Create invoice" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("invoice-job-nudge")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create invoice" })).toHaveCount(1);

  // Don't ask me again: gone for good, but the job still has its Create invoice.
  // The card closes at once and the choice is saved in the background: wait for the save before leaving the page.
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.url() === jobUrl);
  await page.getByTestId("invoice-job-nudge").getByRole("button", { name: "Don't ask me again" }).click();
  await expect(page.getByTestId("invoice-job-nudge")).toHaveCount(0);
  await saved;
  await page.goto(jobUrl);
  await expect(page.getByTestId("invoice-job-nudge")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Create invoice" })).toBeVisible();
});

test("a finished job made by hand has no quote, and offers to start an invoice instead", async ({ page }) => {
  test.setTimeout(240_000);
  await acceptedQuote(page, "job-invoice-hand", { name: "Cupcakes", quantity: "1", price: "100" });
  // A second job, made by hand for the same customer, with a one-off item.
  await page.goto("/app/jobs/new");
  await page.getByLabel("Customer name", { exact: true }).fill("Thandi");
  await page.getByRole("option", { name: /Thandi Nkosi/ }).click();
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: "One-off item (just for this job)" }).click();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Brackets");
  await sheet(page).getByLabel("Quantity").fill("4");
  await sheet(page).getByRole("button", { name: "Add to job" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Start making" }).click();
  await page.getByRole("button", { name: "Mark ready", exact: true }).click();
  await page.getByRole("button", { name: "Mark done", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Done$/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("invoice-job-nudge")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start an invoice" })).toBeVisible();
});
