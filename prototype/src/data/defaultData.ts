import { BusinessProfile, Product, Customer, Quote, Invoice, CreditNote, Job, AppNotification, ProductGroup, Material } from '../types';

export const DEFAULT_PROFILE: BusinessProfile = {
  name: "Pulp Paperworks",
  tagline: "Handcrafted Bookbinding, Creative Workshops & Independent Publishing",
  logo: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=400",
  phone: "+27 (0) 71 283 8342",
  email: "studio@pulppaperworks.com",
  address: "Studio 3B, Victoria Yards, 16 Viljoen Street, Lorentzville, Johannesburg, 2094",
  bankingDetails: {
    bankName: "First National Bank (FNB)",
    accountNumber: "62849102844",
    branchCode: "250655",
    accountType: "Business Cheque",
  },
  vatNumber: "ZA4710298102",
  isVatRegistered: true,
  vatRate: 15, // Standard 15% South African VAT
};

export const DEFAULT_MATERIALS: Material[] = [
  {
    id: "mat_paper_cream",
    name: "Munken Pure Archival Cream Paper (90gsm)",
    category: "Paper & Board",
    unit: "sheet",
    bulkQuantity: 500,
    bulkCost: 450.00,
    notes: "Acid-free smooth book paper, grain long for clean folding signatures",
    stockQuantity: 500,
    lowStockThreshold: 80,
    lowStockWarningEnabled: true,
    supplier: {
      name: "Peters Papers JHB",
      phone: "+27 (0) 11 618 1200",
      address: "Selby, Johannesburg"
    }
  },
  {
    id: "mat_paper_deckle",
    name: "Fabriano 100% Cotton Rag Deckle Paper (200gsm)",
    category: "Paper & Board",
    unit: "sheet",
    bulkQuantity: 100,
    bulkCost: 720.00,
    notes: "Heavyweight textured artist paper for watercolours, ink, and printmaking",
    stockQuantity: 100,
    lowStockThreshold: 15,
    lowStockWarningEnabled: true,
    supplier: {
      name: "Herbert Evans Art Supplies",
      phone: "+27 (0) 11 447 5008",
      address: "Rosebank, Johannesburg"
    }
  },
  {
    id: "mat_paper_cascade",
    name: "Cascade Charcoal Dark Mode Paper (90gsm)",
    category: "Paper & Board",
    unit: "sheet",
    bulkQuantity: 250,
    bulkCost: 295.00,
    notes: "Matte carbon black unlined drawing & journal paper",
    stockQuantity: 250,
    lowStockThreshold: 40,
    lowStockWarningEnabled: true
  },
  {
    id: "mat_greyboard",
    name: "Acid-Free Bookbinder Greyboard (2.5mm)",
    category: "Paper & Board",
    unit: "sheet",
    bulkQuantity: 40,
    bulkCost: 520.00,
    notes: "High-density warp-resistant binder board for hardcovers & solander boxes",
    stockQuantity: 40,
    lowStockThreshold: 8,
    lowStockWarningEnabled: true
  },
  {
    id: "mat_bookcloth",
    name: "European Buckram & Cotton Book Cloth",
    category: "Cover & Binding",
    unit: "m",
    bulkQuantity: 15,
    bulkCost: 1350.00,
    notes: "Paper-backed woven archival bookbinding cloth in assorted natural shades",
    stockQuantity: 15,
    lowStockThreshold: 3,
    lowStockWarningEnabled: true,
    supplier: {
      name: "Winter & Company SA",
      phone: "+27 (0) 11 792 1100"
    }
  },
  {
    id: "mat_leather",
    name: "Vegetable-Tanned Craft Bookbinding Leather",
    category: "Cover & Binding",
    unit: "sheet",
    bulkQuantity: 6,
    bulkCost: 1680.00,
    notes: "Full-grain supple calfskin / bovine leather for heritage spines and full wraps",
    stockQuantity: 6,
    lowStockThreshold: 2,
    lowStockWarningEnabled: true,
    supplier: {
      name: "Woodheads Leather Specialists",
      phone: "+27 (0) 21 461 7210"
    }
  },
  {
    id: "mat_wax_thread",
    name: "Waxed Irish Linen Thread (4-ply)",
    category: "Thread & Stitching",
    unit: "m",
    bulkQuantity: 150,
    bulkCost: 240.00,
    notes: "Traditional archival bookbinding thread for Coptic, French link & stab sewing",
    stockQuantity: 150,
    lowStockThreshold: 25,
    lowStockWarningEnabled: true
  },
  {
    id: "mat_gold_foil",
    name: "Metallic Hot Stamping Foil (Gold & Copper)",
    category: "Finishing & Hardware",
    unit: "m",
    bulkQuantity: 60,
    bulkCost: 380.00,
    notes: "Heat-activated foil roll for brass titling and custom logo debossing",
    stockQuantity: 60,
    lowStockThreshold: 10,
    lowStockWarningEnabled: true
  },
  {
    id: "mat_pva_glue",
    name: "Archival pH-Neutral PVA Bookbinding Adhesive",
    category: "Adhesives & Reinforcements",
    unit: "ml",
    bulkQuantity: 2500,
    bulkCost: 320.00,
    notes: "Reversible water-soluble acid-free glue that does not dry brittle",
    stockQuantity: 2500,
    lowStockThreshold: 400,
    lowStockWarningEnabled: true
  },
  {
    id: "mat_mull_gauze",
    name: "Spine Reinforcement Book Mull (Crash)",
    category: "Adhesives & Reinforcements",
    unit: "m",
    bulkQuantity: 20,
    bulkCost: 190.00,
    notes: "Open-weave starch-filled cotton gauze for durable spine hinges",
    stockQuantity: 20,
    lowStockThreshold: 4,
    lowStockWarningEnabled: true
  },
  {
    id: "mat_ribbon",
    name: "Silk Bookmark Ribbon & Woven Headbands",
    category: "Finishing & Hardware",
    unit: "m",
    bulkQuantity: 50,
    bulkCost: 125.00,
    notes: "6mm double-faced satin ribbon markers and two-tone spine headbands",
    stockQuantity: 50,
    lowStockThreshold: 8,
    lowStockWarningEnabled: true
  },
  {
    id: "mat_brass_screws",
    name: "Solid Brass Binding Screw Posts (25mm)",
    category: "Finishing & Hardware",
    unit: "pcs",
    bulkQuantity: 50,
    bulkCost: 275.00,
    notes: "Precision-machined expandable brass binding Chicago screws for portfolios",
    stockQuantity: 50,
    lowStockThreshold: 10,
    lowStockWarningEnabled: true
  }
];

