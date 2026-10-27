import { expect, test, type Page } from "@playwright/test";
import { legacyCancelJob, openHistory, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, nav, sentQuote } from "./quote-helpers";

const sheet = (page: Page) => page.getByRole("dialog");

/** The All filter on the Jobs list. (A tap before the list wakes up does nothing: tap until it is chosen.) */
async function showAll(page: Page) {
  const all = page.getByRole("button", { name: /^All/ });
  await expect(async () => {
    await all.click();
    await expect(all).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass();
}

/** The Cancelled filter on the Jobs list (the chip is only there while something is cancelled). */
async function showCancelled(page: Page) {
  const chip = page.getByRole("button", { name: /^Cancelled/ });
  await expect(async () => {
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass();
}

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
  await openHistory(page);
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
  // The status is a dropdown: any status can be chosen, not only the next.
  await page.getByLabel("Status", { exact: true }).selectOption("in_progress");
  await expect(page.getByRole("heading", { name: /^Job J-0001 Making$/, level: 1 })).toBeVisible();
  await openHistory(page);
  const log = page.getByTestId("job-activity");
  await expect(log.getByRole("listitem")).toHaveCount(4);
  await expect(log).toContainText("Moved to making");

  // A note saves itself (no Save button), and is kept.
  await expect(page.getByRole("button", { name: "Save note" })).toHaveCount(0);
  await page.getByLabel("Note (optional)").fill("Lemon sponge, no nuts");
  await expect(page.getByRole("status").filter({ hasText: "Note saved." })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Note (optional)")).toHaveValue("Lemon sponge, no nuts");

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

test("a job cancelled before cancelling went can be restored or deleted, has its own chip, and does not block a new job", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "jobs-cancel", "Cancel Co");
  await sentQuote(page);
  await accept(page);
  await page.getByRole("button", { name: "Create a job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);
  // Nothing in the app cancels a job any more: the page offers a status and Delete, not Cancel.
  await expect(page.getByRole("button", { name: "Cancel this job" })).toHaveCount(0);
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("not_started");
  const jobId = page.url().split("/").pop() ?? "";
  await legacyCancelJob(jobId);

  // All leaves cancelled jobs out; they have a chip of their own.
  await nav(page).getByRole("link", { name: "Jobs" }).click();
  await showAll(page);
  await expect(page.getByRole("link", { name: /J-0001/ })).toHaveCount(0);
  await showCancelled(page);
  await page.getByRole("link", { name: /J-0001/ }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Cancelled$/, level: 1 })).toBeVisible();
  await expect(page.getByText("This job was cancelled, so nothing is counted on it.")).toBeVisible();
  // A cancelled job has Restore (no status choice), and Delete at the foot.
  await expect(page.getByLabel("Status", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Restore this job" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete this job" })).toBeVisible();
  await openHistory(page);
  await page.getByRole("link", { name: "quote QT-0001" }).click();
  // The cancelled job does not block a new one.
  await expect(page.getByRole("button", { name: "Create a job" })).toBeVisible();
  await page.getByRole("button", { name: "Create a job" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0002 Not started$/, level: 1 })).toBeVisible();

  // The first one can't be restored beside the second.
  await nav(page).getByRole("link", { name: "Jobs" }).click();
  await showCancelled(page);
  await page.getByRole("link", { name: /J-0001/ }).click();
  await page.getByRole("button", { name: "Restore this job" }).click();
  await expect(page.getByRole("region", { name: "Cancelled" }).getByRole("alert")).toContainText("another job");

  // It can be deleted, and the other job is untouched.
  await page.getByRole("button", { name: "Delete this job" }).click();
  await sheet(page).getByRole("button", { name: "Delete the job" }).click();
  await expect(page.getByTestId("job-deleted-notice")).toContainText("Job J-0001 deleted.");
  await expect(page.getByRole("link", { name: /J-0002/ })).toBeVisible();
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

test("a job can be made without a quote, adding items the way a quote does", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "jobs-manual", "Manual Co");

  // A product with sizes, to pick like on a quote.
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");
  await page.getByRole("radio", { name: /^Yes/ }).click();
  await page.getByLabel("Variation name", { exact: true }).fill("Size");
  for (const [i, [name, price]] of [["Small", "300"], ["Large", "600"]].entries()) {
    const row = page.getByRole("listitem").filter({ has: page.getByRole("textbox", { name: `Size ${i + 1}`, exact: true }) });
    await row.getByLabel(`Size ${i + 1}`, { exact: true }).fill(name);
    await row.getByLabel(`Size ${i + 1} price`, { exact: true }).fill(price);
  }
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();

  await nav(page).getByRole("link", { name: "Jobs" }).click();
  await expect(page.getByText("No jobs yet")).toBeVisible();
  await page.getByRole("link", { name: "New job" }).click();
  await expect(page.getByRole("heading", { name: "New job", level: 1 })).toBeVisible();

  // Pressing Create with nothing filled in says what is missing, at the fields and in a summary.
  await page.getByRole("button", { name: "Create job" }).click();
  const summary = page.getByTestId("form-summary");
  await expect(summary).toContainText("2 things need fixing");
  await expect(summary).toContainText("Choose who this job is for");
  await expect(summary).toContainText("Add at least one item to make.");

  // Items come from the same sheet as a quote's: your products and services, or a one-off item. No prices.
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Add an item");
  await expect(sheet(page).getByTestId("coming-soon")).toContainText("Import from Shopify or a CSV");
  await expect(sheet(page).getByRole("button", { name: /Wedding cake/ })).not.toContainText("R");
  await sheet(page).getByRole("button", { name: /Wedding cake/ }).click();
  await expect(sheet(page)).toHaveAccessibleName("Add Wedding cake");
  await expect(sheet(page).getByLabel(/^Price/)).toHaveCount(0);
  await expect(sheet(page).getByRole("button", { name: "Add a discount" })).toHaveCount(0);
  const size = sheet(page).getByRole("group", { name: "Choose a size" });
  await expect(size).not.toContainText("R");
  // The product has no usual size, so one must be chosen, as on a quote; a quantity of zero is refused too.
  await sheet(page).getByLabel("Quantity").fill("0");
  await sheet(page).getByRole("button", { name: "Add to job" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toContainText("Choose a size.");
  await expect(sheet(page).getByTestId("form-summary")).toContainText("The quantity must be more than zero.");
  await size.getByRole("radio", { name: /Large/ }).check();
  await sheet(page).getByLabel("Quantity").fill("2");
  await sheet(page).getByLabel("Description (optional)").fill("120 cm, oiled");
  await sheet(page).getByRole("button", { name: "Add to job" }).click();
  await expect(sheet(page)).toHaveCount(0);
  const rows = page.getByTestId("job-form-item");
  await expect(rows.nth(0)).toContainText("Wedding cake");
  await expect(rows.nth(0)).toContainText("2 · Large");
  await expect(rows.nth(0)).not.toContainText("one-off");

  // A one-off item.
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: "One-off item (just for this job)" }).click();
  await expect(sheet(page)).toHaveAccessibleName("One-off item");
  await sheet(page).getByLabel("Name", { exact: true }).fill("Brackets");
  await sheet(page).getByLabel("Quantity").fill("4");
  await sheet(page).getByLabel("Unit (optional)").fill("pair");
  await sheet(page).getByRole("button", { name: "Add to job" }).click();
  await expect(rows.nth(1)).toContainText("Brackets");
  await expect(rows.nth(1)).toContainText("4 pair");
  await expect(rows.nth(1)).toContainText("one-off item");

  // An item is changed, and taken off after being asked.
  await rows.nth(1).getByRole("button", { name: /Edit/ }).click();
  await expect(sheet(page)).toHaveAccessibleName("Edit item");
  await sheet(page).getByLabel("Quantity").fill("6");
  await sheet(page).getByRole("button", { name: "Save item" }).click();
  await expect(rows.nth(1)).toContainText("6 pair");
  await rows.nth(1).getByRole("button", { name: /Edit/ }).click();
  await sheet(page).getByRole("button", { name: "Remove this item" }).click();
  await expect(sheet(page).getByRole("alertdialog", { name: "Remove this item?" })).toContainText("off the job");
  await sheet(page).getByRole("button", { name: "Yes, remove it" }).click();
  await expect(rows).toHaveCount(1);
  await expect(sheet(page)).toHaveCount(0);

  await addCustomerInSheet(page, "Sam Jacobs", { phone: "021 555 0000" });
  await page.getByLabel("Needed by (optional)").fill("2030-01-15");
  await page.getByRole("radio", { name: "Delivery (you deliver)" }).check();
  await page.getByTestId("delivery-address-fields").getByLabel("Street address").fill("14 Oak Road");
  await page.getByLabel("Note (optional)").fill("Match the desk");
  await page.getByRole("button", { name: "Create job" }).click();

  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /^Job J-0001 Not started$/, level: 1 })).toBeVisible();
  const items = page.getByTestId("job-items");
  await expect(items).toContainText("2 Wedding cake");
  await expect(items).toContainText("Size: Large");
  await expect(items).toContainText("120 cm, oiled");
  await expect(page.getByText("Sam Jacobs")).toBeVisible();
  await expect(page.getByText("14 Oak Road")).toBeVisible();
  await expect(page.getByTestId("job-needed-by")).toContainText("delivery");
  await expect(page.getByLabel("Note (optional)")).toHaveValue("Match the desk");
  // Where it came from is in History, closed until asked for.
  await expect(page.getByText("Added by hand.")).toBeHidden();
  await openHistory(page);
  await expect(page.getByText("Added by hand.")).toBeVisible();

  // It moves along like any other job, and the list offers New job once there is one.
  await page.getByRole("button", { name: "Start making" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Making$/, level: 1 })).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("not_started");
  await expect(page.getByRole("heading", { name: /^Job J-0001 Not started$/, level: 1 })).toBeVisible();
  await nav(page).getByRole("link", { name: "Jobs" }).click();
  await expect(page.getByRole("link", { name: /Sam Jacobs/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "New job" })).toBeVisible();
});

