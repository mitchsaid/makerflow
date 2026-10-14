import { expect, test, type Page } from "@playwright/test";
import { localSupabase, signUpAndOnboard } from "./helpers";
import { nav, sentQuote } from "./quote-helpers";

const sheet = (page: Page) => page.getByRole("dialog");

async function accept(page: Page) {
  await page.getByRole("button", { name: "They accepted" }).click();
  await sheet(page).getByLabel("How they told you").selectOption("whatsapp");
  await sheet(page).getByRole("button", { name: "Save answer" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Accepted$/, level: 1 })).toBeVisible();
}

/** Today in South Africa plus a number of days, as YYYY-MM-DD (the business's own time zone). */
function day(plus: number): string {
  const now = new Date(Date.now() + plus * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(now);
}

/** Sets a job's needed-by day with the LOCAL server key (a demo credential), as the app has no way to date a job from a quote yet. */
async function setNeededBy(jobId: string, neededBy: string | null) {
  const { url, secretKey } = localSupabase();
  const response = await fetch(`${url}/rest/v1/jobs?id=eq.${jobId}`, {
    method: "PATCH",
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ needed_by: neededBy }),
  });
  expect(response.ok).toBe(true);
}

test("accepting a quote offers a job; Not now closes the card for good, Don't ask me again stops it coming back", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "job-nudge", "Nudge Co");
  await sentQuote(page);
  await accept(page);

  // Straight after the answer: a friendly card, and the plain section is held back so there is one Create a job.
  const nudge = page.getByTestId("create-job-nudge");
  await expect(nudge).toContainText("Create a job for QT-0001?");
  await expect(page.getByRole("button", { name: "Create a job" })).toHaveCount(1);

  // Not now: the card goes, the quote's own Create a job section is there, and a reload does not bring the card back.
  await nudge.getByRole("button", { name: "Not now" }).click();
  await expect(nudge).toHaveCount(0);
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("button", { name: "Create a job" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("create-job-nudge")).toHaveCount(0);

  // Answer again: the card comes back (Not now was only for that time). "Don't ask me again" is remembered.
  await page.getByRole("button", { name: "Change the answer" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();
  await accept(page);
  await expect(nudge).toBeVisible();
  await nudge.getByRole("button", { name: "Don't ask me again" }).click();
  await expect(nudge).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create a job" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("create-job-nudge")).toHaveCount(0);

  // A third answer: nothing is offered, but the section is still there.
  await page.getByRole("button", { name: "Change the answer" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();
  await accept(page);
  await expect(page.getByTestId("create-job-nudge")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create a job" })).toBeVisible();
});

test("the nudge makes the job and opens it", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "job-nudge-go", "Nudge Go Co");
  await sentQuote(page);
  await accept(page);
  await page.getByTestId("create-job-nudge").getByRole("button", { name: "Create a job" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001 Not started$/, level: 1 })).toBeVisible();

  // The quote points to its job and never offers the card again.
  await page.getByRole("link", { name: "quote QT-0001" }).click();
  await expect(page.getByTestId("create-job-nudge")).toHaveCount(0);
  await page.goto(`${page.url()}?next=job`);
  await expect(page.getByTestId("create-job-nudge")).toHaveCount(0);
});

test("Home counts the jobs that are late and the ones needed this week, and opens the list at them", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "job-home", "Home Jobs Co");

  // Nothing yet.
  await expect(page.getByTestId("home-jobs")).toContainText("Nothing to make right now");
  await expect(page.getByRole("link", { name: "New job" })).toBeVisible();

  await sentQuote(page);
  await accept(page);
  await page.getByTestId("create-job-nudge").getByRole("button", { name: "Create a job" }).click();
  await expect(page.getByRole("heading", { name: /^Job J-0001/, level: 1 })).toBeVisible();
  const jobId = page.url().split("/").pop() ?? "";

  // A job with no day set is neither late nor due.
  await nav(page).getByRole("link", { name: "Home" }).click();
  await expect(page.getByTestId("home-count-late")).toHaveText("0");
  await expect(page.getByTestId("home-count-week")).toHaveText("0");
  await expect(page.getByTestId("home-jobs")).toContainText("Nothing is due in the next week.");

  // Needed yesterday: late.
  await setNeededBy(jobId, day(-1));
  await page.reload();
  await expect(page.getByTestId("home-count-late")).toHaveText("1");
  await expect(page.getByTestId("home-count-week")).toHaveText("0");
  await page.getByTestId("home-count-late").click();
  await expect(page).toHaveURL(/\/app\/jobs\?show=late$/);
  await expect(page.getByRole("button", { name: /^Late \(1\)/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: /Thandi Nkosi/ })).toContainText("Late: was needed");

  // Needed in six days: this week (the last day of it). In seven: not yet.
  await setNeededBy(jobId, day(6));
  await nav(page).getByRole("link", { name: "Home" }).click();
  await expect(page.getByTestId("home-count-late")).toHaveText("0");
  await expect(page.getByTestId("home-count-week")).toHaveText("1");
  await page.getByTestId("home-count-week").click();
  await expect(page).toHaveURL(/\/app\/jobs\?show=week$/);
  await expect(page.getByRole("button", { name: /^This week \(1\)/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: /Thandi Nkosi/ })).toBeVisible();

  await setNeededBy(jobId, day(7));
  await page.reload();
  await expect(page.getByText("Nothing is needed in the next week.")).toBeVisible();
  await nav(page).getByRole("link", { name: "Home" }).click();
  await expect(page.getByTestId("home-count-week")).toHaveText("0");

  // The buttons on the list itself switch without leaving the page.
  await page.getByRole("link", { name: /^See the job to do$/ }).click();
  await expect(page.getByRole("button", { name: /^To do \(1\)/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Late \(0\)/ }).click();
  await expect(page.getByText("Nothing is late. Well done.")).toBeVisible();
});
