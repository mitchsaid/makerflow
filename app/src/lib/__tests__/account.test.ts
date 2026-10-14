import { describe, expect, it } from "vitest";
import { CONFIRM_EMAIL_MISSING, CONFIRM_EMAIL_WRONG, confirmationMatches, confirmationProblem, pictureFiles } from "../account";
import { pathFor } from "../images";

describe("confirming a deletion by typing the email address", () => {
  it("matches the address ignoring case and spaces at the ends", () => {
    expect(confirmationMatches("thandi@example.com", "thandi@example.com")).toBe(true);
    expect(confirmationMatches("  Thandi@Example.COM ", "thandi@example.com")).toBe(true);
  });
  it("does not match anything else", () => {
    expect(confirmationMatches("thandi@example.co", "thandi@example.com")).toBe(false);
    expect(confirmationMatches("thandi @example.com", "thandi@example.com")).toBe(false);
    expect(confirmationMatches("DELETE", "thandi@example.com")).toBe(false);
    expect(confirmationMatches("", "thandi@example.com")).toBe(false);
    expect(confirmationMatches(undefined, "thandi@example.com")).toBe(false);
    expect(confirmationMatches({ toString: () => "thandi@example.com" }, "thandi@example.com")).toBe(false);
  });
  it("never matches an account with no email, even an empty answer", () => {
    expect(confirmationMatches("", null)).toBe(false);
    expect(confirmationMatches("", "")).toBe(false);
    expect(confirmationMatches("x", undefined)).toBe(false);
  });
  it("says what to do", () => {
    expect(confirmationProblem("", "a@b.co")).toBe(CONFIRM_EMAIL_MISSING);
    expect(confirmationProblem("   ", "a@b.co")).toBe(CONFIRM_EMAIL_MISSING);
    expect(confirmationProblem("nope", "a@b.co")).toBe(CONFIRM_EMAIL_WRONG);
    expect(confirmationProblem("A@B.co", "a@b.co")).toBeNull();
  });
});

describe("the picture files of deleted businesses", () => {
  it("lists both sizes of each picture", () => {
    expect(pictureFiles([{ organisationId: "o1", id: "i1" }, { organisationId: "o2", id: "i2" }], pathFor)).toEqual([
      "o1/i1/display",
      "o1/i1/thumb",
      "o2/i2/display",
      "o2/i2/thumb",
    ]);
  });
  it("ignores anything that is not a picture record", () => {
    expect(pictureFiles(null, pathFor)).toEqual([]);
    expect(pictureFiles([null, {}, { organisationId: 1, id: "x" }, { organisationId: "o", id: "i" }], pathFor)).toEqual(["o/i/display", "o/i/thumb"]);
  });
});
