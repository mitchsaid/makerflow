import { existsSync, readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

const mailpit = process.env.LOCAL_MAILPIT_URL ?? "http://127.0.0.1:54324";

async function messageIds(address: string): Promise<string[]> {
  const list = await fetch(
    `${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
  );
  const { messages = [] } = (await list.json()) as { messages?: { ID: string }[] };
  return messages.map((m) => m.ID);
}

/** IDs of emails already delivered to `address`, so a later wait can ignore them. */
export async function existingEmailIds(address: string): Promise<Set<string>> {
  return new Set(await messageIds(address));
}

/**
 * Waits for a NEW email to `address` (not one in `ignore`) and returns the
 * sign-in link inside it.
 */
export async function waitForSignInLink(
  address: string,
  ignore: Set<string> = new Set(),
): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const fresh = (await messageIds(address)).filter((id) => !ignore.has(id));
    if (fresh.length > 0) {
      const detail = await fetch(`${mailpit}/api/v1/message/${fresh[0]}`);
      const { HTML, Text } = (await detail.json()) as { HTML: string; Text: string };
      const match = `${HTML} ${Text}`.match(/https?:\/\/[^\s"'<>]+\/auth\/confirm\?[^\s"'<>]+/);
      if (match) return match[0].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No sign-in email arrived for ${address}`);
}

export function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

/** Signs a brand-new person up by email link (same browser) and finishes onboarding. */
export async function signUpAndOnboard(
  page: Page,
  label: string,
  businessName: string,
): Promise<string> {
  const email = uniqueEmail(label);
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.goto(await waitForSignInLink(email));
  await page.getByLabel("Business name").fill(businessName);
  await page.getByRole("button", { name: "Continue" }).click();
  // The optional "what do you make?" step: most tests skip it.
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByTestId("business-name")).toHaveText(businessName);
  return email;
}

/** On a phone, Business profile and Settings are behind the "More" tab. */
export async function openMore(page: Page) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "More" }).click();
  await expect(page.getByRole("heading", { name: "More", level: 1 })).toBeVisible();
}

export type BusinessTab = "Details" | "Logo" | "Ways to pay";

/** The Business profile, on its Details tab or the one asked for. */
export async function openBusinessProfile(page: Page, tab?: BusinessTab) {
  await openMore(page);
  await page.getByRole("link", { name: /Business profile/ }).click();
  await expect(page.getByRole("heading", { name: "Business profile", level: 1 })).toBeVisible();
  if (tab) await businessTab(page, tab);
}

/** Opens a tab of the Business profile. */
export const businessTab = (page: Page, tab: BusinessTab) => openTab(page, "Business profile", tab);

/** Opens a tab of a page's tabs (named by `nav`). (A tap before the page wakes up does nothing: tap until it is open.) */
async function openTab(page: Page, nav: string, tab: string) {
  const link = page.getByRole("navigation", { name: nav }).getByRole("link", { name: tab, exact: true });
  await expect(async () => {
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "page", { timeout: 1_000 });
  }).toPass();
}

/** Product settings (your hourly rate and the margin you aim for): a button on the Products page. */
export async function openProductSettings(page: Page) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Products" }).click();
  await expect(page.getByRole("heading", { name: "Products & services", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Product settings" }).click();
  await expect(page.getByRole("heading", { name: "Product settings", level: 1 })).toBeVisible();
}

export type QuoteSettingsTab = "Wording" | "Starting values" | "Numbers";

/** Quote settings (numbering, wording, terms, themes): a button on the Quotes page. Opens on Wording, or the tab asked for. */
export async function openDocuments(page: Page, tab?: QuoteSettingsTab) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Quotes" }).click();
  await expect(page.getByRole("heading", { name: "Quotes", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Quote settings" }).click();
  await expect(page.getByRole("heading", { name: "Quote settings", level: 1 })).toBeVisible();
  if (tab) await quoteSettingsTab(page, tab);
}

/** Opens a tab of the Quote settings. */
export const quoteSettingsTab = (page: Page, tab: QuoteSettingsTab) => openTab(page, "Quote settings", tab);

/** Invoice settings (invoice and credit note numbers): a button on the Invoices page, which is behind "More" on a phone. */
export async function openInvoiceSettings(page: Page) {
  await openMore(page);
  await page.getByRole("link", { name: /^Invoices/ }).click();
  await expect(page.getByRole("heading", { name: "Invoices", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Invoice settings" }).click();
  await expect(page.getByRole("heading", { name: "Invoice settings", level: 1 })).toBeVisible();
}

export async function openSettings(page: Page) {
  await openMore(page);
  await page.getByRole("link", { name: /^Settings/ }).click();
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
}

/** Sign out is in Settings. */
export async function signOut(page: Page) {
  await openSettings(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** The local stack's URL and publishable (public) key, from the environment or .env.local. */
export function localSupabase() {
  const fromFile: Record<string, string> = {};
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const i = line.indexOf("=");
      if (i > 0 && !line.startsWith("#")) fromFile[line.slice(0, i)] = line.slice(i + 1).trim();
    }
  }
  const get = (k: string) => process.env[k] ?? fromFile[k] ?? "";
  return {
    url: get("NEXT_PUBLIC_SUPABASE_URL"),
    key: get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    /** The LOCAL stack's server key (a demo credential), for tests that check what the database or storage holds. */
    secretKey: get("SUPABASE_SECRET_KEY"),
  };
}

/** The access token a browser holds, read from its Supabase session cookie (maybe chunked). */
export function accessTokenFrom(cookies: { name: string; value: string }[]): string {
  const parts = cookies
    .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const raw = parts.map((c) => c.value).join("").replace(/^base64-/, "");
  return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")).access_token;
}

/**
 * Waits for the next server action to be answered. Start it before the click that sends it, and wait for it before
 * reloading: a button that saves quietly in the background (a "Not now") is gone from the screen at once, so a
 * reload straight after can cancel the save on a slow machine.
 */
export function nextServerAction(page: Page) {
  return page.waitForResponse((r) => r.request().method() === "POST" && "next-action" in r.request().headers());
}

/** The tabs of the product form: Details, Production (a service: Steps) and Inputs. */
export async function openProductTab(page: Page, name: "Details" | "Production" | "Steps" | "Inputs") {
  await page.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByRole("tab", { name: new RegExp(`^${name}`) })).toHaveAttribute("aria-selected", "true");
}

/** Opens History on a job page (where it came from and what happened), if it is closed. */
export async function openHistory(page: Page) {
  const history = page.getByTestId("job-history");
  if ((await history.getAttribute("open")) === null) await history.getByText("History", { exact: true }).click();
  await expect(history).toHaveAttribute("open", "");
}

/**
 * Puts a job in the cancelled state it had before cancelling went (nothing in the app cancels a job now; a few jobs made
 * earlier are still cancelled). Set with the LOCAL server key, a demo credential.
 */
export async function legacyCancelJob(jobId: string) {
  const { url, secretKey } = localSupabase();
  const response = await fetch(`${url}/rest/v1/jobs?id=eq.${jobId}`, {
    method: "PATCH",
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ status: "cancelled" }),
  });
  expect(response.ok).toBe(true);
}
