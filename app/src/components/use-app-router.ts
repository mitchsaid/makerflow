"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { navDirection } from "@/lib/nav-direction";

type Options = Parameters<ReturnType<typeof useRouter>["push"]>[1];

/**
 * `useRouter` whose `push` and `replace` tell the page transitions which way they go (docs/plans/route-transitions.md),
 * the way `AppLink` does for a link: forward to a page under this one, back to a parent (a Cancel that returns to the
 * list slides back), nothing otherwise. Everything else on the router is `useRouter`'s own.
 */
export function useAppRouter() {
  const router = useRouter();
  const pathname = usePathname();
  return useMemo(() => {
    const withDirection = (href: string, options?: Options): Options => {
      const direction = navDirection(pathname, href);
      return options?.transitionTypes || !direction ? options : { ...options, transitionTypes: [direction] };
    };
    return {
      ...router,
      push: (href: string, options?: Options) => router.push(href, withDirection(href, options)),
      replace: (href: string, options?: Options) => router.replace(href, withDirection(href, options)),
    };
  }, [router, pathname]);
}
