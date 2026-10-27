import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { businessTab, openBusinessProfile, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, fillItem, sheet } from "./quote-helpers";

/** Ways to pay besides the bank account (docs/plans/payment-methods.md). */

const text = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "The quote as text" });

test("the owner adds, changes and removes a payment link in the Business profile, checked for this country", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "pm-profile", "Sweet Co");
  await openBusinessProfile(page, "Ways to pay");

  // The list of kinds, each one a choice.
  await page.getByRole("button", { name: "Add a way to pay" }).click();
  const kinds = sheet(page).getByRole("list", { name: "Ways to pay" });
  await expect(kinds.getByRole("button")).toHaveText([/QR code/, /Payment link/, /PayShap or mobile payment ID/, /Pay on collection/, /Something else/]);
  await kinds.getByRole("button", { name: /^Payment link/ }).click();
  await expect(sheet(page)).toHaveAccessibleName("Add payment link");

  // Saving with a wrong address says how to fix it, at the field; nothing typed is lost.
  await expect(sheet(page).getByLabel("Name", { exact: true })).toHaveValue("Pay online");
  await sheet(page).getByLabel("Web address").fill("pay.example.test/sweet");
  await sheet(page).getByRole("button", { name: "Save way to pay" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toContainText("starting with https://");
  await expect(sheet(page).getByLabel("Web address")).toHaveAttribute("aria-invalid", "true");
  await expect(sheet(page).getByLabel("Web address")).toHaveValue("pay.example.test/sweet");
  await sheet(page).getByLabel("Web address").fill("https://pay.example.test/sweet");
  await sheet(page).getByRole("button", { name: "Save way to pay" }).click();
  await expect(sheet(page)).toHaveCount(0);

  // It is a card on the tab, and still there on a fresh load.
  const card = page.getByRole("group", { name: "Pay online" });
  await expect(card.getByLabel("Web address")).toHaveValue("https://pay.example.test/sweet");
  await page.reload();
  await expect(page.getByRole("group", { name: "Pay online" }).getByLabel("Web address")).toHaveValue("https://pay.example.test/sweet");

  // Rename it.
  await page.getByRole("group", { name: "Pay online" }).getByLabel("Name", { exact: true }).fill("Pay by card");
  await page.getByRole("button", { name: "Save Pay online" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." }).last()).toBeVisible();

  // Remove it, after a question.
  await page.getByRole("button", { name: /^Remove Pay by card/ }).click();
  await expect(page.getByRole("alertdialog", { name: "Remove Pay by card?" })).toContainText("Quotes and invoices already sent keep it.");
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await page.getByRole("button", { name: /^Remove Pay by card/ }).click();
  await page.getByRole("button", { name: "Yes, remove it" }).click();
  await expect(page.getByRole("group", { name: "Pay by card" })).toHaveCount(0);
});

test("a quote shows each saved way with a tick, new quotes leave off the ways kept off them, and a sent quote keeps what it showed", async ({ page }) => {
  test.setTimeout(240_000);
  await signUpAndOnboard(page, "pm-quote", "Sweet Co");

  // One way kept on new quotes, one kept off them.
  await openBusinessProfile(page, "Ways to pay");
  await page.getByRole("button", { name: "Add a way to pay" }).click();
  await sheet(page).getByRole("button", { name: /^PayShap or mobile payment ID/ }).click();
  await sheet(page).getByLabel("PayShap ID or number").fill("082 555 0101");
  await sheet(page).getByRole("button", { name: "Save way to pay" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Add a way to pay" }).click();
  await sheet(page).getByRole("button", { name: /^Pay on collection/ }).click();
  await sheet(page).getByLabel("What to tell the customer").fill("Cash or card, thank you");
  await sheet(page).getByRole("checkbox", { name: "Show on new quotes and invoices" }).uncheck();
  await sheet(page).getByRole("button", { name: "Save way to pay" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole("group", { name: "PayShap" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Pay on collection" })).toBeVisible();

  // A new quote: PayShap ticked, collection not.
  await page.goto("/app/quotes/new");
  const pay = page.getByRole("group", { name: "How to pay" });
  await expect(pay.getByRole("checkbox", { name: /Show PayShap on this quote/ })).toBeChecked();
  await expect(pay.getByRole("checkbox", { name: /Show Pay on collection on this quote/ })).not.toBeChecked();
  await expect(pay.getByText("PayShap or mobile payment ID · 082 555 0101")).toBeVisible();

  await fillItem(page, 1, "Cake", "1", "500");
  await addCustomerInSheet(page, "Sarah");
  await pay.getByRole("checkbox", { name: /Show Pay on collection on this quote/ }).check();
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await expect(text(page)).toContainText("How to pay");
  await expect(text(page)).toContainText("PayShap");
  await expect(text(page)).toContainText("082 555 0101");
  await expect(text(page)).toContainText("Cash or card, thank you");

  // Unticking a way leaves it off this quote.
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByRole("group", { name: "How to pay" }).getByRole("checkbox", { name: /Show PayShap on this quote/ }).uncheck();
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await expect(text(page)).not.toContainText("082 555 0101");
  await expect(text(page)).toContainText("Cash or card, thank you");

  // Sent, then the way is changed: the sent quote keeps what it showed.
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByRole("group", { name: "How to pay" }).getByRole("checkbox", { name: /Show PayShap on this quote/ }).check();
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await page.getByRole("button", { name: "Mark as sent", exact: true }).click();
  await sheet(page).getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(page.getByTestId("sent-banner")).toBeVisible();
  const quoteUrl = page.url().split("?")[0];

  await openBusinessProfile(page, "Ways to pay");
  await page.getByRole("group", { name: "PayShap" }).getByLabel("PayShap ID or number").fill("072 000 0000");
  await page.getByRole("button", { name: "Save PayShap" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." }).last()).toBeVisible();

  await page.goto(quoteUrl);
  const document = page.getByTestId("quote-document");
  await expect(document).toContainText("082 555 0101");
  await expect(document).not.toContainText("072 000 0000");
});

test("a way to pay can be added from a quote, without losing what was typed, and is ticked on it", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page, "pm-sheet", "Sweet Co");
  await page.goto("/app/quotes/new");
  const pay = page.getByRole("group", { name: "How to pay" });
  await expect(pay.getByText("No ways to pay yet")).toBeVisible();
  // (Typing while the page is still waking up can land in front of the text instead of replacing it: type until it takes.)
  const intro = page.getByLabel("Intro (optional)");
  await expect(async () => {
    await intro.fill("Cake for Sarah");
    await expect(intro).toHaveValue("Cake for Sarah", { timeout: 1_000 });
  }).toPass();
  await pay.getByRole("button", { name: "Add a way to pay" }).click();
  await sheet(page).getByRole("button", { name: /^Something else/ }).click();
  await sheet(page).getByLabel("Name", { exact: true }).fill("Cash deposit");
  await sheet(page).getByRole("button", { name: "Save way to pay" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toContainText("Enter the details");
  await sheet(page).getByLabel("Details").fill("Hand it to Thandi");
  await sheet(page).getByRole("button", { name: "Save way to pay" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByLabel("Intro (optional)")).toHaveValue("Cake for Sarah");
  await expect(pay.getByRole("checkbox", { name: /Show Cash deposit on this quote/ })).toBeChecked();
  await expect(pay.getByText("Something else · Hand it to Thandi")).toBeVisible();

  // The business profile has it too.
  await openBusinessProfile(page);
  await businessTab(page, "Ways to pay");
  await expect(page.getByRole("group", { name: "Cash deposit" })).toBeVisible();
});

/** A square picture with a chequered pattern, standing in for a QR code. */
async function qrFile() {
  const size = 200;
  const raw = Buffer.alloc(size * size * 3, 255);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (((x >> 3) + (y >> 3)) % 2 === 0) raw.fill(0, (y * size + x) * 3, (y * size + x) * 3 + 3);
    }
  }
  return sharp(raw, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
}

test("a QR code is an uploaded picture: needed, saved, shown on the quote and its PDF, and a sent quote keeps it", async ({ page }) => {
  test.setTimeout(240_000);
  await signUpAndOnboard(page, "pm-qr", "Sweet Co");
  await openBusinessProfile(page, "Ways to pay");

  // The picture is needed: saying so, at the field.
  await page.getByRole("button", { name: "Add a way to pay" }).click();
  await sheet(page).getByRole("button", { name: /^QR code/ }).click();
  await expect(sheet(page)).toHaveAccessibleName("Add QR code");
  await expect(sheet(page).getByLabel("Name", { exact: true })).toHaveValue("Scan to pay");
  await sheet(page).getByLabel("Name", { exact: true }).fill("SnapScan");
  await sheet(page).getByRole("button", { name: "Save way to pay" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toContainText("Choose the QR code picture");

  // Choosing one shows it; saving adds the card.
  await sheet(page).locator('input[type="file"]').setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: await qrFile() });
  await expect(sheet(page).getByRole("img", { name: "QR code for SnapScan" })).toBeVisible();
  await sheet(page).getByLabel("What to tell the customer").fill("Scan with your banking app");
  await sheet(page).getByRole("button", { name: "Save way to pay" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole("group", { name: "SnapScan" }).getByRole("img", { name: "QR code for SnapScan" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("group", { name: "SnapScan" }).getByRole("img", { name: "QR code for SnapScan" })).toBeVisible();

  // On a quote: ticked, printed with its words, and the PDF draws it.
  await page.goto("/app/quotes/new");
  const pay = page.getByRole("group", { name: "How to pay" });
  await expect(pay.getByRole("checkbox", { name: /Show SnapScan on this quote/ })).toBeChecked();
  await expect(pay.getByText("QR code · Scan with your banking app")).toBeVisible();
  await fillItem(page, 1, "Cake", "1", "500");
  await addCustomerInSheet(page, "Sarah");
  await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
  await expect(text(page)).toContainText("Scan with your banking app");
  // (The text version of the quote is for screen readers: the picture is there, with its description, and really loads.)
  const qr = text(page).getByRole("img", { name: "QR code for SnapScan" });
  await expect(qr).toBeAttached();
  await expect.poll(async () => qr.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(100);
  const pdf = await page.request.get(page.url().replace(/\/preview.*$/, "/pdf"));
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  // Sent: the picture stays with the quote.
  await page.getByRole("button", { name: "Mark as sent", exact: true }).click();
  await sheet(page).getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(page.getByTestId("sent-banner")).toBeVisible();
  await expect(page.getByTestId("quote-document").getByTestId("pay-qr")).toBeAttached();
});
