export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export const BUSINESS_NAME_MAX = 120;

/** Business name as entered during onboarding. Mirrors the database rule (1-120 characters). */
export function validateBusinessName(input: unknown): ValidationResult<string> {
  const value = typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
  if (value.length === 0) {
    return { ok: false, error: "Please tell us what your business is called." };
  }
  if (value.length > BUSINESS_NAME_MAX) {
    return {
      ok: false,
      error: `Business names can be up to ${BUSINESS_NAME_MAX} characters.`,
    };
  }
  return { ok: true, value };
}

/**
 * Light sanity check only. The real test of an email address is that the sign-in
 * link arrives, so this only catches obvious typos before we send anything.
 */
export function validateEmail(input: unknown): ValidationResult<string> {
  const value = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (value.length === 0) {
    return { ok: false, error: "Please enter your email address." };
  }
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { ok: false, error: "That doesn't look like an email address." };
  }
  return { ok: true, value };
}

/**
 * Only allow redirects to paths inside this site. Anything else (absolute URLs,
 * protocol-relative "//host", backslash tricks) falls back to the default.
 */
export function safeNextPath(input: unknown, fallback = "/app"): string {
  if (typeof input !== "string") return fallback;
  if (!input.startsWith("/") || input.startsWith("//") || input.includes("\\")) {
    return fallback;
  }
  if (/[\u0000-\u001f]/.test(input)) return fallback;
  return input;
}
