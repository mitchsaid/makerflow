import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

/**
 * Layout checks that need no particular data: on a phone, no field sticks out of the card it is in, and no page
 * scrolls sideways. They also run in Safari on an iPhone (the "iphone" project), where date fields in particular
 * have been wider than their card.
 */

/** The fields (and buttons) that stick out of their card, or the page itself if it scrolls sideways. */
async function stickingOut(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const tolerance = 1;
    for (const card of document.querySelectorAll<HTMLElement>('[data-slot="card"]')) {
      const box = card.getBoundingClientRect();
      for (const el of card.querySelectorAll<HTMLElement>("input:not([type=hidden]):not([type=file]), select, textarea, button")) {
        const rect = el.getBoundingClientRect();
        // The hidden inputs behind radio buttons and the like are one pixel, off to the side.
        if (rect.width <= 2 || rect.height <= 2) continue;
        if (rect.right > box.right + tolerance || rect.left < box.left - tolerance) {
          const name = el.getAttribute("aria-label") ?? el.id ?? el.tagName;
          found.push(`${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} (${name}) is ${Math.round(rect.left)}–${Math.round(rect.right)}, its card ${Math.round(box.left)}–${Math.round(box.right)}`);
        }
      }
    }
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth + tolerance) found.push(`the page scrolls sideways (${root.scrollWidth} wide in ${root.clientWidth})`);
    return found;
  });
}

test("on a phone, date fields and the rest of the new quote fit inside their cards", async ({ page }) => {
  await signUpAndOnboard(page, "layout-quote", "Layout Co");
  await page.goto("/app/quotes/new");
  await expect(page.getByLabel("Quote date")).toBeVisible();
  await expect(page.getByLabel("Valid until")).toBeVisible();
  await expect(page.getByLabel("Needed by (optional)")).toBeVisible();
  expect(await stickingOut(page)).toEqual([]);

  // Each date field has its calendar icon (drawn by the field itself: the native one is not there on a phone), so
  // it still looks like a date field after being made to fit.
  for (const label of ["Quote date", "Valid until", "Needed by (optional)"]) {
    const field = page.getByLabel(label);
    await expect(field.locator("xpath=..").locator("svg")).toHaveCount(1);
    await expect(field.locator("xpath=..").locator("svg")).toBeVisible();
  }
});

test("on a phone, the other forms fit inside their cards too", async ({ page }) => {
  await signUpAndOnboard(page, "layout-forms", "Layout Forms Co");
  for (const path of ["/app/products/new", "/app/products/materials", "/app/products/materials/new", "/app/business", "/app/documents", "/app/settings"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await stickingOut(page), path).toEqual([]);
  }
});
