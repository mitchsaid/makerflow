import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
const signInAnonymously = vi.fn();
const signOut = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims, signInAnonymously, signOut }, rpc }) }));
vi.mock("@/lib/auth/dal", () => ({ getWorkspace: vi.fn(), requireOrganisation: vi.fn() }));
vi.mock("@/lib/demo/purge", () => ({ purgeExpiredDemos: vi.fn().mockResolvedValue(0), removeDemoOf: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/demo/build", () => ({ buildDemoBusiness: vi.fn() }));
vi.mock("../build-documents", () => ({ buildDemoDocuments: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { startDemo } from "../actions";

beforeEach(() => {
  getClaims.mockReset().mockResolvedValue({ data: { claims: null } });
  signInAnonymously.mockReset().mockResolvedValue({ error: null });
  signOut.mockReset().mockResolvedValue({});
  rpc.mockReset().mockResolvedValue({ error: null });
});

describe("startDemo", () => {
  it("signs a new visitor in anonymously and makes their demo, with the check's token when there is one", async () => {
    expect(await startDemo("baker", false, "tok-1")).toEqual({ status: "ok" });
    expect(signInAnonymously).toHaveBeenCalledWith({ options: { captchaToken: "tok-1" } });
    expect(rpc).toHaveBeenCalledWith("create_demo_organisation", { p_kind: "baker", p_name: "Sweet Crumbs Bakery" });
  });

  it("sends no token when the site has no check", async () => {
    await startDemo("woodworker");
    expect(signInAnonymously).toHaveBeenCalledWith(undefined);
  });

  it("an unknown kind is refused before anything is done", async () => {
    expect(await startDemo("florist")).toMatchObject({ status: "error" });
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("a signed-in maker is asked first, and only signed out when they chose to be", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1", is_anonymous: false } } });
    expect(await startDemo("baker")).toEqual({ status: "signed-in" });
    expect(signOut).not.toHaveBeenCalled();
    expect(signInAnonymously).not.toHaveBeenCalled();
    expect(await startDemo("baker", true)).toEqual({ status: "ok" });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("a visitor who already has an anonymous sign-in keeps it", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "v1", is_anonymous: true } } });
    expect(await startDemo("ceramicist")).toEqual({ status: "ok" });
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("says plainly when anonymous sign-ins are off, and when the demos are full", async () => {
    signInAnonymously.mockResolvedValue({ error: { code: "anonymous_provider_disabled", message: "off", status: 422 } });
    expect(await startDemo("baker")).toMatchObject({ status: "error", message: expect.stringMatching(/isn't switched on/) });
    signInAnonymously.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ error: { code: "54000", message: "too many" } });
    expect(await startDemo("baker")).toMatchObject({ status: "error", message: expect.stringMatching(/busy/) });
  });
});
