"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  match: (path: string) => boolean;
  icon: () => React.ReactElement;
  /** Only on the phone tab bar, or only in the desktop sidebar. Default: both. */
  only?: "phone" | "desktop";
};

/**
 * On a phone five tabs fit (founder chose Products as its own tab, 2026-10-03); Business and
 * Settings sit behind "More".
 * The desktop sidebar has room for everything and has no "More".
 */
const ITEMS: Item[] = [
  { href: "/app", label: "Home", match: (p) => p === "/app", icon: HomeIcon },
  { href: "/app/quotes", label: "Quotes", match: (p) => p.startsWith("/app/quotes"), icon: QuotesIcon },
  { href: "/app/customers", label: "Customers", match: (p) => p.startsWith("/app/customers"), icon: CustomersIcon },
  { href: "/app/products", label: "Products", match: (p) => p.startsWith("/app/products"), icon: ProductsIcon },
  { href: "/app/business", label: "Business", match: (p) => p.startsWith("/app/business"), icon: BusinessIcon, only: "desktop" },
  { href: "/app/settings", label: "Settings", match: (p) => p.startsWith("/app/settings"), icon: SettingsIcon, only: "desktop" },
  {
    href: "/app/more",
    label: "More",
    match: (p) =>
      p.startsWith("/app/more") || p.startsWith("/app/business") || p.startsWith("/app/settings"),
    icon: MoreIcon,
    only: "phone",
  },
];

/**
 * Bottom tab bar on phones, left sidebar from tablet width up.
 * Only sections that exist are listed; more appear as features ship.
 */
export function WorkspaceNav({ businessName }: { businessName: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card md:static md:w-56 md:shrink-0 md:border-r md:border-t-0"
    >
      <p className="hidden truncate px-4 pt-5 pb-3 text-sm font-semibold md:block">
        {businessName}
      </p>
      <ul className="flex md:flex-col md:gap-1 md:px-2">
        {ITEMS.map(({ href, label, match, icon: Icon, only }) => {
          const active = match(pathname);
          const visibility =
            only === "desktop" ? "hidden md:block" : only === "phone" ? "md:hidden" : "";
          return (
            <li key={href} className={`flex-1 md:flex-none ${visibility}`}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-3 py-2 text-xs font-medium md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-lg md:text-sm ${
                  active
                    ? "text-primary md:bg-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary md:inset-x-auto md:bottom-2 md:left-0 md:top-2 md:h-auto md:w-0.5"
                  />
                )}
                <TabContent label={label} icon={<Icon />} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Instant feedback: the tapped tab lights up the moment it is pressed, before the
 * next page arrives (the page itself shows a loading skeleton, see loading.tsx).
 * Nothing here changes size between states (same font weight, indicator is
 * absolutely positioned), so tabs never shift when selected.
 */
function TabContent({ label, icon }: { label: string; icon: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={`flex flex-col items-center gap-0.5 md:flex-row md:gap-3 ${
        pending ? "text-primary" : ""
      }`}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}

function HomeIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h5v-6h4v6h5V9.5" />
    </svg>
  );
}

function QuotesIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </svg>
  );
}

function ProductsIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}

function CustomersIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6" />
      <path d="M18 14.3c2 .7 3.5 2.6 3.5 5.7" />
    </svg>
  );
}

function BusinessIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 4.5 4h15L21 9.5" />
      <path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
      <path d="M5 12.5V20h14v-7.5" />
      <path d="M10 20v-4.5h4V20" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}
