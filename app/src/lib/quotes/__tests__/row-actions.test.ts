import { describe, expect, it } from "vitest";
import { quoteRowActions } from "../row-actions";

const job = { id: "j", number: 1 };

describe("what a quote's card offers", () => {
  it("lets a draft be duplicated or deleted, delete last", () => {
    expect(quoteRowActions({ status: "draft", customerName: "Thandi", liveJob: null })).toEqual(["duplicate", "delete-draft"]);
    expect(quoteRowActions({ status: "draft", customerName: null, liveJob: null })).toEqual(["duplicate", "delete-draft"]);
  });

  it("lets a sent quote with a customer become a job, recording the yes", () => {
    expect(quoteRowActions({ status: "sent", customerName: "Thandi", liveJob: null })).toEqual(["turn-into-job", "duplicate"]);
    expect(quoteRowActions({ status: "sent", customerName: null, liveJob: null })).toEqual(["duplicate"]);
  });

  it("makes a job from an accepted quote, or opens the one it has", () => {
    expect(quoteRowActions({ status: "accepted", customerName: "Thandi", liveJob: null })).toEqual(["create-job", "duplicate"]);
    expect(quoteRowActions({ status: "accepted", customerName: "Thandi", liveJob: job })).toEqual(["open-job", "duplicate"]);
    expect(quoteRowActions({ status: "accepted", customerName: null, liveJob: null })).toEqual(["duplicate"]);
  });

  it("offers only duplicating on a declined or withdrawn quote", () => {
    for (const status of ["declined", "withdrawn"]) expect(quoteRowActions({ status, customerName: "Thandi", liveJob: null })).toEqual(["duplicate"]);
  });

  it("offers no job action where the list did not load the jobs", () => {
    expect(quoteRowActions({ status: "sent", customerName: "Thandi" })).toEqual(["duplicate"]);
    expect(quoteRowActions({ status: "accepted", customerName: "Thandi" })).toEqual(["duplicate"]);
    expect(quoteRowActions({ status: "draft", customerName: "Thandi" })).toEqual(["duplicate", "delete-draft"]);
  });
});
