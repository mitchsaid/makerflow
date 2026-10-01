import { devices, expect, test } from "@playwright/test";
import { signOut, signUpAndOnboard } from "./helpers";

const promptHeading = "Make your quotes look right";

test("prompt leads to settings; details save, validate and persist; prompt goes away", async ({
  page,
}) => {
  await signUpAndOnboard(page, "profile", "Sweet Nothings");
  await expect(page.getByRole("heading", { name: promptHeading })).toBeVisible();

  await page.getByRole("link", { name: "Add my details" }).click();
  await expect(page).toHaveURL(/\/app\/settings$/);

  await page.getByLabel("Phone", { exact: true }).fill("021 123 4567");
  await page.getByLabel("Email", { exact: true }).fill("hello@sweet.example");
  await page.getByLabel("Street address").fill("12 Long Street");
  await page.getByLabel("City or town").fill("Cape Town");
  await page.getByLabel("Province").selectOption("Western Cape");
  await page.getByLabel("Postal code").fill("8001");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // VAT: a wrong number is rejected with a helpful message, a right one saves.
  await page.getByRole("checkbox", { name: "I'm registered for VAT" }).check();
  await page.getByLabel("VAT number").fill("12345");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("10 digits and start with 4")).toBeVisible();
  await page.getByLabel("VAT number").fill("412 345 6789");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Everything is still there after a reload.
  await page.reload();
  await expect(page.getByLabel("Phone", { exact: true })).toHaveValue("021 123 4567");
  await expect(page.getByLabel("Street address")).toHaveValue("12 Long Street");
  await expect(page.getByLabel("Province")).toHaveValue("Western Cape");
  await expect(page.getByRole("checkbox", { name: "I'm registered for VAT" })).toBeChecked();
  await expect(page.getByLabel("VAT number")).toHaveValue("4123456789");

  // With the details filled in, the prompt no longer appears on Home.
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.getByTestId("business-name")).toHaveText("Sweet Nothings");
  await expect(page.getByRole("heading", { name: promptHeading })).toHaveCount(0);
});

test("the prompt can be dismissed and stays dismissed", async ({ page }) => {
  await signUpAndOnboard(page, "dismiss", "Quiet Co");
  await expect(page.getByRole("heading", { name: promptHeading })).toBeVisible();

  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByRole("heading", { name: promptHeading })).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("business-name")).toHaveText("Quiet Co");
  await expect(page.getByRole("heading", { name: promptHeading })).toHaveCount(0);
});

test("business name can be changed, and unticking VAT clears the number", async ({ page }) => {
  await signUpAndOnboard(page, "vat", "Old Name");
  await page.getByRole("link", { name: "Settings" }).click();

  await page.getByLabel("Business name").fill("New Name");
  await page.getByRole("checkbox", { name: "I'm registered for VAT" }).check();
  await page.getByLabel("VAT number").fill("4123456789");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.getByRole("checkbox", { name: "I'm registered for VAT" }).uncheck();
  await expect(page.getByLabel("VAT number")).toHaveCount(0);
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Business name")).toHaveValue("New Name");
  await expect(page.getByRole("checkbox", { name: "I'm registered for VAT" })).not.toBeChecked();
  await expect(page.getByLabel("VAT number")).toHaveCount(0);

  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.getByTestId("business-name")).toHaveText("New Name");
});

test("each business only ever sees its own details", async ({ page, browser }) => {
  await signUpAndOnboard(page, "owner-a", "Business A");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Phone", { exact: true }).fill("021 111 2222");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  const other = await browser.newContext({ ...devices["Pixel 7"] });
  const pageB = await other.newPage();
  await signUpAndOnboard(pageB, "owner-b", "Business B");
  await pageB.getByRole("link", { name: "Settings" }).click();
  await expect(pageB.getByLabel("Business name")).toHaveValue("Business B");
  await expect(pageB.getByLabel("Phone", { exact: true })).toHaveValue("");
  await other.close();
});

test("on a phone the navigation is a bottom tab bar with the current section marked", async ({
  page,
}) => {
  await signUpAndOnboard(page, "nav", "Nav Co");

  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeVisible();
  const box = await nav.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.y + box!.height).toBeGreaterThan(viewport.height - 2); // pinned to the bottom
  expect(box!.width).toBeGreaterThan(viewport.width - 2); // full width

  await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");

  // Selecting a tab must not nudge any label: record where each sits, then compare.
  const labelBoxes = async () =>
    Promise.all(
      ["Home", "Settings"].map((name) =>
        nav.getByRole("link", { name }).locator("span span").last().boundingBox(),
      ),
    );
  const before = await labelBoxes();
  await nav.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(nav.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current", "page");
  const after = await labelBoxes();
  for (const i of [0, 1]) {
    expect(after[i]!.x).toBeCloseTo(before[i]!.x, 1);
    expect(after[i]!.width).toBeCloseTo(before[i]!.width, 1);
    expect(after[i]!.y).toBeCloseTo(before[i]!.y, 1);
  }
});

test("signing out from settings locks the workspace again", async ({ page }) => {
  await signUpAndOnboard(page, "out", "Out Co");
  await signOut(page);
  await page.goto("/app/settings");
  await expect(page).toHaveURL(/\/sign-in$/);
});
