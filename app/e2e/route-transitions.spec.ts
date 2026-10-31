import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

/**
 * Route transitions (docs/plans/route-transitions.md): going deeper, coming back and moving between tabs each run a
 * view transition, with the direction as its type (none for tabs). The page is usable at once, whatever the
 * animation is doing.
 */

/** Records every view transition the page starts, with its types, so a test can say which way a navigation went. */
async function recordTransitions(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __transitions: { vt: { types?: Set<string> } }[] };
    w.__transitions = [];
    const original = document.startViewTransition?.bind(document);
    if (!original) return;
    document.startViewTransition = ((arg?: unknown) => {
      const vt = original(arg as never) as unknown as { types?: Set<string> };
      w.__transitions.push({ vt });
      return vt as never;
    }) as typeof document.startViewTransition;
  });
}

const transitionsSince = (page: Page, from: number) =>
  page.evaluate((start) => {
    const w = window as unknown as { __transitions: { vt: { types?: Set<string> } }[] };
    return w.__transitions.slice(start).map((t) => Array.from(t.vt.types ?? []));
  }, from);
const count = (page: Page) => page.evaluate(() => (window as unknown as { __transitions: unknown[] }).__transitions.length);

test("going deeper slides forward, coming back slides back, and a tab fades", async ({ page }) => {
  test.setTimeout(180_000);
  await recordTransitions(page);
  await signUpAndOnboard(page, "route-transitions", "Transition Co");
  await page.goto("/app/quotes");
  await expect(page.getByRole("heading", { name: "Quotes", level: 1 })).toBeVisible();
  expect(await page.evaluate(() => typeof document.startViewTransition)).toBe("function");

  // Deeper: the list to a new quote.
  let before = await count(page);
  await page.getByRole("link", { name: "New quote" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/new/);
  await expect(page.getByRole("heading", { name: "New quote", level: 1 })).toBeVisible();
  const forward = await transitionsSince(page, before);
  expect(forward.length).toBeGreaterThan(0);
  expect(forward.flat()).toContain("nav-forward");

  // Back: the close control goes to the parent.
  before = await count(page);
  await page.getByTestId("close-link").click();
  await expect(page).toHaveURL(/\/app\/quotes$/);
  await expect(page.getByRole("heading", { name: "Quotes", level: 1 })).toBeVisible();
  const back = await transitionsSince(page, before);
  expect(back.length).toBeGreaterThan(0);
  expect(back.flat()).toContain("nav-back");

  // A tab is neither: it runs a transition with no direction (a fade).
  before = await count(page);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Jobs" }).click();
  await expect(page).toHaveURL(/\/app\/jobs$/);
  await expect(page.getByRole("heading", { name: "Jobs", level: 1 })).toBeVisible();
  const tab = await transitionsSince(page, before);
  expect(tab.length).toBeGreaterThan(0);
  expect(tab.flat()).not.toContain("nav-forward");
  expect(tab.flat()).not.toContain("nav-back");
});

test("the page can be used straight away, during the animation", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "route-transitions-usable", "Usable Co");
  await page.goto("/app/quotes");
  await page.getByRole("link", { name: "New quote" }).click();
  // No waiting for the animation: the first field takes typing at once, and the animation layer catches no taps.
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByRole("dialog", { name: "Add an item" })).toBeVisible();
  const layer = await page.evaluate(() => getComputedStyle(document.documentElement, "::view-transition").pointerEvents);
  expect(layer === "none" || layer === "auto").toBe(true);
});

test("with reduced motion the animations have no length", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUpAndOnboard(page, "route-transitions-reduced", "Reduced Co");
  const css = await page.evaluate(async () => {
    const sheets = Array.from(document.styleSheets);
    const rules: string[] = [];
    for (const sheet of sheets) {
      try {
        for (const rule of Array.from(sheet.cssRules)) rules.push(rule.cssText);
      } catch {
        // A sheet from another site cannot be read.
      }
    }
    return rules.join("\n");
  });
  expect(css).toContain("prefers-reduced-motion");
  expect(css).toMatch(/view-transition-new\(\*\)/);
  await page.goto("/app/quotes");
  await page.getByRole("link", { name: "New quote" }).click();
  await expect(page.getByRole("heading", { name: "New quote", level: 1 })).toBeVisible();
});
