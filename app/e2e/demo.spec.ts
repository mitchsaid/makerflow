import { expect, test, type Page } from "@playwright/test";
import { localSupabase, signUpAndOnboard } from "./helpers";

/**
 * Public demo accounts (docs/plans/demo-accounts.md): pick a kind of maker on the landing page and land in a private
 * demo business filled with sample content, with a banner; it can be started over; a real maker is not given one; and
 * a demo that has run out is over and is cleaned up.
 */
const supabase = () => {
  const { url, secretKey } = localSupabase();
  const headers = { apikey: secretKey, Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" };
  return { url, headers };
};

async function startDemo(page: Page, kind: "baker" | "woodworker" | "seamstress" | "ceramicist") {
  await page.goto("/");
  await page.getByTestId(`demo-${kind}`).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 45_000 });
  await expect(page.getByTestId("demo-banner")).toBeVisible();
}

test("a visitor picks a kind of maker and lands in a demo business full of sample content", async ({ page }) => {
  test.setTimeout(150_000);
  await startDemo(page, "baker");
  await expect(page.getByTestId("business-name")).toHaveText("Sweet Crumbs Bakery");
  await expect(page.getByTestId("demo-banner")).toContainText("Demo: Baker.");
  await expect(page.getByTestId("demo-banner")).toContainText("cleared in 6 hours");

  // Products, with variations and what they cost to make.
  await page.goto("/app/products");
  await expect(page.getByText("Celebration cake")).toBeVisible();
  await expect(page.getByTestId("product-count")).toHaveText("4 products");
  await page.getByRole("link", { name: /Celebration cake/ }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Celebration cake");

  // Quotes: a draft, a sent one and an accepted one, with a job under way and an invoice draft.
  await page.goto("/app/quotes");
  await expect(page.getByText("Grace Wedding Events").first()).toBeVisible();
  await expect(page.getByText("Lindiwe Dlamini").first()).toBeVisible();
  // The draft shows what it earns (only the maker sees this).
  await page.getByRole("link", { name: /Pieter van Wyk/ }).first().click();
  await expect(page.getByTestId("margin-summary")).toBeVisible();
  await page.goto("/app/jobs");
  await expect(page.getByRole("link", { name: /Grace Wedding Events/ })).toBeVisible();
  await page.goto("/app/invoices");
  await page.getByRole("button", { name: /^Drafts \(1\)/ }).click();
  await expect(page.getByRole("link", { name: /Grace Wedding Events/ }).first()).toBeVisible();

  // Customers and materials.
  await page.goto("/app/customers");
  await expect(page.getByText("Lindiwe Dlamini")).toBeVisible();
  await page.goto("/app/materials");
  await expect(page.getByText("Cake flour")).toBeVisible();

  // The business has details and a logo, so the "add your logo" nudge is not there.
  await page.goto("/app/business");
  await expect(page.getByLabel("Phone")).toHaveValue("082 555 0101");
  await page.getByRole("link", { name: "Logo", exact: true }).click();
  await expect(page.getByRole("img").first()).toBeVisible();

  // No account to delete, and the document reader is not part of the demo.
  await page.goto("/app/settings");
  await expect(page.getByTestId("account-email")).toHaveCount(0);
  await page.goto("/app/business");
  await expect(page.getByTestId("fill-from-document")).toHaveCount(0);
});

test("a demo can be started over, and each kind of maker has its own business", async ({ page }) => {
  test.setTimeout(180_000);
  await startDemo(page, "woodworker");
  await expect(page.getByTestId("business-name")).toHaveText("Karoo Timber Works");

  // Something of their own, then start over: it is gone, and the sample content is back.
  await page.goto("/app/customers/new");
  await page.getByLabel("Name", { exact: true }).fill("Visitor's own customer");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByTestId("customer-added")).toHaveText("Added Visitor's own customer.");

  await page.getByRole("button", { name: "Start the demo over" }).click();
  // It works for a moment (the old demo is thrown away and the new one built), then the button is back.
  await expect(page.getByRole("button", { name: "Starting over…" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start the demo over" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("demo-banner")).toContainText("Demo: Woodworker.");
  await page.goto("/app/customers");
  await expect(page.getByText("Annelize Pretorius")).toBeVisible();
  await expect(page.getByText("Visitor's own customer")).toHaveCount(0);
});

test("a maker who is signed in is not given a demo, and a demo that has run out is over and cleaned up", async ({ page, browser }) => {
  test.setTimeout(240_000);
  // A real maker: the landing page's demo says to sign out first.
  await signUpAndOnboard(page, "demo-real", "Real Maker Co");
  await page.goto("/");
  await page.getByTestId("demo-baker").click();
  await expect(page.getByText("You're signed in to MakerFlow already.")).toBeVisible();

  // A visitor's demo, then its time runs out.
  const visitor = await browser.newContext();
  const vp = await visitor.newPage();
  await startDemo(vp, "ceramicist");
  const { url, headers } = supabase();
  const found = await fetch(`${url}/rest/v1/organisations?name=eq.Earth%20%26%20Fire%20Ceramics&select=id,demo_kind&demo_kind=eq.ceramicist&order=created_at.desc&limit=1`, { headers });
  const [org] = (await found.json()) as { id: string }[];
  expect(org?.id).toBeTruthy();
  await fetch(`${url}/rest/v1/organisations?id=eq.${org!.id}`, { method: "PATCH", headers, body: JSON.stringify({ demo_expires_at: new Date(Date.now() - 60_000).toISOString() }) });

  // Over: the next page sends them to the landing page, which says so.
  await vp.goto("/app/products");
  await expect(vp).toHaveURL(/\/\?demo=ended/);
  await expect(vp.getByText("Your demo has ended.")).toBeVisible();

  // The clean-up (the scheduler's route, with its secret) removes it, and refuses anyone without the secret.
  const refused = await vp.request.get("/api/cron/demo-cleanup");
  expect(refused.status()).toBe(401);
  const done = await vp.request.get("/api/cron/demo-cleanup", { headers: { authorization: "Bearer test-cron-secret" } });
  expect(done.status()).toBe(200);
  expect(((await done.json()) as { removed: number }).removed).toBeGreaterThanOrEqual(1);
  const gone = await fetch(`${url}/rest/v1/organisations?id=eq.${org!.id}&select=id`, { headers });
  expect(await gone.json()).toEqual([]);
  await visitor.close();
});

test("every kind of maker builds: its business, a draft, a sent and an accepted quote, a job and an invoice draft", async ({ browser }) => {
  test.setTimeout(240_000);
  const cases = [
    { kind: "woodworker", business: "Karoo Timber Works", accepted: "Karoo Guest Lodge" },
    { kind: "seamstress", business: "Stitch & Thread", accepted: "Bridal Boutique Rosebank" },
    { kind: "ceramicist", business: "Earth & Fire Ceramics", accepted: "The Pottery Cafe" },
  ] as const;
  for (const c of cases) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await startDemo(page, c.kind);
    await expect(page.getByTestId("business-name")).toHaveText(c.business);
    await page.goto("/app/quotes");
    await expect(page.getByRole("link", { name: new RegExp(c.accepted) }).first()).toBeVisible();
    await page.goto("/app/jobs");
    await expect(page.getByRole("link", { name: new RegExp(c.accepted) })).toBeVisible();
    await context.close();
  }
});
