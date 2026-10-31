"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { navDirection } from "@/lib/nav-direction";

/**
 * `next/link` that tells the page transitions which way it goes (docs/plans/route-transitions.md): forward to a page
 * under this one, back to a parent, nothing otherwise (then the page fades). Used by the app's links; the tab bar
 * uses plain `Link` because its links are peers. Everything else is `Link`'s own.
 */
export default function AppLink({ href, transitionTypes, ...props }: ComponentProps<typeof Link>) {
  const pathname = usePathname();
  const to = typeof href === "string" ? href : (href.pathname ?? null);
  const direction = to === null ? null : navDirection(pathname, to);
  return <Link href={href} transitionTypes={transitionTypes ?? (direction ? [direction] : undefined)} {...props} />;
}