export const DEFAULT_GROUPS: ProductGroup[] = [
  { id: "pg1", name: "Handmade Books & Journals", description: "Artisan hardcover journals, lay-flat notebooks, and sketchbooks crafted by hand" },
  { id: "pg2", name: "Custom Portfolios & Bespoke Binding", description: "Bespoke presentation folios, leather binding, and archival solander clamshell boxes" },
  { id: "pg3", name: "Pulp Editions & Studio Scrapbooks", description: "Upcycled scrap notebooks, letterpress stationery, and limited edition artist publications" },
  { id: "pg4", name: "Workshops & Masterclasses", description: "Hands-on studio bookbinding workshops hosted at Victoria Yards in Lorentzville" }
];

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "pb1",
    name: "Handcrafted Hardcover Journal (A5 / A4)",
    description: "Hand-sewn textblock cased in archival book cloth or textured book paper. Opens completely flat for effortless writing, sketching, or journaling. 160 numbered pages of 90gsm acid-free cream paper with ribbon bookmark.",
    photo: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600",
    basePrice: 385.00,
    isActive: true,
    stockQuantity: 18,
    groupId: "pg1",
    defaultStages: [
      "Signature Folding & Collation",
      "Hand-Sewing Textblock",
      "Spine Mull & PVA Lining",
      "Cover Board Cutting & Cloth Casing",
      "Casing-In & Nipping Press",
      "Inspection & Ribbon Insert"
    ],
    inputs: [
      {
        id: "inp_j1",
        type: "material",
        name: "Munken Pure Archival Cream Paper (90gsm)",
        materialId: "mat_paper_cream",
        amount: 20,
        unit: "sheet",
        cost: 18.00
      },
      {
        id: "inp_j2",
        type: "material",
        name: "European Buckram & Cotton Book Cloth",
        materialId: "mat_bookcloth",
        amount: 0.35,
        unit: "m",
        cost: 31.50
      },
      {
        id: "inp_j3",
        type: "material",
        name: "Acid-Free Bookbinder Greyboard (2.5mm)",
        materialId: "mat_greyboard",
        amount: 0.5,
        unit: "sheet",
        cost: 6.50
      },
      {
        id: "inp_j4",
        type: "material",
        name: "Waxed Irish Linen Thread (4-ply)",
        materialId: "mat_wax_thread",
        amount: 4,
        unit: "m",
        cost: 6.40
      },
      {
        id: "inp_j5",
        type: "material",
        name: "Archival pH-Neutral PVA Bookbinding Adhesive",
        materialId: "mat_pva_glue",
        amount: 40,
        unit: "ml",
        cost: 5.12
      },
      {
        id: "inp_j6",
        type: "material",
        name: "Silk Bookmark Ribbon & Woven Headbands",
        materialId: "mat_ribbon",
        amount: 0.35,
        unit: "m",
        cost: 0.88
      },
      {
        id: "inp_j7",
        type: "labour",
        name: "Hand Folding, Sewing & Casing Labour",
        amount: 35,
        unit: "mins",
        hourlyRate: 140,
        cost: 81.67
      }
    ],
    customizationOptions: [
      {
        name: "Size",
        isRequired: true,
        type: "variation",
        values: [
          { value: "A5 Classic (148 x 210 mm)", priceUplift: 0 },
          { value: "A4 Large Desk (210 x 297 mm)", priceUplift: 120 },
          { value: "A6 Pocket (105 x 148 mm)", priceUplift: -65 }
        ]
      },
      {
        name: "Cover Material & Colour",
        isRequired: true,
        type: "variation",
        values: [
          { value: "Natural Oatmeal Linen", priceUplift: 0 },
          { value: "Heritage Forest Green Buckram", priceUplift: 0 },
          { value: "Ochre Terracotta Cloth", priceUplift: 25 },
          { value: "Midnight Navy Bookcloth", priceUplift: 25 },
          { value: "Hand-Marbled Turkish Ebru Paper Cover", priceUplift: 65 }
        ]
      },
      {
        name: "Page Ruling",
        isRequired: true,
        type: "variation",
        values: [
          { value: "Plain Unlined Cream (90gsm)", priceUplift: 0 },
          { value: "Subtle 5mm Dot Grid", priceUplift: 0 },
          { value: "Feint Ruled Lines", priceUplift: 0 }
        ]
      },
      {
        name: "Cover Personalisation",
        isRequired: false,
        type: "extra",
        values: [
          { value: "Blind Debossed Initials (Max 3 Letters)", priceUplift: 45 },
          { value: "Metallic Gold Foil Title / Name", priceUplift: 85 },
          { value: "Brushed Copper Foil Title", priceUplift: 85 }
        ]
      }
    ],
    priceBreaks: [
      { minQty: 1, maxQty: 9, unitPrice: 385 },
      { minQty: 10, maxQty: 24, unitPrice: 340 },
      { minQty: 25, maxQty: 99, unitPrice: 295 },
      { minQty: 100, maxQty: undefined, unitPrice: 260 }
    ]
  },
  {
    id: "pb2",
    name: "Japanese Stab-Bound Artist Sketchbook",
    description: "Exposed spine hand-stitched using traditional Asian stab binding techniques. Filled with heavyweight Fabriano 200gsm cotton rag paper, perfect for ink, gouache, watercolours, and printmaking.",
    photo: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600",
    basePrice: 320.00,
    isActive: true,
    stockQuantity: 12,
    groupId: "pg1",
    defaultStages: [
      "Paper Guillotine Cutting & Punching",
      "Corner Wrapping & Fabric Hinges",
      "Decorative Stitch Weaving",
      "Edge Sanding & Final Inspection"
    ],
    inputs: [
      {
        id: "inp_s1",
        type: "material",
        name: "Fabriano 100% Cotton Rag Deckle Paper (200gsm)",
        materialId: "mat_paper_deckle",
        amount: 8,
        unit: "sheet",
        cost: 57.60
      },
      {
        id: "inp_s2",
        type: "material",
        name: "Acid-Free Bookbinder Greyboard (2.5mm)",
        materialId: "mat_greyboard",
        amount: 0.3,
        unit: "sheet",
        cost: 3.90
      },
      {
        id: "inp_s3",
        type: "material",
        name: "Waxed Irish Linen Thread (4-ply)",
        materialId: "mat_wax_thread",
        amount: 3.5,
        unit: "m",
        cost: 5.60
      },
      {
        id: "inp_s4",
        type: "labour",
        name: "Precision Hole Punching & Stitching",
        amount: 25,
        unit: "mins",
        hourlyRate: 140,
        cost: 58.33
      }
    ],
    customizationOptions: [
      {
        name: "Stitch Pattern",
        isRequired: true,
        type: "variation",
        values: [
          { value: "Traditional 4-Hole (Yotsume Toji)", priceUplift: 0 },
          { value: "Noble Binding (Kangxi)", priceUplift: 30 },
          { value: "Tortoise Shell Pattern (Kikko Toji)", priceUplift: 45 },
          { value: "Hemp Leaf Pattern (Asa-no-ha Toji)", priceUplift: 45 }
        ]
      },
      {
        name: "Paper Stock",
        isRequired: true,
        type: "variation",
        values: [
          { value: "200gsm Fabriano Textured Cream Art Paper", priceUplift: 0 },
          { value: "90gsm Cascade Charcoal Dark Mode Paper", priceUplift: 20 },
          { value: "Mixed Alternating Cream & Black Pages", priceUplift: 30 }
        ]
      },
      {
        name: "Corner Protection",
        isRequired: false,
        type: "extra",
        values: [
          { value: "Solid Brass Metal Book Corners (4 pcs)", priceUplift: 35 },
          { value: "Handmade Silk Corner Wraps", priceUplift: 45 }
        ]
      }
    ],
    priceBreaks: [
      { minQty: 1, maxQty: 9, unitPrice: 320 },
      { minQty: 10, maxQty: 29, unitPrice: 285 },
      { minQty: 30, maxQty: undefined, unitPrice: 250 }
    ]
  },
  {
    id: "pb3",
    name: "Bespoke Full Leather Presentation Portfolio",
    description: "Handcrafted from rich South African vegetable-tanned bovine leather with brass screw post binding or exposed hand-sewn leather spine. Built for fine artists, architects, and executive memory books.",
    photo: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=600",
    basePrice: 1450.00,
    isActive: true,
    stockQuantity: 4,
    groupId: "pg2",
    defaultStages: [
      "Leather Skiving & Edge Beveling",
      "Board Mounting & Turn-Ins",
      "Spine Reinforcement & Punching",
      "Custom Foil Titling / Debossing",
      "Brass Hardware Assembly & Testing"
    ],
    inputs: [
      {
        id: "inp_l1",
        type: "material",
        name: "Vegetable-Tanned Craft Bookbinding Leather",
        materialId: "mat_leather",
        amount: 1,
        unit: "sheet",
        cost: 280.00
      },
      {
        id: "inp_l2",
        type: "material",
        name: "Acid-Free Bookbinder Greyboard (2.5mm)",
        materialId: "mat_greyboard",
        amount: 1,
        unit: "sheet",
        cost: 13.00
      },
      {
        id: "inp_l3",
        type: "material",
        name: "Solid Brass Binding Screw Posts (25mm)",
        materialId: "mat_brass_screws",
        amount: 4,
        unit: "pcs",
        cost: 22.00
      },
      {
        id: "inp_l4",
        type: "material",
        name: "Metallic Hot Stamping Foil (Gold & Copper)",
        materialId: "mat_gold_foil",
        amount: 1,
        unit: "m",
        cost: 6.33
      },
      {
        id: "inp_l5",
        type: "labour",
        name: "Master Bookbinder Leather Crafting",
        amount: 90,
        unit: "mins",
        hourlyRate: 160,
        cost: 240.00
      }
    ],
    customizationOptions: [
      {
        name: "Leather Shade",
        isRequired: true,
        type: "variation",
        values: [
          { value: "Saddle Tan Natural Pull-Up", priceUplift: 0 },
          { value: "Heritage Espresso Dark Brown", priceUplift: 0 },
          { value: "Onyx Black Full Grain", priceUplift: 50 }
        ]
      },
      {
        name: "Binding Style",
        isRequired: true,
        type: "variation",
        values: [
          { value: "Screw Post Binding (Expandable Sheets)", priceUplift: 0 },
          { value: "Exposed French Link Hand Stitching", priceUplift: 150 },
          { value: "Classical Rounded & Backed Tight Back", priceUplift: 280 }
        ]
      },
      {
        name: "Front Cover Custom Titling",
        isRequired: false,
        type: "extra",
        values: [
          { value: "Custom Name / Studio Logo Foil Deboss", priceUplift: 120 },
          { value: "Engraved Solid Brass Nameplate", priceUplift: 180 }
        ]
      }
    ],
    priceBreaks: [
      { minQty: 1, maxQty: 4, unitPrice: 1450 },
      { minQty: 5, maxQty: 19, unitPrice: 1280 },
      { minQty: 20, maxQty: undefined, unitPrice: 1150 }
    ]
  },
  {
    id: "pb4",
    name: "Studio Scraps Upcycled Mini-Notebooks (Pack of 3)",
    description: "Zero-waste pocket notebooks crafted 100% from studio paper offcuts, letterpress test sheets, and archival ends. Each set is unique, machine-stitch bound with heavy cotton thread.",
    photo: "https://images.unsplash.com/photo-1588702547919-26089e690ecc?auto=format&fit=crop&q=80&w=600",
    basePrice: 120.00,
    isActive: true,
    stockQuantity: 35,
    groupId: "pg3",
    defaultStages: [
      "Scrap Paper Collation & Trimming",
      "Cover Card Scoring",
      "Centre-Saddle Machine Stitching",
      "Guillotine Edge Flush Trim & Packaging"
    ],
    inputs: [
      {
        id: "inp_sc1",
        type: "material",
        name: "Munken Pure Archival Cream Paper (90gsm)",
        materialId: "mat_paper_cream",
        amount: 6,
        unit: "sheet",
        cost: 5.40
      },
      {
        id: "inp_sc2",
        type: "material",
        name: "Waxed Irish Linen Thread (4-ply)",
        materialId: "mat_wax_thread",
        amount: 1,
        unit: "m",
        cost: 1.60
      },
      {
        id: "inp_sc3",
        type: "labour",
        name: "Scrap Assembly & Machine Stitching",
        amount: 10,
        unit: "mins",
        hourlyRate: 120,
        cost: 20.00
      }
    ],
    customizationOptions: [
      {
        name: "Paper Selection",
        isRequired: true,
        type: "variation",
        values: [
          { value: "Mixed Studio Scraps Sampler (Cream, Kraft, Grid)", priceUplift: 0 },
          { value: "All Plain Cream Archival Pages", priceUplift: 0 },
          { value: "Dark Mode Cascade Charcoal Scraps", priceUplift: 15 }
        ]
      },
      {
        name: "Packaging & Sleeve",
        isRequired: false,
        type: "extra",
        values: [
          { value: "Recycled Kraft Gift Sleeve with Twine Tie", priceUplift: 15 }
        ]
      }
    ],
    priceBreaks: [
      { minQty: 1, maxQty: 4, unitPrice: 120 },
      { minQty: 5, maxQty: 19, unitPrice: 100 },
      { minQty: 20, maxQty: undefined, unitPrice: 85 }
    ]
  },
  {
    id: "pb5",
    name: "Archival Clamshell Solander Presentation Box",
    description: "Custom-built double-tray clamshell preservation box crafted to protect rare editions, artist prints, manuscripts, or treasured albums from light, dust, and handling damage.",
    photo: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&q=80&w=600",
    basePrice: 850.00,
    isActive: true,
    stockQuantity: 6,
    groupId: "pg2",
    defaultStages: [
      "Internal Tray Precision Board Cutting",
      "Tray Assembly & PVA Gluing",
      "Outer Case Wrapping in Book Cloth",
      "Tray Casing & Alignment",
      "Ribbon Pull & Magnetic Clasp Mounting"
    ],
    inputs: [
      {
        id: "inp_c1",
        type: "material",
        name: "Acid-Free Bookbinder Greyboard (2.5mm)",
        materialId: "mat_greyboard",
        amount: 1.5,
        unit: "sheet",
        cost: 19.50
      },
      {
        id: "inp_c2",
        type: "material",
        name: "European Buckram & Cotton Book Cloth",
        materialId: "mat_bookcloth",
        amount: 0.8,
        unit: "m",
        cost: 72.00
      },
      {
        id: "inp_c3",
        type: "material",
        name: "Archival pH-Neutral PVA Bookbinding Adhesive",
        materialId: "mat_pva_glue",
        amount: 80,
        unit: "ml",
        cost: 10.24
      },
      {
        id: "inp_c4",
        type: "material",
        name: "Silk Bookmark Ribbon & Woven Headbands",
        materialId: "mat_ribbon",
        amount: 0.5,
        unit: "m",
        cost: 1.25
      },
      {
        id: "inp_c5",
        type: "labour",
        name: "Box Making & Precision Covering",
        amount: 60,
        unit: "mins",
        hourlyRate: 150,
        cost: 150.00
      }
    ],
    customizationOptions: [
      {
        name: "Internal Box Dimensions",
        isRequired: true,
        type: "variation",
        values: [
          { value: "A4 Size (Fits up to 220 x 310 x 45 mm)", priceUplift: 0 },
          { value: "A3 Portfolio Size (Fits up to 310 x 430 x 50 mm)", priceUplift: 350 },
          { value: "A5 Compact Size (Fits up to 160 x 225 x 35 mm)", priceUplift: -120 }
        ]
      },
      {
        name: "Cloth Colour Combination",
        isRequired: true,
        type: "variation",
        values: [
          { value: "Charcoal Grey Outer / Linen Inner", priceUplift: 0 },
          { value: "Imperial Navy Buckram / Cream Inner", priceUplift: 0 },
          { value: "Olive Green Cloth / Mustard Yellow Lining", priceUplift: 40 }
        ]
      },
      {
        name: "Titling & Closure",
        isRequired: false,
        type: "extra",
        values: [
          { value: "Spine & Front Foil Debossing", priceUplift: 95 },
          { value: "Hidden Magnetic Flap Closure", priceUplift: 60 }
        ]
      }
    ],
    priceBreaks: [
      { minQty: 1, maxQty: 4, unitPrice: 850 },
      { minQty: 5, maxQty: 14, unitPrice: 750 },
      { minQty: 15, maxQty: undefined, unitPrice: 680 }
    ]
  }
];

