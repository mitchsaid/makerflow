import { describe, expect, it } from "vitest";
import {
  canEditBusinessProfile,
  isBusinessProfileComplete,
  parseBusinessProfileForm,
  type BusinessProfile,
} from "../business-profile";
import { validatePostalCode, validateVatNumber } from "../locale/za";
import { validatePhone } from "../validation";

function form(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("validateVatNumber", () => {
  it("accepts 10 digits starting with 4, ignoring spaces and hyphens", () => {
    expect(validateVatNumber("4123456789")).toEqual({ ok: true, value: "4123456789" });
    expect(validateVatNumber("412 345 6789")).toEqual({ ok: true, value: "4123456789" });
    expect(validateVatNumber("412-345-6789")).toEqual({ ok: true, value: "4123456789" });
  });
  it("rejects anything else", () => {
    for (const bad of ["", "123456789", "5123456789", "41234567890", "41234abc89", null, 4123456789]) {
      expect(validateVatNumber(bad).ok).toBe(false);
    }
  });
});

describe("validatePostalCode", () => {
  it("needs exactly 4 digits", () => {
    expect(validatePostalCode(" 8001 ")).toEqual({ ok: true, value: "8001" });
    for (const bad of ["", "800", "80011", "80a1", null]) {
      expect(validatePostalCode(bad).ok).toBe(false);
    }
  });
});

describe("validatePhone", () => {
  it("accepts common South African formats", () => {
    for (const good of ["021 123 4567", "0211234567", "+27 21 123 4567", "(021) 123-4567"]) {
      expect(validatePhone(good).ok).toBe(true);
    }
  });
  it("rejects letters and too-short or too-long numbers", () => {
    for (const bad of ["", "abc", "12345", "021 CALL ME", "1".repeat(20), null]) {
      expect(validatePhone(bad).ok).toBe(false);
    }
  });
});

describe("parseBusinessProfileForm", () => {
  it("turns empty optional fields into null", () => {
    const r = parseBusinessProfileForm(form({ name: "Sweet Nothings" }));
    expect(r).toEqual({
      ok: true,
      name: "Sweet Nothings",
      profile: {
        phone: null,
        email: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        region: null,
        postalCode: null,
        vatRegistered: false,
        vatNumber: null,
      },
    });
  });

  it("parses a full valid form", () => {
    const r = parseBusinessProfileForm(
      form({
        name: "  Sweet   Nothings ",
        phone: "021 123 4567",
        email: "Hello@Sweet.Example",
        addressLine1: "12 Long Street",
        city: "Cape Town",
        region: "Western Cape",
        postalCode: "8001",
        vatRegistered: "on",
        vatNumber: "412 345 6789",
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.name).toBe("Sweet Nothings");
      expect(r.profile.email).toBe("hello@sweet.example");
      expect(r.profile.vatRegistered).toBe(true);
      expect(r.profile.vatNumber).toBe("4123456789");
    }
  });

  it("requires a VAT number when registered", () => {
    const r = parseBusinessProfileForm(form({ name: "X", vatRegistered: "on" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.vatNumber).toBeDefined();
  });

  it("drops a VAT number when not registered", () => {
    const r = parseBusinessProfileForm(form({ name: "X", vatNumber: "4123456789" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.profile.vatRegistered).toBe(false);
      expect(r.profile.vatNumber).toBeNull();
    }
  });

  it("reports every problem at once, keyed by field", () => {
    const r = parseBusinessProfileForm(
      form({ name: "  ", phone: "abc", email: "nope", postalCode: "12", region: "Narnia" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(
        ["email", "name", "phone", "postalCode", "region"].sort(),
      );
    }
  });

  it("rejects over-long address fields", () => {
    const r = parseBusinessProfileForm(form({ name: "X", addressLine1: "a".repeat(121) }));
    expect(r.ok).toBe(false);
  });
});

describe("isBusinessProfileComplete", () => {
  const empty: BusinessProfile = {
    phone: null, email: null, addressLine1: null, addressLine2: null,
    city: null, region: null, postalCode: null, vatRegistered: false, vatNumber: null,
  };
  it("needs an address and a way to get in touch", () => {
    expect(isBusinessProfileComplete(empty)).toBe(false);
    expect(isBusinessProfileComplete({ ...empty, addressLine1: "1 Main", city: "Cape Town" })).toBe(false);
    expect(isBusinessProfileComplete({ ...empty, phone: "0211234567" })).toBe(false);
    expect(
      isBusinessProfileComplete({ ...empty, addressLine1: "1 Main", city: "Cape Town", phone: "0211234567" }),
    ).toBe(true);
    expect(
      isBusinessProfileComplete({ ...empty, addressLine1: "1 Main", city: "Cape Town", email: "a@b.co" }),
    ).toBe(true);
  });
});

describe("canEditBusinessProfile", () => {
  it("is limited to owners and admins", () => {
    expect(canEditBusinessProfile("owner")).toBe(true);
    expect(canEditBusinessProfile("admin")).toBe(true);
    expect(canEditBusinessProfile("staff")).toBe(false);
    expect(canEditBusinessProfile(null)).toBe(false);
  });
});
