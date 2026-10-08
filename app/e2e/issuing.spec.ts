import { expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, openDocuments, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, nav, openQuotes, rand, startSend } from "./quote-helpers";

const sheet = (page: Page) => page.getByRole("dialog");

/** Starts a quote with one item and a customer, and saves it (it is numbered by then). */
async function saveQuote(page: Page, customer = "Thandi Nkosi", price = "800") {
  await openQuotes(page);
  await page.getByRole("link", { name: /Start your first quote|New quote/ }).first().click();
  await expect(page.getByRole("heading", { name: "New quote", level: 1 })).toBeVisible();
  await fillItem(page, 1, "Wedding cake", "1", price);
  await addCustomerInSheet(page, customer);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
}

/** The business gets a phone number in its profile, so quotes can be sent straight away. */
async function addBusinessPhone(page: Page) {
  await openBusinessProfile(page);
  await page.getByLabel("Phone", { exact: true }).fill("011 555 0101");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
}

test("a draft is numbered when first saved, and the next step is a preview of the real document", async ({ page }) => {
  await signUpAndOnboard(page, "iss-number", "Number Co");
  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();
  await expect(page.getByText("It gets its number the first time you save it.")).toBeVisible();
  await fillItem(page, 1, "Wedding cake", "1", "800");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Draft$/, level: 1 })).toBeVisible();
  const quoteUrl = page.url().split("?")[0];

  // Preview is the next step. It shows the real PDF, drawn on the screen, and the way on.
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page).toHaveURL(`${quoteUrl}/preview`);
  await expect(page.getByRole("heading", { name: /^Preview of quote QT-0001 Draft$/, level: 1 })).toBeVisible();
  const pages = page.getByTestId("pdf-page");
  await expect(pages.first()).toBeVisible();
  await expect(pages).toHaveCount(1);
  await expect(pages.first()).toHaveAccessibleName("Quote QT-0001, page 1 of 1");
  // The page really has the document on it: it is not a blank white canvas.
  const inked = await pages.first().evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 100 && data[i + 1] < 100 && data[i + 2] < 100) dark++;
    return dark;
  });
  expect(inked).toBeGreaterThan(500);
  // The text version of the same document is there for screen readers.
  await expect(page.getByRole("region", { name: "The quote as text" })).toContainText("Wedding cake");
  // The design: the business's usual look (Classic), changeable from here.
  await expect(page.getByTestId("current-design")).toHaveText("Classic");
  await expect(page.getByRole("group", { name: "Design" }).getByRole("button")).toHaveCount(5);
  // Download is a plain link to the PDF.
  expect(await page.getByRole("link", { name: "Download" }).getAttribute("href")).toBe(`${new URL(quoteUrl).pathname}/pdf?download=1`);
  // Pressing it really downloads (it first waits for any design choice still being saved).
  const [pressed] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download" }).click()]);
  expect(pressed.suggestedFilename()).toBe("QT-0001-draft.pdf");
  const download = await page.request.get(`${quoteUrl}/pdf?download=1`);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-disposition"]).toContain("attachment");
  expect(download.headers()["content-disposition"]).toContain("QT-0001-draft.pdf");
  expect((await download.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");

  // Edit goes back to the draft with everything as it was.
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page).toHaveURL(quoteUrl);
  await expect(page.getByTestId("quote-line")).toContainText("Wedding cake");

  // Preview saves what is on the screen first, so the preview is never out of date.
  await page.getByTestId("quote-line").getByRole("button", { name: /Edit/ }).click();
  await sheet(page).getByLabel(/^Price/).fill("950");
  await sheet(page).getByRole("button", { name: "Save item" }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page).toHaveURL(`${quoteUrl}/preview`);
  await expect(page.getByRole("region", { name: "The quote as text" })).toContainText(/R\s?950,00/);

  // A new quote's Preview saves it and opens its preview in one go.
  await openQuotes(page);
  await expect(page.getByRole("link", { name: /QT-0001/ })).toContainText("Draft");
  await page.getByRole("link", { name: "New quote" }).click();
  await fillItem(page, 1, "Cupcakes", "12", "15");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\/preview$/);
  await expect(page.getByRole("heading", { name: /^Preview of quote QT-0002/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
});

test("sending lists what is missing, carries on once contact details are added, and marking as sent locks the quote", async ({
  page,
  browser,
}) => {
  await signUpAndOnboard(page, "iss-mark", "Send Co");
  await saveQuote(page);

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  const urlBefore = await page.getByTestId("pdf-pages").getAttribute("data-url");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(sheet(page)).toHaveAccessibleName("Before you can send this quote");
  await expect(sheet(page).getByText(/Add a phone number or email/)).toBeVisible();
  // Nothing about the customer or items is wrong, so only the contact details are asked for.
  await expect(sheet(page).getByRole("list", { name: "What is missing" })).toHaveCount(0);

  // Nothing at all is not enough: it says how to fix it, at the field and in a summary.
  await sheet(page).getByRole("button", { name: "Save and continue" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toBeVisible();
  await expect(sheet(page).getByText("Add a phone number or an email so customers can reach you.")).toHaveCount(2);

  await sheet(page).getByLabel(/^Phone/).fill("011 555 0101");
  await sheet(page).getByRole("button", { name: "Save and continue" }).click();
  // The send carries on: the sheet now asks how it is being sent.
  await expect(sheet(page)).toHaveAccessibleName("Send this quote");
  // The document now has a phone number on it, so the preview behind the sheet is fetched and
  // drawn again (its address carries a stamp of what the document says).
  await expect.poll(() => page.getByTestId("pdf-pages").getAttribute("data-url")).not.toBe(urlBefore);
  await expect(sheet(page)).toContainText("QT-0001 for Thandi Nkosi");
  await expect(sheet(page)).toContainText(/R\s?800,00/);
  await expect(sheet(page).getByTestId("coming-soon")).toHaveCount(2);

  await sheet(page).getByRole("button", { name: "Mark as sent" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?sent=marked$/);
  await expect(page.getByTestId("sent-banner")).toContainText("QT-0001 is marked as sent and locked");
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();

  // The frozen document, and nothing to edit.
  const document = page.getByTestId("quote-document");
  await expect(document).toContainText("Send Co");
  await expect(document).toContainText("Thandi Nkosi");
  await expect(document).toContainText("Wedding cake");
  await expect(document).toContainText("This quotation is not a tax invoice.");
  await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete draft" })).toHaveCount(0);
  // What comes later is shown, and does nothing: emailing and the online link.
  await expect(page.getByTestId("coming-soon")).toHaveCount(2);
  await expect(page.getByTestId("current-design")).toHaveText("Classic");
  // The sent quote is the real document, drawn on the screen.
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await expect(page.getByTestId("activity")).toContainText("Draft created");
  await expect(page.getByTestId("activity")).toContainText("Version 1 marked as sent");

  // The PDF is the frozen one, not a draft preview.
  const url = page.url().split("?")[0];
  const pdf = await page.request.get(`${url}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-disposition"]).toContain('filename="QT-0001.pdf"');
  expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");

  // It stays sent after a reload, and the contact details went into the Business profile.
  await page.reload();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();
  await openBusinessProfile(page);
  await expect(page.getByLabel("Phone", { exact: true })).toHaveValue("011 555 0101");
  await openQuotes(page);
  const row = page.getByRole("link", { name: /Thandi Nkosi/ });
  await expect(row).toContainText("QT-0001");
  await expect(row).toContainText("Sent");

  // Only people in the business can open its PDFs.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signUpAndOnboard(otherPage, "iss-other", "Other Co");
  expect((await otherPage.request.get(`${url}/pdf`)).status()).toBe(404);
  await other.close();
});

test("a quote with no customer and no items says so, and each fix takes you to the right place", async ({ page }) => {
  await signUpAndOnboard(page, "iss-missing", "Missing Co");
  await addBusinessPhone(page);
  await openQuotes(page);
  await page.getByRole("link", { name: "Start your first quote" }).click();
  // Preview on a new, empty quote saves it and opens its preview; Send there lists what it needs.
  await startSend(page);
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\/preview$/);
  await expect(sheet(page)).toHaveAccessibleName("Before you can send this quote");
  const missing = sheet(page).getByRole("list", { name: "What is missing" });
  await expect(missing).toContainText("Choose who the quote is for.");
  await expect(missing).toContainText("Add at least one item to the quote.");

  // The fix is on the edit screen: it takes you there and lands on the field.
  await sheet(page).getByRole("button", { name: "Choose a customer" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Customer name", { exact: true })).toBeFocused();

  // Fix both, and sending is offered.
  await fillItem(page, 1, "Cake", "1", "100");
  await addCustomerInSheet(page, "Sipho");
  await startSend(page);
  // Unsaved changes are saved first (by Preview), so what is sent is what was on screen.
  await expect(sheet(page)).toHaveAccessibleName("Send this quote");
  await expect(sheet(page)).toContainText("QT-0001 for Sipho");

  // Closing it leaves the draft exactly as it was.
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: /^Preview of quote QT-0001 Draft$/, level: 1 })).toBeVisible();
});

test("sending by share hands the PDF to the phone's share sheet, and the quote is locked", async ({ page }) => {
  await page.addInitScript(() => {
    const shared: unknown[] = [];
    Object.assign(window, { __shared: shared });
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", {
      value: async (data: { files: File[]; title: string }) => {
        shared.push({ name: data.files[0].name, type: data.files[0].type, size: data.files[0].size, title: data.title });
      },
      configurable: true,
    });
  });
  await signUpAndOnboard(page, "iss-share", "Share Co");
  await addBusinessPhone(page);
  await saveQuote(page);

  await startSend(page);
  await sheet(page).getByRole("button", { name: "Send and share the PDF" }).click();
  await expect(page).toHaveURL(/\?sent=shared$/);
  await expect(page.getByTestId("sent-banner")).toContainText("QT-0001 is sent and locked");
  const shared = await page.evaluate(() => (window as unknown as { __shared: { name: string; type: string; size: number; title: string }[] }).__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0]).toMatchObject({ name: "QT-0001.pdf", type: "application/pdf", title: "Quote QT-0001" });
  expect(shared[0].size).toBeGreaterThan(1500);
  await expect(page.getByTestId("activity")).toContainText("Version 1 shared as a PDF");

  // It can be shared again any time.
  await page.getByRole("button", { name: "Share PDF" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length)).toBe(2);
});

test("where files can't be shared, the PDF is downloaded instead", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
  });
  await signUpAndOnboard(page, "iss-download", "Download Co");
  await addBusinessPhone(page);
  await saveQuote(page);

  await startSend(page);
  const download = page.waitForEvent("download");
  await sheet(page).getByRole("button", { name: "Send and download the PDF" }).click();
  expect((await download).suggestedFilename()).toBe("QT-0001.pdf");
  await expect(page).toHaveURL(/\?sent=shared$/);
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
});

test("revising a sent quote keeps its number, adds a version, and keeps the old one readable", async ({ page }) => {
  await signUpAndOnboard(page, "iss-revise", "Revise Co");
  await addBusinessPhone(page);
  await saveQuote(page, "Thandi Nkosi", "800");
  await startSend(page);
  await sheet(page).getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByTestId("sent-banner")).toBeVisible();
  const quoteUrl = page.url().split("?")[0];

  await page.getByRole("button", { name: "Revise this quote" }).click();
  await expect(page).toHaveURL(quoteUrl);
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Revising$/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("revising-note")).toContainText("You are working on version 2");
  // It starts as a copy of what was sent, and cannot be deleted (that would delete a sent version).
  await expect(page.getByTestId("quote-line")).toContainText("Wedding cake");
  await expect(page.getByRole("button", { name: "Delete draft" })).toHaveCount(0);

  // Change the price and send version 2.
  await page.getByTestId("quote-line").getByRole("button", { name: /Edit/ }).click();
  await sheet(page).getByLabel(/^Price/).fill("900");
  await sheet(page).getByRole("button", { name: "Save item" }).click();
  await expect(page.getByTestId("sticky-total")).toHaveText(rand("900"));
  await startSend(page);
  await expect(sheet(page)).toHaveAccessibleName("Send this quote");
  await sheet(page).getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByTestId("sent-banner")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("quote-document")).toContainText("QT-0001 · version 2");
  await expect(page.getByTestId("quote-document")).toContainText(/R\s?900,00/);

  // Version 1 is still there, as it was sent.
  await page.getByRole("link", { name: "Version 1" }).click();
  await expect(page.getByTestId("earlier-version-note")).toContainText("This is version 1, an earlier version");
  await expect(page.getByTestId("quote-document")).toContainText(/R\s?800,00/);
  await expect(page.getByRole("button", { name: "Revise this quote" })).toHaveCount(0);
  const v1Pdf = await page.request.get(`${quoteUrl}/pdf?version=1`);
  expect(v1Pdf.status()).toBe(200);
  expect(v1Pdf.headers()["content-disposition"]).toContain("QT-0001.pdf");
  expect((await page.request.get(`${quoteUrl}/pdf?version=3`)).status()).toBe(404);
  await page.goto(`${quoteUrl}?version=9`);
  await expect(page.getByText("This page could not be found.")).toBeVisible();

  await page.goto(quoteUrl);
  await expect(page.getByTestId("activity")).toContainText("Revised: version 2 started");
  await expect(page.getByTestId("activity")).toContainText("Version 2 marked as sent");

  await openQuotes(page);
  await expect(page.getByRole("link", { name: /Thandi Nkosi/ })).toContainText("QT-0001 · v2");
});

test("quote numbers can be set to continue from another system, and never go backwards", async ({ page }) => {
  await signUpAndOnboard(page, "iss-numbering", "Numbering Co");
  await openDocuments(page);
  await expect(page.getByLabel("Prefix", { exact: true })).toHaveValue("QT-");
  await expect(page.getByLabel("Next number", { exact: true })).toHaveValue("1");
  await expect(page.getByTestId("number-preview")).toHaveText("Your next quote will be QT-0001.");

  await page.getByLabel("Prefix", { exact: true }).fill("Q/");
  await page.getByLabel("Next number", { exact: true }).fill("100");
  await expect(page.getByTestId("number-preview")).toHaveText("Your next quote will be Q/0100.");
  await page.getByRole("button", { name: "Save quote numbers" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  await saveQuote(page);
  await expect(page.getByRole("heading", { name: /^Quote Q\/0100 Draft$/, level: 1 })).toBeVisible();

  // Going back to a number already used is refused, says how to fix it, and keeps what was typed.
  await openDocuments(page);
  await expect(page.getByLabel("Next number", { exact: true })).toHaveValue("101");
  await page.getByLabel("Next number", { exact: true }).fill("50");
  await page.getByRole("button", { name: "Save quote numbers" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("Number 100 has already been used. Choose 101 or higher");
  await expect(page.getByLabel("Next number", { exact: true })).toHaveValue("50");
  await page.getByLabel("Prefix", { exact: true }).fill("bad prefix!");
  await page.getByRole("button", { name: "Save quote numbers" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("Use letters, numbers");
});

test("the list filters by status and a quote with no customer still shows its number", async ({ page }) => {
  await signUpAndOnboard(page, "iss-filter", "Filter Co");
  await addBusinessPhone(page);
  await saveQuote(page);
  await startSend(page);
  await sheet(page).getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByTestId("sent-banner")).toBeVisible();

  await openQuotes(page);
  await page.getByRole("link", { name: "New quote" }).click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0002 Draft$/, level: 1 })).toBeVisible();

  await openQuotes(page);
  const filters = page.getByRole("navigation", { name: "Filter quotes" });
  await expect(filters).toContainText("All (2)");
  await filters.getByRole("link", { name: "Sent (1)" }).click();
  await expect(page.getByRole("link", { name: /QT-0001/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /QT-0002/ })).toHaveCount(0);
  await filters.getByRole("link", { name: "Drafts (1)" }).click();
  await expect(page.getByRole("link", { name: /QT-0002/ })).toContainText("No customer yet");
  await nav(page).getByRole("link", { name: "Quotes" }).click();
});