export const DEFAULT_SERVICES: Product[] = [
  {
    id: "ps1",
    name: "Bookbinding Workshop Pass (Victoria Yards Studio)",
    description: "Full-day hands-on masterclass hosted in our Victoria Yards studio in Johannesburg. Learn paper selection, folding, signature stitching, and book casing. All archival materials and your finished handmade book are included.",
    photo: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=600",
    basePrice: 750.00,
    isActive: true,
    customizationOptions: [
      {
        name: "Workshop Topic",
        isRequired: true,
        type: "variation",
        values: [
          { value: "Japanese Stab Binding Masterclass (Beginner Friendly)", priceUplift: 0 },
          { value: "Hardcover Case Binding & Coptic Stitching", priceUplift: 100 },
          { value: "Antique Book Repair & Rebinding Masterclass", priceUplift: 150 },
          { value: "Zines, Monoprints & Alt-Publishing Workshop", priceUplift: 50 }
        ]
      },
      {
        name: "Booking Type",
        isRequired: true,
        type: "variation",
        values: [
          { value: "Individual Seat Pass", priceUplift: 0 },
          { value: "Duo / Friends Pass (2 Seats)", priceUplift: 650 },
          { value: "Private Studio Group Session (Up to 6 Persons)", priceUplift: 3200 }
        ]
      }
    ],
    priceBreaks: [
      { minQty: 1, maxQty: undefined, unitPrice: 750 }
    ]
  },
  {
    id: "ps2",
    name: "Antique Book Rebinding & Spine Restoration",
    description: "Specialist artisan restoration of family bibles, vintage collector volumes, broken hinges, split leather corners, and loose page signatures.",
    photo: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=600",
    basePrice: 650.00,
    isActive: true,
    customizationOptions: [
      {
        name: "Restoration Level",
        isRequired: true,
        type: "variation",
        values: [
          { value: "Spine Reback & Hinge Tightening (Cloth)", priceUplift: 0 },
          { value: "Full Heritage Leather Rebind with Raised Ribs", priceUplift: 850 },
          { value: "Paper Deacidification & Tear Repair (Per Volume)", priceUplift: 350 }
        ]
      }
    ],
    priceBreaks: [
      { minQty: 1, maxQty: undefined, unitPrice: 650 }
    ]
  },
  {
    id: "ps3",
    name: "Custom Hot Foil Cover Stamping & Titling",
    description: "Metallic hot stamping using individual brass typefaces or custom precision CNC engraved logo dies for books, menus, and folders.",
    photo: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=600",
    basePrice: 180.00,
    isActive: true,
    customizationOptions: [
      {
        name: "Foil Foil Finish",
        isRequired: true,
        type: "variation",
        values: [
          { value: "Gilt Bright Gold", priceUplift: 0 },
          { value: "Brushed Antique Copper", priceUplift: 0 },
          { value: "Matte Satin Silver", priceUplift: 0 },
          { value: "Blind Deboss (No Foil)", priceUplift: 0 }
        ]
      }
    ],
    priceBreaks: [
      { minQty: 1, maxQty: undefined, unitPrice: 180 }
    ]
  },
  {
    id: "ps4",
    name: "Short-Run Edition Binding & Publishing Support",
    description: "Artisan binding, collation, and assembly service for limited-edition artist books, poetry chapbooks, exhibition catalogues, and zines.",
    photo: "https://images.unsplash.com/photo-1541462608141-2f682d68c94a?auto=format&fit=crop&q=80&w=600",
    basePrice: 950.00,
    isActive: true,
    customizationOptions: [
      {
        name: "Batch Scope",
        isRequired: true,
        type: "variation",
        values: [
          { value: "Setup & Proof Run (1-10 copies)", priceUplift: 0 },
          { value: "Standard Edition Run (25-50 copies)", priceUplift: 800 },
          { value: "Deluxe Collector Edition (Numbered & Boxed)", priceUplift: 1500 }
        ]
      }
    ],
    priceBreaks: [
      { minQty: 1, maxQty: undefined, unitPrice: 950 }
    ]
  }
];

