import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { openBusinessProfile, signUpAndOnboard } from "./helpers";
import { addCustomerInSheet, startSend } from "./quote-helpers";

const sheet = (page: Page) => page.getByRole("dialog");

/** A picture with some detail in it (a flat colour would compress to nothing). */
async function picture(width: number, height: number, format: "jpeg" | "png" = "jpeg") {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7919 + ((i >> 5) * 104729)) & 255;
  return sharp(raw, { raw: { width, height, channels: 3 } }).toFormat(format).toBuffer();
}

async function chooseFile(page: Page, buffer: Buffer, name: string, mimeType: string) {
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType, buffer });
}

/** How many pictures a PDF holds. */
const imagesIn = async (response: { body(): Promise<Buffer> }) =>
  ((await response.body()).toString("latin1").match(/\/Subtype \/Image/g) ?? []).length;

async function addBusinessPhone(page: Page) {
  await openBusinessProfile(page);
  await page.getByLabel("Phone", { exact: true }).fill("011 555 0101");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
}

test("a product photo is chosen, shown, replaced and removed", async ({ page }) => {
  await signUpAndOnboard(page, "pic-product", "Photo Co");
  await page.goto("/app/products/new");
  await expect(page.getByText("No picture")).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");
  await page.getByLabel("Price", { exact: true }).fill("800");

  // Not a picture: plain words, and nothing is attached.
  await chooseFile(page, Buffer.from("hello, not a picture"), "notes.png", "image/png");
  await expect(page.getByText(/doesn.t look like a picture we can use/)).toBeVisible();
  await expect(page.getByText("No picture")).toBeVisible();

  // A big phone photo: shrunk in the browser, made small on the server, shown on the form.
  await chooseFile(page, await picture(3000, 2000), "cake.jpg", "image/jpeg");
  const preview = page.getByTestId("photo-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("alt", "Photo of Wedding cake");
  const first = await preview.getAttribute("src");
  expect(first).toMatch(/^\/app\/images\/[0-9a-f-]{36}\?size=thumb$/);
  const served = await page.request.get(first!);
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("image/jpeg");
  expect(served.headers()["cache-control"]).toContain("immutable");
  const size = await sharp(await served.body()).metadata();
  expect([size.width, size.height]).toEqual([400, 400]);
  // The page's error message from before is gone.
  await expect(page.getByText(/doesn.t look like a picture/)).toHaveCount(0);

  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page).toHaveURL(/\/app\/products\?added=/);
  // The list shows it small.
  await expect(page.getByRole("link", { name: /Wedding cake/ }).locator("img")).toHaveCount(1);

  // Open it again: the photo is still there; replace it, then remove it.
  await page.getByRole("link", { name: /Wedding cake/ }).click();
  await expect(page.getByTestId("photo-preview")).toHaveAttribute("src", first!);
  await chooseFile(page, await picture(800, 800), "cake2.jpg", "image/jpeg");
  await expect(page.getByTestId("photo-preview")).not.toHaveAttribute("src", first!);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  const second = await page.getByTestId("photo-preview").getAttribute("src");
  expect(second).not.toBe(first);
  // The earlier picture is never deleted.
  expect((await page.request.get(first!)).status()).toBe(200);

  await page.getByRole("button", { name: /^Remove/ }).click();
  await expect(page.getByText("No picture")).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("No picture")).toBeVisible();

  // Only people in the business can see a picture.
  const other = await page.context().browser()!.newContext();
  const otherPage = await other.newPage();
  await signUpAndOnboard(otherPage, "pic-other", "Other Co");
  expect((await otherPage.request.get(second!)).status()).toBe(404);
  await other.close();
});

test("saving while a photo is still uploading waits instead of leaving the photo out", async ({ page }) => {
  await signUpAndOnboard(page, "pic-slow", "Slow Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");
  await page.getByLabel("Price", { exact: true }).fill("800");
  // A slow connection: the upload takes a few seconds.
  await page.route("**/app/images", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue();
  });
  await chooseFile(page, await picture(1200, 1200), "cake.jpg", "image/jpeg");
  await expect(page.getByRole("button", { name: /Uploading…/ })).toBeVisible();
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByText("Wait for the photo to finish uploading, then save.")).toBeVisible();
  await expect(page).toHaveURL(/\/app\/products\/new$/);
  // Once it is up, saving keeps the photo.
  await expect(page.getByTestId("photo-preview")).toBeVisible();
  await expect(page.getByText("Wait for the photo to finish uploading, then save.")).toHaveCount(0);
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page).toHaveURL(/\/app\/products\?added=/);
  await expect(page.getByRole("link", { name: /Wedding cake/ }).locator("img")).toHaveCount(1);
});

