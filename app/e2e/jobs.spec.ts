import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, nav, sentQuote } from "./quote-helpers";

const sheet = (page: Page) => page.getByRole("dialog");

/** Records that the customer accepted the quote that is open. */
async function accept(page: Page) {
  await page.getByRole("button", { name: "They accepted" }).click();
  await sheet(page).getByLabel("How they told you").selectOption("whatsapp");
  await sheet(page).getByRole("button", { name: "Save answer" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Accepted$/, level: 1 })).toBeVisible();
}

test("an accepted quote becomes a job, which moves along one tap at a time", async ({ page }) => {
  await signUpAndOnboard(page, "jobs-flow", "Job Co");
  await sentQuote(page);

  // Only an accepted quote can become a job.
  await expect(page.getByRole("button", { name: "Create a job" })).toHaveCount(0);
  await accept(page);

  await page.getByRole("button", { name: "Create a job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /^Job J-0001 Not started$/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("job-items")).toContainText("Wedding cake");
  await expect(page.getByText("Thandi Nkosi")).toBeVisible();
  await expect(page.getByTestId("job-activity")).toContainText("Job created");

  // The quote now points to its job instead of offering to make another.
  await page.getByRole("link", { name: "quote QT-0001" }).click();
  await expect(page.getByRole("button", { name: "Create a job" })).toHaveCount(0);
  // While the job is active the answer is locked.
  await expect(page.getByRole("button", { name: "Change the answer" })).toHaveCount(0);
  await page.getByRole("link", { name: "Open the job" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001/, level: 1 })).toBeVisible();

  // One tap per step, each logged.
  await page.getByRole("button", { name: "Start making" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Making$/, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Mark ready", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Ready$/, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Back to making" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Making$/, level: 1 })).toBeVisible();
  const log = page.getByTestId("job-activity");
  await expect(log.getByRole("listitem")).toHaveCount(4);
  await expect(log).toContainText("Moved to making");

  // A note is saved, and kept.
  await page.getByLabel("Your note").fill("Lemon sponge, no nuts");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Note saved." })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Your note")).toHaveValue("Lemon sponge, no nuts");

  // Finished jobs leave the "To do" list but stay under Done.
  await page.getByRole("button", { name: "Mark ready", exact: true }).click();
  await page.getByRole("button", { name: "Mark done", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Done$/, level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark done", exact: true })).toHaveCount(0);

  await nav(page).getByRole("link", { name: "Jobs" }).click();
  await expect(page.getByRole("heading", { name: "Jobs", level: 1 })).toBeVisible();
  await expect(page.getByText("Nothing to make right now.")).toBeVisible();
  await page.getByRole("button", { name: /^Done/ }).click();
  await expect(page.getByRole("link", { name: /Thandi Nkosi/ })).toContainText("Done");
  await page.getByLabel("Search jobs").fill("nobody");
  await expect(page.getByText("No jobs match “nobody”.")).toBeVisible();
});

test("a cancelled job can be restored, and frees its quote for another job", async ({ page }) => {
  await signUpAndOnboard(page, "jobs-cancel", "Cancel Co");
  await sentQuote(page);
  await accept(page);
  await page.getByRole("button", { name: "Create a job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);

  await page.getByRole("button", { name: "Cancel this job" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Cancelled$/, level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "quote QT-0001" }).click();
  // The cancelled job no longer blocks a new one.
  await expect(page.getByRole("button", { name: "Create a job" })).toBeVisible();
  await page.getByRole("button", { name: "Create a job" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0002 Not started$/, level: 1 })).toBeVisible();

  // The first one can't be restored beside the second.
  await nav(page).getByRole("link", { name: "Jobs" }).click();
  await page.getByRole("button", { name: /^All/ }).click();
  await page.getByRole("link", { name: /J-0001/ }).click();
  await page.getByRole("button", { name: "Restore this job" }).click();
  await expect(page.getByRole("region", { name: "Where it stands" }).getByRole("alert")).toContainText("another job");
});

test("a delivery job goes out for delivery before it is done", async ({ page }) => {
  await signUpAndOnboard(page, "jobs-delivery", "Deliver Co");
  await sentQuoteForDelivery(page);
  await accept(page);
  await page.getByRole("button", { name: "Create a job" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Not started$/, level: 1 })).toBeVisible();
  await expect(page.getByText("14 Oak Road")).toBeVisible();

  await page.getByRole("button", { name: "Start making" }).click();
  await page.getByRole("button", { name: "Mark ready for delivery" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Ready for delivery$/, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Out for delivery" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Out for delivery$/, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Mark delivered and done" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Done$/, level: 1 })).toBeVisible();
});

