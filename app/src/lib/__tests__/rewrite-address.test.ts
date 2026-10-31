import { afterEach, describe, expect, it, vi } from "vitest";
import { rewriteAddress, takeAddressRewrite } from "../rewrite-address";

afterEach(() => vi.unstubAllGlobals());

describe("rewriteAddress", () => {
  it("is recognised once, for the address it gave, and not for another", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("window", { history: { replaceState } });
    rewriteAddress("/app/quotes/abc?x=1");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/app/quotes/abc?x=1");
    expect(takeAddressRewrite("/app/jobs")).toBe(false);
    expect(takeAddressRewrite("/app/quotes/abc/")).toBe(true);
    expect(takeAddressRewrite("/app/quotes/abc")).toBe(false);
  });

  it("is forgotten after a few seconds, so a later navigation to that address still animates", () => {
    vi.stubGlobal("window", { history: { replaceState: vi.fn() } });
    rewriteAddress("/app/quotes/abc");
    expect(takeAddressRewrite("/app/quotes/abc", Date.now() + 10_000)).toBe(false);
  });
});