export const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: "c1",
    name: "Joburg Contemporary Art Foundation (JCAF)",
    phone: "+27 (0) 11 268 0869",
    email: "curatorial@jcaf.org.za",
    isBusiness: true,
    contactPerson: "Lindiwe Khumalo (Head Curator)",
    vatNumber: "ZA4910283711",
    companyRegistrationNumber: "2018/392019/08",
    address: "1 Forest Road, Forest Town, Johannesburg, 2193",
    billingAddress: "1 Forest Road, Forest Town, Johannesburg, 2193",
    shippingAddress: "1 Forest Road, Forest Town, Johannesburg, 2193",
    useSameAddress: true,
    notes: "Exhibition catalogues and archival clamshell solander presentation boxes for visiting international artists"
  },
  {
    id: "c2",
    name: "David Krut Projects & Bookshop",
    phone: "+27 (0) 11 447 0627",
    email: "books@davidkrut.com",
    isBusiness: true,
    contactPerson: "Mark Attwood",
    vatNumber: "ZA4290184491",
    companyRegistrationNumber: "2001/014920/07",
    address: "142 Jan Smuts Avenue, Parkwood, Johannesburg, 2193",
    billingAddress: "142 Jan Smuts Avenue, Parkwood, Johannesburg, 2193",
    shippingAddress: "David Krut Arts Resource, 151 Jan Smuts Ave, Parkwood, Johannesburg, 2193",
    useSameAddress: false,
    notes: "Consignment stockist for Pulp Editions, Studio Scraps, and bespoke Japanese stab-bound sketchbooks"
  },
  {
    id: "c3",
    name: "Dr. Willem van Rensburg",
    phone: "+27 (0) 82 491 3320",
    email: "willem.vanrensburg@wits.ac.za",
    isBusiness: false,
    address: "45 4th Avenue, Melville, Johannesburg, 2092",
    billingAddress: "45 4th Avenue, Melville, Johannesburg, 2092",
    shippingAddress: "45 4th Avenue, Melville, Johannesburg, 2092",
    useSameAddress: true,
    notes: "Commissioned 19th-century Dutch Bible full leather restoration and custom heritage guestbook"
  },
  {
    id: "c4",
    name: "Victoria Yards Community Art Programme",
    phone: "+27 (0) 72 894 1022",
    email: "workshops@victoriayards.co.za",
    isBusiness: true,
    contactPerson: "Hector Mgiba",
    address: "Victoria Yards, 16 Viljoen Street, Lorentzville, Johannesburg, 2094",
    billingAddress: "Victoria Yards, 16 Viljoen Street, Lorentzville, Johannesburg, 2094",
    shippingAddress: "Victoria Yards, 16 Viljoen Street, Lorentzville, Johannesburg, 2094",
    useSameAddress: true,
    notes: "Monthly weekend youth bookbinding workshop passes and scrap journal materials"
  }
];

