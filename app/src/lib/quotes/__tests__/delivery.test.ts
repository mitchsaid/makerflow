import { describe, expect, it } from "vitest";
import type { SavedAddress } from "../../customers";
import {
  addressWhenCustomerChanges,
  addressWhenFulfilmentChanges,
  addressWhenSavedAddressesChange,
  sameAddress,
} from "../delivery";

const delivery = (text: string): SavedAddress => ({ kind: "delivery", label: "Delivery address on file", text });
const main = (text: string): SavedAddress => ({ kind: "main", label: "Address on file", text });

const alice = [delivery("The gate at the back"), main("12 Main Road\nSoweto")];
const bob = [main("5 Elm Street\nParkhurst")];

describe("sameAddress", () => {
  it("ignores spaces and line breaks", () => {
    expect(sameAddress("12  Main Road\nSoweto", "12 Main Road Soweto")).toBe(true);
    expect(sameAddress("12 Main Road", "14 Main Road")).toBe(false);
  });
});

describe("choosing delivery", () => {
  it("uses the customer's first saved address when nothing is typed", () => {
    expect(addressWhenFulfilmentChanges("delivery", "", alice)).toBe("The gate at the back");
    expect(addressWhenFulfilmentChanges("delivery", "  ", alice)).toBe("The gate at the back");
  });

  it("leaves a typed address alone, and does nothing for a customer with no address", () => {
    expect(addressWhenFulfilmentChanges("delivery", "My own", alice)).toBe("My own");
    expect(addressWhenFulfilmentChanges("delivery", "", [])).toBe("");
  });

  it("changes nothing for collection or undecided", () => {
    expect(addressWhenFulfilmentChanges("collection", "", alice)).toBe("");
    expect(addressWhenFulfilmentChanges("none", "", alice)).toBe("");
  });
});

describe("choosing another customer", () => {
  it("fills an empty address with the new customer's first saved one", () => {
    expect(addressWhenCustomerChanges("", [], alice)).toBe("The gate at the back");
  });

  it("moves the previous customer's own saved address to the new customer's, or empties it", () => {
    expect(addressWhenCustomerChanges("The gate at the back", alice, bob)).toBe("5 Elm Street\nParkhurst");
    expect(addressWhenCustomerChanges("12 Main Road Soweto", alice, [])).toBe("");
  });

  it("never replaces an address typed for the quote", () => {
    expect(addressWhenCustomerChanges("Ring the bell at 9 Oak", alice, bob)).toBe("Ring the bell at 9 Oak");
  });

  it("does the same when the customer is cleared", () => {
    expect(addressWhenCustomerChanges("The gate at the back", alice, [])).toBe("");
    expect(addressWhenCustomerChanges("Ring the bell at 9 Oak", alice, [])).toBe("Ring the bell at 9 Oak");
  });
});

describe("the chosen customer's saved addresses are edited", () => {
  it("follows the edit when the quote's address was theirs", () => {
    const after = [delivery("Unit 9, Sandton Mews"), main("12 Main Road\nSoweto")];
    expect(addressWhenSavedAddressesChange("The gate at the back", alice, after)).toBe("Unit 9, Sandton Mews");
    expect(addressWhenSavedAddressesChange("12 Main Road Soweto", alice, after)).toBe("12 Main Road\nSoweto");
  });

  it("falls back to their first address, or empty, when that kind is gone", () => {
    expect(addressWhenSavedAddressesChange("The gate at the back", alice, [main("12 Main Road")])).toBe("12 Main Road");
    expect(addressWhenSavedAddressesChange("The gate at the back", alice, [])).toBe("");
  });

  it("leaves a typed address alone", () => {
    expect(addressWhenSavedAddressesChange("Ring the bell", alice, bob)).toBe("Ring the bell");
  });
});
