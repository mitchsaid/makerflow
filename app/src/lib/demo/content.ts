import type { BusinessType } from "../business-types";
import type { UnitCode } from "../materials/units";
import type { DemoKind } from "./index";

/**
 * The sample content of each demo business (docs/plans/demo-accounts.md): made-up makers, customers, materials and
 * products that make sense for the trade. It lives here, apart from the product's own paths, and is used only by the
 * demo builder (`build.ts`), which refuses to run on a business that is not a demo. Nothing here is real: the names,
 * numbers and addresses are invented (the 082 555 numbers are reserved-looking test numbers, the VAT number is made up).
 */

export type DemoMaterial = { key: string; name: string; unit: UnitCode; boughtQuantityMilli: number; priceCents: number; supplier?: string };

export type DemoCostLine =
  | { kind: "material"; material: string; amountMilli: number; unit: UnitCode }
  | { kind: "time"; minutes: number }
  | { kind: "other"; name: string; cents: number };

export type DemoProduct = {
  name: string;
  kind: "product" | "service";
  description: string;
  priceCents: number;
  unit?: string;
  variationLabel?: string;
  variations?: { name: string; priceCents: number; usual?: boolean }[];
  extras?: { name: string; priceCents: number }[];
  costs?: { makesMilli: number; lines: DemoCostLine[] };
};

export type DemoCustomer = { name: string; email: string; phone: string; city: string; region: string; postalCode: string; addressLine1: string; notes?: string };

/**
 * A sample quote: for which customer, what is on it (a product by name, its variation and extras by name), and how far
 * it has got. "accepted" also gets a job in progress and an invoice draft; a demo never has an issued invoice
 * (docs/plans/demo-accounts.md, decision 5).
 */
export type DemoQuote = {
  customer: string;
  status: "draft" | "sent" | "accepted";
  title?: string;
  /** How many days ago it was made out (small: a quote must not already have run out). */
  daysAgo: number;
  items: { product: string; variation?: string; extras?: string[]; quantity: number }[];
};

export type DemoContent = {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  region: string;
  postalCode: string;
  /** A made-up VAT number, for the one demo that is registered. */
  vatNumber?: string;
  businessTypes: BusinessType[];
  labourRateCents: number;
  targetMarginBp: number;
  /** The made-up logo: initials on a colour. */
  logo: { initials: string; background: string; foreground: string };
  materials: DemoMaterial[];
  customers: DemoCustomer[];
  products: DemoProduct[];
  quotes: DemoQuote[];
};

const R = (rand: number) => rand * 100;

