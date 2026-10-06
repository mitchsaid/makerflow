import { beforeEach, describe, expect, it, vi } from "vitest";

const requireOrganisation = vi.fn();
const createClient = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ requireOrganisation: () => requireOrganisation() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveBusinessTypes } from "../../app/app/business/type-actions";

const asRole = (role: string) => requireOrganisation.mockResolvedValue({ organisation: { id: "org-1" }, role, user: { id: "u1" } });

beforeEach(() => {
  requireOrganisation.mockReset();
  createClient.mockReset();
});

describe("saveBusinessTypes", () => {
  it("refuses staff without touching the database", async () => {
    asRole("staff");
    expect(await saveBusinessTypes(["food"])).toMatchObject({ status: "error", message: expect.stringMatching(/Only owners and admins/) });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("refuses unknown types from an owner without touching the database", async () => {
    asRole("owner");
    expect(await saveBusinessTypes(["food", "hacking"])).toMatchObject({ status: "error" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("saves a clean list for the owner's own business", async () => {
    asRole("owner");
    const select = vi.fn().mockResolvedValue({ data: [{ organisation_id: "org-1" }], error: null });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: () => ({ update }) });
    expect(await saveBusinessTypes(["workshops", "food", "food"])).toEqual({ status: "saved" });
    expect(update).toHaveBeenCalledWith({ business_types: ["food", "workshops"] });
    expect(eq).toHaveBeenCalledWith("organisation_id", "org-1");
  });

  it("says so when no row changed", async () => {
    asRole("admin");
    const select = vi.fn().mockResolvedValue({ data: [], error: null });
    createClient.mockResolvedValue({ from: () => ({ update: () => ({ eq: () => ({ select }) }) }) });
    expect(await saveBusinessTypes([])).toMatchObject({ status: "error" });
  });
});
