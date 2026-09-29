export interface FulfillmentPreset {
  id: string;
  type: 'collection' | 'delivery';
  label: string;
  price: number;
  isVariable?: boolean;
}

export interface BankingDetails {
  bankName: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
}

export interface BusinessProfile {
  name: string;
  tagline?: string;
  logo: string; // Base64 or placeholder URL
  phone: string;
  email: string;
  address: string;
  bankingDetails: BankingDetails;
  vatNumber?: string; // SARS Section 20 requires this if registered
  isVatRegistered: boolean;
  vatRate: number; // e.g. 15% in South Africa
}

export interface SupplierInfo {
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface Material {
  id: string;
  name: string;
  category?: string;
  unit: string; // e.g., 'kg', 'g', 'l', 'ml', 'm', 'cm', 'mm', 'pcs', 'sheet', 'roll', 'box'
  bulkQuantity: number;
  bulkCost: number;
  notes?: string;
  stockQuantity?: number; // Available inventory count
  lowStockThreshold?: number; // Configurable threshold for low stock warning
  lowStockWarningEnabled?: boolean; // Optional toggle per material
  supplier?: SupplierInfo;
}

export type InputType = 'material' | 'labour' | 'direct';

export interface ProductInput {
  id: string;
  type: InputType;
  name: string;
  materialId?: string;
  amount: number;
  unit?: string;
  hourlyRate?: number;
  cost: number;
  costOverridden?: boolean;
  optionName?: string; // e.g. 'Size' or 'Packaging'
  optionValue?: string; // e.g. '500ml' or 'Gift Box'
  applicableValueKeys?: string[]; // e.g. ['Size:::500ml', 'Packaging:::Gift Box']
}

export interface CustomizationOptionValue {
  value: string;
  priceUplift: number; // e.g. +R25
  photo?: string; // Optional photo URL/Base64 for this specific variation/extra choice
  inputs?: ProductInput[]; // Variation or extra choice specific inputs
}

export interface CustomizationOption {
  id?: string;
  name: string; // e.g. 'Scent', 'Packaging'
  isRequired: boolean;
  values: CustomizationOptionValue[];
  type?: 'variation' | 'extra'; // 'variation' or 'extra'
}

export interface PriceBreak {
  minQty: number;
  maxQty?: number; // undefined means "and above"
  unitPrice: number;
}

export interface ProductGroup {
  id: string;
  name: string;
  description: string;
  bulkDiscountPercentage?: number; // Share bulk discounts
}

export type StageConditionLogic = 'AND' | 'OR';

export interface StageCondition {
  id?: string;
  type: 'option_match' | 'option_selected' | 'quantity_threshold';
  optionName?: string; // Name of variation or extra e.g. 'Packaging', 'Size'
  optionValue?: string; // Value required e.g. 'Gift Box', 'Large'
  quantityOperator?: 'gte' | 'gt' | 'lte' | 'lt' | 'eq';
  quantityThreshold?: number; // e.g. 50
}

export interface ProductStageConfig {
  id: string;
  name: string;
  isConditional?: boolean;
  condition?: StageCondition; // Primary/legacy condition
  conditions?: StageCondition[]; // Multi-condition rules
  conditionLogic?: StageConditionLogic; // 'AND' (all must match) or 'OR' (any can match)
}

export interface Product {
  id: string;
  name: string;
  description: string;
  photo: string; // Base64 or standard decorative placeholders
  basePrice: number;
  isActive: boolean;
  stockQuantity?: number; // Number in stock / inventory quantity
  customizationOptions: CustomizationOption[];
  priceBreaks: PriceBreak[]; // Wholesale / Tier pricing break schedule
  groupId?: string; // Optional reference to product group
  defaultStages?: (string | ProductStageConfig)[]; // Production stages tied to this product
  trackingMode?: 'whole' | 'stages'; // Track as whole vs track in stages
  inputs?: ProductInput[]; // Inputs that make up this product
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  isBusiness?: boolean;
  contactPerson?: string; // Contact person for business customers (e.g. Jane Doe / Procurement)
  vatNumber?: string; // South African 10-digit VAT number (SARS: begins with 4)
  companyRegistrationNumber?: string; // South African CIPC registration (e.g. 2021/123456/07)
  phone: string;
  email: string;
  address: string; // Primary / Billing address
  billingAddress?: string; // Explicit billing address
  shippingAddress?: string; // Optional separate shipping address
  useSameAddress?: boolean; // If true, shipping matches billing address
  defaultPricingTier?: 'retail' | 'wholesale';
  notes: string;
}

export function parseAddress(addressString: string) {
  if (!addressString) return { street: '', city: '', province: '', postalCode: '', country: '' };
  const parts = addressString.split(',').map(s => s.trim());
  if (parts.length >= 5) {
    return {
      street: parts.slice(0, parts.length - 4).join(', '),
      city: parts[parts.length - 4],
      province: parts[parts.length - 3],
      postalCode: parts[parts.length - 2],
      country: parts[parts.length - 1],
    };
  }
  if (parts.length === 4) {
    return { street: parts[0], city: parts[1], province: parts[2], postalCode: parts[3], country: '' };
  }
  if (parts.length === 3) {
    return { street: parts[0], city: parts[1], province: parts[2], postalCode: '', country: '' };
  }
  if (parts.length === 2) {
    return { street: parts[0], city: parts[1], province: '', postalCode: '', country: '' };
  }
  return { street: addressString, city: '', province: '', postalCode: '', country: '' };
}

export function formatAddress(parts: { street?: string; city?: string; province?: string; postalCode?: string; country?: string }) {
  return [parts.street, parts.city, parts.province, parts.postalCode, parts.country]
    .map(s => (s ? s.trim() : ''))
    .filter(Boolean)
    .join(', ');
}

export interface Discount {
  type: 'percentage' | 'fixed'; // 'percentage' or 'ZAR fixed'
  value: number; // percentage (e.g. 10 for 10%) or Rand amount (e.g. 50 for R50)
}

export interface SelectedCustomization {
  value: string;
  priceUplift?: number;
  photo?: string;
}

export interface LineItemCustomizations {
  [optionName: string]: SelectedCustomization;
}

export interface QuoteLineItem {
  id: string;
  productId: string;
  productName: string;
  productPhoto: string;
  hideImage?: boolean;
  productDescription: string;
  quantity: number;
  baseUnitPrice?: number; // default base price
  appliedUnitPrice: number; // price break adjusted unit price before customizations
  selectedCustomizations: LineItemCustomizations;
  itemDiscount?: Discount;
  taxRate?: number;
  total: number;
  unitCost?: number; // Optional direct cost for custom items or overrides
}

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'expired' | 'declined';

export interface Quote {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerIsBusiness?: boolean;
  customerContactPerson?: string;
  customerVatNumber?: string;
  customerCompanyRegNumber?: string;
  customerBillingAddress?: string;
  customerShippingAddress?: string;
  date: string;
  expiryDate: string;
  items: QuoteLineItem[];
  discount: Discount; // Entire quote level discount
  hasDiscount: boolean;
  hasTax?: boolean;
  taxRate?: number;
  taxAmount?: number;
  notes: string;
  signOffMessage?: string;
  status: QuoteStatus;
  templateId: string;
  templateCustomStyle?: QuoteTemplateStyle;
  totalAmount: number;
  fulfillmentType?: 'collection' | 'delivery';
  fulfillmentLabel?: string;
  fulfillmentPrice?: number;
  fulfillmentAddress?: string;
  useCustomerAddressForDelivery?: boolean;
}

export type CreditNoteReason = 
  | 'Goods Returned / Defective'
  | 'Order Cancellation / Reduction'
  | 'Billing / Pricing Adjustment'
  | 'Discount / Rebate Allowed'
  | 'Damaged / Short Delivered'
  | 'Other';

export interface CreditNoteLineItem {
  id: string;
  invoiceLineItemId?: string;
  productId?: string;
  productName: string;
  productPhoto?: string;
  productDescription?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  restockQuantity?: boolean;
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string; // e.g. "CN-2026-001" (SARS compliant sequential numbering)
  invoiceId: string;
  invoiceNumber: string; // Reference to original tax invoice
  invoiceDate?: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerIsBusiness?: boolean;
  customerContactPerson?: string;
  customerVatNumber?: string;
  customerCompanyRegNumber?: string;
  customerBillingAddress?: string;
  customerShippingAddress?: string;
  date: string;
  reason: CreditNoteReason | string;
  notes?: string;
  items: CreditNoteLineItem[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  hasVat: boolean;
  templateId?: string;
  templateCustomStyle?: QuoteTemplateStyle;
  status: 'issued' | 'applied';
}

export interface StatementTransaction {
  id: string;
  date: string;
  type: 'Invoice' | 'Credit Note' | 'Payment';
  reference: string;
  description: string;
  debit: number; // Invoiced amounts
  credit: number; // Credited or paid amounts
  balance: number; // Running balance
  status?: string;
  dueDate?: string;
}

export interface AgingSummary {
  current: number; // 0 - 30 days
  days30: number; // 31 - 60 days
  days60: number; // 61 - 90 days
  days90Plus: number; // 90+ days
  totalOutstanding: number;
}

export interface InvoiceLineItem {
  id: string;
  productId: string;
  productName: string;
  productPhoto: string;
  hideImage?: boolean;
  productDescription: string;
  quantity: number;
  baseUnitPrice?: number;
  appliedUnitPrice: number; // Tier adjusted price
  selectedCustomizations: LineItemCustomizations;
  itemDiscount?: Discount;
  taxRate?: number;
  total: number;
  unitCost?: number;
}

export type InvoiceStatus = 'unpaid' | 'paid' | 'overdue' | 'partially_credited' | 'credited';

export interface Invoice {
  id: string;
  invoiceNumber: string; // Sequential SARS complying Section 20 fields
  quoteId?: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerIsBusiness?: boolean;
  customerContactPerson?: string;
  customerVatNumber?: string;
  customerCompanyRegNumber?: string;
  customerBillingAddress?: string;
  customerShippingAddress?: string;
  date: string;
  dueDate: string;
  items: InvoiceLineItem[];
  discount: Discount;
  hasDiscount: boolean;
  notes: string;
  status: InvoiceStatus;
  templateId: string;
  templateCustomStyle?: QuoteTemplateStyle;
  totalAmount: number;
  vatAmount: number; // calculated SARS compliance VAT
  subtotal: number; // before VAT if VAT is calculated, or total after discount
  hasVat: boolean;
  creditedAmount?: number;
  creditNoteIds?: string[];
  fulfillmentType?: 'collection' | 'delivery';
  fulfillmentLabel?: string;
  fulfillmentPrice?: number;
  fulfillmentAddress?: string;
  useCustomerAddressForDelivery?: boolean;
}

export type JobTaskStatus = 'Pending' | 'Sourcing Materials' | 'In Production' | 'Quality Check' | 'Done';

export type TrackingType = 'consolidated' | 'batch' | 'individual';

export interface ItemStageProgress {
  id: string;
  name: string;
  completedQty: number;
}

export interface JobTaskItem {
  id: string;
  productId?: string;
  title: string;
  quantity: number;
  status: JobTaskStatus;
  customizationSummary: string; // comma-separated custom specs chosen by buyer
  selectedCustomizations?: LineItemCustomizations;
  trackingType?: TrackingType;
  batchSize?: number;
  unitStatuses?: JobTaskStatus[];
  completedCount?: number;
  stockCount?: number;
  trackingMode?: 'whole' | 'stages';
  stages?: ItemStageProgress[];
  deductedCount?: number;
  unitCost?: number;
  inputs?: ProductInput[];
}

export type JobStatus = 'Awaiting quote acceptance' | 'Not Started' | 'In Progress' | 'Ready for Collection' | 'Ready for Delivery' | 'Being Delivered' | 'Done';

export type JobType = 'customer_order' | 'stock_creation';

export interface Job {
  id: string;
  jobNumber: string;
  jobType?: JobType; // 'customer_order' or 'stock_creation'
  quoteId?: string;
  customerId: string;
  clientName: string;
  status: JobStatus;
  items: JobTaskItem[];
  dateCreated: string;
  fulfillmentType?: 'collection' | 'delivery';
  notes?: string;
}

export interface AppNotification {
  id: string;
  message: string;
  timestamp: string;
  type: 'quote_viewed' | 'quote_accepted' | 'quote_declined' | 'general';
  isRead: boolean;
  referenceId: string; // id of the quote or job
}

export interface TimeLogEntry {
  id: string;
  jobId?: string;
  jobNumber?: string;
  clientName?: string;
  taskTitle?: string;
  activityName: string;
  durationSeconds: number;
  timestamp: string;
  notes?: string;
}

export type TemplateFontOption = 'sans' | 'serif' | 'mono' | 'display' | 'playful';
export type TemplateBannerStyle = 'none' | 'top-bar' | 'full-banner' | 'curved-header' | 'botanical-accent' | 'brutalist-block' | 'vintage-badge';
export type TableHeaderStyle = 'minimal-line' | 'filled-row' | 'rounded-pill' | 'boxed-grid' | 'bold-solid' | 'espresso-block';
export type TableRowStyle = 'subtle-lines' | 'card-rows' | 'full-grid' | 'clean-borderless';
export type TotalBoxStyle = 'minimal-line' | 'filled-card' | 'standalone-pill' | 'brutalist-banner' | 'clean-row';
export type TemplateBorderRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type LogoDisplayMode = 'logo-and-name' | 'logo-only' | 'name-only';

export interface QuoteTemplateStyle {
  id: string;
  name: string;
  description: string;
  category?: 'Standard' | 'Editorial' | 'Bold & Pop' | 'Warm & Organic' | 'Custom';
  isCustom?: boolean;

