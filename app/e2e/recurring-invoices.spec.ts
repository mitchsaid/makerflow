import { expect, test, type Page } from "@playwright/test";
import { localSupabase } from "./helpers";
import { businessWithAddress } from "./invoice-helpers";
import { addCustomerInSheet, sheet } from "./quote-helpers";

/**
 * Repeating invoices (docs/plans/recurring.md, slice 1): Repeat from a draft's ⋯, the schedule checked at its fields,
 * the Repeating list (pause, resume, change, edit what it repeats, stop), and the daily run making ONE draft a day, marked
 * as made by a repeat, never an issued invoice.
 */
const rand = (whole: string) => new RegExp(`R\\s?${whole.replace(/ /g, "\\s?")},00`);

async function openMenu(page: Page, name: string | RegExp, title: string | RegExp) {
  const button = page.getByRole("button", { name });
  await expect(button).toBeVisible();
  await expect(async () => {
    await button.click();
    await expect(page.getByRole("dialog", { name: title })).toBeVisible({ timeout: 1_000 });
  }).toPass();
}

/** A saved draft for Thandi Nkosi with one item at R 300. */
async function savedDraft(page: Page) {
  await page.goto("/app/invoices/new");
  await addCustomerInSheet(page, "Thandi Nkosi");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /One-off item/ }).click();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Workshop pass");
  await sheet(page).getByLabel("Quantity").fill("1");
  await sheet(page).getByLabel(/^Price/).fill("300");
  await sheet(page).getByRole("button", { name: "Add to invoice" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/invoices\/drafts\/[0-9a-f-]{36}\?saved=1$/);
}

/** Today where the test business is (South Africa). */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

