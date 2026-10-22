import Link from "next/link";

export type SectionLink<K extends string> = { key: K; label: string; href: string };

const COLUMNS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

/**
 * A switch between a few views of one area (Products, Services, Materials; a customer's Quotes, Jobs, Invoices,
 * Details). Each view is its own address, so back works and a view can be bookmarked; the active one is marked.
 */
export function SectionSwitch<K extends string>({ label, items, active }: { label: string; items: readonly SectionLink<K>[]; active: K }) {
  return (
    <nav aria-label={label} className={`grid ${COLUMNS[items.length] ?? "grid-cols-3"} gap-1 rounded-lg bg-muted p-1`}>
      {items.map(({ key, label: text, href }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === active ? "page" : undefined}
          className={`flex min-h-11 items-center justify-center rounded-md px-1 text-base font-medium ${
            key === active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {text}
        </Link>
      ))}
    </nav>
  );
}
