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
  options: { quoteSetup?: "skip" | "leave" } = {},
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
  // The first New quote asks two setup questions; most tests are about something else and skip them.
  if (options.quoteSetup !== "leave") {
    await page.goto("/app/quotes/new");
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();
    await page.goto("/app");
    await expect(page.getByTestId("business-name")).toHaveText(businessName);
  }
  return email;
}

/** On a phone, Business profile and Settings are behind the "More" tab. */
export async function openMore(page: Page) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "More" }).click();
  await expect(page.getByRole("heading", { name: "More", level: 1 })).toBeVisible();
}

export async function openBusinessProfile(page: Page) {
  await openMore(page);
  await page.getByRole("link", { name: /Business profile/ }).click();
  await expect(page.getByRole("heading", { name: "Business profile", level: 1 })).toBeVisible();
}

/** Quote and invoice settings: numbering, wording, terms. Behind "More" on a phone. */
export async function openDocuments(page: Page) {
  await openMore(page);
  await page.getByRole("link", { name: /Quotes and invoices/ }).click();
  await expect(page.getByRole("heading", { name: "Quotes and invoices", level: 1 })).toBeVisible();
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