async function dueToday(organisationName: string) {
  const { url, secretKey } = localSupabase();
  const headers = { apikey: secretKey, Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json", Prefer: "return=minimal" };
  const orgs = await (await fetch(`${url}/rest/v1/organisations?name=eq.${encodeURIComponent(organisationName)}&select=id`, { headers })).json();
  const response = await fetch(`${url}/rest/v1/recurrences?organisation_id=eq.${orgs[0].id}`, { method: "PATCH", headers, body: JSON.stringify({ next_run_on: today() }) });
  expect(response.ok).toBe(true);
}

const runDaily = (page: Page, secret = "test-cron-secret") => page.request.get("/api/cron/recurrences", { headers: { authorization: `Bearer ${secret}` } });

test("a draft is repeated on a schedule that is checked, listed, paused, changed and stopped", async ({ page }) => {
  test.setTimeout(240_000);
  await businessWithAddress(page, "repeat-list", "Repeat Co");
  await savedDraft(page);

  await page.goto("/app/invoices?show=drafts");
  await openMenu(page, "More for Thandi Nkosi, draft", /Thandi Nkosi · draft/);
  await page.getByRole("dialog", { name: /Thandi Nkosi · draft/ }).getByRole("button", { name: /^Repeat/ }).click();
  await expect(sheet(page)).toHaveAccessibleName("Repeat this invoice");

  // The usual choice is monthly from next month, said in words.
  await expect(page.getByTestId("repeat-spoken")).toContainText(/^Every month on the \d+(st|nd|rd|th), from /);

  // A first day that has passed is named at its field and in the summary, and nothing is started.
  await sheet(page).getByLabel("First one on").fill("2020-01-01");
  await sheet(page).getByRole("button", { name: "Start repeating" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("Choose a starting day that is today or later.");
  await expect(sheet(page).getByText("Choose a starting day that is today or later.")).toHaveCount(2);

  // An end after a number of times needs a whole number.
  await sheet(page).getByLabel("First one on").fill(today());
  await sheet(page).getByRole("radio", { name: /A number of times/ }).check();
  await sheet(page).getByRole("button", { name: "Start repeating" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("Enter a whole number of times");
  await sheet(page).getByLabel("Number of times").fill("6");

  await sheet(page).getByRole("button", { name: "Start repeating" }).click();
  await expect(page).toHaveURL(/\/app\/invoices\?show=repeating$/);
  const row = page.getByTestId("repeat-row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Thandi Nkosi");
  await expect(row).toContainText(rand("300"));
  await expect(page.getByTestId("repeat-how")).toContainText(/Every month on the \d+(st|nd|rd|th) · 6 times in all/);
  await expect(page.getByTestId("repeat-status")).toHaveText("Repeating");
  await expect(page.getByTestId("repeat-next")).toContainText("Next on");

  // Pause, then resume: a question each time.
  await openMenu(page, "More for the repeat for Thandi Nkosi", /Thandi Nkosi · repeat/);
  await page.getByRole("dialog", { name: /Thandi Nkosi · repeat/ }).getByRole("button", { name: /^Pause/ }).click();
  await sheet(page).getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByTestId("repeat-status")).toHaveText("Paused");
  await expect(page.getByTestId("repeat-next")).toHaveCount(0);
  await openMenu(page, "More for the repeat for Thandi Nkosi", /Thandi Nkosi · repeat/);
  await page.getByRole("dialog", { name: /Thandi Nkosi · repeat/ }).getByRole("button", { name: /^Resume/ }).click();
  await sheet(page).getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByTestId("repeat-status")).toHaveText("Repeating");

  // Change the schedule: weekly now, and the list says so.
  await openMenu(page, "More for the repeat for Thandi Nkosi", /Thandi Nkosi · repeat/);
  await page.getByRole("dialog", { name: /Thandi Nkosi · repeat/ }).getByRole("button", { name: /^Change schedule/ }).click();
  await expect(sheet(page)).toHaveAccessibleName("Change schedule");
  await sheet(page).getByLabel("How often").selectOption({ label: "Every week" });
  await sheet(page).getByRole("button", { name: "Save schedule" }).click();
  await expect(page.getByTestId("repeat-how")).toContainText(/^Every week on \w+s/);

  // Edit what it repeats: the same form, without dates or preview; the price changes for the next ones.
  await page.getByTestId("repeat-row").getByRole("link").click();
  await expect(page.getByRole("heading", { name: "What this repeats", level: 1 })).toBeVisible();
  await expect(page.getByTestId("repeat-note")).toContainText("due 14 days later");
  await expect(page.getByLabel("Invoice date")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue to preview" })).toHaveCount(0);
  await expect(page.getByTestId("sticky-total")).toContainText(rand("300"));
  await page.getByTestId("quote-line").first().getByRole("button").first().click();
  await sheet(page).getByLabel(/^Price/).fill("350");
  await sheet(page).getByRole("button", { name: /Save changes|Update item|Done/ }).click();
  await expect(page.getByTestId("sticky-total")).toContainText(rand("350"));
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto("/app/invoices?show=repeating");
  await expect(page.getByTestId("repeat-row")).toContainText(rand("350"));

  // Stop: a question; the draft it was started from is still there.
  await openMenu(page, "More for the repeat for Thandi Nkosi", /Thandi Nkosi · repeat/);
  await page.getByRole("dialog", { name: /Thandi Nkosi · repeat/ }).getByRole("button", { name: /^Stop repeating/ }).click();
  await sheet(page).getByRole("button", { name: "Stop repeating", exact: true }).click();
  await expect(page.getByTestId("repeat-row")).toHaveCount(0);
  await page.goto("/app/invoices?show=drafts");
  await expect(page.getByTestId("invoice-draft-row")).toHaveCount(1);
});

test("the daily run makes one draft a day, marked as made by a repeat, and Home says it is ready", async ({ page }) => {
  test.setTimeout(240_000);
  await businessWithAddress(page, "repeat-run", "Run Co");
  await savedDraft(page);
  await page.goto("/app/invoices?show=drafts");
  await openMenu(page, "More for Thandi Nkosi, draft", /Thandi Nkosi · draft/);
  await page.getByRole("dialog", { name: /Thandi Nkosi · draft/ }).getByRole("button", { name: /^Repeat/ }).click();
  await sheet(page).getByRole("button", { name: "Start repeating" }).click();
  await expect(page).toHaveURL(/show=repeating$/);

  // Nobody can run it without the secret.
  expect((await runDaily(page, "wrong")).status()).toBe(401);

  // Not due yet: nothing is made.
  const early = await (await runDaily(page)).json();
  expect(early.made).toBe(0);

  // Due today: one draft is made, however many times the run is called.
  await dueToday("Run Co");
  const first = await (await runDaily(page)).json();
  expect(first.made).toBe(1);
  const second = await (await runDaily(page)).json();
  expect(second.made).toBe(0);

  await page.goto("/app");
  await expect(page.getByTestId("home-repeats-ready")).toHaveText("1");
  await expect(page.getByTestId("home-repeats")).toContainText("Repeat ready to check");

  await page.goto("/app/invoices?show=drafts");
  await expect(page.getByTestId("invoice-draft-row")).toHaveCount(2);
  await expect(page.getByTestId("draft-from-repeat")).toHaveCount(1);
  // The draft it made is a draft, not an invoice, dated today with the item as it was.
  await page.getByTestId("draft-from-repeat").click();
  await expect(page.getByRole("heading", { name: "Invoice draft", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Invoice date")).toHaveValue(today());
  await expect(page.getByTestId("sticky-total")).toContainText(rand("300"));

  // The repeat has moved on and says what it made.
  await page.goto("/app/invoices?show=repeating");
  await expect(page.getByTestId("repeat-row")).toContainText("1 made");
  await expect(page.getByTestId("repeat-next")).toContainText("Next on");
  // No invoice was issued.
  await page.goto("/app/invoices");
  await expect(page.getByTestId("invoice-count")).toHaveText("0 invoices");
});

test("a repeat that can no longer make a good invoice pauses itself, says why, and Home says it needs a look", async ({ page }) => {
  test.setTimeout(240_000);
  await businessWithAddress(page, "repeat-pause", "Pause Co");
  await savedDraft(page);
  await page.goto("/app/invoices?show=drafts");
  await openMenu(page, "More for Thandi Nkosi, draft", /Thandi Nkosi · draft/);
  await page.getByRole("dialog", { name: /Thandi Nkosi · draft/ }).getByRole("button", { name: /^Repeat/ }).click();
  await sheet(page).getByRole("button", { name: "Start repeating" }).click();
  await expect(page).toHaveURL(/show=repeating$/);

  // Break what it repeats behind the app's back (an item that no longer checks out), and make it due.
  const { url, secretKey } = localSupabase();
  const headers = { apikey: secretKey, Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json", Prefer: "return=representation" };
  const rows = await (await fetch(`${url}/rest/v1/recurrences?select=id,form`, { headers })).json();
  const form = rows[0].form;
  form.lines[0].unitPrice = "not a price";
  const patched = await fetch(`${url}/rest/v1/recurrences?id=eq.${rows[0].id}`, { method: "PATCH", headers, body: JSON.stringify({ form, next_run_on: today() }) });
  expect(patched.ok).toBe(true);

  const result = await (await runDaily(page)).json();
  expect(result.paused).toBe(1);
  expect(result.made).toBe(0);

  await page.goto("/app");
  await expect(page.getByTestId("home-repeats-paused")).toHaveText("1");
  await page.goto("/app/invoices?show=repeating");
  await expect(page.getByTestId("repeat-status")).toHaveText("Paused");
  await expect(page.getByTestId("repeat-reason")).toContainText("It could not make an invoice");
  await expect(page.getByTestId("repeat-reason")).toContainText("Edit what it repeats");

  // It cannot be resumed until it is fixed: the problem is said in the question.
  await openMenu(page, "More for the repeat for Thandi Nkosi", /Thandi Nkosi · repeat/);
  await page.getByRole("dialog", { name: /Thandi Nkosi · repeat/ }).getByRole("button", { name: /^Resume/ }).click();
  await sheet(page).getByRole("button", { name: "Resume", exact: true }).click();
  await expect(sheet(page).getByRole("alert")).toContainText("Fix this first");
});
