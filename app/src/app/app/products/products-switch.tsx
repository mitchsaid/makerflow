import { SectionSwitch, type SectionLink } from "@/components/section-switch";

export type ProductsView = "product" | "service" | "materials";

const VIEWS: SectionLink<ProductsView>[] = [
  { key: "product", label: "Products", href: "/app/products" },
  { key: "service", label: "Services", href: "/app/products?view=services" },
  { key: "materials", label: "Materials", href: "/app/products/materials" },
];

/** The switch at the top of the Products tab: Products, Services and Materials (docs/plans/costs-and-recipes.md). */
export function ProductsSwitch({ active }: { active: ProductsView }) {
  return <SectionSwitch label="Products, services or materials" items={VIEWS} active={active} />;
}
