/**
 * Public demo accounts (docs/plans/demo-accounts.md): a visitor tries MakerFlow in a private, temporary business of
 * their own, one of a few kinds of maker. This is the small part everyone may import: which kinds there are and the
 * words for them. The sample content is in `content.ts`, which only the builder uses.
 */

export const DEMO_KINDS = ["baker", "woodworker", "seamstress", "ceramicist"] as const;
export type DemoKind = (typeof DEMO_KINDS)[number];

export const isDemoKind = (value: unknown): value is DemoKind => typeof value === "string" && (DEMO_KINDS as readonly string[]).includes(value);

/** What the landing page offers, in this order: a short name and what they make. */
export const DEMO_CHOICES: Record<DemoKind, { title: string; line: string }> = {
  baker: { title: "Baker", line: "Cakes and cupcakes, made to order" },
  woodworker: { title: "Woodworker", line: "Furniture and custom pieces" },
  seamstress: { title: "Seamstress", line: "Alterations and made-to-measure" },
  ceramicist: { title: "Ceramicist", line: "Handmade pottery, sets and commissions" },
};

/** How long a demo lasts, in hours (the database sets the expiry; this is for the words). */
export const DEMO_HOURS = 6;

/** "5 hours", "45 minutes", "less than a minute": how long is left of a demo. */
export function timeLeftWords(expiresAt: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 60_000));
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour" : `${hours} hours`;
}
