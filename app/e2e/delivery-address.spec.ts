import { expect, test, type Page } from "@playwright/test";
import { openBusinessProfile, signUpAndOnboard } from "./helpers";
import { fillItem, openQuotes, startSend } from "./quote-helpers";

const sheet = (page: Page) => page.getByRole("dialog");

async function newQuote(page: Page) {
  await openQuotes(page);
  await page.getByRole("link", { name: /Start your first quote|New quote/ }).first().click();
  await expect(page.getByRole("heading", { name: "New quote", level: 1 })).toBeVisible();
  await fillItem(page, 1, "Wedding cake", "1", "800");
}

/** Adds a customer in the sheet over the quote, with the address details given. */
async function addCustomer(page: Page, name: string, details: { street?: string; city?: string; deliverTo?: string } = {}) {
  await page.getByLabel("Customer name", { exact: true }).fill(name);
  await page.getByRole("option", { name: new RegExp(`Add “${name}”`) }).click();
  const dialog = page.getByRole("dialog", { name: "Add a customer" });
  if (details.street || details.city || details.deliverTo) {
    await dialog.getByRole("button", { name: "Add address, delivery details or notes" }).click();
    if (details.street) await dialog.getByLabel("Street address").fill(details.street);
    if (details.city) await dialog.getByLabel("City or town").fill(details.city);
    if (details.deliverTo) await dialog.getByLabel("Deliver to (optional)").fill(details.deliverTo);
  }
  await dialog.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("selected-customer")).toHaveText(name);
}

test("a delivery uses the customer's saved address, or another one, and it prints on the sent quote", async ({ page }) => {
  await signUpAndOnboard(page, "del-saved", "Deliver Co");
  await openBusinessProfile(page);
  await page.getByLabel("Phone", { exact: true }).fill("011 555 0101");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await newQuote(page);
  await addCustomer(page, "Thandi Nkosi", { street: "12 Main Road", city: "Soweto", deliverTo: "The gate at the back" });

  // Nothing about where to until it is a delivery.
  await expect(page.getByText("Delivery address on file")).toHaveCount(0);
  await page.getByRole("radio", { name: "Delivery (you deliver, with a fee)" }).check();

  // Their saved delivery address is picked for them; their main address is the other choice.
  const onFile = page.getByRole("radio", { name: /Delivery address on file/ });
  await expect(onFile).toBeChecked();
  await expect(page.getByText("The gate at the back")).toBeVisible();
  const main = page.getByRole("radio", { name: /^Address on file/ });
  await expect(main).not.toBeChecked();
  await expect(page.getByRole("radio", { name: "A different address" })).not.toBeChecked();
  await expect(page.getByLabel("Delivery address", { exact: true })).toHaveCount(0);

  // Use their main address instead.
  await main.check();
  await expect(main).toBeChecked();
  await expect(page.getByText(/12 Main Road/).first()).toBeVisible();

  // A different address: an empty box, for this quote only.
  await page.getByRole("radio", { name: "A different address" }).check();
  const box = page.getByLabel("Delivery address", { exact: true });
  await expect(box).toHaveValue("");
  await box.fill("5 Elm Street\nParkhurst");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}\?saved=1$/);

  // It was saved: reopening shows it as the typed address.
  await page.reload();
  await expect(page.getByRole("radio", { name: "A different address" })).toBeChecked();
  await expect(page.getByLabel("Delivery address", { exact: true })).toHaveValue("5 Elm Street\nParkhurst");

  // Collection hides it (the text stays on the draft but is not printed).
  await page.getByRole("radio", { name: "Collection (the customer collects)" }).check();
  await expect(page.getByLabel("Delivery address", { exact: true })).toHaveCount(0);
  await page.getByRole("radio", { name: "Delivery (you deliver, with a fee)" }).check();
  await expect(page.getByLabel("Delivery address", { exact: true })).toHaveValue("5 Elm Street\nParkhurst");

  // Send it: the address is on the frozen document.
  await startSend(page);
  await sheet(page).getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();
  const document = page.getByTestId("quote-document");
  await expect(document).toContainText("Deliver to");
  await expect(document).toContainText("5 Elm Street");
  await expect(document).toContainText("Parkhurst");

  // Quote again carries the address to the new draft.
  await page.getByRole("button", { name: "Quote again" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0002 Draft$/, level: 1 })).toBeVisible();
  await expect(page.getByRole("radio", { name: "A different address" })).toBeChecked();
  await expect(page.getByLabel("Delivery address", { exact: true })).toHaveValue("5 Elm Street\nParkhurst");
});

