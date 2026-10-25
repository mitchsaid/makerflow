import { expect, test, type Page } from "@playwright/test";
import { issuedInvoice } from "./invoice-helpers";
import { signUpAndOnboard } from "./helpers";
import { sentQuote, sheet } from "./quote-helpers";

/** One filled button on a screen, for the next step; actions that fit the status; every sheet ends with Cancel (docs/ux-review-2026-10-25.md, N1, N2, N4). */

/** The buttons and links on the page (outside sheets) drawn as the filled primary. */
async function filled(page: Page) {
  return page.locator("main").evaluate((main) =>
    Array.from(main.querySelectorAll<HTMLElement>("button, a"))
      .filter((el) => el.offsetParent !== null && !el.closest('[role="dialog"]') && /(^|\s)bg-primary(\s|$)/.test(el.className))
      .map((el) => el.innerText.trim()),
  );
}

test("a sent quote: the answer comes first, the PDF is outlined, and there is no Quote again until it is answered", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "next-sent", "Next Step Co");
  await sentQuote(page);
  // Right after marking it sent, the offer to turn a yes into a job is the one filled button.
  expect(await filled(page)).toEqual(["Turn into a job"]);
  // Later, nothing is filled: the next step is to record the answer, in the card at the top.
  await page.goto(page.url().split("?")[0]);
  expect(await filled(page)).toEqual([]);
  await expect(page.getByRole("button", { name: "Quote again" })).toHaveCount(0);
  const answer = page.getByRole("button", { name: "They accepted" });
  const pdf = page.getByRole("button", { name: /Download PDF|Share PDF/ });
  expect((await answer.boundingBox())!.y).toBeLessThan((await pdf.boundingBox())!.y);

  // The answer sheet ends with Cancel, which changes nothing.
  await answer.click();
  await sheet(page).getByRole("button", { name: "Cancel" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Sent$/, level: 1 })).toBeVisible();

  // Accepted, and the job card closed: the job is the one filled button; corrections are quiet and last.
  await answer.click();
  await sheet(page).getByLabel("How they told you").selectOption("whatsapp");
  await sheet(page).getByRole("button", { name: "Save answer" }).click();
  await expect(page.getByRole("heading", { name: /Accepted$/, level: 1 })).toBeVisible();
  await page.getByTestId("create-job-nudge").getByRole("button", { name: "Not now" }).click();
  await expect(page.getByTestId("create-job-nudge")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create a job" })).toBeVisible();
  await expect.poll(() => filled(page)).toEqual(["Create a job"]);
  await expect(page.getByTestId("quote-corrections").getByRole("button")).toHaveText(["Change the answer", "Quote again"]);
});

test("an issued invoice: the deposit is the one filled button, and the payment and invoice sheets end with Cancel", async ({ page }) => {
  test.setTimeout(240_000);
  await issuedInvoice(page, "next-invoice", { name: "Cake", quantity: "1", price: "500", depositPercent: "50" });
  expect(await filled(page)).toEqual(["Record the deposit"]);
  await page.getByRole("button", { name: "Record a payment" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Record a payment");
  await expect(sheet(page).getByRole("button", { name: "Record payment" })).toBeVisible();
  await sheet(page).getByRole("button", { name: "Cancel" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Issue a credit note" }).click();
  await sheet(page).getByRole("button", { name: "Cancel" }).click();
  await expect(sheet(page)).toHaveCount(0);
  // Paid in full: no filled button is left.
  await page.getByRole("button", { name: "Record the deposit" }).click();
  await sheet(page).getByRole("button", { name: "Record payment" }).click();
  await expect(sheet(page)).toHaveCount(0);
  // Once the page has the payment, the deposit is no longer asked for.
  await expect.poll(() => filled(page)).toEqual(["Record a payment"]);
});
