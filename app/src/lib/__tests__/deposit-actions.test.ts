import { beforeEach, describe, expect, it, vi } from "vitest";

const requireOrganisation = vi.fn();
const createClient = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ requireOrganisation: () => requireOrganisation() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveDepositDefault } from "../../app/app/documents/deposit-actions";

const asRole = (role: string) => requireOrganisation.mockResolvedValue({ organisation: { id: "org-1" }, role });

beforeEach(() => {
  requireOrganisation.mockReset();
  createClient.mockReset();
});

describe("saveDepositDefault", () => {
  it("refuses staff without touching the database", async () => {
    asRole("staff");
    expect(await saveDepositDefault({ kind: "percent", value: "50" })).toMatchObject({ status: "error", message: expect.stringMatching(/Only owners and admins/) });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("says how to fix a bad value, and saves nothing", async () => {
    asRole("owner");
    expect(await saveDepositDefault({ kind: "percent", value: "" })).toMatchObject({ status: "error", errors: { depositValue: expect.stringMatching(/percentage/i) } });
    expect(await saveDepositDefault({ kind: "percent", value: "150" })).toMatchObject({ status: "error" });
    expect(await saveDepositDefault({ kind: "fixed", value: "0" })).toMatchObject({ status: "error" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("refuses a request that is not the right shape", async () => {
    asRole("owner");
    expect(await saveDepositDefault({ kind: "lottery", value: "5" } as never)).toMatchObject({ status: "error" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("saves the default for the owner's own business, in basis points or cents", async () => {
    asRole("admin");
    const select = vi.fn().mockResolvedValue({ data: [{ organisation_id: "org-1" }], error: null });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: () => ({ update }) });
    expect(await saveDepositDefault({ kind: "percent", value: "40" })).toEqual({ status: "saved" });
    expect(update).toHaveBeenCalledWith({ default_deposit_kind: "percent", default_deposit_value: 4000 });
    expect(await saveDepositDefault({ kind: "fixed", value: "1 250,50" })).toEqual({ status: "saved" });
    expect(update).toHaveBeenLastCalledWith({ default_deposit_kind: "fixed", default_deposit_value: 125050 });
    expect(await saveDepositDefault({ kind: "none", value: "" })).toEqual({ status: "saved" });
    expect(update).toHaveBeenLastCalledWith({ default_deposit_kind: "none", default_deposit_value: 0 });
    expect(eq).toHaveBeenCalledWith("organisation_id", "org-1");
  });

  it("says so when no row changed", async () => {
    asRole("owner");
    const select = vi.fn().mockResolvedValue({ data: [], error: null });
    createClient.mockResolvedValue({ from: () => ({ update: () => ({ eq: () => ({ select }) }) }) });
    expect(await saveDepositDefault({ kind: "percent", value: "10" })).toMatchObject({ status: "error" });
  });
});
