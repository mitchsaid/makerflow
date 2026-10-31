"use client";

import { useState, ViewTransition } from "react";
import { usePathname } from "next/navigation";
import { takeAddressRewrite } from "@/lib/rewrite-address";

// What each side of a navigation is called in globals.css. Going deeper: the new page slides in over the old, which
// moves under it. Coming back: the page slides away and the one beneath comes back. Anything else (tabs): nothing
// moves, as on a phone's own tab bar; the page is simply there (a fade of a loading skeleton over the old page
// looked muddy on a real phone).
const ENTER = { "nav-forward": "push-in", "nav-back": "pop-under", default: "none" } as const;
const EXIT = { "nav-forward": "push-under", "nav-back": "pop-out", default: "none" } as const;

/**
 * Around the page in the workspace layout (docs/plans/route-transitions.md): a new path is an exit and an enter, so
 * a page slides in from the right when the maker goes deeper and back off to the right when they come back (the
 * direction comes from `AppLink`); between tabs nothing moves. The page sits on an opaque layer with the page's
 * own background, so two pages are never seen through each other while they move. The key changes with the
 * navigation, not with the path alone: a change of query only (a customer's tabs) animates nothing, and neither does
 * a page taking the address of what it just saved (`rewriteAddress`): that is not a navigation and the page must stay
 * as it is. The motion is in globals.css, and is off for people who ask for less motion.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // A new number for each navigation: it is what the transition is keyed on.
  const [seen, setSeen] = useState({ pathname, navigation: 0 });
  if (seen.pathname !== pathname) {
    setSeen({ pathname, navigation: takeAddressRewrite(pathname) ? seen.navigation : seen.navigation + 1 });
  }
  return (
    <ViewTransition key={seen.navigation} default="none" enter={ENTER} exit={EXIT}>
      <div className="flex flex-1 flex-col bg-background">{children}</div>
    </ViewTransition>
  );
}
