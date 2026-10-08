import { expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, openDocuments, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, openQuotes } from "./quote-helpers";

const sheet = (page: Page) => page.getByRole("dialog");
const pdfUrl = (page: Page) => page.getByTestId("pdf-pages").first().getAttribute("data-url");
const saved = (page: Page) => expect(page.getByTestId("design-save-status")).toHaveText("");
const shot = async (page: Page, name: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
};

/** A PDF as text without the moment it was made, which differs on every drawing. */
const withoutDates = (pdf: Buffer) => pdf.toString("latin1").replace(/\(D:\d{14}Z\)/g, "").replace(/\/ID \[[^\]]*\]/g, "");

async function saveQuote(page: Page, customer: string) {
  await openQuotes(page);
  await page.getByRole("link", { name: /Start your first quote|New quote/ }).first().click();
  await fillItem(page, 1, "Wedding cake", "1", "800");
  await addCustomerInSheet(page, customer);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
}

test("a theme is remixed from a starter, changed part by part with the preview following, saved, used, and a sent quote never changes", async ({ page }) => {
  // A long walk: the studio, two quotes, a send and a deletion.
  test.setTimeout(180_000);
  await signUpAndOnboard(page, "theme-flow", "Look Co");
  await openBusinessProfile(page);
  await page.getByLabel("Phone", { exact: true }).fill("011 555 0101");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // The library: the five starters, none of our own yet.
  await openDocuments(page);
  await page.getByRole("link", { name: "Manage themes" }).click();
  await expect(page.getByRole("heading", { name: "Themes", level: 1 })).toBeVisible();
  await expect(page.getByTestId("theme-card")).toHaveCount(5);
  await expect(page.getByText("You haven't made a theme yet.")).toBeVisible();
  await shot(page, "library-empty");

  // Remix Warm: a copy in the studio, with the quote drawn on it.
  await page.getByRole("link", { name: "Remix Warm" }).click();
  await expect(page).toHaveURL(/\/app\/documents\/themes\/new\?from=starter:warm/);
  await expect(page.getByLabel("Theme name")).toHaveValue("Remix of Warm");
  await expect(page.getByText("A copy of Warm. It isn't saved until you press Save.")).toBeVisible();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await shot(page, "studio-colour");

  // Each choice redraws the preview on the spot.
  let before = await pdfUrl(page);
  await page.getByRole("tab", { name: "Items" }).click();
  await page.getByTestId("choice-layout-cards").click();
  await expect.poll(() => pdfUrl(page)).not.toBe(before);
  await shot(page, "studio-items");
  before = await pdfUrl(page);
  await page.getByTestId("choice-density-airy").click();
  await expect.poll(() => pdfUrl(page)).not.toBe(before);
  await page.getByRole("tab", { name: "Top" }).click();
  before = await pdfUrl(page);
  await page.getByTestId("choice-header-band").click();
  await expect.poll(() => pdfUrl(page)).not.toBe(before);
  await shot(page, "studio-top");
  await page.getByRole("tab", { name: "Colour" }).click();
  before = await pdfUrl(page);
  await page.getByRole("button", { name: "Teal", exact: true }).click();
  await expect.poll(() => pdfUrl(page)).not.toBe(before);

  // Name it and save: it now has an address of its own.
  await page.getByLabel("Theme name").fill("Market stall");
  await page.getByRole("button", { name: "Save theme" }).click();
  await expect(page).toHaveURL(/\/app\/documents\/themes\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("theme-save-status")).toHaveText("Saved.");

  // It is in the library, and can be the usual theme for new quotes.
  await page.goto("/app/documents/themes");
  await expect(page.getByTestId("theme-card")).toHaveCount(6);
  const mine = page.getByTestId("theme-card").filter({ hasText: "Market stall" });
  await expect(mine).toBeVisible();
  await mine.getByRole("button", { name: /Use for new quotes/ }).click();
  await expect(mine).toContainText("Your usual theme");
  await shot(page, "library");

  // A new quote follows it; a pick here is for this quote only; "Use my usual theme" goes back.
  await saveQuote(page, "Thandi Nkosi");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await expect(page.getByTestId("current-design")).toHaveText("Market stall");
  await expect(page.getByText(/This quote follows your usual theme/)).toBeVisible();
  const usual = await pdfUrl(page);
  await page.getByTestId("theme-option").filter({ hasText: "Bold" }).click();
  await expect(page.getByTestId("current-design")).toHaveText("Bold");
  await expect.poll(() => pdfUrl(page)).not.toBe(usual);
  await saved(page);
  await page.reload();
  await expect(page.getByTestId("current-design")).toHaveText("Bold");
  await shot(page, "preview-picker");
  await page.getByRole("button", { name: "Use my usual theme" }).click();
  await expect(page.getByTestId("current-design")).toHaveText("Market stall");
  await saved(page);

  // Send it in Market stall.
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await sheet(page).getByRole("button", { name: "Mark as sent" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?sent=marked$/);
  await expect(page.getByTestId("current-design")).toHaveText("Market stall");
  const sentUrl = page.url().split("?")[0];
  const sentBefore = await (await page.request.get(`${sentUrl}/pdf`)).body();

  // Edit the theme (from a quote's preview there is a link; here, the library): the sent quote is untouched.
  await page.goto("/app/documents/themes");
  await page.getByTestId("theme-card").filter({ hasText: "Market stall" }).getByRole("link", { name: /Edit/ }).click();
  await expect(page.getByLabel("Theme name")).toHaveValue("Market stall");
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await page.getByRole("button", { name: "Rose", exact: true }).click();
  await page.getByRole("tab", { name: "Items" }).click();
  await page.getByTestId("choice-layout-showcase").click();
  await expect(page.getByTestId("theme-save-status")).toHaveText("Not saved yet.");
  await page.getByRole("button", { name: "Save theme" }).click();
  await expect(page.getByTestId("theme-save-status")).toHaveText("Saved.");
  await page.goto(sentUrl);
  await expect(page.getByTestId("current-design")).toHaveText("Market stall");
  const sentAfter = await (await page.request.get(`${sentUrl}/pdf`)).body();
  expect(withoutDates(sentAfter)).toBe(withoutDates(sentBefore));

  // Deleting the theme: new drafts fall back to Classic, and the sent quote still reads as sent.
  await page.goto("/app/documents/themes");
  const stall = page.getByTestId("theme-card").filter({ hasText: "Market stall" });
  await stall.getByRole("button", { name: /^Delete/ }).click();
  await stall.getByRole("button", { name: /^Yes, delete/ }).click();
  await expect(page.getByTestId("theme-card")).toHaveCount(5);
  await page.goto(sentUrl);
  await expect(page.getByTestId("current-design")).toHaveText("Market stall");
  await saveQuote(page, "Lerato Dube");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("current-design")).toHaveText("Classic");
});