const BAKER: DemoContent = {
  businessName: "Sweet Crumbs Bakery",
  ownerName: "Thandi Nkosi",
  phone: "082 555 0101",
  email: "orders@sweetcrumbs.example",
  addressLine1: "12 Long Street",
  addressLine2: "Gardens",
  city: "Cape Town",
  region: "Western Cape",
  postalCode: "8001",
  businessTypes: ["food"],
  labourRateCents: R(180),
  targetMarginBp: 5000,
  logo: { initials: "SC", background: "#b5483a", foreground: "#fff7ee" },
  materials: [
    { key: "flour", name: "Cake flour", unit: "kg", boughtQuantityMilli: 12500, priceCents: R(189), supplier: "Cape Bulk Foods" },
    { key: "butter", name: "Butter", unit: "kg", boughtQuantityMilli: 5000, priceCents: R(395), supplier: "Cape Bulk Foods" },
    { key: "sugar", name: "Castor sugar", unit: "kg", boughtQuantityMilli: 10000, priceCents: R(215) },
    { key: "cocoa", name: "Cocoa powder", unit: "kg", boughtQuantityMilli: 1000, priceCents: R(240) },
    { key: "eggs", name: "Free-range eggs", unit: "dozen", boughtQuantityMilli: 5000, priceCents: R(190) },
    { key: "boxes", name: "Cake boxes", unit: "each", boughtQuantityMilli: 50000, priceCents: R(425) },
  ],
  customers: [
    { name: "Lindiwe Dlamini", email: "lindiwe@example.test", phone: "082 555 0111", addressLine1: "4 Kloof Road", city: "Cape Town", region: "Western Cape", postalCode: "8001", notes: "Birthday cakes for the twins every March." },
    { name: "Pieter van Wyk", email: "pieter@example.test", phone: "082 555 0112", addressLine1: "88 Main Road", city: "Claremont", region: "Western Cape", postalCode: "7708" },
    { name: "Fatima Hendricks", email: "fatima@example.test", phone: "082 555 0113", addressLine1: "21 Rose Avenue", city: "Rondebosch", region: "Western Cape", postalCode: "7700", notes: "Halal kitchen only." },
    { name: "Grace Wedding Events", email: "grace@events.example", phone: "082 555 0114", addressLine1: "5 Vineyard Lane", city: "Stellenbosch", region: "Western Cape", postalCode: "7600" },
    { name: "Sipho Mokoena", email: "sipho@example.test", phone: "082 555 0115", addressLine1: "17 Oak Street", city: "Cape Town", region: "Western Cape", postalCode: "8001" },
  ],
  products: [
    {
      name: "Celebration cake",
      kind: "product",
      description: "A layered sponge, filled and covered in buttercream, made to order.",
      priceCents: R(450),
      variationLabel: "Size",
      variations: [
        { name: "Small (serves 8)", priceCents: R(450), usual: true },
        { name: "Medium (serves 16)", priceCents: R(750) },
        { name: "Large (serves 30)", priceCents: R(1250) },
      ],
      extras: [
        { name: "Fondant topper", priceCents: R(120) },
        { name: "Fresh flowers", priceCents: R(85) },
      ],
      costs: {
        makesMilli: 1000,
        lines: [
          { kind: "material", material: "flour", amountMilli: 400, unit: "kg" },
          { kind: "material", material: "butter", amountMilli: 300, unit: "kg" },
          { kind: "material", material: "sugar", amountMilli: 350, unit: "kg" },
          { kind: "material", material: "eggs", amountMilli: 500, unit: "dozen" },
          { kind: "material", material: "boxes", amountMilli: 1000, unit: "each" },
          { kind: "time", minutes: 150 },
        ],
      },
    },
    {
      name: "Chocolate cupcakes",
      kind: "product",
      description: "Rich chocolate cupcakes with ganache. Sold by the dozen.",
      priceCents: R(220),
      unit: "dozen",
      costs: {
        makesMilli: 1000,
        lines: [
          { kind: "material", material: "flour", amountMilli: 250, unit: "kg" },
          { kind: "material", material: "cocoa", amountMilli: 60, unit: "kg" },
          { kind: "material", material: "sugar", amountMilli: 200, unit: "kg" },
          { kind: "material", material: "eggs", amountMilli: 300, unit: "dozen" },
          { kind: "time", minutes: 60 },
        ],
      },
    },
    { name: "Sourdough loaf", kind: "product", description: "Slow-fermented, baked on Fridays.", priceCents: R(65) },
    { name: "Wedding cake tasting box", kind: "product", description: "Six mini cakes to taste before you choose.", priceCents: R(350) },
    { name: "Cake design consultation", kind: "service", description: "Planning a cake with you, by phone or in person.", priceCents: R(180), unit: "hour" },
  ],
  quotes: [
    {
      customer: "Grace Wedding Events",
      status: "accepted",
      title: "Cakes for the Davids wedding",
      daysAgo: 3,
      items: [
        { product: "Celebration cake", variation: "Large (serves 30)", extras: ["Fondant topper", "Fresh flowers"], quantity: 1 },
        { product: "Chocolate cupcakes", quantity: 3 },
      ],
    },
    { customer: "Lindiwe Dlamini", status: "sent", title: "Birthday cake for the twins", daysAgo: 1, items: [{ product: "Celebration cake", variation: "Medium (serves 16)", extras: ["Fondant topper"], quantity: 1 }, { product: "Chocolate cupcakes", quantity: 2 }] },
    { customer: "Pieter van Wyk", status: "draft", daysAgo: 0, items: [{ product: "Celebration cake", variation: "Small (serves 8)", quantity: 1 }, { product: "Chocolate cupcakes", quantity: 2 }, { product: "Cake design consultation", quantity: 1 }] },
  ],
};