export const DEFAULT_QUOTES: Quote[] = [
  {
    id: "q1",
    quoteNumber: "QT-2026-001",
    customerId: "c1",
    customerName: "Joburg Contemporary Art Foundation (JCAF)",
    customerEmail: "curatorial@jcaf.org.za",
    customerPhone: "+27 (0) 11 268 0869",
    customerAddress: "1 Forest Road, Forest Town, Johannesburg, 2193",
    customerIsBusiness: true,
    customerContactPerson: "Lindiwe Khumalo (Head Curator)",
    customerVatNumber: "ZA4910283711",
    customerCompanyRegNumber: "2018/392019/08",
    customerBillingAddress: "1 Forest Road, Forest Town, Johannesburg, 2193",
    customerShippingAddress: "1 Forest Road, Forest Town, Johannesburg, 2193",
    date: "2026-07-08",
    expiryDate: "2026-08-08",
    items: [
      {
        id: "qi1",
        productId: "pb1",
        productName: "Handcrafted Hardcover Journal (A5 / A4)",
        productPhoto: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=400",
        productDescription: "Hand-sewn textblock in Imperial Navy Buckram with blind debossed exhibition title.",
        quantity: 25,
        baseUnitPrice: 385,
        appliedUnitPrice: 295, // Tier rate for 25+ units
        selectedCustomizations: {
          "Size": { value: "A5 Classic (148 x 210 mm)", priceUplift: 0 },
          "Cover Material & Colour": { value: "Midnight Navy Bookcloth", priceUplift: 25 },
          "Page Ruling": { value: "Plain Unlined Cream (90gsm)", priceUplift: 0 },
          "Cover Personalisation": { value: "Metallic Gold Foil Title / Name", priceUplift: 85 }
        },
        total: 10125 // (295 + 25 + 85) * 25 = 405 * 25 = 10125
      },
      {
        id: "qi2",
        productId: "pb5",
        productName: "Archival Clamshell Solander Presentation Box",
        productPhoto: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&q=80&w=400",
        productDescription: "Custom A4 Solander clamshell box lined in acid-free paper for VIP artist archive.",
        quantity: 5,
        baseUnitPrice: 850,
        appliedUnitPrice: 750, // Tier rate for 5+ units
        selectedCustomizations: {
          "Internal Box Dimensions": { value: "A4 Size (Fits up to 220 x 310 x 45 mm)", priceUplift: 0 },
          "Cloth Colour Combination": { value: "Charcoal Grey Outer / Linen Inner", priceUplift: 0 },
          "Titling & Closure": { value: "Spine & Front Foil Debossing", priceUplift: 95 }
        },
        total: 4225 // (750 + 95) * 5 = 845 * 5 = 4225
      }
    ],
    discount: { type: "percentage", value: 5 }, // 5% Art institution partnership discount
    hasDiscount: true,
    notes: "Handcrafted at Victoria Yards, Johannesburg. Includes individual archival wrapping and delivery to Forest Town gallery.",
    status: "accepted",
    templateId: "artisan-warm",
    totalAmount: 13632.50, // (10125 + 4225) = 14350 - 5% = 13632.50
    fulfillmentType: "delivery",
    fulfillmentLabel: "Johannesburg Studio Courier Delivery",
    fulfillmentPrice: 0
  },
  {
    id: "q2",
    quoteNumber: "QT-2026-002",
    customerId: "c2",
    customerName: "David Krut Projects & Bookshop",
    customerEmail: "books@davidkrut.com",
    customerPhone: "+27 (0) 11 447 0627",
    customerAddress: "142 Jan Smuts Avenue, Parkwood, Johannesburg, 2193",
    customerIsBusiness: true,
    customerContactPerson: "Mark Attwood",
    customerVatNumber: "ZA4290184491",
    customerCompanyRegNumber: "2001/014920/07",
    customerBillingAddress: "142 Jan Smuts Avenue, Parkwood, Johannesburg, 2193",
    customerShippingAddress: "David Krut Arts Resource, 151 Jan Smuts Ave, Parkwood, Johannesburg, 2193",
    date: "2026-07-12",
    expiryDate: "2026-08-12",
    items: [
      {
        id: "qi3",
        productId: "pb2",
        productName: "Japanese Stab-Bound Artist Sketchbook",
        productPhoto: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=400",
        productDescription: "Traditional Tortoise Shell exposed stitch with Fabriano 200gsm cotton rag pages.",
        quantity: 15,
        baseUnitPrice: 320,
        appliedUnitPrice: 285,
        selectedCustomizations: {
          "Stitch Pattern": { value: "Tortoise Shell Pattern (Kikko Toji)", priceUplift: 45 },
          "Paper Stock": { value: "200gsm Fabriano Textured Cream Art Paper", priceUplift: 0 },
          "Corner Protection": { value: "Solid Brass Metal Book Corners (4 pcs)", priceUplift: 35 }
        },
        total: 5475 // (285 + 45 + 35) * 15 = 365 * 15 = 5475
      },
      {
        id: "qi4",
        productId: "pb4",
        productName: "Studio Scraps Upcycled Mini-Notebooks (Pack of 3)",
        productPhoto: "https://images.unsplash.com/photo-1588702547919-26089e690ecc?auto=format&fit=crop&q=80&w=400",
        productDescription: "Upcycled studio offcuts notebooks in recycled kraft sleeve.",
        quantity: 20,
        baseUnitPrice: 120,
        appliedUnitPrice: 85,
        selectedCustomizations: {
          "Paper Selection": { value: "Mixed Studio Scraps Sampler (Cream, Kraft, Grid)", priceUplift: 0 },
          "Packaging & Sleeve": { value: "Recycled Kraft Gift Sleeve with Twine Tie", priceUplift: 15 }
        },
        total: 2000 // (85 + 15) * 20 = 100 * 20 = 2000
      }
    ],
    discount: { type: "percentage", value: 0 },
    hasDiscount: false,
    notes: "Wholesale bookstore consignment order. Ready for collection from Victoria Yards.",
    status: "sent",
    templateId: "minimalist",
    totalAmount: 7475,
    fulfillmentType: "collection",
    fulfillmentLabel: "Collection from Studio (Victoria Yards)",
    fulfillmentPrice: 0
  },
  {
    id: "q3",
    quoteNumber: "QT-2026-003",
    customerId: "c3",
    customerName: "Dr. Willem van Rensburg",
    customerEmail: "willem.vanrensburg@wits.ac.za",
    customerPhone: "+27 (0) 82 491 3320",
    customerAddress: "45 4th Avenue, Melville, Johannesburg, 2092",
    customerIsBusiness: false,
    date: "2026-07-16",
    expiryDate: "2026-08-16",
    items: [
      {
        id: "qi5",
        productId: "ps2",
        productName: "Antique Book Rebinding & Spine Restoration",
        productPhoto: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=400",
        productDescription: "Full heritage leather restoration of 1884 family bible with five raised spine ribs and blind tooling.",
        quantity: 1,
        baseUnitPrice: 650,
        appliedUnitPrice: 650,
        selectedCustomizations: {
          "Restoration Level": { value: "Full Heritage Leather Rebind with Raised Ribs", priceUplift: 850 }
        },
        total: 1500
      },
      {
        id: "qi6",
        productId: "pb3",
        productName: "Bespoke Full Leather Presentation Portfolio",
        productPhoto: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=400",
        productDescription: "Heritage Espresso brown leather guestbook with custom monogram debossing.",
        quantity: 1,
        baseUnitPrice: 1450,
        appliedUnitPrice: 1450,
        selectedCustomizations: {
          "Leather Shade": { value: "Heritage Espresso Dark Brown", priceUplift: 0 },
          "Binding Style": { value: "Classical Rounded & Backed Tight Back", priceUplift: 280 },
          "Front Cover Custom Titling": { value: "Custom Name / Studio Logo Foil Deboss", priceUplift: 120 }
        },
        total: 1850
      }
    ],
    discount: { type: "fixed", value: 150 },
    hasDiscount: true,
    notes: "Estimated restoration lead time: 3-4 weeks to allow proper leather curing and paper drying in the book press.",
    status: "viewed",
    templateId: "royal-classic",
    totalAmount: 3200 // (1500 + 1850) - 150 = 3200
  }
];

