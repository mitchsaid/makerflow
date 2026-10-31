"use client";

import { useState, ViewTransition } from "react";
import { usePathname } from "next/navigation";
import { takeAddressRewrite } from "@/lib/rewrite-address";

const WHICH_WAY = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-fade" } as const;

/**
 * Around the page in the workspace layout (docs/plans/route-transitions.md): a new path is an exit and an enter, so
 * a page slides in from the right when the maker goes deeper, from the left when they come back, and fades when it
 * is neither (the direction comes from `AppLink`). The key changes with the path, so a change of query only (a customer's
 * tabs) animates nothing, and neither does a page taking the address of what it just saved
 * (`rewriteAddress`): that is not a navigation and the page must stay as it is. The motion is in globals.css, and is
 * off for people who ask for less motion.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // A new number for each navigation: it is what the transition is keyed on.
  const [seen, setSeen] = useState({ pathname, navigation: 0 });
  if (seen.pathname !== pathname) {
    setSeen({ pathname, navigation: takeAddressRewrite(pathname) ? seen.navigation : seen.navigation + 1 });
  }
  return (
    <ViewTransition key={seen.navigation} default="none" enter={WHICH_WAY} exit={WHICH_WAY}>
      {children}
    </ViewTransition>
  );
}
