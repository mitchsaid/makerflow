import { expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, openDocuments, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, openQuotes } from "./quote-helpers";

const sheet = (page: Page) => page.getByRole("dialog");
const saved = (page: Page) => expect(page.getByTestId("design-save-status")).toHaveText("");
const pdfUrl = (page: Page) => page.getByTestId("pdf-pages").getAttribute("data-url");

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

test("a design is chosen and made yours on the preview, the usual look is set, and a sent quote never changes", async ({ page }) => {
  // A long walk: two quotes, a send and the usual look.
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "design-flow", "Look Co");
  await openBusinessProfile(page);
  await page.getByLabel("Phone", { exact: true }).fill("011 555 0101");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await saveQuote(page, "Thandi Nkosi");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  const designs = page.getByRole("group", { name: "Design" });
  await expect(page.getByTestId("current-design")).toHaveText("Classic");
  await expect(designs.getByRole("button", { name: /^Classic/ })).toHaveAttribute("aria-pressed", "true");

  // Choosing a design redraws the preview (the picture's address carries a stamp of what it says).
  const classicUrl = await pdfUrl(page);
  const tapped = Date.now();
  await designs.getByRole("button", { name: /^Bold/ }).click();
  await expect(designs.getByRole("button", { name: /^Bold/ })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => pdfUrl(page)).not.toBe(classicUrl);
  await expect(page.getByTestId("current-design")).toHaveText("Bold");
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  // The preview is drawn in the browser: a tap shows at once (no save or server trip first).
  await expect.poll(() => pdfUrl(page)).not.toBe(classicUrl);
  expect(Date.now() - tapped).toBeLessThan(2500);

  // Make it yours: a colour, and one part changed. It redraws again, and stays after a reload.
  const boldUrl = await pdfUrl(page);
  await page.getByRole("button", { name: "Make it yours" }).click();
  await page.getByRole("button", { name: "Teal", exact: true }).click();
  await expect.poll(() => pdfUrl(page)).not.toBe(boldUrl);
  const tealUrl = await pdfUrl(page);
  await page.getByRole("group", { name: "Total", exact: true }).getByRole("button").first().click();
  await expect.poll(() => pdfUrl(page)).not.toBe(tealUrl);
  await saved(page);
  await page.reload();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await expect(designs.getByRole("button", { name: /^Bold/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Teal", exact: true })).toHaveAttribute("aria-pressed", "true");

  // Send it. The design it goes out in is on the sent quote, read-only.
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await sheet(page).getByRole("button", { name: "Mark as sent" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?sent=marked$/);
  await expect(page.getByTestId("current-design")).toHaveText("Bold");
  await expect(page.getByRole("group", { name: "Design" })).toHaveCount(0);
  const sentUrl = page.url().split("?")[0];
  const before = await (await page.request.get(`${sentUrl}/pdf`)).body();

  // The business's usual look: Soft in rose. Every quote that follows it picks it up; sent ones do not.
  await openDocuments(page);
  const look = page.locator("#look");
  await look.getByRole("button", { name: /^Soft/ }).click();
  await look.getByRole("button", { name: "Make it yours" }).click();
  await look.getByRole("button", { name: "Rose", exact: true }).click();
  await look.getByRole("button", { name: "Save my look" }).click();
  await expect(look.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  await page.goto(sentUrl);
  await expect(page.getByTestId("current-design")).toHaveText("Bold");
  const after = await (await page.request.get(`${sentUrl}/pdf`)).body();
  expect(withoutDates(after)).toBe(withoutDates(before));

  // A new quote starts in the usual look and says so.
  await saveQuote(page, "Lerato Dube");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await expect(page.getByTestId("current-design")).toHaveText("Soft");
  await expect(page.getByText(/It follows your usual look/)).toBeVisible();
  // Choosing for this quote only, then going back to the usual look.
  const softUrl = await pdfUrl(page);
  await designs.getByRole("button", { name: /^Modern/ }).click();
  await expect(page.getByTestId("current-design")).toHaveText("Modern");
  await expect(page.getByText(/It follows your usual look/)).toHaveCount(0);
  await expect.poll(() => pdfUrl(page)).not.toBe(softUrl);
  const modernUrl = await pdfUrl(page);
  await page.getByRole("button", { name: "Use my usual look" }).click();
  await expect(page.getByText(/It follows your usual look/)).toBeVisible();
  await expect(page.getByTestId("current-design")).toHaveText("Soft");
  // Saved, not just shown: the preview is redrawn from what was stored, and a reload agrees.
  await expect.poll(() => pdfUrl(page)).not.toBe(modernUrl);
  await saved(page);
  await page.reload();
  await expect(page.getByTestId("current-design")).toHaveText("Soft");
});
