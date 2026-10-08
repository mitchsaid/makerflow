import { expect, test } from "@playwright/test";
import { openDocuments, signUpAndOnboard } from "./helpers";

const card = (page: import("@playwright/test").Page) => page.getByRole("form", { name: "Two quick questions" });

test("the first New quote asks two questions and starts the form the way they were answered", async ({ page }) => {
  await signUpAndOnboard(page, "setup-answer", "Setup Co", { quoteSetup: "leave" });
  await page.goto("/app/quotes/new");
  await expect(page.getByRole("heading", { name: "New quote", level: 1 })).toBeVisible();
  await expect(card(page)).toBeVisible();
  // The form is not there yet: the questions come first.
  await expect(page.getByRole("button", { name: "Add item" })).toHaveCount(0);

  await card(page).getByRole("radio", { name: "Yes, to start work" }).check();
  await card(page).getByLabel("How much, as a percentage of the total?").fill("40");
  await card(page).getByRole("radio", { name: "I deliver it" }).check();
  await card(page).getByRole("button", { name: "Save and start my quote" }).click();

  // The form, started that way.
  await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Ask for a deposit to start work" })).toBeChecked();
  await expect(page.getByLabel("Percentage (%)")).toHaveValue("40");
  await expect(page.getByRole("radio", { name: /^Delivery/ })).toBeChecked();
  await expect(page.getByLabel(/^Delivery fee/)).toBeVisible();

  // The answers live under Quotes and invoices, and are not asked again.
  await openDocuments(page);
  await expect(page.getByLabel("Percentage (%)")).toHaveValue("40");
  await expect(page.getByLabel("New quotes start with")).toHaveValue("delivery");
  await page.goto("/app/quotes/new");
  await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();
  await expect(card(page)).toHaveCount(0);

  // Changing the hand-over there changes where the next new quote starts.
  await openDocuments(page);
  await page.getByLabel("New quotes start with").selectOption("collection");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.").last()).toBeVisible();
  await page.goto("/app/quotes/new");
  await expect(page.getByRole("radio", { name: /^Collection/ })).toBeChecked();
});

test("skipping, or answering 'it varies' and no deposit, leaves the form as it was", async ({ page }) => {
  await signUpAndOnboard(page, "setup-skip", "Skip Setup Co", { quoteSetup: "leave" });
  await page.goto("/app/quotes/new");
  await card(page).getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Ask for a deposit to start work" })).not.toBeChecked();
  await expect(page.getByRole("radio", { name: "Not decided yet" })).toBeChecked();
  // Skipped means asked: it does not come back.
  await page.goto("/app/quotes/new");
  await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();
  await expect(card(page)).toHaveCount(0);
});

test("a deposit percentage that can't be used says how to fix it and keeps the answers", async ({ page }) => {
  await signUpAndOnboard(page, "setup-error", "Error Setup Co", { quoteSetup: "leave" });
  await page.goto("/app/quotes/new");
  await card(page).getByRole("radio", { name: "Yes, to start work" }).check();
  await card(page).getByRole("radio", { name: "They collect it" }).check();
  await card(page).getByLabel("How much, as a percentage of the total?").fill("");
  await card(page).getByRole("button", { name: "Save and start my quote" }).click();
  await expect(page.getByTestId("form-summary")).toBeVisible();
  await expect(card(page).getByLabel("How much, as a percentage of the total?")).toHaveAccessibleDescription(/./);
  // Nothing typed is lost.
  await expect(card(page).getByRole("radio", { name: "They collect it" })).toBeChecked();
  await expect(card(page).getByRole("radio", { name: "Yes, to start work" })).toBeChecked();

  await card(page).getByLabel("How much, as a percentage of the total?").fill("30");
  await card(page).getByRole("button", { name: "Save and start my quote" }).click();
  await expect(page.getByLabel("Percentage (%)")).toHaveValue("30");
  await expect(page.getByRole("radio", { name: /^Collection/ })).toBeChecked();
});