const WOODWORKER: DemoContent = {
  businessName: "Karoo Timber Works",
  ownerName: "Johan Botha",
  phone: "082 555 0201",
  email: "info@karootimber.example",
  addressLine1: "3 Industrial Road",
  addressLine2: "Workshop 4",
  city: "Oudtshoorn",
  region: "Western Cape",
  postalCode: "6625",
  vatNumber: "4987654321",
  businessTypes: ["craft"],
  labourRateCents: R(320),
  targetMarginBp: 4000,
  logo: { initials: "KT", background: "#4a5d3a", foreground: "#f6f1e4" },
  materials: [
    { key: "oak", name: "Oak planks", unit: "m", boughtQuantityMilli: 20000, priceCents: R(2400), supplier: "Southern Cape Timber" },
    { key: "pine", name: "Pine planks", unit: "m", boughtQuantityMilli: 30000, priceCents: R(1650), supplier: "Southern Cape Timber" },
    { key: "oil", name: "Hardwax oil", unit: "l", boughtQuantityMilli: 5000, priceCents: R(1450) },
    { key: "screws", name: "Wood screws", unit: "each", boughtQuantityMilli: 500000, priceCents: R(260) },
  ],
  customers: [
    { name: "Annelize Pretorius", email: "annelize@example.test", phone: "082 555 0211", addressLine1: "9 Church Street", city: "Oudtshoorn", region: "Western Cape", postalCode: "6625" },
    { name: "Karoo Guest Lodge", email: "stay@karoolodge.example", phone: "082 555 0212", addressLine1: "Plot 12, Route 62", city: "Calitzdorp", region: "Western Cape", postalCode: "6660", notes: "Orders in batches of 6." },
    { name: "Mpho Sithole", email: "mpho@example.test", phone: "082 555 0213", addressLine1: "40 Bergview Drive", city: "George", region: "Western Cape", postalCode: "6529" },
    { name: "Dewald Kruger", email: "dewald@example.test", phone: "082 555 0214", addressLine1: "2 Voortrekker Road", city: "Mossel Bay", region: "Western Cape", postalCode: "6506" },
  ],
  products: [
    {
      name: "Dining table",
      kind: "product",
      description: "Solid timber, hand finished with hardwax oil. Made to order.",
      priceCents: R(9800),
      variationLabel: "Length",
      variations: [
        { name: "1.6 m (seats 6)", priceCents: R(9800), usual: true },
        { name: "2.0 m (seats 8)", priceCents: R(12500) },
        { name: "2.4 m (seats 10)", priceCents: R(15800) },
      ],
      extras: [
        { name: "Extension leaf", priceCents: R(2200) },
        { name: "Engraved initials", priceCents: R(350) },
      ],
      costs: {
        makesMilli: 1000,
        lines: [
          { kind: "material", material: "oak", amountMilli: 9000, unit: "m" },
          { kind: "material", material: "oil", amountMilli: 600, unit: "l" },
          { kind: "material", material: "screws", amountMilli: 40000, unit: "each" },
          { kind: "time", minutes: 1500 },
        ],
      },
    },
    {
      name: "Bench",
      kind: "product",
      description: "A sturdy hallway or garden bench in pine.",
      priceCents: R(2600),
      costs: {
        makesMilli: 1000,
        lines: [
          { kind: "material", material: "pine", amountMilli: 6000, unit: "m" },
          { kind: "material", material: "oil", amountMilli: 200, unit: "l" },
          { kind: "time", minutes: 360 },
        ],
      },
    },
    { name: "Cutting board", kind: "product", description: "Oak, with a juice groove. Oiled.", priceCents: R(420) },
    { name: "Custom commission", kind: "service", description: "Design and building to your drawing, charged by the hour.", priceCents: R(380), unit: "hour" },
    { name: "Delivery and set-up", kind: "service", description: "We bring it and put it in place.", priceCents: R(650) },
  ],
  quotes: [
    {
      customer: "Karoo Guest Lodge",
      status: "accepted",
      title: "Dining tables for the lodge",
      daysAgo: 3,
      items: [{ product: "Dining table", variation: "2.4 m (seats 10)", extras: ["Engraved initials"], quantity: 2 }, { product: "Delivery and set-up", quantity: 1 }],
    },
    { customer: "Annelize Pretorius", status: "sent", daysAgo: 1, items: [{ product: "Bench", quantity: 1 }, { product: "Cutting board", quantity: 2 }] },
    { customer: "Mpho Sithole", status: "draft", daysAgo: 0, items: [{ product: "Bench", quantity: 1 }, { product: "Custom commission", quantity: 6 }, { product: "Delivery and set-up", quantity: 1 }] },
  ],
};

