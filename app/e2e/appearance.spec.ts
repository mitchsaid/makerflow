import { expect, test } from "@playwright/test";
import { openSettings, signUpAndOnboard } from "./helpers";

/** The Appearance choice (docs/plans/visual-design.md): light, dark, or the same as the device. */
const LIGHT_BG = "rgb(251, 246, 236)";
const DARK_BG = "rgb(20, 17, 14)";
const background = (page: import("@playwright/test").Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
// The buttons animate their colours, so these are polled. The Sign out button is an outline button: it has the page's colour in light, and `dark:bg-input/30` in dark.
const signOutBackground = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Sign out" }).evaluate((el) => getComputedStyle(el).backgroundColor);

test.describe("on a phone that prefers light", () => {
  test.use({ colorScheme: "light" });
  test("choosing Dark makes the app dark, keeps it after a reload, and Same as this device goes back", async ({ page }) => {
    test.setTimeout(150_000);
    await signUpAndOnboard(page, "appearance-dark", "Appearance Dark Co");
    await openSettings(page);
    expect(await background(page)).toBe(LIGHT_BG);
    await expect(page.getByRole("radio", { name: /Same as this device/ })).toBeChecked();

    await page.getByRole("radio", { name: "Dark", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await background(page)).toBe(DARK_BG);
    // The address-bar colour follows too.
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", "#14110e");

    // After a reload it is dark from the first paint, and the choice shows as chosen.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await background(page)).toBe(DARK_BG);
    await expect(page.getByRole("radio", { name: "Dark", exact: true })).toBeChecked();

    // The `dark:` classes follow the choice, not only the device: this phone prefers light, yet the button has its dark look.
    await expect.poll(() => signOutBackground(page)).not.toBe(LIGHT_BG);
    await page.getByRole("radio", { name: /Same as this device/ }).click();
    await expect.poll(() => signOutBackground(page)).toBe(LIGHT_BG);
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
    expect(await background(page)).toBe(LIGHT_BG);
    await page.reload();
    expect(await background(page)).toBe(LIGHT_BG);
  });
});

test.describe("on a phone that prefers dark", () => {
  test.use({ colorScheme: "dark" });
  test("it follows the phone until Light is chosen", async ({ page }) => {
    test.setTimeout(150_000);
    await signUpAndOnboard(page, "appearance-light", "Appearance Light Co");
    await openSettings(page);
    expect(await background(page)).toBe(DARK_BG);
    await page.getByRole("radio", { name: "Light", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await background(page)).toBe(LIGHT_BG);
    await page.reload();
    expect(await background(page)).toBe(LIGHT_BG);
    // The `dark:` variant is off too, though the phone prefers dark: the outline button has the page's light colour.
    await openSettings(page);
    await expect.poll(() => signOutBackground(page)).toBe(LIGHT_BG);
  });
});
