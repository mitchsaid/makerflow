import type { Table } from "./products";

/**
 * Shopify's product export (docs/plans/import-onboarding.md, slice 3). One product is several rows: the first carries
 * the Title and description, and each following row (one per variant, or per extra picture) carries only the Handle
 * and its own options and price. This turns that into the plain shape the importer already reads (a Title on every
 * row, a Price, a Description, and the option values as extra columns), so a product with sizes and scents arrives as
 * one suggested product with choices, which the maker confirms like any other suggestion. Archived products are left
 * out. Anything that is not a Shopify export comes back as null and is read as it is.
 */

const squash = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9]/g, "");

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
/** The description is HTML in Shopify; keep the words. */
export function plainText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

export function isShopifyExport(table: Table): boolean {
  const heads = (table[0] ?? []).map(squash);
  return heads.includes("handle") && heads.includes("title") && heads.includes("variantprice");
}

export function fromShopify(table: Table): Table | null {
  if (!isShopifyExport(table)) return null;
  const heads = (table[0] ?? []).map(squash);
  const at = (name: string) => heads.indexOf(name);
  const handle = at("handle");
  const title = at("title");
  const body = at("bodyhtml");
  const price = at("variantprice");
  const status = at("status");
  const optionNames = [1, 2, 3].map((n) => at(`option${n}name`));
  const optionValues = [1, 2, 3].map((n) => at(`option${n}value`));

  type Product = { title: string; body: string; names: string[]; rows: { price: string; values: string[] }[] };
  const products = new Map<string, Product>();
  for (const cells of table.slice(1)) {
    const key = (cells[handle] ?? "").trim();
    if (key === "") continue;
    let product = products.get(key);
    if (!product) {
      product = { title: "", body: "", names: [], rows: [] };
      products.set(key, product);
    }
    const t = (cells[title] ?? "").trim();
    if (t !== "") {
      product.title = t;
      product.body = body === -1 ? "" : plainText(cells[body] ?? "");
      product.names = optionNames.map((i) => (i === -1 ? "" : (cells[i] ?? "").trim()));
      // A product the shop has archived is not one the maker sells now.
      if (status !== -1 && (cells[status] ?? "").trim().toLowerCase() === "archived") product.title = "";
    }
    const p = (cells[price] ?? "").trim();
    // A row with no price is a picture, not a variant.
    if (p === "") continue;
    // "Default Title" is what Shopify writes for a product with no options.
    const values = optionValues.map((i) => (i === -1 ? "" : (cells[i] ?? "").trim())).map((v) => (v.toLowerCase() === "default title" ? "" : v));
    product.rows.push({ price: p, values });
  }

  // The heading of an option column: the name every product gives it, or "Option" when they disagree.
  const heading = (n: number) => {
    const names = new Set([...products.values()].filter((p) => p.rows.length > 1 && p.names[n]).map((p) => p.names[n]!));
    return names.size === 1 ? [...names][0]! : "Option";
  };
  const out: Table = [["Title", "Price", "Description", heading(0), heading(1), heading(2)]];
  for (const p of products.values()) {
    if (p.title === "") continue;
    for (const r of p.rows) out.push([p.title, r.price, p.body, ...r.values]);
  }
  return out;
}