const SEAMSTRESS: DemoContent = {
  businessName: "Stitch & Thread",
  ownerName: "Naledi Molefe",
  phone: "082 555 0301",
  email: "hello@stitchandthread.example",
  addressLine1: "27 Jan Smuts Avenue",
  addressLine2: "Studio 2",
  city: "Johannesburg",
  region: "Gauteng",
  postalCode: "2196",
  businessTypes: ["clothing"],
  labourRateCents: R(220),
  targetMarginBp: 5500,
  logo: { initials: "ST", background: "#5b3a8c", foreground: "#fdf7ff" },
  materials: [
    { key: "cotton", name: "Cotton fabric", unit: "m", boughtQuantityMilli: 10000, priceCents: R(950), supplier: "Fabric Warehouse" },
    { key: "lining", name: "Satin lining", unit: "m", boughtQuantityMilli: 10000, priceCents: R(780), supplier: "Fabric Warehouse" },
    { key: "zips", name: "Invisible zips", unit: "each", boughtQuantityMilli: 25000, priceCents: R(225) },
    { key: "thread", name: "Thread", unit: "each", boughtQuantityMilli: 12000, priceCents: R(300) },
  ],
  customers: [
    { name: "Zanele Khumalo", email: "zanele@example.test", phone: "082 555 0311", addressLine1: "6 Rivonia Road", city: "Sandton", region: "Gauteng", postalCode: "2196" },
    { name: "Bridal Boutique Rosebank", email: "orders@rosebankbridal.example", phone: "082 555 0312", addressLine1: "11 Oxford Road", city: "Rosebank", region: "Gauteng", postalCode: "2196", notes: "Sends alterations in batches." },
    { name: "Michelle Naidoo", email: "michelle@example.test", phone: "082 555 0313", addressLine1: "73 Louis Botha Avenue", city: "Johannesburg", region: "Gauteng", postalCode: "2196" },
    { name: "Thabo Radebe", email: "thabo@example.test", phone: "082 555 0314", addressLine1: "9 Jorissen Street", city: "Braamfontein", region: "Gauteng", postalCode: "2017" },
  ],
  products: [
    {
      name: "Made-to-measure dress",
      kind: "product",
      description: "Designed with you, cut and sewn to your measurements.",
      priceCents: R(1800),
      variationLabel: "Style",
      variations: [
        { name: "Day dress", priceCents: R(1800), usual: true },
        { name: "Cocktail dress", priceCents: R(2600) },
        { name: "Evening gown", priceCents: R(4200) },
      ],
      extras: [
        { name: "Lining", priceCents: R(350) },
        { name: "Hand-finished hem", priceCents: R(180) },
      ],
      costs: {
        makesMilli: 1000,
        lines: [
          { kind: "material", material: "cotton", amountMilli: 3500, unit: "m" },
          { kind: "material", material: "zips", amountMilli: 1000, unit: "each" },
          { kind: "material", material: "thread", amountMilli: 500, unit: "each" },
          { kind: "time", minutes: 480 },
        ],
      },
    },
    { name: "Hem trousers or skirt", kind: "service", description: "Shortened and pressed.", priceCents: R(110) },
    { name: "Replace a zip", kind: "service", description: "New zip fitted, matching colour.", priceCents: R(160) },
    { name: "Suit alteration", kind: "service", description: "Jacket and trousers taken in or let out.", priceCents: R(520) },
    { name: "Cushion cover", kind: "product", description: "Cotton, with an invisible zip.", priceCents: R(180) },
  ],
  quotes: [
    {
      customer: "Bridal Boutique Rosebank",
      status: "accepted",
      title: "Bridal alterations, March",
      daysAgo: 3,
      items: [{ product: "Suit alteration", quantity: 3 }, { product: "Hem trousers or skirt", quantity: 4 }, { product: "Replace a zip", quantity: 2 }],
    },
    { customer: "Zanele Khumalo", status: "sent", title: "Cocktail dress", daysAgo: 1, items: [{ product: "Made-to-measure dress", variation: "Cocktail dress", extras: ["Lining", "Hand-finished hem"], quantity: 1 }] },
    { customer: "Michelle Naidoo", status: "draft", daysAgo: 0, items: [{ product: "Made-to-measure dress", variation: "Day dress", quantity: 1 }, { product: "Cushion cover", quantity: 4 }] },
  ],
};