/** Makes a job by hand with these one-off items (name, quantity, unit) and opens it. */
async function jobWithItems(page: Page, items: [string, string, string][], customer = "Sam Jacobs") {
  await nav(page).getByRole("link", { name: "Jobs" }).click();
  await page.getByRole("link", { name: "New job" }).click();
  await expect(page.getByRole("heading", { name: "New job", level: 1 })).toBeVisible();
  for (const [name, quantity, unit] of items) {
    await page.getByRole("button", { name: "Add item" }).click();
    await sheet(page).getByRole("button", { name: "One-off item (just for this job)" }).click();
    await sheet(page).getByLabel("Name", { exact: true }).fill(name);
    await sheet(page).getByLabel("Quantity").fill(quantity);
    if (unit) await sheet(page).getByLabel("Unit (optional)").fill(unit);
    await sheet(page).getByRole("button", { name: "Add to job" }).click();
    await expect(sheet(page)).toHaveCount(0);
  }
  await addCustomerInSheet(page, customer);
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);
}

test("counting what is made starts the job, and offers the next step when everything is made", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "jobs-progress", "Progress Co");
  await jobWithItems(page, [["Shelf", "2", ""], ["Brackets", "4", "pair"]]);
  await expect(page.getByRole("heading", { name: /^Job J-0001 Not started$/, level: 1 })).toBeVisible();
  const progress = page.getByTestId("job-progress");
  await expect(progress).toContainText("0 of 2 items made");
  const shelf = page.getByTestId("item-progress").nth(0);
  const brackets = page.getByTestId("item-progress").nth(1);
  await expect(shelf).toContainText("Made 0 of 2");
  await expect(brackets).toContainText("Made 0 of 4 pair");
  await expect(page.getByTestId("all-made-prompt")).toHaveCount(0);

  // The first unit made starts the job; the count shows at once and is kept.
  await shelf.getByRole("button", { name: "One more made of Shelf" }).click();
  await expect(shelf).toContainText("Made 1 of 2");
  await expect(page.getByRole("heading", { name: /^Job J-0001 Making$/, level: 1 })).toBeVisible();
  await openHistory(page);
  await expect(page.getByTestId("job-activity")).toContainText("Moved to making");
  await shelf.getByRole("button", { name: "One more made of Shelf" }).click();
  await expect(progress).toContainText("1 of 2 items made");
  await expect(shelf).toContainText("All made");
  await expect(shelf.getByRole("button", { name: "One more made of Shelf" })).toBeDisabled();

  // A number can be typed; too many is refused with what to type, and the count stays.
  const typed = brackets.getByLabel("How many of Brackets are made");
  await typed.fill("9");
  await typed.press("Enter");
  await expect(brackets.getByRole("alert")).toContainText("more than the 4 ordered");
  await expect(brackets).toContainText("Made 0 of 4 pair");
  await typed.fill("3");
  await typed.press("Enter");
  await expect(brackets).toContainText("Made 3 of 4 pair");
  // (The count shows at once; wait for it to be saved before leaving the page.)
  await expect(brackets).not.toContainText("Saving");
  await page.reload();
  await expect(page.getByTestId("item-progress").nth(1)).toContainText("Made 3 of 4 pair");

  // Everything made: the page offers the next step, but nothing moves by itself.
  await page.getByTestId("item-progress").nth(1).getByRole("button", { name: /All made for Brackets/ }).click();
  await expect(page.getByTestId("job-progress")).toContainText("All 2 items made");
  await expect(page.getByTestId("all-made-prompt")).toContainText("Everything is made.");
  await expect(page.getByRole("heading", { name: /^Job J-0001 Making$/, level: 1 })).toBeVisible();

  // From the list: the row shows the progress, and its button takes the same step.
  await nav(page).getByRole("link", { name: "Jobs" }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Sam Jacobs" });
  await expect(row.getByTestId("job-row-progress")).toContainText("All 2 items made");
  await row.getByRole("button", { name: /^Mark ready for J-0001/ }).click();
  await expect(row.getByTestId("job-status-chip")).toHaveText("Ready");
  await expect(row.getByTestId("job-row-progress")).toHaveCount(0);

  // Ready jobs show no counts; stepping back brings them back as they were.
  await row.getByRole("link").click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Ready$/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("item-progress")).toHaveCount(0);
  await page.getByLabel("Status", { exact: true }).selectOption("in_progress");
  await expect(page.getByTestId("item-progress").nth(1)).toContainText("All made");
});