test("the Add an item list shows each product's photo, with an empty square for one without", async ({ page }) => {
  await signUpAndOnboard(page, "pic-pick", "Pick Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");
  await page.getByLabel("Price", { exact: true }).fill("800");
  await chooseFile(page, await picture(1200, 1200), "cake.jpg", "image/jpeg");
  await expect(page.getByTestId("photo-preview")).toBeVisible();
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page).toHaveURL(/\/app\/products\?added=/);
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cupcakes");
  await page.getByLabel("Price", { exact: true }).fill("15");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page).toHaveURL(/\/app\/products\?added=/);

  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Add an item");
  const cake = sheet(page).getByRole("button", { name: /Wedding cake/ });
  const cupcakes = sheet(page).getByRole("button", { name: /Cupcakes/ });
  await expect(cake.locator("img")).toHaveCount(1);
  await expect(cake.locator("img")).toHaveAttribute("src", /^\/app\/images\/[0-9a-f-]{36}\?size=thumb$/);
  await expect(cupcakes.locator("img")).toHaveCount(0);
  // The names line up whether or not there is a photo.
  // Both measured in one go, so the sheet sliding in cannot move one between the two.
  const [a, b] = await sheet(page).evaluate(() =>
    ["Wedding cake", "Cupcakes"].map((name) => {
      const el = [...document.querySelectorAll("[role='dialog'] button span")].find((e) => e.textContent === name);
      return el!.getBoundingClientRect().x;
    }),
  );
  expect(Math.abs(a! - b!)).toBeLessThan(1);
});

test("a service has no photo", async ({ page }) => {
  await signUpAndOnboard(page, "pic-service", "Service Co");
  await page.goto("/app/products/new?kind=service");
  await expect(page.getByLabel("Photo (optional)")).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});

test("the photo and the logo go on the quote, the switch turns photos off, and a sent quote keeps what it sent", async ({ page }) => {
  await signUpAndOnboard(page, "pic-quote", "Pictures Co");
  await addBusinessPhone(page);

  // The logo, on the Business profile.
  await openBusinessProfile(page);
  await chooseFile(page, await picture(1200, 400, "png"), "logo.png", "image/png");
  await expect(page.getByTestId("logoImage-preview")).toBeVisible();
  await page.getByRole("button", { name: "Save logo" }).click();
  await expect(page.getByText("Saved.").first()).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("logoImage-preview")).toBeVisible();

  // A product with a photo.
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");
  await page.getByLabel("Price", { exact: true }).fill("800");
  await chooseFile(page, await picture(1600, 1600), "cake.jpg", "image/jpeg");
  await expect(page.getByTestId("photo-preview")).toBeVisible();
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toBeVisible();

  // On a quote: the item shows its photo, and the switch appears.
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Wedding cake/ }).click();
  await sheet(page).getByRole("button", { name: "Add to quote" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await addCustomerInSheet(page, "Thandi Nkosi");
  const line = page.getByTestId("quote-line");
  await expect(line.locator("img")).toHaveCount(1);
  const switchBox = page.getByRole("checkbox", { name: "Show product photos on this quote" });
  await expect(switchBox).toBeChecked();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);
  const quoteUrl = page.url().split("?")[0];

  // The PDF has both pictures in it.
  const withPhotos = await page.request.get(`${quoteUrl}/pdf`);
  expect(withPhotos.status()).toBe(200);
  const bothCount = await imagesIn(withPhotos);
  expect(bothCount).toBeGreaterThanOrEqual(2);

  // Switched off: the photo goes (the logo stays), and it is saved.
  await switchBox.uncheck();
  await expect(line.locator("img")).toHaveCount(0);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  const without = await page.request.get(`${quoteUrl}/pdf`);
  // The logo is still there; the photo is not.
  expect(await imagesIn(without)).toBe(bothCount - 1);
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Show product photos on this quote" })).not.toBeChecked();
  await page.getByRole("checkbox", { name: "Show product photos on this quote" }).check();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();

  // Send it. Then the product gets a different photo and the business a different logo: the sent
  // version keeps the pictures it was sent with.
  await startSend(page);
  await sheet(page).getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();
  const before = await page.request.get(`${quoteUrl}/pdf`);
  expect(await imagesIn(before)).toBe(bothCount);

  await page.goto("/app/products");
  await page.getByRole("link", { name: /Wedding cake/ }).click();
  await page.getByRole("button", { name: /^Remove/ }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await openBusinessProfile(page);
  await page.getByRole("button", { name: /^Remove/ }).click();
  await page.getByRole("button", { name: "Save logo" }).click();
  await expect(page.getByText("Saved.").first()).toBeVisible();

  const after = await page.request.get(`${quoteUrl}/pdf`);
  expect(await imagesIn(after)).toBe(bothCount);
});

