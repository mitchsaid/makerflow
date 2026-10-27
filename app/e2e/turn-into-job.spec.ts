import { expect, test } from "@playwright/test";
import { openHistory, signUpAndOnboard } from "./helpers";
import { sentQuote } from "./quote-helpers";

/** "Turn into a job" right after Mark as sent (docs/plans/turn-into-job.md). */

const sheet = (page: import("@playwright/test").Page) => page.getByRole("dialog");

test("right after Mark as sent, a quote that was already a yes becomes a job in one go", async ({ page }) => {
  test.setTimeout(240_000);
  await signUpAndOnboard(page, "turn-job", "Turn Co");
  await sentQuote(page);
  await expect(page).toHaveURL(/\?sent=marked$/);

  const offer = page.getByTestId("turn-into-job");
  await expect(offer).toContainText("Already a yes?");
  await offer.getByRole("button", { name: "Turn into a job" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Turn into a job");

  // It is the usual acceptance: the day and how they told you are asked for, and nothing is saved without them.
  await sheet(page).getByRole("button", { name: "Save answer and create job" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toBeVisible();
  await expect(sheet(page).getByText(/Choose how they told you/i).first()).toBeVisible();
  await sheet(page).getByLabel("How they told you").selectOption("whatsapp");
  await sheet(page).getByLabel("Note (optional)").fill("Said yes on WhatsApp");
  await sheet(page).getByRole("button", { name: "Save answer and create job" }).click();

  // The job is made and opened; the quote is accepted and points to it.
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /^Job J-0001 Not started$/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("job-items")).toContainText("Wedding cake");
  await openHistory(page);
  await page.getByRole("link", { name: "quote QT-0001" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Accepted$/, level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the job" })).toBeVisible();
  await expect(page.getByTestId("turn-into-job")).toHaveCount(0);
});

test("the offer is only on the page right after marking", async ({ page }) => {
  test.setTimeout(240_000);
  await signUpAndOnboard(page, "turn-job-gone", "Turn Gone Co");
  await sentQuote(page);
  await expect(page.getByTestId("turn-into-job")).toBeVisible();
  // A reload of the quote's own address no longer has the banner, so no offer.
  await page.goto(page.url().replace("?sent=marked", ""));
  await expect(page.getByTestId("turn-into-job")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "They accepted" })).toBeVisible();
});
