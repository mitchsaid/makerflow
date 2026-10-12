import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("adminOrMessage", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });

  it("gives the server's access when the key is set", async () => {
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    const { adminOrMessage } = await import("../admin");
    const made = adminOrMessage("a test");
    expect(made.admin).toBeDefined();
    expect(made.message).toBeUndefined();
  });

  it("says what is missing and who can fix it, and logs what was attempted, when the key is not set", async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    const { adminOrMessage, SERVER_KEY_MISSING_MESSAGE } = await import("../admin");
    const made = adminOrMessage("a job change");
    expect(made.admin).toBeUndefined();
    expect(made.message).toBe(SERVER_KEY_MISSING_MESSAGE);
    expect(SERVER_KEY_MISSING_MESSAGE).toContain("SUPABASE_SECRET_KEY");
    expect(SERVER_KEY_MISSING_MESSAGE).toContain("nothing was changed");
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("a job change"), expect.any(String));
  });
});
