import { expect, test } from "@playwright/test";
import { openMore, signUpAndOnboard } from "./helpers";

/** "Send feedback" (docs/plans/feedback-button.md): a row on the More tab opening a short sheet. */

test("feedback is sent from the More tab: the words are asked for, then it is sent and the next one starts empty", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "feedback", "Feedback Co");
  await openMore(page);
  await page.getByRole("button", { name: /Send feedback/ }).click();
  const sheet = page.getByRole("dialog", { name: "Send feedback" });
  await expect(sheet).toBeVisible();

  // Nothing typed: the problem is said at the field and in a summary, and the button stays pressable.
  await sheet.getByRole("button", { name: "Send feedback" }).click();
  await expect(sheet.getByTestId("form-summary")).toContainText("Tell us what happened or what would help");
  await expect(sheet.getByText("Tell us what happened or what would help").first()).toBeVisible();

  // Typed words go; the kind and the "you can email me" tick come with them.
  await sheet.getByLabel("It's about").selectOption({ label: "An idea" });
  await sheet.getByLabel("Your message").fill("It would help to copy last week's quote.");
  await expect(sheet.getByRole("checkbox", { name: "You can email me about this" })).toBeChecked();
  await sheet.getByRole("button", { name: "Send feedback" }).click();
  await expect(sheet.getByTestId("feedback-sent")).toContainText("Thank you. We read every message.");
  await expect(sheet.getByTestId("feedback-sent")).toContainText("We may email you");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog", { name: "Send feedback" })).toHaveCount(0);

  // The next one starts empty.
  await page.getByRole("button", { name: /Send feedback/ }).click();
  await expect(page.getByRole("dialog", { name: "Send feedback" }).getByLabel("Your message")).toHaveValue("");
});

test("closing the sheet before sending keeps what was typed", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page, "feedback-keep", "Feedback Keep Co");
  await openMore(page);
  await page.getByRole("button", { name: /Send feedback/ }).click();
  await page.getByRole("dialog", { name: "Send feedback" }).getByLabel("Your message").fill("Half a thought");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Send feedback" })).toHaveCount(0);
  await page.getByRole("button", { name: /Send feedback/ }).click();
  await expect(page.getByRole("dialog", { name: "Send feedback" }).getByLabel("Your message")).toHaveValue("Half a thought");
});

test.describe("on a wide screen", () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test("feedback is at the foot of the sidebar, where there is no More tab", async ({ page }) => {
    test.setTimeout(120_000);
    await signUpAndOnboard(page, "feedback-wide", "Feedback Wide Co");
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Send feedback" }).click();
    const sheet = page.getByRole("dialog", { name: "Send feedback" });
    await expect(sheet).toBeVisible();
    await sheet.getByLabel("Your message").fill("Wide screen works.");
    await sheet.getByRole("button", { name: "Send feedback" }).click();
    await expect(sheet.getByTestId("feedback-sent")).toBeVisible();
  });
});
