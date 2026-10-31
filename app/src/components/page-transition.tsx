"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

const WHICH_WAY = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-fade" } as const;

/**
 * Around the page in the workspace layout (docs/plans/route-transitions.md): a new path is an exit and an enter, so
 * a page slides in from the right when the maker goes deeper, from the left when they come back, and fades when it
 * is neither (the direction comes from `AppLink`). The key is the path, so a change of query only (a customer's
 * tabs) animates nothing. The motion is in globals.css, and is off for people who ask for less motion.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} default="none" enter={WHICH_WAY} exit={WHICH_WAY}>
      {children}
    </ViewTransition>
  );
}
