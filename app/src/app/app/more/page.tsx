import Link from "next/link";
import { requireOrganisation } from "@/lib/auth/dal";

const LINKS = [
  {
    href: "/app/business",
    title: "Business profile",
    description: "Your business name, contact details, address and VAT.",
  },
  {
    href: "/app/settings",
    title: "Settings",
    description: "Your account and how the app works for you.",
  },
] as const;

/** The phone's "More" tab: the places that don't need a tab of their own. */
export default async function MorePage() {
  await requireOrganisation();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold">More</h1>
      <ul className="space-y-2">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="block text-base font-medium">{link.title}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{link.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