test("an item can be added to a job that exists, the way a quote's items are added", async ({ page }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "jobs-add-item", "Add Item Co");
  await jobWithItems(page, [["Shelf", "2", ""]]);
  await page.getByRole("button", { name: "Start making" }).click();
  await page.getByRole("button", { name: "Mark ready", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Ready$/, level: 1 })).toBeVisible();

  await page.getByRole("link", { name: "Add an item" }).click();
  // (The sheet is open over the page, so the heading is found by its tag.)
  await expect(page.locator("h1")).toHaveText("Add an item to job J-0001");
  // The same sheet as a quote's: pick, or a one-off item. No prices.
  await expect(sheet(page)).toHaveAccessibleName("Add an item");
  await sheet(page).getByRole("button", { name: "One-off item (just for this job)" }).click();
  await expect(sheet(page).getByLabel(/^Price/)).toHaveCount(0);
  // Asking for nothing is refused, at the field and in a summary.
  await sheet(page).getByRole("button", { name: "Add to job" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toContainText("Say what this item is");
  await sheet(page).getByLabel("Name", { exact: true }).fill("Ribbon");
  await sheet(page).getByLabel("Quantity").fill("3");
  await sheet(page).getByLabel("Unit (optional)").fill("m");
  await sheet(page).getByRole("button", { name: "Add to job" }).click();

  // Back on the job, which was ready and now has something to make.
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /^Job J-0001 Making$/, level: 1 })).toBeVisible();
  const items = page.getByTestId("job-items");
  await expect(items).toContainText("3 m Ribbon");
  await expect(items).toContainText("Added later");
  await expect(page.getByTestId("job-progress")).toContainText("0 of 2 items made");
  await openHistory(page);
  await expect(page.getByTestId("job-activity")).toContainText("Added Ribbon");
  await openHistory(page);
  await expect(page.getByTestId("job-activity")).toContainText("Moved to making");

  // The new item is counted like the others.
  await page.getByRole("button", { name: "One more made of Ribbon" }).click();
  await expect(page.getByTestId("item-progress").nth(1)).toContainText("Made 1 of 3 m");

  // A finished job takes no more.
  await page.getByRole("button", { name: "Mark ready", exact: true }).click();
  await page.getByRole("button", { name: "Mark done", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Done$/, level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add an item" })).toHaveCount(0);
  await page.goto(`${new URL(page.url()).pathname}/add-item`);
  await expect(page.getByText("This job has moved on, so it can’t take new items now.")).toBeVisible();
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
  await page.getByTestId("delivery-address-fields").getByLabel("Street address").fill("14 Oak Road");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  await startSend(page);
  await sheet(page).getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();
}

test("any job can be deleted for good, after a question, and its number is free again", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "jobs-delete", "Delete Co");
  await sentQuote(page);
  await accept(page);
  await page.getByRole("button", { name: "Create a job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);
  const jobUrl = page.url();

  // Deleting asks first; keeping the job changes nothing.
  await page.getByRole("button", { name: "Delete this job" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Delete this job?");
  await sheet(page).getByRole("button", { name: "Keep the job" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Not started$/, level: 1 })).toBeVisible();

  // Deleting goes back to the list, says so, and the job is gone from every list and from its address.
  await page.getByRole("button", { name: "Delete this job" }).click();
  await sheet(page).getByRole("button", { name: "Delete the job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\?deleted=1$/);
  await expect(page.getByTestId("job-deleted-notice")).toContainText("Job J-0001 deleted.");
  await expect(page.getByRole("link", { name: /J-0001/ })).toHaveCount(0);
  await page.goto(jobUrl);
  await expect(page.getByText(/404|could not be found/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Job J-0001/, level: 1 })).toHaveCount(0);

  // The quote can get a new job, which takes the freed number.
  await page.goto("/app/quotes");
  await page.getByRole("link", { name: /QT-0001/ }).first().click();
  await page.getByRole("button", { name: "Create a job" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Not started$/, level: 1 })).toBeVisible();

  // A job being made can be deleted too: the page offers Delete whatever the status.
  await page.getByRole("button", { name: "Start making" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Making$/, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Delete this job" }).click();
  await sheet(page).getByRole("button", { name: "Delete the job" }).click();
  await expect(page.getByTestId("job-deleted-notice")).toContainText("Job J-0001 deleted.");
});
