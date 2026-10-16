import { describe, expect, it } from "vitest";
import { ZA_LOCALE } from "../../locale/za";
import {
  customerDetail,
  findPossibleDuplicates,
  forOrganisation,
  matchesSearch,
  parseCustomerForm,
  savedAddresses,
  validateCustomerName,
  type CustomerSummary,
} from "../index";

function form(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}
const parse = (entries: Record<string, string>) => parseCustomerForm(form(entries), ZA_LOCALE);

describe("validateCustomerName", () => {
  it("needs a name, tidies spaces, and has a limit", () => {
    expect(validateCustomerName("  Thandi   Nkosi ")).toEqual({ ok: true, value: "Thandi Nkosi" });
    expect(validateCustomerName("")).toMatchObject({ ok: false });
    expect(validateCustomerName("   ")).toMatchObject({ ok: false });
    expect(validateCustomerName(undefined)).toMatchObject({ ok: false });
    expect(validateCustomerName("x".repeat(121))).toMatchObject({ ok: false });
    expect(validateCustomerName("x".repeat(120)).ok).toBe(true);
  });
});

describe("parseCustomerForm", () => {
  it("accepts a name alone, as an individual with everything else empty", () => {
    const r = parse({ name: "Thandi" });
    expect(r).toEqual({
      ok: true,
      value: {
        name: "Thandi",
        kind: "individual",
        contactPerson: null,
        email: null,
        phone: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        region: null,
        postalCode: null,
        deliverySameAsMain: true,
      deliveryAddressLine1: null,
      deliveryAddressLine2: null,
      deliveryCity: null,
      deliveryRegion: null,
      deliveryPostalCode: null,
        vatNumber: null,
        companyRegistrationNumber: null,
        notes: null,
      },
    });
  });

  it("keeps business details only when the customer is a business", () => {
    const details = {
      name: "Cape Cakes",
      contactPerson: "Sam",
      vatNumber: "4123456789",
      companyRegistrationNumber: "2020/123456/07",
    };
    const individual = parse(details);
    expect(individual.ok && individual.value).toMatchObject({
      kind: "individual",
      contactPerson: null,
      vatNumber: null,
      companyRegistrationNumber: null,
    });
    const business = parse({ ...details, kind: "business" });
    expect(business.ok && business.value).toMatchObject({
      kind: "business",
      contactPerson: "Sam",
      vatNumber: "4123456789",
      companyRegistrationNumber: "2020/123456/07",
    });
  });

  it("reports every problem at once, by field, in plain words", () => {
    const r = parse({
      name: "",
      phone: "abc",
      email: "nope",
      region: "Narnia",
      postalCode: "12",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(["email", "name", "phone", "postalCode", "region"]);
    expect(r.errors.name).toMatch(/name/i);
    expect(r.errors.region).toMatch(/province/i);
  });

  it("does not hold a customer's tax number to the business's own country rules", () => {
    const foreign = parse({ name: "Namib Ltd", kind: "business", vatNumber: "NA 1234567-8" });
    expect(foreign.ok && foreign.value.vatNumber).toBe("NA 1234567-8");
    const junk = parse({ name: "X", kind: "business", vatNumber: "!!!" });
    expect(junk.ok).toBe(false);
  });

  it("keeps line breaks in the notes, tidying the rest", () => {
    const r = parse({ name: "Thandi", notes: "Pays cash\nLikes blue" });
    expect(r.ok && r.value.notes).toBe("Pays cash\nLikes blue");
  });

  it("delivers to the main address unless the form says otherwise, and then carries no separate address", () => {
    const same = parse({ name: "Thandi", addressLine1: "12 Main Road", deliveryAddressLine1: "ignored" });
    expect(same.ok && same.value.deliverySameAsMain).toBe(true);
    expect(same.ok && same.value.deliveryAddressLine1).toBeNull();
    // A form that never showed the delivery part (it was not opened) sends nothing about it: still "same".
    const unopened = parse({ name: "Thandi" });
    expect(unopened.ok && unopened.value.deliverySameAsMain).toBe(true);
  });

  it("keeps a separate delivery address as parts, checked like the main address", () => {
    const r = parse({
      name: "Thandi",
      deliverySameAsMain: "no",
      deliveryAddressLine1: "  4 Dock   Road ",
      deliveryCity: "Durban",
      deliveryRegion: "KwaZulu-Natal",
      deliveryPostalCode: "4001",
    });
    expect(r.ok && r.value).toMatchObject({
      deliverySameAsMain: false,
      deliveryAddressLine1: "4 Dock Road",
      deliveryCity: "Durban",
      deliveryRegion: "KwaZulu-Natal",
      deliveryPostalCode: "4001",
    });
    const bad = parse({ name: "Thandi", deliverySameAsMain: "no", deliveryAddressLine1: "4 Dock Road", deliveryRegion: "Narnia", deliveryPostalCode: "ABC" });
    expect(!bad.ok && bad.errors.deliveryRegion).toBeTruthy();
    expect(!bad.ok && bad.errors.deliveryPostalCode).toBeTruthy();
  });

  it("says how to fix a delivery address that is switched to separate but left empty", () => {
    const r = parse({ name: "Thandi", deliverySameAsMain: "no" });
    expect(!r.ok && r.errors.deliveryAddressLine1).toMatch(/tick/i);
  });
});

describe("findPossibleDuplicates", () => {
  const existing = [
    { id: "1", name: "Thandi Nkosi", phone: "021 123 4567" },
    { id: "2", name: "Sam", phone: null },
    { id: "3", name: "Lerato", phone: "(082) 555-0000" },
  ];
  it("matches the same name ignoring case and spacing", () => {
    expect(findPossibleDuplicates({ name: " thandi  NKOSI", phone: null }, existing)).toEqual([existing[0]]);
  });
  it("matches the same phone number however it is written", () => {
    expect(findPossibleDuplicates({ name: "Someone else", phone: "082 555 0000" }, existing)).toEqual([existing[2]]);
  });
  it("ignores very short numbers and a customer's own row", () => {
    expect(findPossibleDuplicates({ name: "New", phone: "123" }, [{ id: "9", name: "Z", phone: "123" }])).toEqual([]);
    expect(findPossibleDuplicates({ name: "Sam", phone: null }, existing, "2")).toEqual([]);
  });
  it("finds nothing for a new person", () => {
    expect(findPossibleDuplicates({ name: "Brand New", phone: "011 000 1111" }, existing)).toEqual([]);
  });
});

describe("matchesSearch", () => {
  const c: CustomerSummary = {
    id: "1",
    organisationId: "org-a",
    name: "Cape Cakes",
    kind: "business",
    contactPerson: "Sam Jacobs",
    phone: "021 555 0000",
    email: "orders@cakes.example",
    city: "Cape Town",
    archived: false,
  };
  it("searches name, contact, email and town without caring about case", () => {
    for (const q of ["cape", "JACOBS", "orders@", "town"]) expect(matchesSearch(c, q)).toBe(true);
    expect(matchesSearch(c, "zebra")).toBe(false);
    expect(matchesSearch(c, "  ")).toBe(true);
  });
  it("finds a phone number by its digits", () => {
    expect(matchesSearch(c, "0215550000")).toBe(true);
    expect(matchesSearch(c, "555")).toBe(true);
    expect(matchesSearch(c, "99")).toBe(false);
  });
});

describe("forOrganisation", () => {
  it("keeps only the current business's rows, for someone who belongs to several", () => {
    const rows = [
      { id: "1", organisationId: "x" },
      { id: "2", organisationId: "y" },
      { id: "3", organisationId: "x" },
    ];
    expect(forOrganisation(rows, "x").map((r) => r.id)).toEqual(["1", "3"]);
    expect(forOrganisation(rows, "z")).toEqual([]);
  });
});

describe("customerDetail", () => {
  it("joins what tells two customers apart, skipping what is missing", () => {
    expect(customerDetail({ contactPerson: "Sam", phone: "021 555 0000", email: "s@x.example", city: "Cape Town" })).toBe(
      "Sam · 021 555 0000 · Cape Town",
    );
    expect(customerDetail({ contactPerson: null, phone: null, email: "s@x.example", city: null })).toBe("s@x.example");
    expect(customerDetail({ contactPerson: null, phone: null, email: null, city: null })).toBe("");
  });
});

describe("savedAddresses", () => {
  const base = {
    addressLine1: null,
    addressLine2: null,
    city: null,
    region: null,
    postalCode: null,
    deliverySameAsMain: true,
    deliveryAddressLine1: null,
    deliveryAddressLine2: null,
    deliveryCity: null,
    deliveryRegion: null,
    deliveryPostalCode: null,
  };

  it("offers nothing when the customer has no address", () => {
    expect(savedAddresses(base, ZA_LOCALE)).toEqual([]);
    // A separate delivery address with nothing in it is nothing.
    expect(savedAddresses({ ...base, deliverySameAsMain: false }, ZA_LOCALE)).toEqual([]);
  });

  it("offers the delivery address first, then the main address written the way the country writes it", () => {
    const list = savedAddresses(
      {
        ...base,
        deliverySameAsMain: false,
        deliveryAddressLine1: "4 Dock Road",
        deliveryCity: "Durban",
        deliveryPostalCode: "4001",
        addressLine1: "12 Main Road",
        city: "Soweto",
        region: "Gauteng",
        postalCode: "1804",
      },
      ZA_LOCALE,
    );
    expect(list.map((a) => a.kind)).toEqual(["delivery", "main"]);
    expect(list[0].text).toContain("4 Dock Road");
    expect(list[0].text).toContain("Durban");
    expect(list[1].text).toContain("12 Main Road");
    expect(list[1].text).toContain("Soweto");
    expect(list[1].text).toContain("1804");
  });

  it("offers one address when the main address is the delivery address", () => {
    const list = savedAddresses({ ...base, addressLine1: "12 Main Road", city: "Soweto" }, ZA_LOCALE);
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe("main");
    // The same written out again as a separate delivery address is still one address.
    const again = savedAddresses(
      { ...base, addressLine1: "12 Main Road", city: "Soweto", deliverySameAsMain: false, deliveryAddressLine1: "12  Main Road", deliveryCity: "Soweto" },
      ZA_LOCALE,
    );
    expect(again).toHaveLength(1);
    expect(again[0].kind).toBe("delivery");
  });
});
