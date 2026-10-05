import { beforeEach, describe, expect, it, vi } from "vitest";

const requireOrganisation = vi.fn();
const createClient = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ requireOrganisation: () => requireOrganisation() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveBankDetails } from "../../../app/app/business/bank-actions";

const values = {
  fields: { holder: "Sweet Co", bank: "FNB", accountType: "Savings", accountNumber: "62123456789", branchCode: "250655" },
  useReference: true,
};
const asRole = (role: string) =>
  requireOrganisation.mockResolvedValue({ organisation: { id: "org-1" }, role, profile: { countryCode: "ZA" } });

beforeEach(() => {
  requireOrganisation.mockReset();
  createClient.mockReset();
});

describe("saveBankDetails", () => {
  it.each(["admin", "staff"])("refuses a %s without touching the database", async (role) => {
    asRole(role);
    const result = await saveBankDetails(values);
    expect(result).toMatchObject({ status: "error", message: expect.stringMatching(/Only the owner/) });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("refuses a malformed request from the owner without touching the database", async () => {
    asRole("owner");
    const bad = { fields: { holder: 5 }, useReference: "yes" } as unknown as typeof values;
    expect(await saveBankDetails(bad)).toMatchObject({ status: "error" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("tells the owner what is wrong with the fields, and saves nothing", async () => {
    asRole("owner");
    const result = await saveBankDetails({ ...values, fields: { ...values.fields, branchCode: "12" } });
    expect(result).toMatchObject({ status: "error", errors: { branchCode: expect.stringMatching(/6 digits/) } });
    expect(createClient).not.toHaveBeenCalled();
  });

  const savedRow = {
    country_code: "ZA",
    details: { ...values.fields },
    use_reference: true,
    updated_at: "2026-10-05T08:00:00Z",
  };

  it("changes the existing row for the owner's own business", async () => {
    asRole("owner");
    const select = vi.fn().mockResolvedValue({ data: [savedRow], error: null });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const insert = vi.fn();
    createClient.mockResolvedValue({ from: () => ({ update, insert }) });
    expect((await saveBankDetails(values)).status).toBe("saved");
    expect(eq).toHaveBeenCalledWith("organisation_id", "org-1");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ country_code: "ZA", use_reference: true }));
    expect(insert).not.toHaveBeenCalled();
  });

  it("adds the row the first time, and changes it instead if another tab added it first", async () => {
    asRole("owner");
    const empty = { data: [], error: null };
    const select = vi.fn().mockResolvedValueOnce(empty).mockResolvedValueOnce({ data: [savedRow], error: null });
    const update = vi.fn().mockReturnValue({ eq: () => ({ select }) });
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate" } });
    const insert = vi.fn().mockReturnValue({ select: () => ({ single }) });
    createClient.mockResolvedValue({ from: () => ({ update, insert }) });
    expect((await saveBankDetails(values)).status).toBe("saved");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ organisation_id: "org-1" }));
    expect(update).toHaveBeenCalledTimes(2);
  });
});
