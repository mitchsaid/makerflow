/**
 * Which way a navigation goes, for the page transitions (docs/plans/route-transitions.md): "nav-forward" when the
 * target is deeper than where the maker is (a list to its row, a page to its preview), "nav-back" when it is a parent
 * of it, nothing when it is neither (tabs and other peers fade). Only the path counts: a query or a hash does not.
 */
export type NavDirection = "nav-forward" | "nav-back";

function pathOf(address: string): string | null {
  // Another site, a protocol, or an address that is not a path from the root: not ours to animate.
  if (!address.startsWith("/") || address.startsWith("//")) return null;
  const path = address.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  return path === "" ? "/" : path;
}

export function navDirection(from: string, to: string): NavDirection | null {
  const a = pathOf(from);
  const b = pathOf(to);
  if (a === null || b === null || a === b) return null;
  const under = (child: string, parent: string) => (parent === "/" ? child !== "/" : child.startsWith(`${parent}/`));
  if (under(b, a)) return "nav-forward";
  if (under(a, b)) return "nav-back";
  return null;
}
