import { describe, expect, it } from "vitest";
import { quoteRowActions } from "../row-actions";

const job = { id: "j", number: 1 };

describe("what a quote's card offers", () => {
  it("lets a draft be deleted, and nothing else", () => {
    expect(quoteRowActions({ status: "draft", customerName: "Thandi", liveJob: null })).toEqual(["delete-draft"]);
    expect(quoteRowActions({ status: "draft", customerName: null, liveJob: null })).toEqual(["delete-draft"]);
  });

  it("lets a sent quote with a customer become a job, recording the yes", () => {
    expect(quoteRowActions({ status: "sent", customerName: "Thandi", liveJob: null })).toEqual(["turn-into-job"]);
    expect(quoteRowActions({ status: "sent", customerName: null, liveJob: null })).toEqual([]);
  });

  it("makes a job from an accepted quote, or opens the one it has", () => {
    expect(quoteRowActions({ status: "accepted", customerName: "Thandi", liveJob: null })).toEqual(["create-job"]);
    expect(quoteRowActions({ status: "accepted", customerName: "Thandi", liveJob: job })).toEqual(["open-job"]);
    expect(quoteRowActions({ status: "accepted", customerName: null, liveJob: null })).toEqual([]);
  });

  it("offers nothing on a declined or withdrawn quote", () => {
    for (const status of ["declined", "withdrawn"]) expect(quoteRowActions({ status, customerName: "Thandi", liveJob: null })).toEqual([]);
  });

  it("offers no job action where the list did not load the jobs", () => {
    expect(quoteRowActions({ status: "sent", customerName: "Thandi" })).toEqual([]);
    expect(quoteRowActions({ status: "accepted", customerName: "Thandi" })).toEqual([]);
    expect(quoteRowActions({ status: "draft", customerName: "Thandi" })).toEqual(["delete-draft"]);
  });
});
