import { describe, expect, it } from "vitest";
import { addDays, datesForCopy, daysBetween, formatDay, isIsoDay, todayIn } from "../dates";

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

describe("datesForCopy", () => {
  const old = {
    issueDate: "2026-09-01",
    validUntil: "2026-09-15",
    neededBy: "2026-09-20",
    balanceDue: "date" as const,
    balanceDueDate: "2026-09-25",
    title: "kept",
  };

  it("makes the dates fresh and keeps everything else", () => {
    const copy = datesForCopy(old, "2026-10-06");
    expect(copy).toMatchObject({ issueDate: "2026-10-06", validUntil: "2026-10-20", title: "kept" });
  });

  it("drops dates that have passed", () => {
    const copy = datesForCopy(old, "2026-10-06");
    expect(copy.neededBy).toBe("");
    expect(copy.balanceDue).toBe("handover");
    expect(copy.balanceDueDate).toBe("");
  });

  it("keeps dates that are still ahead, including today", () => {
    const copy = datesForCopy({ ...old, neededBy: "2026-10-06", balanceDueDate: "2026-11-01" }, "2026-10-06");
    expect(copy.neededBy).toBe("2026-10-06");
    expect(copy.balanceDue).toBe("date");
    expect(copy.balanceDueDate).toBe("2026-11-01");
  });
});
