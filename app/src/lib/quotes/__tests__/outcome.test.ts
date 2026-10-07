import { describe, expect, it } from "vitest";
import { currentOutcome, NOTE_MAX, outcomeSentence, parseOutcome, type OutcomeEvent } from "../outcome";

const today = "2026-10-06";
const typed = { on: "2026-10-05", how: "whatsapp", note: "" };

describe("parseOutcome", () => {
  it("accepts a day, a way and no note", () => {
    expect(parseOutcome("accepted", typed, today)).toEqual({
      ok: true,
      value: { on: "2026-10-05", how: "whatsapp", note: null },
    });
  });

  it("trims the note and keeps it", () => {
    const result = parseOutcome("declined", { ...typed, note: "  Too dear  " }, today);
    expect(result).toEqual({ ok: true, value: { on: "2026-10-05", how: "whatsapp", note: "Too dear" } });
  });

  it("allows today but not a day that hasn't happened", () => {
    expect(parseOutcome("accepted", { ...typed, on: today }, today).ok).toBe(true);
    const future = parseOutcome("accepted", { ...typed, on: "2026-10-07" }, today);
    expect(future).toMatchObject({ ok: false, errors: { on: expect.stringContaining("hasn't happened yet") } });
  });

  it("needs a real day and a known way, and says how to fix each", () => {
    const result = parseOutcome("accepted", { on: "", how: "", note: "" }, today);
    expect(result).toEqual({
      ok: false,
      errors: { on: "Choose the day they told you.", how: "Choose how they told you." },
    });
    expect(parseOutcome("accepted", { ...typed, on: "2026-02-30" }, today).ok).toBe(false);
    expect(parseOutcome("accepted", { ...typed, how: "carrier pigeon" }, today).ok).toBe(false);
  });

  it("limits the note", () => {
    expect(parseOutcome("accepted", { ...typed, note: "x".repeat(NOTE_MAX) }, today).ok).toBe(true);
    const long = parseOutcome("accepted", { ...typed, note: "x".repeat(NOTE_MAX + 1) }, today);
    expect(long).toMatchObject({ ok: false, errors: { note: expect.stringContaining("500") } });
  });

  it("withdrawing takes only a note: no day and no way, whatever was typed", () => {
    expect(parseOutcome("withdrawn", { on: "", how: "", note: "" }, today)).toEqual({
      ok: true,
      value: { on: null, how: null, note: null },
    });
    expect(parseOutcome("withdrawn", { on: "2099-01-01", how: "phone", note: " Repricing " }, today)).toEqual({
      ok: true,
      value: { on: null, how: null, note: "Repricing" },
    });
    expect(parseOutcome("withdrawn", { on: "", how: "", note: "x".repeat(NOTE_MAX + 1) }, today).ok).toBe(false);
  });
});

const event = (kind: OutcomeEvent["kind"], extra: Partial<OutcomeEvent> = {}): OutcomeEvent => ({
  kind,
  on: null,
  how: null,
  note: null,
  ...extra,
});

describe("currentOutcome", () => {
  const events = [
    event("created"),
    event("sent"),
    event("accepted", { on: "2026-10-04", how: "phone" }),
    event("reopened"),
    event("declined", { on: "2026-10-05", how: "email", note: "Too dear" }),
  ];

  it("is the latest event that matches where the quote stands", () => {
    expect(currentOutcome("declined", events)).toBe(events[4]);
  });

  it("is nothing for a quote that has no answer", () => {
    expect(currentOutcome("sent", events)).toBeNull();
    expect(currentOutcome("draft", events)).toBeNull();
  });

  it("is nothing when the log has no matching event", () => {
    expect(currentOutcome("withdrawn", events)).toBeNull();
  });
});

describe("outcomeSentence", () => {
  it("says what happened, when and how", () => {
    expect(outcomeSentence(event("accepted", { on: "2026-10-05", how: "whatsapp" }), "en-ZA")).toMatch(
      /^Accepted on 0?5 Oct 2026 · WhatsApp$/,
    );
    expect(outcomeSentence(event("declined", { on: "2026-10-05", how: "in_person" }), "en-ZA")).toMatch(
      /^Declined on 0?5 Oct 2026 · In person$/,
    );
  });

  it("says withdrawn and changed answers plainly", () => {
    expect(outcomeSentence(event("withdrawn"), "en-ZA")).toBe("Withdrawn");
    expect(outcomeSentence(event("reopened"), "en-ZA")).toBe("Answer changed, back to sent");
  });
});
