import { CompanyPreset } from '../types';
import { 
  DEFAULT_PROFILE, DEFAULT_PRODUCTS, DEFAULT_CUSTOMERS, 
  DEFAULT_QUOTES, DEFAULT_INVOICES, DEFAULT_CREDIT_NOTES, DEFAULT_JOBS, DEFAULT_NOTIFICATIONS, DEFAULT_GROUPS,
  DEFAULT_SERVICES, DEFAULT_MATERIALS
} from './defaultData';

export const COMPANY_PRESETS: CompanyPreset[] = [
  {
    id: 'pulp-paperworks',
    name: 'Pulp Paperworks',
    tagline: 'Handcrafted Bookbinding, Creative Workshops & Independent Publishing',
    category: 'Bookbinding & Paper Arts',
    icon: '📚',
    websiteUrl: 'https://pulppaperworks.com/bookbinding-services-johannesburg/',
    profile: DEFAULT_PROFILE,
    groups: DEFAULT_GROUPS,
    materials: DEFAULT_MATERIALS,
    products: DEFAULT_PRODUCTS,
    services: DEFAULT_SERVICES,
    customers: DEFAULT_CUSTOMERS,
    quotes: DEFAULT_QUOTES,
    invoices: DEFAULT_INVOICES,
    creditNotes: DEFAULT_CREDIT_NOTES,
    jobs: DEFAULT_JOBS,
    notifications: DEFAULT_NOTIFICATIONS
  },
  {
    id: 'lollipop-league',
    name: 'The Lollipop League',
    tagline: 'Handcrafted Gourmet Lollipops & Event Favours',
    category: 'Artisanal Confectionery',
    icon: '🍭',
    websiteUrl: 'https://www.thelollipopleague.co.za/',
    profile: {
      name: 'The Lollipop League',
      logo: 'https://images.unsplash.com/photo-1575224300306-1b8da36134ec?auto=format&fit=crop&q=80&w=300',
      phone: '+27 (0) 21 824 1050',
      email: 'hello@thelollipopleague.co.za',
      address: 'Studio 12, The Salt River Sheds, 11 Crane Passage, Salt River, Cape Town, 7925',
      bankingDetails: {
        bankName: 'First National Bank (FNB)',
        accountNumber: '62910488219',
        branchCode: '250655',
        accountType: 'Business Cheque',
      },
      vatNumber: 'ZA4820193811',
      isVatRegistered: true,
      vatRate: 15,
    },
    groups: [
      { id: 'lg1', name: 'Speciality Lollipops', description: 'Our full range of artisan flavours — floral, fruit, spice, and cocktail-inspired' },
      { id: 'lg2', name: 'Picture / Logo Lollipops', description: 'Your image or logo suspended inside crystal clear isomalt' },
      { id: 'lg3', name: 'Lace & Cutout Lollipops', description: 'Intricate edible lace patterns or custom cutout lettering' },
      { id: 'lg4', name: 'Gift Jars', description: 'Handcrafted small lollipops in glass jars for favours or gifting' }
    ],
    products: [
      {
        id: 'lp1',
        name: 'Speciality Lollipops',
        description: 'Our full range of artisan flavours — floral, fruit, spice, and cocktail-inspired. Hand-poured crystal isomalt lollipops with sprinkles, flowers, or fruit pieces.',
        photo: 'https://images.unsplash.com/photo-1575224300306-1b8da36134ec?auto=format&fit=crop&q=80&w=600',
        basePrice: 11.00,
        isActive: true,
        groupId: 'lg1',
        customizationOptions: [
          {
            name: 'Lollipop Size',
            isRequired: true,
            type: 'variation',
            values: [
              { value: 'Small (35mm)', priceUplift: 0 },
              { value: 'Medium (50mm)', priceUplift: 11 },
              { value: 'Large (55mm)', priceUplift: 19 }
            ]
          },
          {
            name: 'Flavour',
            isRequired: true,
            type: 'variation',
            values: [
              { value: 'Gin & Tonic', priceUplift: 0 },
              { value: 'Tequila, Lemon & Salt', priceUplift: 0 },
              { value: 'Strawberry Daiquiri', priceUplift: 0 },
              { value: 'Mojito', priceUplift: 0 },
              { value: 'Brandy & Cola', priceUplift: 0 },
              { value: 'Amarula Butterscotch', priceUplift: 0 },
              { value: 'Piña Colada', priceUplift: 0 },
              { value: 'Lichi', priceUplift: 0 },
              { value: 'Salted Caramel', priceUplift: 0 },
              { value: 'Dehydrated Strawberry', priceUplift: 0 },
              { value: 'Earl Grey & Gold', priceUplift: 0 },
              { value: 'Mango & Kiwifruit', priceUplift: 0 },
              { value: 'Coconut Salted Caramel', priceUplift: 0 },
              { value: 'Pear & Rosemary', priceUplift: 0 },
              { value: 'Orange Blossom & Fennel Floret', priceUplift: 0 },
              { value: 'Lemon Verbena', priceUplift: 0 },
              { value: 'Smokey Peach', priceUplift: 0 },
              { value: 'Rose & Viola', priceUplift: 0 },
              { value: 'Malt Caramel', priceUplift: 0 },
              { value: 'Orange Blossom & Lemonade', priceUplift: 0 },
              { value: 'Cardamom & Calendula', priceUplift: 0 },
              { value: 'Vanilla & Coffee Bean', priceUplift: 0 },
              { value: 'Blackcurrant', priceUplift: 0 },
              { value: 'Lemon Zest & Lavender', priceUplift: 0 },
              { value: 'Gingerbread (Shimmer)', priceUplift: 0 },
              { value: 'Raspberry & Basil', priceUplift: 0 },
              { value: 'Pineapple & Paprika', priceUplift: 0 },
              { value: 'Elderflower & Cornflower', priceUplift: 0 },
              { value: 'Chilli Cherry', priceUplift: 0 },
              { value: 'Apple & Cinnamon', priceUplift: 0 },
              { value: 'Naartjie', priceUplift: 0 },
              { value: 'Grapefruit & Mint', priceUplift: 0 },
              { value: 'Apricot & Violet', priceUplift: 0 },
              { value: 'Cherry Cola', priceUplift: 0 },
              { value: 'Salt & Pepper Watermelon', priceUplift: 0 }
            ]
          },
          {
            name: 'Production Requirement',
            isRequired: false,
            type: 'variation',
            values: [
              { value: 'Standard Batch', priceUplift: 0 },
              { value: 'Separate Halal / Alcohol-Free Production Batch', priceUplift: 0 }
            ]
          },
          {
            name: 'Custom Finishing',
            isRequired: false,
            type: 'extra',
            values: [
              { value: 'Custom Satin Ribbon (Gold & Black Default)', priceUplift: 3 },
              { value: 'Custom Branded Tag', priceUplift: 5 }
            ]
          }
        ],
        priceBreaks: [
          { minQty: 15, maxQty: 99, unitPrice: 16 },
          { minQty: 100, maxQty: 499, unitPrice: 14 },
          { minQty: 500, maxQty: 999, unitPrice: 12 },
          { minQty: 1000, maxQty: undefined, unitPrice: 11 }
        ]
      },
      {
        id: 'lp2',
        name: 'Picture / Logo Lollipops',
        description: 'Your custom image or logo suspended inside the lollipop. Supply high-contrast artwork.',
        photo: 'https://images.unsplash.com/photo-1582293041079-7814c2f12063?auto=format&fit=crop&q=80&w=600',
        basePrice: 13.50,
        isActive: true,
        groupId: 'lg2',
        customizationOptions: [
          {
            name: 'Lollipop Size',
            isRequired: true,
            type: 'variation',
            values: [
              { value: 'Small (35mm)', priceUplift: 0 },
              { value: 'Medium (50mm)', priceUplift: 13.50 },
              { value: 'Large (55mm)', priceUplift: 21.50 }
            ]
          },
          {
            name: 'Flavour Selection',
            isRequired: true,
            type: 'variation',
            values: [
              { value: 'Rose', priceUplift: 0 },
              { value: 'Apple', priceUplift: 0 },
              { value: 'Clear Vanilla', priceUplift: 0 },
              { value: 'Passionfruit', priceUplift: 0 }
            ]
          },
          {
            name: 'Artwork Image File',
            isRequired: false,
            type: 'extra',
            values: [
              { value: 'High-Contrast Logo / Photo Artwork', priceUplift: 0 }
            ]
          },
          {
            name: 'Custom Finishing',
            isRequired: false,
            type: 'extra',
            values: [
              { value: 'Custom Tag & Satin Ribbon', priceUplift: 6 }
            ]
          }
        ],
        priceBreaks: [
          { minQty: 15, maxQty: 99, unitPrice: 16 },
          { minQty: 100, maxQty: undefined, unitPrice: 13.50 }
        ]
      },
      {
        id: 'lp3',
        name: 'Lace & Cutout Lollipops',
        description: 'Intricate edible lace patterns or custom cutout words/letters inside crystal clear isomalt.',
        photo: 'https://images.unsplash.com/photo-1514517521153-1be72277b32f?auto=format&fit=crop&q=80&w=600',
        basePrice: 14.00,
        isActive: true,
        groupId: 'lg3',
        customizationOptions: [
          {
            name: 'Lollipop Size',
            isRequired: true,
            type: 'variation',
            values: [
              { value: 'Small (35mm)', priceUplift: 0 },
              { value: 'Medium (50mm)', priceUplift: 14.00 },
              { value: 'Large (55mm)', priceUplift: 21.00 }
            ]
          },
          {
            name: 'Gold Leaf Accents',
            isRequired: false,
            type: 'extra',
            values: [
              { value: '24k Edible Gold Leaf Flakes', priceUplift: 6 }
            ]
          },
          {
            name: 'Cutout Text or Lace Pattern',
            isRequired: false,
            type: 'extra',
            values: [
              { value: 'Custom Cutout Word (e.g. LOVE / Monogram)', priceUplift: 5 },
              { value: 'Intricate Edible Lace Pattern', priceUplift: 8 }
            ]
          },
          {
            name: 'Custom Finishing',
            isRequired: false,
            type: 'extra',
            values: [
              { value: 'Custom Ribbon & Branded Tag', priceUplift: 6 }
            ]
          }
        ],
        priceBreaks: [
          { minQty: 15, maxQty: 99, unitPrice: 18 },
          { minQty: 100, maxQty: 499, unitPrice: 16 },
          { minQty: 500, maxQty: 999, unitPrice: 15 },
          { minQty: 1000, maxQty: undefined, unitPrice: 14 }
        ]
      },
      {
        id: 'lp4',
        name: 'Gift Jars',
        description: 'Beautifully packaged glass jars filled with small lollipops — perfect for favours, gifting or resale.',
        photo: 'https://images.unsplash.com/photo-1581795669633-91b63ad08e23?auto=format&fit=crop&q=80&w=600',
        basePrice: 64.00,
        isActive: true,
        groupId: 'lg4',
        customizationOptions: [
          {
            name: 'Jar Size',
            isRequired: true,
            type: 'variation',
            values: [
              { value: 'Jar of 5 Small Lollipops', priceUplift: 0 },
              { value: 'Jar of 15 Small Lollipops', priceUplift: 126.00 }
            ]
          },
          {
            name: 'Flavour Preference',
            isRequired: true,
            type: 'variation',
            values: [
              { value: 'Assorted Mixed Flavours', priceUplift: 0 },
              { value: 'Floral & Botanical Mix', priceUplift: 0 },
              { value: 'Cocktail-Inspired Party Mix', priceUplift: 0 },
              { value: 'Single Custom Flavour', priceUplift: 10 }
            ]
          },
          {
            name: 'Custom Branding',
            isRequired: false,
            type: 'extra',
            values: [
              { value: 'Custom Branded Sticker on Jar', priceUplift: 12 },
              { value: 'Custom Satin Bow & Gift Tag', priceUplift: 10 }
            ]
          }
        ],
        priceBreaks: [
          { minQty: 5, maxQty: 14, unitPrice: 75 },
          { minQty: 15, maxQty: 99, unitPrice: 68 },
          { minQty: 100, maxQty: undefined, unitPrice: 64 }
        ]
      }
    ],
    services: [
      {
        id: 'ls1',
        name: 'On-Site Live Lollipop Pouring Station (2 Hours)',
        description: 'Interactive pop-up station with master confectioners hand-pouring custom edible lollipops live for event guests.',
        photo: 'https://images.unsplash.com/photo-1514517521153-1be72277b32f?auto=format&fit=crop&q=80&w=400',
        basePrice: 3800.00,
        isActive: true,
        customizationOptions: [],
        priceBreaks: [{ minQty: 1, maxQty: undefined, unitPrice: 3800 }]
      }
    ],
    customers: [
      {
        id: 'lc1',
        name: 'Planit Weddings & Luxe Events',
        phone: '+27 (0) 82 441 9023',
        email: 'events@planitweddings.co.za',
        address: 'Villa 14, Constantia Heights, Cape Town, 7806',
        notes: 'VIP Wedding Planner requesting custom lollipops for 120 guests'
      },
      {
        id: 'lc2',
        name: 'The Cape Town Gin Company',
        phone: '+27 (0) 21 422 1009',
        email: 'marketing@capetowngin.com',
        address: '53 Heritage Square, Bree Street, Cape Town Central, 8001',
        notes: 'G&T Botanical pop gifts for new spirit launch'
      }
    ],
    quotes: [
      {
        id: 'lq1',
        quoteNumber: 'TLL-2026-081',
        customerId: 'lc1',
        customerName: 'Planit Weddings & Luxe Events',
        customerEmail: 'events@planitweddings.co.za',
        customerPhone: '+27 (0) 82 441 9023',
        customerAddress: 'Villa 14, Constantia Heights, Cape Town, 7806',
        date: '2026-07-20',
        expiryDate: '2026-08-20',
        items: [
          {
            id: 'lqi1',
            productId: 'lp1',
            productName: 'Speciality Lollipops',
            productPhoto: 'https://images.unsplash.com/photo-1575224300306-1b8da36134ec?auto=format&fit=crop&q=80&w=400',
            productDescription: 'Artisan lollipops in Dehydrated Strawberry flavour.',
            quantity: 120,
            baseUnitPrice: 11,
            appliedUnitPrice: 14,
            selectedCustomizations: {
              'Lollipop Size': { value: 'Small (35mm)', priceUplift: 0 },
              'Flavour': { value: 'Dehydrated Strawberry', priceUplift: 0 },
              'Custom Finishing': { value: 'Custom Branded Tag', priceUplift: 5 }
            },
            total: 2280.00
          },
          {
            id: 'lqi2',
            productId: 'lp2',
            productName: 'Picture / Logo Lollipops',
            productPhoto: 'https://images.unsplash.com/photo-1582293041079-7814c2f12063?auto=format&fit=crop&q=80&w=400',
            productDescription: 'Medium 50mm lollipops with custom wedding monogram artwork.',
            quantity: 100,
            baseUnitPrice: 13.50,
            appliedUnitPrice: 27,
            selectedCustomizations: {
              'Lollipop Size': { value: 'Medium (50mm)', priceUplift: 13.50 },
              'Flavour Selection': { value: 'Rose', priceUplift: 0 },
              'Custom Finishing': { value: 'Custom Tag & Satin Ribbon', priceUplift: 6 }
            },
            total: 3300.00
          },
          {
            id: 'lqi3',
            productId: 'lp4',
            productName: 'Gift Jars',
            productPhoto: 'https://images.unsplash.com/photo-1581795669633-91b63ad08e23?auto=format&fit=crop&q=80&w=400',
            productDescription: 'Jars of 15 small lollipops with custom branded stickers.',
            quantity: 10,
            baseUnitPrice: 64,
            appliedUnitPrice: 190,
            selectedCustomizations: {
              'Jar Size': { value: 'Jar of 15 Small Lollipops', priceUplift: 126.00 },
              'Flavour Preference': { value: 'Floral & Botanical Mix', priceUplift: 0 },
              'Custom Branding': { value: 'Custom Branded Sticker on Jar', priceUplift: 12 }
            },
            total: 2020.00
          }
        ],
        discount: { type: 'percentage', value: 5 },
        hasDiscount: true,
        hasTax: true,
        taxRate: 15,
        taxAmount: 1087.28,
        notes: 'Thank you for choosing The Lollipop League! Hand-poured with love in Cape Town.',
        status: 'sent',
        templateId: 'playful-candy',
        totalAmount: 8335.28,
        fulfillmentType: 'delivery',
        fulfillmentLabel: 'Cape Town Courier Delivery',
        fulfillmentPrice: 150
      }
    ],
    invoices: [
      {
        id: 'li1',
        invoiceNumber: 'INV-TLL-0042',
        customerId: 'lc2',
        customerName: 'The Cape Town Gin Company',
        customerEmail: 'marketing@capetowngin.com',
        customerPhone: '+27 (0) 21 422 1009',
        customerAddress: '53 Heritage Square, Bree Street, Cape Town Central, 8001',
        date: '2026-07-15',
        dueDate: '2026-07-30',
        items: [
          {
            id: 'lii1',
            productId: 'lp1',
            productName: 'Speciality Lollipops',
            productPhoto: 'https://images.unsplash.com/photo-1575224300306-1b8da36134ec?auto=format&fit=crop&q=80&w=400',
            productDescription: 'Gin & Tonic cocktail-inspired lollipops for spirit launch hampers.',
            quantity: 200,
            appliedUnitPrice: 14,
            selectedCustomizations: {
              'Lollipop Size': { value: 'Small (35mm)', priceUplift: 0 },
              'Flavour': { value: 'Gin & Tonic', priceUplift: 0 },
              'Production Requirement': { value: 'Separate Halal / Alcohol-Free Production Batch', priceUplift: 0 }
            },
            total: 2800.00
          }
        ],
        discount: { type: 'percentage', value: 0 },
        hasDiscount: false,
        notes: 'Tax Invoice for Cape Town Gin Co promotion.',
        status: 'unpaid',
        templateId: 'modern-clean',
        subtotal: 2800.00,
        vatAmount: 420.00,
        hasVat: true,
        totalAmount: 3220.00,
        fulfillmentType: 'collection'
      }
    ],
    jobs: [
      {
        id: 'lj1',
        jobNumber: 'JOB-TLL-108',
        customerId: 'lc1',
        clientName: 'Planit Weddings & Luxe Events',
        status: 'In Progress',
        dateCreated: '2026-07-21',
        fulfillmentType: 'delivery',
        items: [
          {
            id: 'lji1',
            title: 'Speciality Lollipops (Dehydrated Strawberry - 120 units)',
            quantity: 120,
            status: 'In Production',
            customizationSummary: 'Small (35mm), Dehydrated Strawberry, Custom Monogram Tag',
            trackingType: 'batch',
            batchSize: 30,
            completedCount: 60,
            stockCount: 120
          },
          {
            id: 'lji2',
            title: 'Picture / Logo Lollipops (100 units)',
            quantity: 100,
            status: 'Sourcing Materials',
            customizationSummary: 'Medium (50mm), Rose Flavour, Custom Tag & Satin Ribbon',
            trackingType: 'individual',
            completedCount: 0,
            stockCount: 100
          }
        ]
      }
    ],
    notifications: [
      {
        id: 'ln1',
        message: 'Planit Weddings & Luxe Events viewed Quote TLL-2026-081',
        timestamp: '15 mins ago',
        type: 'quote_viewed',
        isRead: false,
        referenceId: 'lq1'
      }
    ]
  },
  {
    id: 'veldt-forge',
    name: 'Veldt & Forge Jewellers',
    tagline: 'Bespoke Fine Jewellery & Precious Metalsmiths',
    category: 'Fine Jewellery & Goldsmiths',
    icon: '💎',
    profile: {
      name: 'Veldt & Forge Jewellers',
      logo: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&q=80&w=300',
      phone: '+27 (0) 21 887 2301',
      email: 'studio@veldtandforge.co.za',
      address: '74 Church Street, Stellenbosch Village, 7600',
      bankingDetails: {
        bankName: 'Investec Bank',
        accountNumber: '10011928301',
        branchCode: '580105',
        accountType: 'Private Business Account',
      },
      vatNumber: 'ZA4902193812',
      isVatRegistered: true,
      vatRate: 15,
    },
    groups: [
      { id: 'vg1', name: 'Engagement & Solitaires', description: 'Ethically sourced diamonds and sapphire rings' },
      { id: 'vg2', name: 'Heritage Signets', description: 'Hand-engraved precious metal signet rings' },
      { id: 'vg3', name: 'Earrings & Pendants', description: 'Fynbos inspired gold & platinum jewellery' }
    ],
    products: [
      {
        id: 'vp1',
        name: 'Handcrafted 18k Fynbos Solitaire Ring',
        description: 'Custom forged 18k gold band with claw-set center stone, carved with delicate botanical texture.',
        photo: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=400',
        basePrice: 18500.00,
        isActive: true,
        groupId: 'vg1',
        customizationOptions: [
          {
            name: 'Precious Metal',
            isRequired: true,
            type: 'variation',
            values: [
              { value: '18k Yellow Gold', priceUplift: 0 },
              { value: '18k Rose Gold', priceUplift: 0 },
              { value: '950 Platinum', priceUplift: 2800 }
            ]
          },
          {
            name: 'Center Gemstone',
            isRequired: true,
            type: 'variation',
            values: [
              { value: '1.0ct Salt & Pepper Diamond', priceUplift: 0 },
              { value: '1.2ct Forever One Moissanite', priceUplift: -3500 },
              { value: '1.0ct Royal Blue Ceylon Sapphire', priceUplift: 4500 }
            ]
          },
          {
            name: 'Band Finish',
            isRequired: false,
            type: 'extra',
            values: [
              { value: 'Hand-Hammered Bark Texture', priceUplift: 450 },
              { value: 'Custom Inside Inscription (Max 20 chars)', priceUplift: 350 }
            ]
          }
        ],
        priceBreaks: [{ minQty: 1, maxQty: undefined, unitPrice: 18500 }]
      },
      {
        id: 'vp2',
        name: 'Bespoke Heritage Signet Ring',
        description: 'Solid heavy-weight signet ring hand-engraved with family crest, monogram, or custom coordinates.',
        photo: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&q=80&w=400',
        basePrice: 4200.00,
        isActive: true,
        groupId: 'vg2',
        customizationOptions: [
          {
            name: 'Metal Option',
            isRequired: true,
            type: 'variation',
            values: [
              { value: '925 Sterling Silver', priceUplift: 0 },
              { value: '9k Solid Yellow Gold', priceUplift: 3800 },
              { value: '18k Solid Yellow Gold', priceUplift: 9500 }
            ]
          },
          {
            name: 'Engraving Style',
            isRequired: false,
            type: 'extra',
            values: [
              { value: 'Deep Relief Family Crest', priceUplift: 850 },
              { value: 'Monogram Lettering', priceUplift: 450 }
            ]
          }
        ],
        priceBreaks: [{ minQty: 1, maxQty: undefined, unitPrice: 4200 }]
      }
    ],
    services: [
      {
        id: 'vs1',
        name: 'Bespoke Ring Resizing & Polishing Service',
        description: 'Laser resizing, prong inspection, ultrasonic clean, and high-polish rhodium plating.',
        photo: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=400',
        basePrice: 650.00,
        isActive: true,
        customizationOptions: [],
        priceBreaks: [{ minQty: 1, maxQty: undefined, unitPrice: 650 }]
      }
    ],
    customers: [
      {
        id: 'vc1',
        name: 'Anika van der Merwe',
        phone: '+27 (0) 83 910 4482',
        email: 'anika.vdm@gmail.com',
        address: '12 Oak Lane, Franschhoek, 7690',
        notes: 'Custom engagement ring enquiry'
      }
    ],
    quotes: [
      {
        id: 'vq1',
        quoteNumber: 'VF-2026-112',
        customerId: 'vc1',
        customerName: 'Anika van der Merwe',
        customerEmail: 'anika.vdm@gmail.com',
        customerPhone: '+27 (0) 83 910 4482',
        customerAddress: '12 Oak Lane, Franschhoek, 7690',
        date: '2026-07-22',
        expiryDate: '2026-08-22',
        items: [
          {
            id: 'vqi1',
            productId: 'vp1',
            productName: 'Handcrafted 18k Fynbos Solitaire Ring',
            productPhoto: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=400',
            productDescription: '18k Yellow Gold band with Royal Blue Ceylon Sapphire.',
            quantity: 1,
            baseUnitPrice: 18500,
            appliedUnitPrice: 18500,
            selectedCustomizations: {
              'Precious Metal': { value: '18k Yellow Gold', priceUplift: 0 },
              'Center Gemstone': { value: '1.0ct Royal Blue Ceylon Sapphire', priceUplift: 4500 },
              'Band Finish': { value: 'Hand-Hammered Bark Texture', priceUplift: 450 }
            },
            total: 23450.00
          }
        ],
        discount: { type: 'percentage', value: 0 },
        hasDiscount: false,
        hasTax: true,
        taxRate: 15,
        taxAmount: 3517.50,
        notes: 'Includes valuation certificate and velvet ring box.',
        status: 'sent',
        templateId: 'golden-luxury',
        totalAmount: 26967.50,
        fulfillmentType: 'collection'
      }
    ],
    invoices: [],
    jobs: [
      {
        id: 'vj1',
        jobNumber: 'JOB-VF-054',
        customerId: 'vc1',
        clientName: 'Anika van der Merwe',
        status: 'In Progress',
        dateCreated: '2026-07-23',
        fulfillmentType: 'collection',
        items: [
          {
            id: 'vji1',
            title: '18k Fynbos Solitaire Ring forging',
            quantity: 1,
            status: 'In Production',
            customizationSummary: '18k Yellow Gold, 1.0ct Royal Blue Ceylon Sapphire, Hand-Hammered Bark Texture',
            trackingType: 'individual',
            completedCount: 0,
            stockCount: 1
          }
        ]
      }
    ],
    notifications: []
  },
  {
    id: 'kogelberg-timber',
    name: 'Kogelberg Oak & Timber',
    tagline: 'Solid Hardwood Furniture & Architectural Joinery',
    category: 'Custom Furniture & Timber',
    icon: '🪵',
    profile: {
      name: 'Kogelberg Oak & Timber',
      logo: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&q=80&w=300',
      phone: '+27 (0) 44 382 1044',
      email: 'info@kogelbergtimber.co.za',
      address: 'Industrial Park, Plot 8, Main Road, Knysna, 6570',
      bankingDetails: {
        bankName: 'Standard Bank',
        accountNumber: '08192847112',
        branchCode: '051001',
        accountType: 'Business Current',
      },
      vatNumber: 'ZA4102938471',
      isVatRegistered: true,
      vatRate: 15,
    },
    groups: [
      { id: 'kg1', name: 'Dining & Living Tables', description: 'Live edge & solid hardwood tables' },
      { id: 'kg2', name: 'Storage & Credenzas', description: 'Fluted sideboards and cabinetry' }
    ],
    products: [
      {
        id: 'kp1',
        name: 'Live-Edge French Oak Dining Table (8-Seater)',
        description: 'Single-slab or bookmatched French Oak dining table with organic natural edge and matte steel base.',
        photo: 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?auto=format&fit=crop&q=80&w=400',
        basePrice: 24000.00,
        isActive: true,
        groupId: 'kg1',
        customizationOptions: [
          {
            name: 'Timber Species',
            isRequired: true,
            type: 'variation',
            values: [
              { value: 'French Oak', priceUplift: 0 },
              { value: 'Knysna Wild Olive (Rare)', priceUplift: 6500 },
              { value: 'African Black Tamboti', priceUplift: 8000 }
            ]
          },
          {
            name: 'Base Leg Style',
            isRequired: true,
            type: 'variation',
            values: [
              { value: 'Matte Black Steel X-Legs', priceUplift: 0 },
              { value: 'Tapered Wooden Pedestal Posts', priceUplift: 1200 },
              { value: 'Brushed Brass Inlaid Base', priceUplift: 3200 }
            ]
          },
          {
            name: 'Surface Oil Finish',
            isRequired: false,
            type: 'extra',
            values: [
              { value: 'Monocoat Natural Matte Oil', priceUplift: 0 },
              { value: 'Dark Walnut Satin Stain', priceUplift: 600 }
            ]
          }
        ],
        priceBreaks: [{ minQty: 1, maxQty: undefined, unitPrice: 24000 }]
      },
      {
        id: 'kp2',
        name: 'Modular Solid Walnut Sideboard Credenza',
        description: 'Solid walnut credenza featuring tambour slatted doors and soft-close brass hardware.',
        photo: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&q=80&w=400',
 basePrice: 16500.00,
        isActive: true,
        groupId: 'kg2',
        customizationOptions: [
          {
            name: 'Door Style',
            isRequired: true,
            type: 'variation',
            values: [
              { value: 'Slatted Tambour Sliding Doors', priceUplift: 0 },
              { value: 'Fluted Reeded Glass Panels', priceUplift: 1100 }
            ]
          }
        ],
        priceBreaks: [{ minQty: 1, maxQty: undefined, unitPrice: 16500 }]
      }
    ],
    services: [
      {
        id: 'ks1',
        name: 'On-Site Custom Joinery Installation & Leveling',
        description: 'Professional white-glove installation and timber floor mounting.',
        photo: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=400',
        basePrice: 2500.00,
        isActive: true,
        customizationOptions: [],
        priceBreaks: [{ minQty: 1, maxQty: undefined, unitPrice: 2500 }]
      }
    ],
    customers: [
      {
        id: 'kc1',
        name: 'Studio Arch Design Consultants',
        phone: '+27 (0) 21 418 2000',
        email: 'projects@studioarch.co.za',
        address: 'Suite 201, The Foundry, Prestwich St, De Waterkant, 8001',
        notes: 'Interior architects specifying for luxury residential project'
      }
    ],
    quotes: [
      {
        id: 'kq1',
        quoteNumber: 'KOT-2026-009',
        customerId: 'kc1',
        customerName: 'Studio Arch Design Consultants',
        customerEmail: 'projects@studioarch.co.za',
        customerPhone: '+27 (0) 21 418 2000',
        customerAddress: 'Suite 201, The Foundry, Prestwich St, De Waterkant, 8001',
        date: '2026-07-18',
        expiryDate: '2026-08-18',
        items: [
          {
            id: 'kqi1',
            productId: 'kp1',
            productName: 'Live-Edge French Oak Dining Table (8-Seater)',
            productPhoto: 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?auto=format&fit=crop&q=80&w=400',
            productDescription: '8-Seater dining table with Knysna Wild Olive slab.',
            quantity: 1,
            baseUnitPrice: 24000,
            appliedUnitPrice: 24000,
            selectedCustomizations: {
              'Timber Species': { value: 'Knysna Wild Olive (Rare)', priceUplift: 6500 },
              'Base Leg Style': { value: 'Matte Black Steel X-Legs', priceUplift: 0 },
              'Surface Oil Finish': { value: 'Monocoat Natural Matte Oil', priceUplift: 0 }
            },
            total: 30500.00
          }
        ],
        discount: { type: 'percentage', value: 5 },
        hasDiscount: true,
        hasTax: true,
        taxRate: 15,
        taxAmount: 4346.25,
        notes: 'Handcrafted in Knysna timber workshop.',
        status: 'accepted',
        templateId: 'minimalist-arch',
        totalAmount: 33321.25,
        fulfillmentType: 'delivery',
        fulfillmentLabel: 'Long Distance Furniture Freight',
        fulfillmentPrice: 1200
      }
    ],
    invoices: [],
    jobs: [
      {
        id: 'kj1',
        jobNumber: 'JOB-KOT-088',
        customerId: 'kc1',
        clientName: 'Studio Arch Design Consultants',
        status: 'In Progress',
        dateCreated: '2026-07-20',
        fulfillmentType: 'delivery',
        items: [
          {
            id: 'kji1',
            title: 'Live-Edge Dining Table (Wild Olive)',
            quantity: 1,
            status: 'In Production',
            customizationSummary: 'Knysna Wild Olive (Rare), Matte Black Steel X-Legs',
            trackingType: 'individual',
            completedCount: 0,
            stockCount: 1
          }
        ]
      }
    ],
    notifications: []
  },
  {
    id: 'cloudgrip-shearling',
    name: 'CloudGrip Leather & Shearling',
    tagline: 'Artisanal Merino Sheepskin Slippers & Footwear',
    category: 'Footwear & Leather Goods',
    icon: '🐑',
    profile: {
      name: 'CloudGrip Leather & Shearling',
      logo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=300',
      phone: '+27 (0) 33 263 1192',
      email: 'orders@cloudgrip.co.za',
      address: 'The Old Tannery, Nottingham Road, Natal Midlands, 3280',
      bankingDetails: {
        bankName: 'Nedbank',
        accountNumber: '11920384711',
        branchCode: '198765',
        accountType: 'Business Account',
      },
      vatNumber: 'ZA4091827364',
      isVatRegistered: true,
      vatRate: 15,
    },
    groups: [
      { id: 'cg1', name: 'Adult Shearling Boots', description: 'Full sheepskin boots & indoor/outdoor slippers' },
      { id: 'cg2', name: 'Children & Babies', description: 'Soft fluffy sheepskin booties' }
    ],
    products: [
      {
        id: 'cp1',
        name: 'Artisanal Merino Sheepskin Slipper Boots',
        description: 'Plush 100% genuine South African Merino sheepskin slippers with reinforced suede heels and flexible crepe rubber soles.',
        photo: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&q=80&w=400',
        basePrice: 1450.00,
        isActive: true,
        groupId: 'cg1',
        customizationOptions: [
          {
            name: 'Outer Leather Colour',
            isRequired: true,
            type: 'variation',
            values: [
              { value: 'Antique Chestnut Suede', priceUplift: 0 },
              { value: 'Obsidian Black Suede', priceUplift: 0 },
              { value: 'Sand Cream Suede', priceUplift: 0 }
            ]
          },
          {
            name: 'Wool Fleece Lining',
            isRequired: true,
            type: 'variation',
            values: [
              { value: 'Natural Ivory Merino Wool', priceUplift: 0 },
              { value: 'Charcoal Grey Wool', priceUplift: 50 }
            ]
          },
          {
            name: 'Sole Type',
            isRequired: true,
            type: 'variation',
            values: [
              { value: 'Indoor/Outdoor Crepe Rubber Sole', priceUplift: 0 },
              { value: 'Soft Indoor Suede Sole', priceUplift: -100 }
            ]
          }
        ],
        priceBreaks: [
          { minQty: 1, maxQty: 9, unitPrice: 1450 },
          { minQty: 10, maxQty: 29, unitPrice: 1300 },
          { minQty: 30, maxQty: undefined, unitPrice: 1150 }
        ]
      },
      {
        id: 'cp2',
        name: 'Hand-Stitched Genuine Shearling Mules',
        description: 'Slip-on shearling mules crafted with raw leather stitching and memory foam cushion footbed.',
        photo: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&q=80&w=400',
        basePrice: 1150.00,
        isActive: true,
        groupId: 'cg1',
        customizationOptions: [
          {
            name: 'Initial Monogram Stamping',
            isRequired: false,
            type: 'extra',
            values: [
              { value: 'Gold Foil Monogram Stamp (Heel)', priceUplift: 95 }
            ]
          }
        ],
        priceBreaks: [
          { minQty: 1, maxQty: 9, unitPrice: 1150 },
          { minQty: 10, maxQty: undefined, unitPrice: 980 }
        ]
      }
    ],
    services: [
      {
        id: 'cs1',
        name: 'Shearling Resoiling & Deep Wool Cleansing',
        description: 'Complete sole replacement, re-fluffing, and suede waterproofing treatment.',
        photo: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=400',
        basePrice: 350.00,
        isActive: true,
        customizationOptions: [],
        priceBreaks: [{ minQty: 1, maxQty: undefined, unitPrice: 350 }]
      }
    ],
    customers: [
      {
        id: 'cc1',
        name: 'Midlands Country Boutique',
        phone: '+27 (0) 33 234 9011',
        email: 'info@midlandsboutique.co.za',
        address: '4 Main Street, Mooi River, 3300',
        notes: 'Boutique stockist placing winter order'
      }
    ],
    quotes: [
      {
        id: 'cq1',
        quoteNumber: 'CG-2026-033',
        customerId: 'cc1',
        customerName: 'Midlands Country Boutique',
        customerEmail: 'info@midlandsboutique.co.za',
        customerPhone: '+27 (0) 33 234 9011',
        customerAddress: '4 Main Street, Mooi River, 3300',
        date: '2026-07-19',
        expiryDate: '2026-08-19',
        items: [
          {
            id: 'cqi1',
            productId: 'cp1',
            productName: 'Artisanal Merino Sheepskin Slipper Boots',
            productPhoto: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&q=80&w=400',
            productDescription: 'Antique Chestnut Suede with Crepe Rubber Soles.',
            quantity: 15,
            baseUnitPrice: 1450,
            appliedUnitPrice: 1300,
            selectedCustomizations: {
              'Outer Leather Colour': { value: 'Antique Chestnut Suede', priceUplift: 0 },
              'Wool Fleece Lining': { value: 'Natural Ivory Merino Wool', priceUplift: 0 },
              'Sole Type': { value: 'Indoor/Outdoor Crepe Rubber Sole', priceUplift: 0 }
            },
            total: 19500.00
          }
        ],
        discount: { type: 'percentage', value: 0 },
        hasDiscount: false,
        hasTax: true,
        taxRate: 15,
        taxAmount: 2925.00,
        notes: 'Hand-stitched in Nottingham Road workshop.',
        status: 'sent',
        templateId: 'vintage-craft',
        totalAmount: 22425.00,
        fulfillmentType: 'delivery',
        fulfillmentLabel: 'Courier Freight',
        fulfillmentPrice: 250
      }
    ],
    invoices: [],
    jobs: [],
    notifications: []
  },
  {
    id: 'fynbos-clay',
    name: 'Fynbos & Clay Artisans',
    tagline: 'Ceramics, Leathercraft & Organic Soaps (Original Default)',
    category: 'Cape Town Artisan Collective',
    icon: '🏺',
    profile: DEFAULT_PROFILE,
    groups: DEFAULT_GROUPS,
    products: DEFAULT_PRODUCTS,
    services: DEFAULT_SERVICES,
    customers: DEFAULT_CUSTOMERS,
    quotes: DEFAULT_QUOTES,
    invoices: DEFAULT_INVOICES,
    jobs: DEFAULT_JOBS,
    notifications: DEFAULT_NOTIFICATIONS
  }
];
