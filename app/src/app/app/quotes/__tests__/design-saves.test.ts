import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleDesignSave, waitForDesignSave } from "../design-saves";

describe("saving the design choice in the background", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves once, after a quiet moment, with the last choice", async () => {
    const saved: string[] = [];
    scheduleDesignSave("q1", async () => void saved.push("a"));
    scheduleDesignSave("q1", async () => void saved.push("b"));
    await vi.advanceTimersByTimeAsync(299);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    expect(saved).toEqual(["b"]);
  });

  it("waitForDesignSave starts a waiting save at once and waits for it to finish", async () => {
    const saved: string[] = [];
    scheduleDesignSave("q1", async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      saved.push("done");
    });
    const waited = waitForDesignSave();
    await vi.advanceTimersByTimeAsync(60);
    await waited;
    expect(saved).toEqual(["done"]);
  });

  it("keeps the saves of two quotes apart, and runs them one after the other", async () => {
    const order: string[] = [];
    scheduleDesignSave("q1", async () => void order.push("q1"));
    scheduleDesignSave("q2", async () => void order.push("q2"));
    await waitForDesignSave();
    expect(order.sort()).toEqual(["q1", "q2"]);
  });

  it("carries on after a save fails", async () => {
    const order: string[] = [];
    scheduleDesignSave("q1", async () => {
      throw new Error("offline");
    });
    scheduleDesignSave("q2", async () => void order.push("q2"));
    await waitForDesignSave();
    await vi.advanceTimersByTimeAsync(1);
    expect(order).toEqual(["q2"]);
  });
});