export const DEFAULT_INVOICES: Invoice[] = [
  {
    id: "i1",
    invoiceNumber: "INV-2026-001",
    quoteId: "q1",
    customerId: "c1",
    customerName: "Joburg Contemporary Art Foundation (JCAF)",
    customerEmail: "curatorial@jcaf.org.za",
    customerPhone: "+27 (0) 11 268 0869",
    customerAddress: "1 Forest Road, Forest Town, Johannesburg, 2193",
    customerIsBusiness: true,
    customerContactPerson: "Lindiwe Khumalo (Head Curator)",
    customerVatNumber: "ZA4910283711",
    customerCompanyRegNumber: "2018/392019/08",
    customerBillingAddress: "1 Forest Road, Forest Town, Johannesburg, 2193",
    customerShippingAddress: "1 Forest Road, Forest Town, Johannesburg, 2193",
    date: "2026-07-09",
    dueDate: "2026-08-09",
    items: [
      {
        id: "ii1",
        productId: "pb1",
        productName: "Handcrafted Hardcover Journal (A5 / A4)",
        productPhoto: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=400",
        productDescription: "Hand-sewn textblock in Imperial Navy Buckram with blind debossed exhibition title.",
        quantity: 25,
        appliedUnitPrice: 295,
        selectedCustomizations: {
          "Size": { value: "A5 Classic (148 x 210 mm)", priceUplift: 0 },
          "Cover Material & Colour": { value: "Midnight Navy Bookcloth", priceUplift: 25 },
          "Page Ruling": { value: "Plain Unlined Cream (90gsm)", priceUplift: 0 },
          "Cover Personalisation": { value: "Metallic Gold Foil Title / Name", priceUplift: 85 }
        },
        total: 10125
      },
      {
        id: "ii2",
        productId: "pb5",
        productName: "Archival Clamshell Solander Presentation Box",
        productPhoto: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&q=80&w=400",
        productDescription: "Custom A4 Solander clamshell box lined in acid-free paper for VIP artist archive.",
        quantity: 5,
        appliedUnitPrice: 750,
        selectedCustomizations: {
          "Internal Box Dimensions": { value: "A4 Size (Fits up to 220 x 310 x 45 mm)", priceUplift: 0 },
          "Cloth Colour Combination": { value: "Charcoal Grey Outer / Linen Inner", priceUplift: 0 },
          "Titling & Closure": { value: "Spine & Front Foil Debossing", priceUplift: 95 }
        },
        total: 4225
      }
    ],
    discount: { type: "percentage", value: 5 },
    hasDiscount: true,
    notes: "Tax Invoice converted from accepted Quote QT-2026-001. Direct FNB Electronic Funds Transfer details below. Payment terms: 30 days.",
    status: "unpaid",
    templateId: "artisan-warm",
    totalAmount: 13632.50,
    subtotal: 11854.35, // 13632.50 / 1.15
    vatAmount: 1778.15,  // 13632.50 - 11854.35
    hasVat: true,
    creditedAmount: 769.50,
    creditNoteIds: ["cn1"]
  }
];

