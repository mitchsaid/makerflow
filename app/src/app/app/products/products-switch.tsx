import Link from "next/link";

export type ProductsView = "product" | "service" | "materials";

const VIEWS: { view: ProductsView; label: string; href: string }[] = [
  { view: "product", label: "Products", href: "/app/products" },
  { view: "service", label: "Services", href: "/app/products?view=services" },
  { view: "materials", label: "Materials", href: "/app/products/materials" },
];

/** The switch at the top of the Products tab: Products, Services and Materials (docs/plans/costs-and-recipes.md). */
export function ProductsSwitch({ active }: { active: ProductsView }) {
  return (
    <nav aria-label="Products, services or materials" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
      {VIEWS.map(({ view, label, href }) => (
        <Link
          key={view}
          href={href}
          aria-current={view === active ? "page" : undefined}
          className={`flex min-h-11 items-center justify-center rounded-md text-base font-medium ${
            view === active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