test("Customers moved behind More and Jobs took the tab", async ({ page }) => {
  await signUpAndOnboard(page, "jobs-nav", "Nav Jobs Co");
  await expect(nav(page).getByRole("link", { name: "Jobs" })).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "Customers" })).toBeHidden();
  await nav(page).getByRole("link", { name: "More" }).click();
  await page.getByRole("link", { name: /^Customers/ }).click();
  await expect(page.getByRole("heading", { name: "Customers", level: 1 })).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "More" })).toHaveAttribute("aria-current", "page");

  // No jobs yet: the empty state says how to make one.
  await nav(page).getByRole("link", { name: "Jobs" }).click();
  await expect(page.getByText("No jobs yet")).toBeVisible();
});

test("a job can be made without a quote", async ({ page }) => {
  await signUpAndOnboard(page, "jobs-manual", "Manual Co");
  await nav(page).getByRole("link", { name: "Jobs" }).click();
  await expect(page.getByText("No jobs yet")).toBeVisible();
  await page.getByRole("link", { name: "New job" }).click();
  await expect(page.getByRole("heading", { name: "New job", level: 1 })).toBeVisible();

  // Pressing Create with nothing filled in says what is missing, at the fields and in a summary.
  await page.getByRole("button", { name: "Create job" }).click();
  const summary = page.getByTestId("form-summary");
  await expect(summary).toContainText("2 things need fixing");
  await expect(summary).toContainText("Choose who this job is for");
  await expect(summary).toContainText("Say what to make.");
  await expect(page.getByText("Say what to make.")).toHaveCount(2);

  // Fix them; what was typed along the way stays.
  await page.getByLabel("Item 1").fill("Oak shelf");
  await page.getByLabel("Quantity").fill("0");
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(summary).toContainText("The quantity must be more than zero.");
  await expect(page.getByLabel("Item 1")).toHaveValue("Oak shelf");
  await page.getByLabel("Quantity").fill("2");

  await page.getByRole("button", { name: "Add another item" }).click();
  await expect(page.getByLabel("Item 2")).toBeFocused();
  await page.getByLabel("Item 2").fill("Brackets");
  await page.getByLabel("Unit (optional)").nth(1).fill("pair");
  await page.getByLabel("Quantity").nth(1).fill("4");
  await page.getByLabel("Details (optional)").first().fill("120 cm, oiled");

  await addCustomerInSheet(page, "Sam Jacobs", { phone: "021 555 0000" });
  await page.getByLabel("Needed by (optional)").fill("2030-01-15");
  await page.getByRole("radio", { name: "Delivery (you deliver)" }).check();
  await page.getByLabel("Deliver to (optional)").fill("14 Oak Road");
  await page.getByLabel("Note (optional)").fill("Match the desk");
  await page.getByRole("button", { name: "Create job" }).click();

  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /^Job J-0001 Not started$/, level: 1 })).toBeVisible();
  const items = page.getByTestId("job-items");
  await expect(items).toContainText("2 Oak shelf");
  await expect(items).toContainText("120 cm, oiled");
  await expect(items).toContainText("4 pair Brackets");
  await expect(page.getByText("Sam Jacobs")).toBeVisible();
  await expect(page.getByText("14 Oak Road")).toBeVisible();
  await expect(page.getByTestId("job-needed-by")).toContainText("delivery");
  await expect(page.getByLabel("Your note")).toHaveValue("Match the desk");
  await expect(page.getByText("Added by hand, without a quote.")).toBeVisible();

  // It moves along like any other job, and the list offers New job once there is one.
  await page.getByRole("button", { name: "Start making" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Making$/, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Cancel this job" }).click();
  await page.getByRole("button", { name: "Restore this job" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Not started$/, level: 1 })).toBeVisible();
  await nav(page).getByRole("link", { name: "Jobs" }).click();
  await expect(page.getByRole("link", { name: /Sam Jacobs/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "New job" })).toBeVisible();
});

/** A sent quote for delivery, with the address typed on the quote. */
async function sentQuoteForDelivery(page: Page) {
  const { openBusinessProfile } = await import("./helpers");
  const { addCustomerInSheet, fillItem, openQuotes, startSend } = await import("./quote-helpers");
  await openBusinessProfile(page);
  await page.getByLabel("Phone", { exact: true }).fill("011 555 0101");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await openQuotes(page);
  await page.getByRole("link", { name: /Start your first quote|New quote/ }).first().click();
  await fillItem(page, 1, "Wedding cake", "1", "800");
  await addCustomerInSheet(page, "Thandi Nkosi");
  await page.getByRole("radio", { name: "Delivery (you deliver, with a fee)" }).check();
  await page.getByLabel("Deliver to (optional)").fill("14 Oak Road");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  await startSend(page);
  await sheet(page).getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();
}