test("a variation choice has its own picture: chosen, kept after saving, shown beside it on a quote, removed", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "pic-choice", "Choice Pics Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");
  await page.getByRole("radio", { name: "Yes" }).click();
  await page.getByLabel("Variation name", { exact: true }).fill("Size");
  await page.getByLabel("Size 1", { exact: true }).fill("Small");
  await page.getByLabel("Size 1 price", { exact: true }).fill("300");
  await page.getByLabel("Size 2", { exact: true }).fill("Large");
  await page.getByLabel("Size 2 price", { exact: true }).fill("600");

  // A picture for Large only: not a picture is refused in plain words, a real one is shown on its button.
  // The product's own photo field comes first, then each choice's.
  const second = page.locator('input[type="file"]').nth(2);
  await second.setInputFiles({ name: "x.png", mimeType: "image/png", buffer: Buffer.from("hello, not a picture") });
  await expect(page.getByText(/doesn.t look like a picture we can use/)).toBeVisible();
  await second.setInputFiles({ name: "large.jpg", mimeType: "image/jpeg", buffer: await picture(1200, 900) });
  const largeButton = page.getByRole("button", { name: "Large: replace the picture" });
  await expect(largeButton.locator("img")).toBeVisible();
  await expect(page.getByText(/doesn.t look like a picture/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Small: add a picture" })).toBeVisible();

  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Wedding cake.");

  // Kept after saving: opened again, Large still has it.
  await page.getByRole("link", { name: /Wedding cake/ }).click();
  await expect(page.getByRole("button", { name: "Large: replace the picture" }).locator("img")).toBeVisible();

  // Beside the choice on a quote.
  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Wedding cake/ }).click();
  const choose = sheet(page).getByRole("group", { name: "Choose a size" });
  await expect(choose.locator("label", { hasText: "Large" }).locator("img")).toHaveCount(1);
  await expect(choose.locator("label", { hasText: "Small" }).locator("img")).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Removed: only the pointing stops.
  await page.goto("/app/products");
  await page.getByRole("link", { name: /Wedding cake/ }).click();
  await page.getByRole("button", { name: /^Remove picture of Large$/ }).click();
  await expect(page.getByRole("button", { name: "Large: add a picture" })).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Large: add a picture" })).toBeVisible();
});

test("a choice of another variation (a flavour) has its own picture too, shown beside it on a quote", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "pic-flavour", "Flavour Pics Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Cupcakes");
  await page.getByLabel("Price", { exact: true }).fill("30");
  // Other variations come under the first one.
  await page.getByRole("radio", { name: "Yes" }).click();
  await page.getByLabel("Variation name", { exact: true }).fill("Type");
  await page.getByLabel("Type 1", { exact: true }).fill("Standard");
  await page.getByLabel("Type 2", { exact: true }).fill("Other");
  await page.getByLabel("Type 2 price", { exact: true }).fill("30");
  await page.getByRole("button", { name: /^Add (a|another) variation$/ }).click();
  await page.getByLabel("Name of this variation").last().fill("Flavour");
  await page.getByLabel("Flavour: choice 1", { exact: true }).fill("Vanilla");
  await page.getByLabel("Flavour: choice 2", { exact: true }).fill("Red velvet");

  // The product's own photo field comes first, then each choice's (Standard, Other, then Vanilla).
  await page.locator('input[type="file"]').nth(3).setInputFiles({ name: "v.jpg", mimeType: "image/jpeg", buffer: await picture(900, 900) });
  await expect(page.getByRole("button", { name: "Vanilla: replace the picture" }).locator("img")).toBeVisible();
  await expect(page.getByRole("button", { name: "Red velvet: add a picture" })).toBeVisible();

  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByTestId("product-added")).toHaveText("Added Cupcakes.");

  await page.goto("/app/quotes/new");
  await page.getByRole("button", { name: "Add item" }).click();
  await sheet(page).getByRole("button", { name: /Cupcakes/ }).click();
  const flavour = sheet(page).getByRole("group", { name: "Flavour" });
  await expect(flavour.locator("label", { hasText: "Vanilla" }).locator("img")).toHaveCount(1);
  await expect(flavour.locator("label", { hasText: "Red velvet" }).locator("img")).toHaveCount(0);
});

test("pictures chosen for two choices at once both stay, and what is typed while they upload is kept", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "pic-race", "Race Pics Co");
  await page.goto("/app/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Wedding cake");
  await page.getByRole("radio", { name: "Yes" }).click();
  await page.getByLabel("Variation name", { exact: true }).fill("Size");
  await page.getByLabel("Size 1", { exact: true }).fill("Small");
  await page.getByLabel("Size 2", { exact: true }).fill("Large");

  // Both pictures are on their way together, and a price is typed meanwhile (the product's own photo field is first).
  const files = page.locator('input[type="file"]');
  const one = await picture(2400, 1800);
  await files.nth(1).setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: one });
  await files.nth(2).setInputFiles({ name: "b.jpg", mimeType: "image/jpeg", buffer: one });
  await page.getByLabel("Size 1 price", { exact: true }).fill("300");

  await expect(page.getByRole("button", { name: "Small: replace the picture" }).locator("img")).toBeVisible();
  await expect(page.getByRole("button", { name: "Large: replace the picture" }).locator("img")).toBeVisible();
  await expect(page.getByLabel("Size 1 price", { exact: true })).toHaveValue("300");
  await expect(page.getByLabel("Size 1", { exact: true })).toHaveValue("Small");
});
