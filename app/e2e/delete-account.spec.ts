import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { accessTokenFrom, localSupabase, openBusinessProfile, openSettings, signUpAndOnboard, uniqueEmail, waitForSignInLink, startFresh } from "./helpers";

const sheet = (page: Page) => page.getByRole("dialog");

/** What the LOCAL database and storage hold, asked with the local server key (a demo credential). */
function admin() {
  const { url, secretKey } = localSupabase();
  const headers = { apikey: secretKey, Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" };
  return {
    async rows(table: string, filter: string): Promise<unknown[]> {
      const response = await fetch(`${url}/rest/v1/${table}?select=*&${filter}`, { headers });
      return (await response.json()) as unknown[];
    },
    async pictureFolders(organisationId: string): Promise<number> {
      const response = await fetch(`${url}/storage/v1/object/list/pictures`, {
        method: "POST",
        headers,
        body: JSON.stringify({ prefix: `${organisationId}/`, limit: 100 }),
      });
      return ((await response.json()) as unknown[]).length;
    },
  };
}

const userIdOf = async (page: Page) =>
  (JSON.parse(Buffer.from(accessTokenFrom(await page.context().cookies()).split(".")[1], "base64url").toString("utf8")) as { sub: string }).sub;

test("deleting the account asks for the email address, removes the data and the sign-in, and the same email starts afresh", async ({ page }) => {
  test.setTimeout(180_000);
  const db = admin();
  const email = await signUpAndOnboard(page, "del-flow", "Delete Co");
  const userId = await userIdOf(page);
  const [membership] = (await db.rows("memberships", `user_id=eq.${userId}`)) as { organisation_id: string }[];
  const org = membership.organisation_id;

  // The business has a logo, so there is a file in storage to remove.
  await openBusinessProfile(page, "Logo");
  const logo = await sharp({ create: { width: 400, height: 150, channels: 3, background: "#1e3a8a" } }).png().toBuffer();
  await page.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: logo });
  await expect(page.getByTestId("logoImage-preview")).toBeVisible();
  await page.getByRole("button", { name: "Save logo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  expect(await db.pictureFolders(org)).toBeGreaterThan(0);

  // Settings: the card, and a sheet that names the account.
  await openSettings(page);
  await expect(page.getByRole("heading", { name: "Delete your account" })).toBeVisible();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(sheet(page)).toHaveAccessibleName("Delete your account?");
  await expect(sheet(page).getByTestId("confirm-email-shown")).toHaveText(email);

  // Pressing it with nothing typed, or the wrong thing, says what to do, at the field and in a summary.
  await sheet(page).getByRole("button", { name: "Delete my account" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toContainText("Type your email address to confirm.");
  await sheet(page).getByLabel("Your email address").fill("someone-else@example.test");
  await sheet(page).getByRole("button", { name: "Delete my account" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toContainText("That is not your email address");
  await expect(sheet(page).getByLabel("Your email address")).toHaveAccessibleDescription(/That is not your email address/);
  // Nothing was deleted, and what was typed is still there.
  await expect(sheet(page).getByLabel("Your email address")).toHaveValue("someone-else@example.test");
  expect(await db.rows("organisations", `id=eq.${org}`)).toHaveLength(1);

  // Cancel changes nothing and gives focus back.
  await sheet(page).getByRole("button", { name: "Cancel" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete my account" })).toBeFocused();
  expect(await db.rows("organisations", `id=eq.${org}`)).toHaveLength(1);

  // The right address (any case) deletes it all and leaves for the sign-in page.
  await page.getByRole("button", { name: "Delete my account" }).click();
  await sheet(page).getByLabel("Your email address").fill(` ${email.toUpperCase()} `);
  await sheet(page).getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/sign-in\?account=deleted$/);
  await expect(page.getByTestId("account-deleted")).toContainText("Your account has been deleted");
  expect((await page.context().cookies()).filter((c) => /^sb-.*-auth-token/.test(c.name) && c.value !== "")).toEqual([]);
  expect(await db.rows("organisations", `id=eq.${org}`)).toHaveLength(0);
  expect(await db.rows("profiles", `id=eq.${userId}`)).toHaveLength(0);
  expect(await db.rows("memberships", `user_id=eq.${userId}`)).toHaveLength(0);
  expect(await db.pictureFolders(org)).toBe(0);

  // Signed out: the app wants a sign-in.
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in/);

  // The same email starts from the very beginning: a new person, naming their business, the first-quote questions.
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.goto(await waitForSignInLink(email));
  await expect(page.getByLabel("Business name")).toBeVisible();
  await page.getByLabel("Business name").fill("Fresh Start Co");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await startFresh(page);
  await expect(page.getByTestId("business-name")).toHaveText("Fresh Start Co");
  await page.goto("/app/quotes/new");
  // Nothing of the old account is left: its first quote number starts again, with no customers.
  await expect(page.getByTestId("quote-number")).toHaveText("QT-0001");
  // It is a different account behind the same address.
  expect(await userIdOf(page)).not.toBe(userId);
});

test("an account that is the only owner of a business shared with someone else cannot be deleted, and nothing changes", async ({ page }) => {
  test.setTimeout(120_000);
  const db = admin();
  const { url, secretKey } = localSupabase();
  const email = await signUpAndOnboard(page, "del-shared", "Shared Co");
  const userId = await userIdOf(page);
  const [membership] = (await db.rows("memberships", `user_id=eq.${userId}`)) as { organisation_id: string }[];
  const org = membership.organisation_id;

  // Someone else joins the business (nothing in the app invites people yet, so the database is told directly).
  const other = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: uniqueEmail("del-other"), email_confirm: true }),
  });
  const { id: otherId } = (await other.json()) as { id: string };
  await fetch(`${url}/rest/v1/memberships`, {
    method: "POST",
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ organisation_id: org, user_id: otherId, role: "staff" }),
  });

  await openSettings(page);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await sheet(page).getByLabel("Your email address").fill(email);
  await sheet(page).getByRole("button", { name: "Delete my account" }).click();
  await expect(sheet(page).getByTestId("form-summary")).toContainText("only owner of Shared Co");
  await expect(sheet(page).getByTestId("form-summary")).toContainText("Nothing was deleted");
  expect(await db.rows("organisations", `id=eq.${org}`)).toHaveLength(1);
  expect(await db.rows("profiles", `id=eq.${userId}`)).toHaveLength(1);
  // Still signed in.
  await sheet(page).getByRole("button", { name: "Cancel" }).click();
  await page.goto("/app");
  await expect(page.getByTestId("business-name")).toHaveText("Shared Co");
});