export const DEFAULT_CREDIT_NOTES: CreditNote[] = [
  {
    id: "cn1",
    creditNoteNumber: "CN-2026-001",
    invoiceId: "i1",
    invoiceNumber: "INV-2026-001",
    invoiceDate: "2026-07-09",
    customerId: "c1",
    customerName: "Joburg Contemporary Art Foundation (JCAF)",
    customerEmail: "curatorial@jcaf.org.za",
    customerPhone: "+27 (0) 11 268 0869",
    customerAddress: "1 Forest Road, Forest Town, Johannesburg, 2193",
    customerIsBusiness: true,
    customerContactPerson: "Lindiwe Khumalo (Head Curator)",
    customerVatNumber: "ZA4910283711",
    customerCompanyRegNumber: "2018/392019/08",
    customerBillingAddress: "1 Forest Road, Forest Town, Johannesburg, 2193",
    customerShippingAddress: "1 Forest Road, Forest Town, Johannesburg, 2193",
    date: "2026-07-15",
    reason: "Goods Returned / Defective",
    notes: "SARS Section 21 Tax Credit Note. Issued for 2 x Handcrafted Hardcover Journals with minor foil debossing flaw identified during curatorial intake. Flawed covers returned to Victoria Yards studio for reprocessing.",
    items: [
      {
        id: "cni1",
        invoiceLineItemId: "ii1",
        productId: "pb1",
        productName: "Handcrafted Hardcover Journal (A5 / A4)",
        productDescription: "Hand-sewn textblock in Imperial Navy Buckram with blind debossed exhibition title. Credited 2 units at agreed partnership rate.",
        quantity: 2,
        unitPrice: 384.75, // 405 minus 5% discount
        total: 769.50,
        restockQuantity: true
      }
    ],
    subtotal: 669.13,
    vatAmount: 100.37,
    totalAmount: 769.50,
    hasVat: true,
    templateId: "artisan-warm",
    status: "issued"
  }
];

