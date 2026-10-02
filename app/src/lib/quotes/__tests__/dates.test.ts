import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDay, isIsoDay, todayIn } from "../dates";

describe("isIsoDay", () => {
  it("accepts real calendar days only", () => {
    expect(isIsoDay("2026-10-02")).toBe(true);
    expect(isIsoDay("2028-02-29")).toBe(true); // leap year
    for (const bad of ["2026-02-29", "2026-13-01", "2026-00-10", "2026-10-32", "26-10-02", "2026/10/02", "", null, 20261002]) {
      expect(isIsoDay(bad), String(bad)).toBe(false);
    }
  });
});

describe("addDays and daysBetween", () => {
  it("moves across months, years and leap days", () => {
    expect(addDays("2026-10-02", 14)).toBe("2026-10-16");
    expect(addDays("2026-12-25", 10)).toBe("2027-01-04");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-10-02", "2026-10-16")).toBe(14);
    expect(daysBetween("2026-10-16", "2026-10-02")).toBe(-14);
  });
});

describe("todayIn", () => {
  it("is the calendar day where the business is, not in UTC", () => {
    const lateEveningUtc = new Date("2026-10-02T23:30:00Z"); // already the 3rd in Johannesburg (UTC+2)
    expect(todayIn("Africa/Johannesburg", lateEveningUtc)).toBe("2026-10-03");
    expect(todayIn("UTC", lateEveningUtc)).toBe("2026-10-02");
  });
});

describe("formatDay", () => {
  it("shows the stored day without shifting it", () => {
    expect(formatDay("2026-10-02", "en-ZA")).toMatch(/2.*(Oct|okt).*2026/i);
    expect(formatDay("nonsense", "en-ZA")).toBe("nonsense");
  });
});
