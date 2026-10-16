import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";
import { localSupabase, openBusinessProfile, openDocuments, openMore, openSettings, signUpAndOnboard, uniqueEmail, waitForSignInLink } from "./helpers";

// Automated accessibility checks (axe): contrast, labels, headings, names, tap-target
// basics. They catch a lot but not everything; a screen-reader pass is still worth doing.
async function expectNoViolations(page: Page, where: string) {
  // Not while a page's loading skeleton is still on screen: it has no title of its own, and is not the page.
  await expect(page.getByTestId("page-loading")).toHaveCount(0);
  // The page title streams in just after the page itself; checking before it arrives reports a
  // missing title that is not really missing.
  await expect(page).toHaveTitle(/.+/);
  // During a soft navigation the old title is swapped for the new one; wait until it has stayed put for a moment.
  await expect
    .poll(
      async () => {
        const first = await page.title();
        await page.waitForTimeout(150);
        return first.trim() !== "" && (await page.title()) === first;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  // Sheets fade in; colours measured halfway through a fade are not the colours people see.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  // A sticky action bar covers part of whatever is under it at this scroll position, which says nothing about the page
  // under it (target-size counts a covered target as small). Its own content is still checked: it is only let go of
  // its place on the screen for the scan, so it sits in the flow instead of over the page.
  await page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('[data-testid="action-bar"]');
    if (bar) bar.style.position = "static";
  });
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  await page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('[data-testid="action-bar"]');
    if (bar) bar.style.position = "";
  });
  const summary = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
  );
  expect(summary, `accessibility problems on ${where}`).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test("signed-out pages", async ({ page }) => {
      await page.goto("/");
      await expectNoViolations(page, "landing page");

      await page.goto("/sign-in");
      await expectNoViolations(page, "sign-in");

      await page.goto("/sign-in?error=link");
      await expect(page.getByText("expired or was already used")).toBeVisible();
      await expectNoViolations(page, "sign-in with an error");
    });

    test("sign-up steps and the examples tailored to what they make", async ({ page }) => {
      const email = uniqueEmail(`a11y-onboard-${scheme}`);
      await page.goto("/sign-in");
      await page.getByLabel("Email address").fill(email);
      await page.getByRole("button", { name: "Email me a sign-in link" }).click();
      await expect(page.getByRole("status")).toContainText("Check your email");
      await page.goto(await waitForSignInLink(email));
      await expect(page.getByLabel("Business name")).toBeVisible();
      await expectNoViolations(page, "onboarding, business name");
      await page.getByLabel("Business name").fill("Onboard Axe Co");
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("heading", { name: "What do you make or sell?", level: 1 })).toBeVisible();
      await expectNoViolations(page, "onboarding, what do you make");
      await page.getByRole("checkbox", { name: "Food and baking" }).check();
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByTestId("business-name")).toBeVisible();

      await page.goto("/app/documents/policies");
      await expect(page.getByTestId("showing-types")).toBeVisible();
      await page.getByTestId("more-examples").locator("summary").click();
      await expectNoViolations(page, "terms, examples for you with more examples open");
    });

    test("signed-in pages", async ({ page }) => {
      // One long walk through every screen (and their error states); it grows with the app.
      test.setTimeout(720_000);
      await signUpAndOnboard(page, `a11y-${scheme}`, "Axe Co");
      await expectNoViolations(page, "home");

      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Jobs" }).click();
      await expect(page.getByRole("heading", { name: "Jobs", level: 1 })).toBeVisible();
      await expectNoViolations(page, "jobs, empty");
      await page.getByRole("link", { name: "New job" }).first().click();
      await expect(page.getByRole("heading", { name: "New job", level: 1 })).toBeVisible();
      await expectNoViolations(page, "new job");
      await page.getByRole("button", { name: "Create job" }).click();
      await expect(page.getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "new job, with errors");
      await page.getByRole("button", { name: "Add item" }).click();
      await expect(page.getByRole("dialog", { name: "Add an item" })).toBeVisible();
      await expectNoViolations(page, "new job, add an item");
      await page.getByRole("dialog").getByRole("button", { name: "One-off item (just for this job)" }).click();
      await expect(page.getByRole("dialog", { name: "One-off item" })).toBeVisible();
      await expectNoViolations(page, "new job, one-off item");
      await page.getByRole("dialog").getByLabel("Name", { exact: true }).fill("Shelf");
      await page.getByRole("dialog").getByRole("button", { name: "Add to job" }).click();
      await expect(page.getByTestId("job-form-item")).toHaveCount(1);
      await expectNoViolations(page, "new job, with an item");
      await page.getByRole("radio", { name: "Delivery (you deliver)" }).check();
      await expectNoViolations(page, "new job, delivery");
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Jobs" }).click();

      await openMore(page);
      await expectNoViolations(page, "more");

      await openSettings(page);
      await expectNoViolations(page, "settings");
      // The delete card's sheet, with its error (nothing is deleted: the wrong text is typed).
      await page.getByRole("button", { name: "Delete my account" }).click();
      await expect(page.getByRole("dialog", { name: "Delete your account?" })).toBeVisible();
      await expectNoViolations(page, "settings, delete your account");
      await page.getByRole("dialog").getByLabel("Your email address").fill("not-me@example.test");
      await page.getByRole("dialog").getByRole("button", { name: "Delete my account" }).click();
      await expect(page.getByRole("dialog").getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "settings, delete your account, with an error");
      await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await openMore(page);
      await page.getByRole("link", { name: /^Customers/ }).click();
      await expect(page.getByRole("heading", { name: "Customers", level: 1 })).toBeVisible();
      await expectNoViolations(page, "customers, empty");

      await page.getByRole("link", { name: "Add your first customer" }).click();
      await expect(page.getByRole("heading", { name: "Add a customer", level: 1 })).toBeVisible();
      await expectNoViolations(page, "add customer");
      await page.getByRole("checkbox", { name: "This is a business" }).check();
      await page.getByRole("button", { name: "Add address, delivery details or notes" }).click();
      await expectNoViolations(page, "add customer, business with all sections");
      await page.getByLabel("Phone", { exact: true }).fill("bad");
      await page.getByRole("button", { name: "Add customer" }).click();
      await expect(page.getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "add customer with errors");

      await page.getByLabel("Name", { exact: true }).fill("Axe Customer");
      await page.getByLabel("Phone", { exact: true }).fill("021 123 4567");
      await page.getByRole("button", { name: "Add customer" }).click();
      await expect(page.getByTestId("customer-added")).toBeVisible();
      await expectNoViolations(page, "customers, with a customer");

      await page.getByRole("link", { name: /Axe Customer/ }).click();
      await expect(page.getByRole("heading", { name: "Axe Customer", level: 1 })).toBeVisible();
      await expectNoViolations(page, "edit customer");

      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Quotes" }).click();
      await expect(page.getByRole("heading", { name: "Quotes", level: 1 })).toBeVisible();
      await expectNoViolations(page, "quotes, empty");

      await page.getByRole("link", { name: "Start your first quote" }).click();
      await expect(page.getByRole("heading", { name: "New quote", level: 1 })).toBeVisible();
      await expectNoViolations(page, "new quote");
      // The number it will get, and the sheet that changes how quotes are numbered.
      await page.getByRole("button", { name: /Change how quotes are numbered/ }).click();
      await expect(page.getByRole("dialog", { name: "Quote numbers" })).toBeVisible();
      await expectNoViolations(page, "new quote, quote numbers sheet");
      await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByLabel("Customer name", { exact: true }).fill("Axe");
      await expect(page.getByRole("option", { name: /Add “Axe”/ })).toBeVisible();
      await expectNoViolations(page, "new quote, customer list open");
      await page.getByRole("option", { name: /Add “Axe”/ }).click();
      await expect(page.getByRole("dialog", { name: "Add a customer" })).toBeVisible();
      await expectNoViolations(page, "new quote, add customer sheet");
      await page.getByRole("dialog").getByRole("button", { name: "Add customer" }).click();
      await expect(page.getByTestId("selected-customer")).toBeVisible();
      await page.getByRole("button", { name: /Edit details/ }).click();
      await expect(page.getByRole("dialog", { name: "Customer details" })).toBeVisible();
      await expectNoViolations(page, "new quote, edit customer sheet");
      // Deliveries somewhere else: the same fields as the address, in their own group.
      await page.getByRole("dialog").getByRole("checkbox", { name: "Same as the address above" }).uncheck();
      await expect(page.getByRole("dialog").getByRole("group", { name: "Delivery" }).getByLabel("Street address")).toBeVisible();
      await expectNoViolations(page, "edit customer sheet, delivery address open");
      await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByRole("button", { name: "Add a needed-by date" }).click();
      await page.getByRole("button", { name: "Add a discount" }).click();
      await page.getByLabel("Discount on the whole quote").selectOption("percent");
      await page.getByRole("radio", { name: /^Delivery \(you deliver/ }).check();
      await expectNoViolations(page, "new quote, all sections open");
      // Delivery with addresses on file: the choices, and "a different address".
      await page.getByRole("button", { name: /Edit details/ }).click();
      await page.getByRole("dialog").getByRole("checkbox", { name: "Same as the address above" }).uncheck();
      await page.getByRole("dialog").getByRole("group", { name: "Delivery" }).getByLabel("Street address").fill("The gate at the back");
      await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("radio", { name: /Delivery address on file/ })).toBeVisible();
      await expectNoViolations(page, "new quote, delivery to an address on file");
      await page.getByRole("radio", { name: "A different address" }).check();
      await expectNoViolations(page, "new quote, delivery to a different address");
      await page.getByRole("checkbox", { name: "Ask for a deposit to start work" }).check();
      await page.getByLabel("Percentage (%)").fill("50");
      await page.getByLabel("Balance due", { exact: true }).selectOption("date");
      await expectNoViolations(page, "new quote, deposit open");
      // The balance in the maker's own words.
      await page.getByLabel("Balance due", { exact: true }).selectOption("other");
      await expect(page.getByLabel("When is the balance due?")).toBeVisible();
      await expectNoViolations(page, "new quote, balance due in words");
      await page.getByLabel("Balance due", { exact: true }).selectOption("handover");
      // Terms: with nothing saved the sheet opens to write one; then the term is on the quote, and the sheet lists the rest.
      await page.getByRole("button", { name: "Add a term" }).click();
      await expect(page.getByRole("dialog", { name: "New term" })).toBeVisible();
      await expectNoViolations(page, "new quote, new term sheet");
      await page.getByRole("dialog").getByLabel("Wording").fill("Shoes off at the door, please.");
      await page.getByRole("dialog").getByRole("button", { name: "Save term" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByTestId("quote-term")).toHaveCount(1);
      await expectNoViolations(page, "new quote, a term on the quote");
      await page.getByRole("button", { name: /^Change the wording for this quote/ }).click();
      await expectNoViolations(page, "new quote, a term's wording open");
      await page.getByRole("button", { name: /^Remove Shoes off/ }).click();
      await page.getByRole("button", { name: "Add a term" }).click();
      await expect(page.getByRole("dialog", { name: "Add a term" })).toBeVisible();
      await expectNoViolations(page, "new quote, add a term sheet");
      await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // Bank details on a quote: the sheet to add them, with and without errors.
      await page.getByRole("button", { name: "Add bank details" }).click();
      await expect(page.getByRole("dialog", { name: "Add bank details" })).toBeVisible();
      await expectNoViolations(page, "new quote, add bank details sheet");
      await page.getByRole("dialog").getByRole("button", { name: "Save bank details" }).click();
      await expect(page.getByRole("dialog").getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "new quote, add bank details sheet with errors");
      await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // The item sheet: pick, one-off configure (with errors), product form.
      await page.getByRole("button", { name: "Add item" }).click();
      await expect(page.getByRole("dialog", { name: "Add an item" })).toBeVisible();
      await expectNoViolations(page, "item sheet, pick");
      await page.getByRole("dialog").getByRole("button", { name: "Add new product" }).click();
      await expect(page.getByRole("dialog", { name: "Add a product" })).toBeVisible();
      await expectNoViolations(page, "item sheet, add product");
      await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: /One-off item/ }).click();
      await expect(page.getByRole("dialog", { name: "One-off item" })).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: "Add to quote" }).click();
      await expect(page.getByRole("dialog").getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "item sheet, configure with errors");
      await page.getByRole("dialog").getByLabel("Name", { exact: true }).fill("Axe item");
      await page.getByRole("dialog").getByLabel(/^Price/).fill("10");
      await page.getByRole("dialog").getByRole("button", { name: "Add to quote" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      // The compact item row, its edit sheet with the remove question, and the cancel question.
      await expectNoViolations(page, "new quote with an item");
      await page.getByTestId("quote-line").getByRole("button", { name: /Edit/ }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Remove this item" }).click();
      await expect(page.getByRole("dialog").getByRole("alertdialog")).toBeVisible();
      await expectNoViolations(page, "item sheet, remove question");
      await page.getByRole("dialog").getByRole("button", { name: "Keep it" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByRole("button", { name: "Cancel new quote" }).click();
      await expect(page.getByRole("alertdialog", { name: "Cancel this new quote?" })).toBeVisible();
      await expectNoViolations(page, "new quote, cancel question");
      await page.getByRole("button", { name: "Keep editing" }).click();

      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "new quote with errors");
      await page.getByLabel("Discount (%)").first().fill("5");
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByText("Draft saved.")).toBeVisible();
      await expectNoViolations(page, "saved quote");

      // Sending: what is missing (the business has no phone or email yet), then the choice.
      await page.getByRole("button", { name: "Continue to preview", exact: true }).click();
      await expect(page.getByTestId("pdf-page").first()).toBeVisible();
      await expectNoViolations(page, "quote preview");
      // No logo yet, so the preview offers one: the card (checked above) and its sheet.
      await page.getByRole("button", { name: "Add your logo" }).click();
      await expect(page.getByRole("dialog", { name: "Add your logo" })).toBeVisible();
      await expectNoViolations(page, "quote preview, add your logo");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      // The strip of themes, scrolled to the middle of the screen, clear of the bar that stays above the tab bar.
      await page.getByTestId("theme-option").first().evaluate((el) => el.scrollIntoView({ block: "center" }));
      await expectNoViolations(page, "quote preview, themes");
      await page.getByRole("button", { name: "Email", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Email this quote" })).toBeVisible();
      await expectNoViolations(page, "email sheet");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByRole("button", { name: "Mark as sent", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Before you can mark this quote as sent" })).toBeVisible();
      await expectNoViolations(page, "send sheet, something missing");
      await page.getByRole("dialog").getByLabel(/^Phone/).fill("bad");
      await page.getByRole("dialog").getByRole("button", { name: "Save and continue" }).click();
      await expect(page.getByRole("dialog").getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "send sheet, contact error");
      await page.getByRole("dialog").getByLabel(/^Phone/).fill("011 555 0101");
      await page.getByRole("dialog").getByRole("button", { name: "Save and continue" }).click();
      await expect(page.getByRole("dialog", { name: "Mark this quote as sent" })).toContainText("QT-0001");
      await expectNoViolations(page, "send sheet, ready");
      await page.getByRole("dialog").getByRole("button", { name: "Mark as sent", exact: true }).click();
      await expect(page.getByTestId("sent-banner")).toBeVisible();
      await expectNoViolations(page, "sent quote");

      // What the customer said: the sheet, its errors, the answered quote, and withdrawing.
      await page.getByRole("button", { name: "They accepted" }).click();
      await expect(page.getByRole("dialog", { name: "They accepted" })).toBeVisible();
      await expectNoViolations(page, "outcome sheet");
      await page.getByRole("dialog").getByRole("button", { name: "Save answer" }).click();
      await expect(page.getByRole("dialog").getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "outcome sheet, with an error");
      await page.getByRole("dialog").getByLabel("How they told you").selectOption("whatsapp");
      await page.getByRole("dialog").getByRole("button", { name: "Save answer" }).click();
      await expect(page.getByTestId("outcome-banner")).toContainText("Accepted");
      await expect(page.getByTestId("create-job-nudge")).toBeVisible();
      await expectNoViolations(page, "accepted quote, with the Create a job card");

      // Its job: the page, a step taken, the list; then cancelled so the quote can be reopened below.
      await page.getByRole("button", { name: "Create a job" }).click();
      await expect(page.getByRole("heading", { name: /^Job J-0001/, level: 1 })).toBeVisible();
      const jobId = page.url().split("/").pop() ?? "";
      await expectNoViolations(page, "job, not started");
      await page.getByRole("button", { name: "Start making" }).click();
      await expect(page.getByRole("heading", { name: /^Job J-0001 Making$/, level: 1 })).toBeVisible();
      await page.getByLabel("Your note").fill("Check the colour");
      await page.getByRole("button", { name: "Save note" }).click();
      await expect(page.getByText("Note saved.")).toBeVisible();
      // "Note saved." shows a moment before the button is back: a disabled (faded) button fails the contrast check.
      await expect(page.getByRole("button", { name: "Save note" })).toBeEnabled();
      await expectNoViolations(page, "job, making, with a note");
      // Counting what is made, and adding an item to the job through the quote's item sheet.
      await page.getByRole("button", { name: /^One more made of/ }).first().click();
      await expect(page.getByTestId("job-progress")).toContainText("made");
      await expectNoViolations(page, "job, making, with counts");
      await page.getByRole("link", { name: "Add an item" }).click();
      await expect(page.getByRole("dialog")).toHaveAccessibleName("Add an item");
      await expectNoViolations(page, "job, add an item");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expectNoViolations(page, "job, add an item page");
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Jobs" }).click();
      await expect(page.getByRole("link", { name: /J-0001/ })).toBeVisible();
      await expectNoViolations(page, "jobs list");
      await page.getByRole("button", { name: /^This week/ }).click();
      await expectNoViolations(page, "jobs list, this week filter");
      // A late job, so the red Late number is checked for contrast too (the local server key is a demo credential).
      const { url, secretKey } = localSupabase();
      const dated = await fetch(`${url}/rest/v1/jobs?id=eq.${jobId}`, {
        method: "PATCH",
        headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ needed_by: "2020-01-01" }),
      });
      expect(dated.ok).toBe(true);
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home" }).click();
      await expect(page.getByTestId("home-count-late")).toHaveText("1");
      await expectNoViolations(page, "home, with job counts");
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Jobs" }).click();
      await expect(page.getByRole("link", { name: /J-0001/ })).toBeVisible();
      await page.getByRole("link", { name: /J-0001/ }).click();
      await page.getByRole("button", { name: "Cancel this job" }).click();
      await expect(page.getByRole("heading", { name: /^Job J-0001 Cancelled$/, level: 1 })).toBeVisible();
      await expectNoViolations(page, "job, cancelled");
      await page.getByRole("link", { name: "quote QT-0001" }).click();
      await expect(page.getByRole("button", { name: "Change the answer" })).toBeVisible();
      await page.getByRole("button", { name: "Change the answer" }).click();
      await expect(page.getByRole("button", { name: "They accepted" })).toBeVisible();
      await page.getByRole("button", { name: "Withdraw this quote" }).click();
      await expect(page.getByRole("dialog", { name: "Withdraw this quote" })).toBeVisible();
      await expectNoViolations(page, "withdraw sheet");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByRole("button", { name: "Revise this quote" }).click();
      await expect(page.getByTestId("revising-note")).toBeVisible();
      await expectNoViolations(page, "quote being revised");
      await page.getByRole("button", { name: "Discard this revision" }).click();
      await expect(page.getByRole("alertdialog", { name: "Discard this revision?" })).toBeVisible();
      await expectNoViolations(page, "discard this revision question");
      await page.getByRole("button", { name: "Keep editing" }).click();
      await page.getByRole("link", { name: "View version 1" }).click();
      await expect(page.getByTestId("editing-note")).toBeVisible();
      await expectNoViolations(page, "the sent version of a quote being revised");
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Quotes" }).click();
      await expect(page.getByRole("heading", { name: "Quotes", level: 1 })).toBeVisible();
      await expectNoViolations(page, "quotes, with a quote");

      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Products" }).click();
      await expect(page.getByRole("heading", { name: "Products & services", level: 1 })).toBeVisible();
      await expectNoViolations(page, "products, empty");
      await page.getByRole("link", { name: "Add your first product" }).click();
      await expect(page.getByRole("heading", { name: "Add a product", level: 1 })).toBeVisible();
      await expectNoViolations(page, "add product");
      await page.getByRole("button", { name: "Add product" }).click();
      await expect(page.getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "add product with errors");
      await page.getByLabel("Name", { exact: true }).fill("Axe product");
      await page.getByLabel("Price", { exact: true }).fill("10");
      // A photo chosen (and one that isn't a picture, with its message).
      await page.locator('input[type="file"]').setInputFiles({ name: "x.png", mimeType: "image/png", buffer: Buffer.from("nope") });
      await expect(page.getByText(/doesn.t look like a picture/)).toBeVisible();
      await expectNoViolations(page, "add product, photo problem");
      const swatch = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#d97706" } }).jpeg().toBuffer();
      await page.locator('input[type="file"]').setInputFiles({ name: "x.jpg", mimeType: "image/jpeg", buffer: swatch });
      await expect(page.getByTestId("photo-preview")).toBeVisible();
      await expectNoViolations(page, "add product, with a photo");
      await page.getByRole("button", { name: "Add product" }).click();
      await expect(page.getByTestId("product-added")).toBeVisible();
      await expectNoViolations(page, "products, with a product");

      // Materials: the empty list, the form with its problems, the list with one, and the edit screen.
      await page.goto("/app/products/materials");
      await expectNoViolations(page, "materials, empty");
      await page.getByRole("link", { name: "Add your first material" }).click();
      await expectNoViolations(page, "new material");
      await page.getByRole("button", { name: "Add material" }).click();
      await expect(page.getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "new material, with problems");
      await page.getByLabel("Name", { exact: true }).fill("Cake flour");
      await page.getByLabel("Unit", { exact: true }).selectOption("kg");
      await page.getByLabel("How much you bought").fill("12,5");
      await page.getByLabel("What you paid for it").fill("187,50");
      await page.getByRole("button", { name: "Add material" }).click();
      await expect(page.getByTestId("material-added")).toBeVisible();
      await expectNoViolations(page, "materials, with a material");
      await page.getByRole("link", { name: /Cake flour/ }).click();
      await expect(page.getByRole("heading", { name: "Cake flour", level: 1 })).toBeVisible();
      await expectNoViolations(page, "edit material");
      await page.goto("/app/products");
      await page.getByRole("navigation", { name: "Products, services or materials" }).getByRole("link", { name: "Services" }).click();
      await expect(page.getByText("No services yet")).toBeVisible();
      await expectNoViolations(page, "services, empty");
      await page.getByRole("link", { name: "Add your first service" }).click();
      await expect(page.getByRole("heading", { name: "Add a service", level: 1 })).toBeVisible();
      await expectNoViolations(page, "add service");
      await page.goto("/app/products");
      await page.getByRole("link", { name: /Axe product/ }).click();
      await expect(page.getByRole("heading", { name: "Axe product", level: 1 })).toBeVisible();
      await expectNoViolations(page, "edit product");
      // Variations on the product, with a problem, then saved and chosen on a quote.
      await page.getByRole("radio", { name: /^Yes/ }).click();
      await page.getByLabel("Variation name", { exact: true }).fill("Size");
      await page.getByRole("textbox", { name: "Size 1", exact: true }).fill("Small");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "product variations, with problems");
      const rows = page.getByRole("listitem").filter({ has: page.getByRole("textbox", { name: /^Size \d$/ }) });
      await rows.nth(0).getByLabel("Size 1 price", { exact: true }).fill("100");
      await page.getByRole("textbox", { name: "Size 2", exact: true }).fill("Large");
      await rows.nth(1).getByLabel("Size 2 price", { exact: true }).fill("200");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Saved.")).toBeVisible();
      await expectNoViolations(page, "product variations, saved");
      // Extras: a new one with problems, saved, then the picker of saved extras; then a list with problems.
      await page.getByRole("button", { name: "Add an extra" }).click();
      await expect(page.getByLabel("Extra name")).toBeFocused();
      await expectNoViolations(page, "product extras, a new extra");
      await page.getByRole("checkbox", { name: "Ask for wording" }).check();
      await page.getByLabel("Longest (optional)").fill("0");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "product extras, with problems");
      await page.getByLabel("Extra name").fill("Engraving");
      await page.getByLabel("Longest (optional)").fill("40");
      await page.getByLabel("Where does it apply?").selectOption({ label: "This product only" });
      await page.getByRole("checkbox", { name: "Price depends on the size" }).check();
      await expectNoViolations(page, "product extras, priced by size");
      await page.getByLabel("Engraving adds for Small", { exact: true }).fill("5");
      await page.getByLabel("Engraving adds for Large", { exact: true }).fill("9");
      // Saved first: a card that has a problem stays open until the next save.
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Saved.")).toBeVisible();
      await page.getByRole("button", { name: "Done Engraving" }).click();
      await page.getByRole("button", { name: "Add an extra" }).click();
      await expect(page.getByLabel("Extra name")).toBeFocused();
      await page.getByLabel("Extra name").fill("Gift wrap");
      await page.getByLabel(/^Price/).last().fill("30");
      await page.getByRole("button", { name: "Done Gift wrap" }).click();
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Saved.")).toBeVisible();
      await page.getByRole("button", { name: /^Add (a|another) variation$/ }).click();
      await page.getByLabel("Name of this variation").last().fill("Flavour");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByTestId("form-summary")).toContainText("Flavour: choice 1");
      await expectNoViolations(page, "product lists, with problems");
      await page.getByLabel("Flavour: choice 1", { exact: true }).fill("Vanilla");
      await page.getByLabel("Flavour: choice 2", { exact: true }).fill("Chocolate");
      await page.getByLabel("Flavour: choice 2 adds", { exact: true }).fill("20");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Saved.")).toBeVisible();
      await expectNoViolations(page, "product options, saved");
      // Another product is offered the saved extra before a new one is made.
      await page.goto("/app/products/new");
      await page.getByLabel("Name", { exact: true }).fill("Second product");
      await page.getByRole("button", { name: "Add an extra" }).click();
      await expect(page.getByRole("group", { name: "Add an extra" })).toBeVisible();
      await expectNoViolations(page, "product extras, the saved extras to pick from");
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.goto("/app/quotes/new");
      await page.getByRole("button", { name: "Add item" }).click();
      await page.getByRole("dialog").getByRole("button", { name: /Axe product/ }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Add to quote" }).click();
      await expect(page.getByRole("dialog").getByTestId("form-summary")).toContainText("Choose a size");
      await expect(page.getByRole("dialog").getByTestId("form-summary")).toContainText("Choose a flavour");
      await expectNoViolations(page, "item sheet, choose a size and a flavour with errors");
      await page.getByRole("dialog").getByRole("radio", { name: /Small/ }).check();
      await page.getByRole("dialog").getByRole("radio", { name: /Chocolate/ }).check();
      await expect(page.getByRole("dialog").getByTestId("line-sum")).toBeVisible();
      await expectNoViolations(page, "item sheet, an option that adds to the price");
      await page.getByRole("dialog").getByRole("checkbox", { name: /Gift wrap/ }).check();
      await expect(page.getByRole("dialog").getByLabel("Gift wrap: how many (optional)")).toBeVisible();
      await expectNoViolations(page, "item sheet, an extra ticked with how many");
      await page.keyboard.press("Escape");

      await openBusinessProfile(page);
      await expectNoViolations(page, "business profile");

      // Error state: bad phone and a VAT number that is too short.
      await page.getByLabel("Phone", { exact: true }).fill("bad");
      await page.getByRole("checkbox", { name: "I'm registered for VAT" }).check();
      await page.getByRole("button", { name: "Save details" }).click();
      await expect(page.getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "business profile with errors");

      // Bank details: with errors, then saved.
      await page.getByRole("button", { name: "Save bank details" }).click();
      await expect(page.getByText("Enter the account holder").first()).toBeVisible();
      await expectNoViolations(page, "business profile, bank details with errors");
      const bank = page.getByRole("group", { name: "Bank details" });
      await bank.getByLabel("Account holder").fill("Axe Co");
      await bank.getByLabel("Bank name", { exact: true }).fill("FNB");
      await bank.getByLabel("Account type").selectOption("Savings");
      await bank.getByLabel("Account number").fill("62123456789");
      await bank.getByLabel("Branch code").fill("250655");
      await page.getByRole("button", { name: "Save bank details" }).click();
      await expect(page.getByText(/Last changed /)).toBeVisible();
      await expectNoViolations(page, "business profile, bank details saved");

      // A VAT-registered business gets the VAT choice on each item.
      await page.getByLabel("Phone", { exact: true }).fill("011 555 0101");
      await page.getByLabel("VAT number").fill("4123456789");
      // Wait for this save itself, not just for a "Saved." that an earlier form on the page may still be showing.
      const savedDetails = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/app/business");
      await page.getByRole("button", { name: "Save details" }).click();
      await savedDetails;
      await expect(page.getByText("Saved.").first()).toBeVisible();
      await page.goto("/app/quotes/new");
      await page.getByRole("button", { name: "Add item" }).click();
      await page.getByRole("dialog").getByRole("button", { name: /One-off item/ }).click();
      await page.getByRole("dialog").getByLabel("VAT on this item").selectOption("zero");
      await expect(page.getByRole("dialog").getByLabel("VAT on this item")).toHaveAccessibleDescription(/VAT at 0%/);
      await expectNoViolations(page, "item sheet, VAT choice");
      await page.keyboard.press("Escape");
      await page.goto("/app/products/new");
      await page.getByLabel("VAT on this").selectOption("zero");
      await expectNoViolations(page, "add product, VAT choice");
      // Quantity prices: a row with a problem.
      await page.getByRole("button", { name: "Add a quantity price" }).click();
      await page.getByLabel("From (quantity)").fill("10");
      await page.getByLabel("Name", { exact: true }).fill("Axe quantity product");
      await page.getByLabel("Price", { exact: true }).fill("10");
      await page.getByRole("button", { name: "Add product" }).click();
      await expect(page.getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "product quantity prices, with a problem");

      // Quotes and invoices: the settings page, then quote numbers with a number already used.
      await openDocuments(page);
      await expectNoViolations(page, "quotes and invoices");
      // Themes: the library, then the studio (each part), then saved.
      await page.getByRole("link", { name: "Manage themes" }).click();
      await expect(page.getByRole("heading", { name: "Themes", level: 1 })).toBeVisible();
      await expectNoViolations(page, "themes library");
      await page.getByRole("link", { name: "Create new theme" }).click();
      await expect(page.getByRole("heading", { name: "Create a new theme", level: 1 })).toBeVisible();
      await expectNoViolations(page, "create a new theme, where to start");
      await page.getByRole("region", { name: "Remix a starter" }).getByRole("link", { name: /^Warm/ }).click();
      await expect(page.getByTestId("pdf-page").first()).toBeVisible();
      for (const tab of ["Colour", "Type", "Background", "Top", "Items", "Totals", "Finish"]) {
        await page.getByRole("tab", { name: tab }).click();
        // Scroll the choices to the middle of the screen, clear of the pinned preview and the bar below.
        await page.getByTestId("studio-panel").evaluate((el) => el.scrollIntoView({ block: "center" }));
        await expectNoViolations(page, `theme studio, ${tab}`);
        if (tab === "Type") {
          await page.getByRole("button", { name: /^Headings/ }).click();
          await expect(page.getByTestId("font-playfair")).toBeVisible();
          await expectNoViolations(page, "theme studio, font list");
          await page.getByTestId("font-playfair").click();
        }
        if (tab === "Background") {
          await page.getByTestId("choice-background-gradient").click();
          await page.getByTestId("studio-panel").evaluate((el) => el.scrollIntoView({ block: "center" }));
          await expectNoViolations(page, "theme studio, gradient background");
          await page.getByTestId("choice-background-image").click();
          await page.getByTestId("studio-panel").evaluate((el) => el.scrollIntoView({ block: "center" }));
          await expectNoViolations(page, "theme studio, picture background");
          await page.getByTestId("choice-background-paper").click();
        }
      }
      await page.getByRole("button", { name: "Save theme" }).click();
      await expect(page.getByTestId("theme-save-status")).toHaveText("Saved.");
      await openBusinessProfile(page);
      // The logo: chosen, then saved (it lives on the Business profile).
      const logo = await sharp({ create: { width: 400, height: 150, channels: 3, background: "#1e3a8a" } }).png().toBuffer();
      await page.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: logo });
      await expect(page.getByTestId("logoImage-preview")).toBeVisible();
      await expectNoViolations(page, "business profile, logo chosen");
      await page.getByRole("button", { name: "Save logo" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Saved." }).first()).toBeVisible();
      await openDocuments(page);
      // The default deposit: with an error, then saved.
      await page.getByLabel("Deposit on a new quote").selectOption("percent");
      await page.getByRole("button", { name: "Save deposit" }).click();
      await expect(page.getByText("Enter a percentage").first()).toBeVisible();
      await expectNoViolations(page, "quotes and invoices, default deposit with an error");
      await page.getByLabel("Percentage (%)").fill("40");
      await page.getByRole("button", { name: "Save deposit" }).click();
      await expect(page.locator("#deposit-default").getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
      await expectNoViolations(page, "quotes and invoices, default deposit saved");
      // Quote numbers, with a number that has already been used.
      await page.getByLabel("Next number", { exact: true }).fill("1");
      await page.getByRole("button", { name: "Save quote numbers" }).click();
      // Wait for THIS form's answer .
      await expect(page.getByText(/has already been used/).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Save quote numbers" })).toBeEnabled();
      await expectNoViolations(page, "quotes and invoices, quote numbers with an error");


      // Terms: the library, the form (with errors and an example), and the saved list with an untitled term.
      await page.getByRole("link", { name: "Manage your terms" }).click();
      await expect(page.getByRole("heading", { name: "Terms", level: 1 })).toBeVisible();
      await expectNoViolations(page, "terms, empty");
      await page.getByRole("link", { name: "Add a term" }).click();
      await expect(page.getByRole("heading", { name: "Add a term", level: 1 })).toBeVisible();
      await expectNoViolations(page, "add term");
      await page.getByRole("button", { name: "Save term" }).click();
      await expect(page.getByTestId("form-summary")).toBeVisible();
      await expectNoViolations(page, "add term with errors");
      await page.getByRole("button", { name: "If you cancel: made to order" }).click();
      await page.getByRole("button", { name: "Save term" }).click();
      await expect(page.getByTestId("policy-saved")).toBeVisible();
      await page.getByRole("link", { name: "Add a term" }).click();
      // Four examples show first; the rest are under "More examples".
      await page.getByText("More examples").click();
      await page.getByRole("button", { name: "Lead time" }).click();
      await page.getByRole("button", { name: "Save term" }).click();
      await expect(page.getByTestId("policy-saved")).toBeVisible();
      await expectNoViolations(page, "terms, with a titled and an untitled term");
      await page.getByRole("list", { name: "Your terms" }).getByRole("link", { name: /If you cancel/ }).click();
      await expect(page.getByRole("heading", { name: "If you cancel: made to order", level: 1 })).toBeVisible();
      await expectNoViolations(page, "edit term");
    });

    test("quote usuals and the deposit choice", async ({ page }) => {
      test.setTimeout(240_000);
      await signUpAndOnboard(page, `a11y-usual-${scheme}`, "Usual Axe Co");
      await openDocuments(page);
      await page.getByLabel("Deposit on a new quote").selectOption("ask");
      await page.getByLabel("Introduction (optional)").fill("Thank you for asking.");
      await expectNoViolations(page, "quotes and invoices, usuals");
      await page.getByRole("button", { name: "Save deposit" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

      await page.goto("/app/quotes/new");
      await page.getByRole("radio", { name: "A percentage of the total" }).check();
      await page.getByLabel("Description (optional)").fill("A different introduction");
      await expect(page.getByRole("button", { name: "Save as my usual description" })).toBeVisible();
      await expectNoViolations(page, "new quote, deposit choice and Save as my usual");
    });
  });
}
