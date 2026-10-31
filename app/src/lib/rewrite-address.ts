/**
 * A page that was just saved for the first time can take the address of the thing it made (a new quote's page becomes
 * the quote's own address) without going anywhere: the page stays as it is. The page transitions
 * (docs/plans/route-transitions.md) must not treat that as a navigation, or the page would be replaced and what was
 * typed lost. Pages say so here; the transitions ask once per address change.
 */
const EXPIRES_AFTER_MS = 3000;
let rewrite: { path: string; at: number } | null = null;

const pathOnly = (address: string) => address.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";

/** Gives the page a new address without a navigation (`history.replaceState`), and notes that it is not one. */
export function rewriteAddress(address: string) {
  rewrite = { path: pathOnly(address), at: Date.now() };
  window.history.replaceState(null, "", address);
}

/** Whether the page's path just changed because of `rewriteAddress` (true once per rewrite). */
export function takeAddressRewrite(pathname: string, now = Date.now()): boolean {
  const mine = rewrite;
  if (!mine || mine.path !== pathOnly(pathname)) return false;
  rewrite = null;
  return now - mine.at < EXPIRES_AFTER_MS;
}