export const DEFAULT_JOBS: Job[] = [
  {
    id: "j1",
    jobNumber: "JOB-2026-001",
    quoteId: "q1",
    customerId: "c1",
    clientName: "Joburg Contemporary Art Foundation (JCAF)",
    status: "In Progress",
    dateCreated: "2026-07-09",
    fulfillmentType: "delivery",
    items: [
      {
        id: "jt1",
        productId: "pb1",
        title: "Handcrafted Hardcover Journal (A5 / A4)",
        quantity: 25,
        status: "In Production",
        completedCount: 15,
        customizationSummary: "Cover: Midnight Navy Bookcloth, Size: A5 Classic, Titling: Gold Foil Exhibition Title",
        selectedCustomizations: {
          "Size": { value: "A5 Classic (148 x 210 mm)", priceUplift: 0 },
          "Cover Material & Colour": { value: "Midnight Navy Bookcloth", priceUplift: 25 },
          "Cover Personalisation": { value: "Metallic Gold Foil Title / Name", priceUplift: 85 }
        }
      },
      {
        id: "jt2",
        productId: "pb5",
        title: "Archival Clamshell Solander Presentation Box",
        quantity: 5,
        status: "Done",
        completedCount: 5,
        customizationSummary: "Size: A4, Cloth: Charcoal Grey Outer / Linen Inner, Titling: Gold Foil Spine & Front",
        selectedCustomizations: {
          "Internal Box Dimensions": { value: "A4 Size (Fits up to 220 x 310 x 45 mm)", priceUplift: 0 },
          "Cloth Colour Combination": { value: "Charcoal Grey Outer / Linen Inner", priceUplift: 0 },
          "Titling & Closure": { value: "Spine & Front Foil Debossing", priceUplift: 95 }
        }
      }
    ]
  },
  {
    id: "j2",
    jobNumber: "JOB-2026-002",
    quoteId: "q2",
    customerId: "c2",
    clientName: "David Krut Projects & Bookshop",
    status: "Awaiting quote acceptance",
    dateCreated: "2026-07-12",
    fulfillmentType: "collection",
    items: [
      {
        id: "jt3",
        productId: "pb2",
        title: "Japanese Stab-Bound Artist Sketchbook",
        quantity: 15,
        status: "Pending",
        customizationSummary: "Stitch: Tortoise Shell Pattern (Kikko Toji), Paper: 200gsm Fabriano, Corners: Brass Book Corners",
        selectedCustomizations: {
          "Stitch Pattern": { value: "Tortoise Shell Pattern (Kikko Toji)", priceUplift: 45 },
          "Corner Protection": { value: "Solid Brass Metal Book Corners (4 pcs)", priceUplift: 35 }
        }
      }
    ]
  }
];

export const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    message: "Lindiwe Khumalo (JCAF) viewed Quote QT-2026-001",
    timestamp: "2026-07-08T11:20:00Z",
    type: "quote_viewed",
    isRead: true,
    referenceId: "q1"
  },
  {
    id: "n2",
    message: "Lindiwe Khumalo (JCAF) accepted Quote QT-2026-001! Tax Invoice INV-2026-001 & JOB-2026-001 generated.",
    timestamp: "2026-07-09T09:45:00Z",
    type: "quote_accepted",
    isRead: false,
    referenceId: "q1"
  },
  {
    id: "n3",
    message: "David Krut Projects & Bookshop viewed Quote QT-2026-002",
    timestamp: "2026-07-13T14:10:00Z",
    type: "quote_viewed",
    isRead: false,
    referenceId: "q2"
  }
];