  // Font Controls
  headerFont: TemplateFontOption;
  bodyFont: TemplateFontOption;

  // Colour Controls
  bgColor: string;          // Paper canvas background e.g. '#FFFFFF', '#FAF7F2', '#FDF2F4', '#EFECE6'
  textColor: string;        // Primary body text color e.g. '#1C1917', '#3A2012', '#0F172A'
  headingColor: string;     // Headings/Titles color
  accentColor: string;      // Accent highlight color e.g. '#D97706', '#E07A5F', '#FACC15', '#1E3A8A'
  accentBgColor: string;    // Soft banner fill / pill fill
  accentTextColor: string;  // Text on top of accent fill

  // Header / Banner Styling
  bannerStyle: TemplateBannerStyle;

  // Table Styling
  tableHeaderStyle: TableHeaderStyle;
  tableRowStyle: TableRowStyle;

  // Total Block Styling
  totalBoxStyle: TotalBoxStyle;

  // Structural Frame & Borders
  borderRadius: TemplateBorderRadius;
  borderWidth: 'none' | 'thin' | 'medium' | 'thick';
  borderColor: string;

  // Item Photo Options
  showProductPhotos?: boolean;
  productPhotoRadius?: 'square' | 'rounded' | 'circle';

  // Branding & Logo
  logoDisplayMode?: LogoDisplayMode;
}

export interface CompanyPreset {
  id: string;
  name: string;
  tagline: string;
  category: string;
  icon: string;
  websiteUrl?: string;
  profile: BusinessProfile;
  groups: ProductGroup[];
  materials?: Material[];
  products: Product[];
  services: Product[];
  customers: Customer[];
  quotes: Quote[];
  invoices: Invoice[];
  creditNotes?: CreditNote[];
  jobs: Job[];
  notifications: AppNotification[];
}

