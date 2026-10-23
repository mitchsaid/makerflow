import { SectionSwitch, type SectionLink } from "@/components/section-switch";

export type ProductsView = "product" | "service";

const VIEWS: SectionLink<ProductsView>[] = [
  { key: "product", label: "Products", href: "/app/products" },
  { key: "service", label: "Services", href: "/app/products?view=services" },
];

/** The switch at the top of the Products tab: Products and Services. Materials has its own place (docs/plans/materials-menu-and-gaps.md). */
export function ProductsSwitch({ active }: { active: ProductsView }) {
  return <SectionSwitch label="Products or services" items={VIEWS} active={active} />;
}
