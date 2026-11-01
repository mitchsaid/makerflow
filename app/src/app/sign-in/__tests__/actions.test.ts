import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signInWithOtp } }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "localhost:3000" }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { requestMagicLink } from "../actions";

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

beforeEach(() => signInWithOtp.mockReset().mockResolvedValue({ error: null }));

describe("requestMagicLink and the are-you-a-person check", () => {
  it("sends the check's token along when there is one", async () => {
    expect(await requestMagicLink({ status: "idle" }, form({ email: "a@example.test", captchaToken: "tok-123" }))).toMatchObject({ status: "sent" });
    expect(signInWithOtp.mock.calls[0]![0].options).toMatchObject({ captchaToken: "tok-123", shouldCreateUser: true });
  });

  it("sends none when the site has the check off (an empty token is not sent)", async () => {
    await requestMagicLink({ status: "idle" }, form({ email: "a@example.test" }));
    await requestMagicLink({ status: "idle" }, form({ email: "a@example.test", captchaToken: "" }));
    for (const call of signInWithOtp.mock.calls) expect(call[0].options).not.toHaveProperty("captchaToken");
  });

  it("a bad address is refused before anything is sent", async () => {
    expect(await requestMagicLink({ status: "idle" }, form({ email: "nope" }))).toMatchObject({ status: "error" });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
});