test("a customer with nothing saved gets a plain box, a too-long address says how to fix it, and none is needed to send", async ({ page }) => {
  await signUpAndOnboard(page, "del-typed", "Typed Co");
  await openBusinessProfile(page);
  await page.getByLabel("Phone", { exact: true }).fill("011 555 0101");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await newQuote(page);
  await addCustomer(page, "Sipho Dlamini");
  await page.getByRole("radio", { name: "Delivery (you deliver, with a fee)" }).check();

  // Nothing saved for this customer: just a box, and it can be left.
  await expect(page.getByRole("radio", { name: /on file/ })).toHaveCount(0);
  const box = page.getByLabel("Deliver to (optional)");
  await expect(box).toBeVisible();
  await expect(page.getByText(/Nothing is saved for this customer yet/)).toBeVisible();

  // Too long: it says how to fix it, at the field and in the summary, and nothing typed is lost.
  await box.fill("x".repeat(401));
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByTestId("form-summary")).toContainText("up to 400 characters");
  await expect(box).toHaveValue("x".repeat(401));

  // No address at all is fine to send.
  await box.fill("");
  await startSend(page);
  await sheet(page).getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByRole("heading", { name: /^Quote QT-0001 Sent$/, level: 1 })).toBeVisible();
  await expect(page.getByTestId("quote-document")).not.toContainText("Deliver to");
});

test("changing the customer moves the saved address along, but never replaces one typed for this quote", async ({ page }) => {
  await signUpAndOnboard(page, "del-change", "Change Co");
  await newQuote(page);
  await addCustomer(page, "Thandi Nkosi", { deliverTo: "The gate at the back" });
  await page.getByRole("radio", { name: "Delivery (you deliver, with a fee)" }).check();
  await expect(page.getByRole("radio", { name: /Delivery address on file/ })).toBeChecked();

  // Another customer with their own address: the quote's address follows.
  await page.getByRole("button", { name: "Change customer" }).click();
  await addCustomer(page, "Sipho Dlamini", { deliverTo: "Unit 4, Sandton Mews" });
  await expect(page.getByRole("radio", { name: /Delivery address on file/ })).toBeChecked();
  await expect(page.getByText("Unit 4, Sandton Mews")).toBeVisible();
  await expect(page.getByText("The gate at the back")).toHaveCount(0);

  // An address typed for this quote stays when the customer changes.
  await page.getByRole("radio", { name: "A different address" }).check();
  await page.getByLabel("Delivery address", { exact: true }).fill("5 Elm Street");
  await page.getByRole("button", { name: "Change customer" }).click();
  await addCustomer(page, "Carla Meyer");
  await expect(page.getByLabel("Deliver to (optional)")).toHaveValue("5 Elm Street");

  // Changing the customer's saved address from the quote refreshes the choices (here: a customer
  // who had none gets one).
  await page.getByRole("button", { name: /Edit details/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Deliver to (optional)").fill("Farm gate, R45");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /Delivery address on file/ })).toBeVisible();
  await expect(page.getByText("Farm gate, R45")).toBeVisible();
  // What was typed for the quote is still there and still chosen.
  await expect(page.getByRole("radio", { name: "A different address" })).toBeChecked();
  await expect(page.getByLabel("Delivery address", { exact: true })).toHaveValue("5 Elm Street");
});
