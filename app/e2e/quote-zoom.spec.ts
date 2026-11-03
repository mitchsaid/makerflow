import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";
import { sentQuote } from "./quote-helpers";

/**
 * Pinch and zoom on the document (docs/plans/quote-viewer-zoom.md): "Zoom in" under the preview opens the document full
 * screen, sharper; buttons, double-tap, a two-finger pinch and a drag move it; Close returns to the page.
 */
type Touch = (type: "touchStart" | "touchMove" | "touchEnd", points: { x: number; y: number }[]) => Promise<unknown>;
/** Real touches (more than one finger), which Playwright's own touchscreen cannot send. One session keeps their state. */
async function touches(page: Page): Promise<Touch> {
  const session = await page.context().newCDPSession(page);
  return (type, points) => session.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, id) => ({ ...p, id })) });
}

const scale = async (page: Page) => Number(await page.getByTestId("zoom-viewport").getAttribute("data-scale"));

test("a sent quote can be opened full screen and zoomed with buttons, double-tap, pinch and drag", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "quote-zoom", "Zoom Co");
  await sentQuote(page);
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();

  await page.getByTestId("zoom-open").click();
  const viewport = page.getByTestId("zoom-viewport");
  await expect(page.getByTestId("zoom-page").first()).toBeVisible();
  expect(await scale(page)).toBe(1);
  // Fitted: nothing to zoom out of.
  await expect(page.getByTestId("zoom-out")).toBeDisabled();
  await expect(page.getByTestId("zoom-fit")).toBeDisabled();

  // Buttons.
  await page.getByTestId("zoom-in").click();
  expect(await scale(page)).toBeCloseTo(1.5);
  await page.getByTestId("zoom-in").click();
  expect(await scale(page)).toBeCloseTo(2.25);
  await page.getByTestId("zoom-fit").click();
  expect(await scale(page)).toBe(1);

  // Double-tap goes in where it is tapped, and again goes back.
  const box = (await viewport.boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 3 };
  await page.touchscreen.tap(at.x, at.y);
  await page.touchscreen.tap(at.x, at.y);
  await expect.poll(() => scale(page)).toBeCloseTo(2.5);
  await page.touchscreen.tap(at.x, at.y);
  await page.touchscreen.tap(at.x, at.y);
  await expect.poll(() => scale(page)).toBe(1);

  // A two-finger pinch zooms in.
  const touch = await touches(page);
  const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await touch("touchStart", [{ x: mid.x - 30, y: mid.y }, { x: mid.x + 30, y: mid.y }]);
  for (const spread of [50, 80, 110]) await touch("touchMove", [{ x: mid.x - spread, y: mid.y }, { x: mid.x + spread, y: mid.y }]);
  await touch("touchEnd", []);
  await expect.poll(() => scale(page)).toBeGreaterThan(2.5);

  // A one-finger drag moves the document.
  const pageBox = () => page.getByTestId("zoom-page").first().boundingBox();
  const before = (await pageBox())!;
  await touch("touchStart", [{ x: mid.x, y: mid.y }]);
  for (const dx of [-20, -60, -100]) await touch("touchMove", [{ x: mid.x + dx, y: mid.y }]);
  await touch("touchEnd", []);
  await expect.poll(async () => ((await pageBox())!.x)).toBeLessThan(before.x - 50);

  // Colours and names are fine, light and dark.
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`), colorScheme).toEqual([]);
  }

  // Close: back on the page, which is as it was.
  await page.getByTestId("zoom-close").click();
  await expect(viewport).toHaveCount(0);
  await expect(page.getByTestId("pdf-page").first()).toBeVisible();
});