const CERAMICIST: DemoContent = {
  businessName: "Earth & Fire Ceramics",
  ownerName: "Lerato Mahlangu",
  phone: "082 555 0401",
  email: "studio@earthandfire.example",
  addressLine1: "14 Pottery Lane",
  city: "Durban",
  region: "KwaZulu-Natal",
  postalCode: "4001",
  businessTypes: ["craft"],
  labourRateCents: R(200),
  targetMarginBp: 5000,
  logo: { initials: "EF", background: "#c9733a", foreground: "#fff8f0" },
  materials: [
    { key: "clay", name: "Stoneware clay", unit: "kg", boughtQuantityMilli: 25000, priceCents: R(520), supplier: "Clay Supplies SA" },
    { key: "glaze", name: "Celadon glaze", unit: "l", boughtQuantityMilli: 4000, priceCents: R(880), supplier: "Clay Supplies SA" },
    { key: "gas", name: "Kiln firing", unit: "each", boughtQuantityMilli: 1000, priceCents: R(450) },
    { key: "packaging", name: "Gift packaging", unit: "each", boughtQuantityMilli: 100000, priceCents: R(950) },
  ],
  customers: [
    { name: "The Pottery Cafe", email: "orders@potterycafe.example", phone: "082 555 0411", addressLine1: "101 Florida Road", city: "Durban", region: "KwaZulu-Natal", postalCode: "4001", notes: "Repeat order every quarter." },
    { name: "Ayesha Patel", email: "ayesha@example.test", phone: "082 555 0412", addressLine1: "33 Musgrave Road", city: "Durban", region: "KwaZulu-Natal", postalCode: "4001" },
    { name: "Nomsa Zulu", email: "nomsa@example.test", phone: "082 555 0413", addressLine1: "8 Hillcrest Close", city: "Hillcrest", region: "KwaZulu-Natal", postalCode: "3610" },
    { name: "Coastal Weddings", email: "hello@coastalweddings.example", phone: "082 555 0414", addressLine1: "2 Marine Parade", city: "Umhlanga", region: "KwaZulu-Natal", postalCode: "4319" },
  ],
  products: [
    {
      name: "Dinner set",
      kind: "product",
      description: "Hand-thrown stoneware, glazed and fired. Plate, bowl and mug per setting.",
      priceCents: R(1400),
      unit: "setting",
      variationLabel: "Glaze",
      variations: [
        { name: "Celadon", priceCents: R(1400), usual: true },
        { name: "Speckled white", priceCents: R(1400) },
        { name: "Deep blue", priceCents: R(1600) },
      ],
      extras: [
        { name: "Monogram", priceCents: R(60) },
        { name: "Gift packaging", priceCents: R(95) },
      ],
      costs: {
        makesMilli: 1000,
        lines: [
          { kind: "material", material: "clay", amountMilli: 1800, unit: "kg" },
          { kind: "material", material: "glaze", amountMilli: 150, unit: "l" },
          { kind: "material", material: "gas", amountMilli: 250, unit: "each" },
          { kind: "time", minutes: 180 },
        ],
      },
    },
    {
      name: "Vase",
      kind: "product",
      description: "A tall hand-thrown vase.",
      priceCents: R(520),
      costs: {
        makesMilli: 1000,
        lines: [
          { kind: "material", material: "clay", amountMilli: 1200, unit: "kg" },
          { kind: "material", material: "glaze", amountMilli: 80, unit: "l" },
          { kind: "time", minutes: 75 },
        ],
      },
    },
    { name: "Mug", kind: "product", description: "Stoneware mug, dishwasher safe.", priceCents: R(185) },
    { name: "Pottery workshop", kind: "service", description: "A two-hour hands-on class for up to six people.", priceCents: R(1800) },
    { name: "Commissioned piece", kind: "service", description: "Designed and made to your brief, charged by the hour.", priceCents: R(240), unit: "hour" },
  ],
  quotes: [
    {
      customer: "The Pottery Cafe",
      status: "accepted",
      title: "Quarterly cafe order",
      daysAgo: 3,
      items: [{ product: "Mug", quantity: 24 }, { product: "Dinner set", variation: "Celadon", extras: ["Gift packaging"], quantity: 6 }],
    },
    { customer: "Ayesha Patel", status: "sent", daysAgo: 1, items: [{ product: "Vase", quantity: 2 }, { product: "Mug", quantity: 4 }] },
    { customer: "Coastal Weddings", status: "draft", daysAgo: 0, items: [{ product: "Vase", quantity: 4 }, { product: "Pottery workshop", quantity: 1 }] },
  ],
};

const CONTENT: Record<DemoKind, DemoContent> = { baker: BAKER, woodworker: WOODWORKER, seamstress: SEAMSTRESS, ceramicist: CERAMICIST };

export const demoContent = (kind: DemoKind): DemoContent => CONTENT[kind];
