import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { openBusinessProfile, openDocuments, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, openQuotes } from "./quote-helpers";

const sheet = (page: Page) => page.getByRole("dialog");
const pdfUrl = (page: Page) => page.getByTestId("pdf-pages").first().getAttribute("data-url");
const saved = (page: Page) => expect(page.getByTestId("design-save-status")).toHaveText("");
const shot = async (page: Page, name: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
};

/** A soft picture to put behind a quote. */
async function backdrop() {
  return sharp({ create: { width: 800, height: 1100, channels: 3, background: "#e8d9c4" } }).png().toBuffer();
}

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

  // The library: the five starters, none of our own yet. Creating one starts with a choice of where from.
  await openDocuments(page);
  await page.getByRole("link", { name: "Manage themes" }).click();
  await expect(page.getByRole("heading", { name: "Themes", level: 1 })).toBeVisible();
  await expect(page.getByTestId("theme-card")).toHaveCount(5);
  await expect(page.getByText("You haven't made a theme yet.")).toBeVisible();
  await shot(page, "library-empty");
  await page.getByRole("link", { name: "Create new theme" }).click();
  await expect(page.getByRole("heading", { name: "Create a new theme", level: 1 })).toBeVisible();
  await shot(page, "create-start");
  await expect(page.getByRole("link", { name: /^Start from scratch/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Remix a starter" }).getByRole("link")).toHaveCount(5);

  // Remix Warm: a copy in the studio, with the quote drawn on it.
  await page.getByRole("region", { name: "Remix a starter" }).getByRole("link", { name: /^Warm/ }).click();
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
  // Row styles: boxed rows and the spreadsheet (there is no "full grid").
  await page.getByTestId("choice-layout-table").click();
  await expect(page.getByTestId("choice-rows-sheet")).toBeVisible();
  await expect(page.getByTestId("choice-rows-boxed")).toBeVisible();
  await expect(page.getByTestId("choice-rows-grid")).toHaveCount(0);
  before = await pdfUrl(page);
  await page.getByTestId("choice-rows-sheet").click();
  await expect.poll(() => pdfUrl(page)).not.toBe(before);
  await shot(page, "studio-sheet");
  await page.getByTestId("choice-layout-cards").click();
  await page.getByRole("tab", { name: "Top" }).click();
  before = await pdfUrl(page);
  await page.getByTestId("choice-header-band").click();
  await expect.poll(() => pdfUrl(page)).not.toBe(before);
  await shot(page, "studio-top");
  await page.getByRole("tab", { name: "Colour" }).click();
  before = await pdfUrl(page);
  await page.getByRole("button", { name: "Teal", exact: true }).click();
  await expect.poll(() => pdfUrl(page)).not.toBe(before);

  // Fonts: a list of popular ones, each shown as it prints; choosing one redraws the preview.
  await page.getByRole("tab", { name: "Type" }).click();
  before = await pdfUrl(page);
  await page.getByRole("button", { name: /^Headings/ }).click();
  await expect(page.getByTestId(/^font-/)).toHaveCount(20);
  await shot(page, "studio-fonts");
  await page.getByTestId("font-playfair").click();
  await expect(page.getByRole("button", { name: /^Headings/ })).toContainText("Playfair Display");
  await expect.poll(() => pdfUrl(page)).not.toBe(before);

  // Background: paper, a gradient, or a picture.
  await page.getByRole("tab", { name: "Background" }).click();
  before = await pdfUrl(page);
  await page.getByTestId("choice-background-gradient").click();
  await expect.poll(() => pdfUrl(page)).not.toBe(before);
  await page.getByTestId("choice-gradientDirection-diagonal").click();
  await shot(page, "studio-background");
  await page.getByTestId("choice-background-image").click();
  await page.locator('input[type="file"]').setInputFiles({ name: "bg.png", mimeType: "image/png", buffer: await backdrop() });
  await expect(page.getByTestId("backgroundImage-preview")).toBeVisible();
  before = await pdfUrl(page);
  await page.getByTestId("choice-imageStrength-medium").click();
  await expect.poll(() => pdfUrl(page)).not.toBe(before);
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await page.getByTestId("choice-background-paper").click();

  // Name it and save: it now has an address of its own.
  await page.getByLabel("Theme name").fill("Market stall");
  await page.getByRole("button", { name: "Save theme" }).click();
  await expect(page).toHaveURL(/\/app\/documents\/themes\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("theme-save-status")).toHaveText("Saved.");

  // It is in the library.
  await page.goto("/app/documents/themes");
  await expect(page.getByTestId("theme-card")).toHaveCount(6);
  await expect(page.getByTestId("theme-card").filter({ hasText: "Market stall" })).toBeVisible();
  await shot(page, "library");

  // A new quote has the theme chosen last: nothing was chosen on a quote yet, so Classic. Picking is for
  // this quote, and it is what the next quote starts with.
  await saveQuote(page, "Thandi Nkosi");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await expect(page.getByTestId("current-design")).toHaveText("Classic");
  const classic = await pdfUrl(page);
  await page.getByTestId("theme-option").filter({ hasText: "Market stall" }).click();
  await expect(page.getByTestId("current-design")).toHaveText("Market stall");
  await expect.poll(() => pdfUrl(page)).not.toBe(classic);
  await saved(page);
  await page.reload();
  await expect(page.getByTestId("current-design")).toHaveText("Market stall");
  await shot(page, "preview-picker");

  // Send it in Market stall.
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await sheet(page).getByRole("button", { name: "Mark as sent" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?sent=marked$/);
  await expect(page.getByTestId("current-design")).toHaveText("Market stall");
  const sentUrl = page.url().split("?")[0];
  const sentBefore = await (await page.request.get(`${sentUrl}/pdf`)).body();

  // The next quote starts with the theme chosen last (Market stall) with nothing picked; choosing another
  // there is what the quote after that starts with.
  await saveQuote(page, "Lerato Dube");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await expect(page.getByTestId("current-design")).toHaveText("Market stall");
  await page.getByTestId("theme-option").filter({ hasText: "Bold" }).click();
  await expect(page.getByTestId("current-design")).toHaveText("Bold");
  await saved(page);
  await saveQuote(page, "Sipho Zulu");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("current-design")).toHaveText("Bold");
  // Create a new theme from a quote's preview: the studio, and back to the quote with it on.
  await page.getByRole("link", { name: "Create new theme" }).click();
  await expect(page.getByRole("heading", { name: "Create a new theme", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: /^Start from scratch/ }).click();
  await expect(page.getByLabel("Theme name")).toHaveValue("My theme");
  await page.getByLabel("Theme name").fill("From scratch");
  await page.getByRole("button", { name: "Save and use on this quote" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\/preview$/);
  await expect(page.getByTestId("current-design")).toHaveText("From scratch");

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

  // Deleting the theme: the sent quote still reads as sent, and the library has one fewer.
  await page.goto("/app/documents/themes");
  const stall = page.getByTestId("theme-card").filter({ hasText: "Market stall" });
  await stall.getByRole("button", { name: /^Delete/ }).click();
  await stall.getByRole("button", { name: /^Yes, delete/ }).click();
  await expect(page.getByTestId("theme-card")).toHaveCount(6);
  await page.goto(sentUrl);
  await expect(page.getByTestId("current-design")).toHaveText("Market stall");
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();
});
