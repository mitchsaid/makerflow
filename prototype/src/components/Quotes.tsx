import React, { useState, useEffect } from 'react';
import { 
  FileText, PlusCircle, Search, Calendar, ChevronRight, Eye, EyeOff,
  Trash2, Tag, Percent, ArrowRight, Printer, Check, X, Sparkles, Zap,
  ExternalLink, FileCheck, Layers, Landmark, Edit2, Download, Mail,
  ChevronDown, Palette, Truck, Paintbrush, Save
} from 'lucide-react';
import { 
  Customer, Product, Quote, QuoteLineItem, Discount, 
  LineItemCustomizations, SelectedCustomization, CustomizationOption, BusinessProfile, Job,
  parseAddress, formatAddress, QuoteTemplateStyle, FulfillmentPreset, Material
} from '../types';
import { STANDARD_QUOTE_TEMPLATES, resolveQuoteTemplate } from '../data/quoteTemplates';
import { DocumentRenderer, RenderItem } from './DocumentRenderer';
import { TemplateCustomizerModal } from './TemplateCustomizerModal';
import { TemplateGalleryModal } from './TemplateGalleryModal';
import { InternalQuoteFinancials } from './InternalQuoteFinancials';
import { getProductPhotoUrl, handleImageError } from '../lib/imageUtils';
import { AdvancedCustomItemModal, CustomItemResult } from './AdvancedCustomItemModal';
import { DatePickerWithShortcuts, addDays, formatDateToISO } from './DatePickerWithShortcuts';
import { formatSADate } from '../lib/dateUtils';
import { downloadElementAsPdf } from '../lib/pdfUtils';

interface QuotesProps {
  profile: BusinessProfile;
  quotes: Quote[];
  customers: Customer[];
  products: Product[];
  services?: Product[];
  materials?: Material[];
  jobs: Job[];
  customTemplates?: QuoteTemplateStyle[];
  onSaveCustomTemplate?: (style: QuoteTemplateStyle) => void;
  onDeleteCustomTemplate?: (templateId: string) => void;
  onUpdateQuoteTemplate?: (quoteId: string, templateId: string, customStyle?: QuoteTemplateStyle) => void;
  onCreateQuote: (quote: Omit<Quote, 'id' | 'quoteNumber'> & { quoteNumber?: string }) => Quote;
  onUpdateQuote?: (quote: Quote) => Quote;
  onDeleteQuote?: (quoteId: string) => void;
  onUpdateQuoteStatus: (quoteId: string, status: Quote['status']) => void;
  onConvertQuoteToInvoice: (quoteId: string) => void;
  onConvertQuoteToJob: (quoteId: string) => void;
  onSelectActiveQuoteIdForBuyer: (quoteId: string | null) => void; // Link to Buyer portal view
  quotesStartInCreationMode?: boolean;
  onResetQuotesStartInCreationMode?: () => void;
  onEditProductInCatalogue?: (productId: string) => void;
  onAddNewProductInCatalogue?: () => void;
  onAddCustomer?: (customer: Omit<Customer, 'id'>) => Customer;
  onUpdateCustomer?: (customer: Customer) => void;
}

export default function Quotes({
  profile,
  quotes,
  customers,
  products,
  services = [],
  materials = [],
  jobs,
  customTemplates = [],
  onSaveCustomTemplate = () => {},
  onDeleteCustomTemplate,
  onUpdateQuoteTemplate = () => {},
  onCreateQuote,
  onUpdateQuote,
  onDeleteQuote,
  onUpdateQuoteStatus,
  onConvertQuoteToInvoice,
  onConvertQuoteToJob,
  onSelectActiveQuoteIdForBuyer,
  quotesStartInCreationMode = false,
  onResetQuotesStartInCreationMode,
  onEditProductInCatalogue,
  onAddNewProductInCatalogue,
  onAddCustomer,
  onUpdateCustomer
}: QuotesProps) {
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [customizerInitialStyle, setCustomizerInitialStyle] = useState<QuoteTemplateStyle | undefined>(undefined);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [creationStep, setCreationStep] = useState<1 | 2>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'products' | 'services' | 'custom'>('products');
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  // Custom Item Form State (Once-off custom items)
  const [customItemName, setCustomItemName] = useState('');
  const [customItemDesc, setCustomItemDesc] = useState('');
  const [customItemQty, setCustomItemQty] = useState(1);
  const [customItemPrice, setCustomItemPrice] = useState<number | string>('');
  const [customItemCost, setCustomItemCost] = useState<number | string>('');
  const [isAdvancedCustomItemOpen, setIsAdvancedCustomItemOpen] = useState(false);

  // Customer Search and Modal states
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomerForModal, setEditingCustomerForModal] = useState<Customer | null>(null);

  // Customer Modal Form states
  const [modalCustName, setModalCustName] = useState('');
  const [modalCustPhone, setModalCustPhone] = useState('');
  const [modalCustEmail, setModalCustEmail] = useState('');
  const [modalCustContactPerson, setModalCustContactPerson] = useState('');
  const [modalCustIsBusiness, setModalCustIsBusiness] = useState(false);
  const [modalCustVatNumber, setModalCustVatNumber] = useState('');
  const [modalCustCompanyRegNumber, setModalCustCompanyRegNumber] = useState('');
  const [modalCustUseSameAddress, setModalCustUseSameAddress] = useState(true);
  const [modalCustStreet, setModalCustStreet] = useState('');
  const [modalCustCity, setModalCustCity] = useState('');
  const [modalCustProvince, setModalCustProvince] = useState('');
  const [modalCustPostalCode, setModalCustPostalCode] = useState('');
  const [modalCustCountry, setModalCustCountry] = useState('');
  const [modalCustShippingStreet, setModalCustShippingStreet] = useState('');
  const [modalCustShippingCity, setModalCustShippingCity] = useState('');
  const [modalCustShippingProvince, setModalCustShippingProvince] = useState('');
  const [modalCustShippingPostalCode, setModalCustShippingPostalCode] = useState('');
  const [modalCustShippingCountry, setModalCustShippingCountry] = useState('');
  const [modalCustNotes, setModalCustNotes] = useState('');

  // Conversion / Prompt states
  const [isConvertDropdownOpen, setIsConvertDropdownOpen] = useState(false);
  const [showJobConversionPrompt, setShowJobConversionPrompt] = useState(false);
  const [promptQuote, setPromptQuote] = useState<Quote | null>(null);
  const [dontAskCheckbox, setDontAskCheckbox] = useState(false);

  // Product configuration states (modal configuration before adding)
  const [selectedProductToConfigure, setSelectedProductToConfigure] = useState<Product | null>(null);
  const [editingLineItemIndex, setEditingLineItemIndex] = useState<number | null>(null);
  const [configQty, setConfigQty] = useState<number>(1);
  const [configRate, setConfigRate] = useState<number>(0);
  const [isRateDirty, setIsRateDirty] = useState<boolean>(false);
  const [configCustoms, setConfigCustoms] = useState<LineItemCustomizations>({});
  const [hasConfigDiscount, setHasConfigDiscount] = useState<boolean>(false);
  const [configDiscountType, setConfigDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [configDiscountVal, setConfigDiscountVal] = useState<number>(0);
  const [hasConfigTax, setHasConfigTax] = useState<boolean>(false);
  const [configTaxRate, setConfigTaxRate] = useState<number>(15);
  const [configHideImage, setConfigHideImage] = useState<boolean>(false);
  const [configOverriddenTotal, setConfigOverriddenTotal] = useState<number | null>(null);
  const [isTotalDirty, setIsTotalDirty] = useState<boolean>(false);
  const [extrasAsSeparate, setExtrasAsSeparate] = useState<{[optName: string]: boolean}>({});

  const handleCloseProductModal = () => {
    setIsProductModalOpen(false);
    setSelectedProductToConfigure(null);
    setEditingLineItemIndex(null);
    setExtrasAsSeparate({});
    setConfigHideImage(false);
    setConfigOverriddenTotal(null);
    setIsTotalDirty(false);
    setIsRateDirty(false);
  };

  const handleOpenCustomerModal = (cust: Customer | null) => {
    if (cust) {
      setEditingCustomerForModal(cust);
      setModalCustName(cust.name);
      setModalCustPhone(cust.phone || '');
      setModalCustEmail(cust.email || '');
      setModalCustContactPerson(cust.contactPerson || '');
      setModalCustIsBusiness(!!cust.isBusiness);
      setModalCustVatNumber(cust.vatNumber || '');
      setModalCustCompanyRegNumber(cust.companyRegistrationNumber || '');
      setModalCustUseSameAddress(cust.useSameAddress !== undefined ? cust.useSameAddress : true);

      const parsedBilling = parseAddress(cust.billingAddress || cust.address || '');
      setModalCustStreet(parsedBilling.street);
      setModalCustCity(parsedBilling.city);
      setModalCustProvince(parsedBilling.province);
      setModalCustPostalCode(parsedBilling.postalCode);
      setModalCustCountry(parsedBilling.country);

      const parsedShipping = parseAddress(cust.shippingAddress || cust.billingAddress || cust.address || '');
      setModalCustShippingStreet(parsedShipping.street);
      setModalCustShippingCity(parsedShipping.city);
      setModalCustShippingProvince(parsedShipping.province);
      setModalCustShippingPostalCode(parsedShipping.postalCode);
      setModalCustShippingCountry(parsedShipping.country);

      setModalCustNotes(cust.notes || '');
    } else {
      setEditingCustomerForModal(null);
      setModalCustName('');
      setModalCustPhone('');
      setModalCustEmail('');
      setModalCustContactPerson('');
      setModalCustIsBusiness(false);
      setModalCustVatNumber('');
      setModalCustCompanyRegNumber('');
      setModalCustUseSameAddress(true);
      setModalCustStreet('');
      setModalCustCity('');
      setModalCustProvince('');
      setModalCustPostalCode('');
      setModalCustCountry('');
      setModalCustShippingStreet('');
      setModalCustShippingCity('');
      setModalCustShippingProvince('');
      setModalCustShippingPostalCode('');
      setModalCustShippingCountry('');
      setModalCustNotes('');
    }
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomerModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCustName) return;

    const formattedBilling = formatAddress({
      street: modalCustStreet,
      city: modalCustCity,
      province: modalCustProvince,
      postalCode: modalCustPostalCode,
      country: modalCustCountry
    });

    const formattedShipping = modalCustUseSameAddress
      ? formattedBilling
      : formatAddress({
          street: modalCustShippingStreet,
          city: modalCustShippingCity,
          province: modalCustShippingProvince,
          postalCode: modalCustShippingPostalCode,
          country: modalCustShippingCountry
        });

    const payload = {
      name: modalCustName,
      phone: modalCustPhone,
      email: modalCustEmail,
      isBusiness: modalCustIsBusiness,
      contactPerson: modalCustIsBusiness && modalCustContactPerson.trim() ? modalCustContactPerson.trim() : undefined,
      vatNumber: modalCustIsBusiness ? modalCustVatNumber.trim() : undefined,
      companyRegistrationNumber: modalCustIsBusiness ? modalCustCompanyRegNumber.trim() : undefined,
      billingAddress: formattedBilling,
      shippingAddress: formattedShipping,
      useSameAddress: modalCustUseSameAddress,
      address: formattedBilling,
      notes: modalCustNotes
    };

    if (editingCustomerForModal) {
      if (onUpdateCustomer) {
        onUpdateCustomer({
          ...editingCustomerForModal,
          ...payload
        });
      }
      setShowSuccessToast(`Customer details for "${modalCustName}" updated successfully!`);
    } else {
      if (onAddCustomer) {
        const added = onAddCustomer(payload);
        if (added && added.id) {
          setCustomerId(added.id);
        }
      }
      setShowSuccessToast(`New customer "${modalCustName}" added successfully!`);
    }

    setIsCustomerModalOpen(false);
    setEditingCustomerForModal(null);
  };

  // Creation State
  const nextIndex = quotes.length + 1;
  const autoQuoteNumber = `QT-${new Date().getFullYear()}-${String(nextIndex).padStart(3, '0')}`;
  const [customQuoteNumber, setCustomQuoteNumber] = useState('');

  const [customerId, setCustomerId] = useState('');
  const [quoteDate, setQuoteDate] = useState<string>(() => formatDateToISO(new Date()));
  const [customExpiryDate, setCustomExpiryDate] = useState<string>(() => addDays(30));
  const [expiryDays, setExpiryDays] = useState<number>(30);
  const [validityMode, setValidityMode] = useState<'preset' | 'custom'>('custom');
  const [quoteNotes, setQuoteNotes] = useState('Standard 50% deposit required prior to production. Balanced due upon completion. Delivery can be arranged with local South African couriers.');
  const [signOffMessage, setSignOffMessage] = useState('Thank you so much for your business!');
  const [quoteTemplate, setQuoteTemplate] = useState<string>('artisan-warm');
  const [creatingCustomStyle, setCreatingCustomStyle] = useState<QuoteTemplateStyle | undefined>(undefined);
  const [showStylesExpanded, setShowStylesExpanded] = useState(false);
  
  // Quote-level Discount state (Complexity deferred)
  const [hasQuoteDiscount, setHasQuoteDiscount] = useState(false);
  const [quoteDiscountType, setQuoteDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [quoteDiscountVal, setQuoteDiscountVal] = useState<number>(0);

  // Quote-level Tax state
  const [hasQuoteTax, setHasQuoteTax] = useState(false);
  const [quoteTaxRate, setQuoteTaxRate] = useState<number>(profile.isVatRegistered ? profile.vatRate : 15);

  // Active build items
  const [lineItems, setLineItems] = useState<Omit<QuoteLineItem, 'id' | 'total'>[]>([]);

  // Fulfillment States
  const [fulfillmentPresets, setFulfillmentPresets] = useState<FulfillmentPreset[]>(() => {
    const saved = localStorage.getItem('maker_fulfillment_presets');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'fp_1', type: 'collection', label: 'Business Pickup', price: 0 },
      { id: 'fp_2', type: 'delivery', label: 'Standard Local Delivery', price: 120 },
      { id: 'fp_3', type: 'delivery', label: 'National Courier Delivery', price: 180 },
      { id: 'fp_4', type: 'delivery', label: 'Distance-Based Delivery', price: 0, isVariable: true },
    ];
  });

  useEffect(() => {
    localStorage.setItem('maker_fulfillment_presets', JSON.stringify(fulfillmentPresets));
  }, [fulfillmentPresets]);

  const [selectedFulfillmentPresetId, setSelectedFulfillmentPresetId] = useState<string>('');
  const [fulfillmentType, setFulfillmentType] = useState<'collection' | 'delivery' | undefined>(undefined);
  const [customFulfillmentAddress, setCustomFulfillmentAddress] = useState<string>('');
  const [useCustomerAddress, setUseCustomerAddress] = useState<boolean>(true);
  const [isManagingPresets, setIsManagingPresets] = useState<boolean>(false);
  const [isFulfilmentAddModalOpen, setIsFulfilmentAddModalOpen] = useState<boolean>(false);
  const [isFulfilmentConfigModalOpen, setIsFulfilmentConfigModalOpen] = useState<boolean>(false);
  const [newPresetLabel, setNewPresetLabel] = useState<string>('');
  const [newPresetType, setNewPresetType] = useState<'collection' | 'delivery'>('delivery');
  const [newPresetPrice, setNewPresetPrice] = useState<number>(0);
  const [newPresetIsVariable, setNewPresetIsVariable] = useState<boolean>(false);
  const [newPresetPricingMode, setNewPresetPricingMode] = useState<'free' | 'fixed' | 'variable'>('free');
  const [enteredFulfillmentPrice, setEnteredFulfillmentPrice] = useState<number>(0);

  // Separate address parts for full address entry
  const [addrLine, setAddrLine] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrProvince, setAddrProvince] = useState('');
  const [addrPostalCode, setAddrPostalCode] = useState('');
  const [addrCountry, setAddrCountry] = useState('South Africa');

  // Auto-compile address parts into the customFulfillmentAddress
  useEffect(() => {
    const parts = [addrLine, addrCity, addrProvince, addrPostalCode, addrCountry]
      .map(p => p.trim())
      .filter(Boolean);
    setCustomFulfillmentAddress(parts.join(', '));
  }, [addrLine, addrCity, addrProvince, addrPostalCode, addrCountry]);

  // Action-specific notifications and toasts
  const [showSendNotification, setShowSendNotification] = useState(false);
  const [sentQuoteData, setSentQuoteData] = useState<Quote | null>(null);
  const [notificationEmail, setNotificationEmail] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => {
        setShowSuccessToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  const handleQuoteAcceptedStateTrigger = (quote: Quote) => {
    // 1. Mark quote as accepted in State first (if not already)
    if (quote.status !== 'accepted') {
      onUpdateQuoteStatus(quote.id, 'accepted');
    }

    // 2. Check if we should ask the user
    const preference = localStorage.getItem('maker_dont_ask_convert_to_job');
    if (preference === 'always') {
      onConvertQuoteToJob(quote.id);
      setShowSuccessToast(`Quote accepted & Job created successfully!`);
    } else if (preference === 'never') {
      setShowSuccessToast(`Quote marked as accepted!`);
    } else {
      setPromptQuote(quote);
      setDontAskCheckbox(false);
      setShowJobConversionPrompt(true);
    }
  };

  const handleConfirmJobConversionPrompt = (wantsJob: boolean) => {
    if (promptQuote) {
      if (wantsJob) {
        onConvertQuoteToJob(promptQuote.id);
        setShowSuccessToast(`Quote accepted & turned into a Job!`);
      } else {
        setShowSuccessToast(`Quote marked as accepted.`);
      }

      if (dontAskCheckbox) {
        localStorage.setItem('maker_dont_ask_convert_to_job', wantsJob ? 'always' : 'never');
      }
    }
    setShowJobConversionPrompt(false);
    setPromptQuote(null);
  };

  const handleDownloadQuotePdf = async (q: Quote) => {
    setIsGeneratingPdf(true);
    setShowSuccessToast(`Generating PDF for Quote ${q.quoteNumber}...`);
    try {
      await downloadElementAsPdf('printable-quote-area', `Quote_${q.quoteNumber}.pdf`);
      setShowSuccessToast(`Quote ${q.quoteNumber} downloaded as PDF!`);
    } catch (e) {
      console.error('PDF export failed:', e);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Trigger starting in creation mode
  useEffect(() => {
    if (quotesStartInCreationMode) {
      setIsCreating(true);
      setCreationStep(1);
      setLineItems([]);
      setHasQuoteDiscount(false);
      setQuoteDiscountVal(0);
      setCustomQuoteNumber(`QT-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(3, '0')}`);
      setCustomerId('');
      setCreatingCustomStyle(undefined);
      setQuoteTemplate('artisan-warm');
      onResetQuotesStartInCreationMode?.();
    }
  }, [quotesStartInCreationMode, customers, quotes.length]);

  // Sync customQuoteNumber with autoQuoteNumber when entering creating mode
  useEffect(() => {
    if (isCreating && !customQuoteNumber) {
      setCustomQuoteNumber(autoQuoteNumber);
    } else if (!isCreating) {
      setCustomQuoteNumber('');
    }
  }, [isCreating, autoQuoteNumber]);

  const selectedQuote = quotes.find(q => q.id === selectedQuoteId);

  const formatZAR = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
  };

  // Helper: calculate tier unit price based on qty breaks schedule
  const getTierUnitPrice = (product: Product, quantity: number): number => {
    const matchedBreak = product.priceBreaks.find(
      b => quantity >= b.minQty && (b.maxQty === undefined || quantity <= b.maxQty)
    );
    return matchedBreak ? matchedBreak.unitPrice : product.basePrice;
  };

  // Calculate sum total of a single item block
  const calculateItemBlockTotal = (
    baseUnitPrice: number, 
    qty: number, 
    customs: LineItemCustomizations, 
    discount?: Discount,
    taxRate?: number
  ): number => {
    const customUpliftsSum = Object.values(customs).reduce((sum, item) => sum + item.priceUplift, 0);
    let sub = (baseUnitPrice + customUpliftsSum) * qty;
    if (discount && discount.value > 0) {
      if (discount.type === 'percentage') {
        sub = sub * (1 - discount.value / 100);
      } else {
        sub = Math.max(0, sub - discount.value);
      }
    }
    if (taxRate && taxRate > 0) {
      sub = sub * (1 + taxRate / 100);
    }
    return sub;
  };

  const handleAddProduct = (product: Product) => {
    // Auto-select first customization option value for any variation or required option
    const initialCustoms: LineItemCustomizations = {};
    product.customizationOptions.forEach(opt => {
      const isVariation = opt.type !== 'extra';
      const shouldAutoSelect = opt.isRequired || isVariation;
      if (shouldAutoSelect && opt.values.length > 0) {
        initialCustoms[opt.name] = {
          value: opt.values[0].value,
          priceUplift: opt.values[0].priceUplift,
          photo: opt.values[0].photo
        };
      }
    });

    setSelectedProductToConfigure(product);
    setConfigQty(1);
    setConfigRate(getTierUnitPrice(product, 1));
    setIsRateDirty(false);
    setConfigHideImage(false);
    setConfigOverriddenTotal(null);
    setIsTotalDirty(false);
    setConfigCustoms(initialCustoms);
    setHasConfigDiscount(false);
    setConfigDiscountType('percentage');
    setConfigDiscountVal(0);
    setHasConfigTax(false);
    setConfigTaxRate(profile.isVatRegistered ? profile.vatRate : 15);
  };

  const handleAddCustomItem = () => {
    if (!customItemName.trim()) return;
    const priceNum = typeof customItemPrice === 'number' ? customItemPrice : parseFloat(String(customItemPrice).replace(',', '.')) || 0;
    const costNum = typeof customItemCost === 'number' ? customItemCost : parseFloat(String(customItemCost).replace(',', '.')) || 0;
    const qtyNum = Math.max(1, customItemQty || 1);

    const newItem: QuoteLineItem = {
      id: 'custom_' + Date.now(),
      productId: 'custom_' + Date.now(),
      productName: customItemName.trim(),
      productPhoto: '',
      productDescription: customItemDesc.trim(),
      quantity: qtyNum,
      baseUnitPrice: priceNum,
      appliedUnitPrice: priceNum,
      selectedCustomizations: {},
      total: qtyNum * priceNum,
      unitCost: costNum > 0 ? costNum : undefined
    };

    setLineItems(prev => [...prev, newItem]);
    // Reset custom item form
    setCustomItemName('');
    setCustomItemDesc('');
    setCustomItemQty(1);
    setCustomItemPrice('');
    setCustomItemCost('');
    setIsProductModalOpen(false);
  };

  const handleConfirmAddProduct = () => {
    if (!selectedProductToConfigure) return;

    // Ensure variation options with choices are populated
    const effectiveConfigCustoms = { ...configCustoms };
    selectedProductToConfigure.customizationOptions?.forEach(opt => {
      if (opt.type !== 'extra' && opt.values.length > 0 && !effectiveConfigCustoms[opt.name]) {
        effectiveConfigCustoms[opt.name] = {
          value: opt.values[0].value,
          priceUplift: opt.values[0].priceUplift,
          photo: opt.values[0].photo
        };
      }
    });

    let appliedUnitPrice = configRate;
    if (isTotalDirty && configOverriddenTotal !== null) {
      const customUpliftsSum = (Object.values(effectiveConfigCustoms) as SelectedCustomization[]).reduce(
        (sum, item) => sum + (item.priceUplift || 0),
        0
      );
      let targetPreTaxAndDiscount = configOverriddenTotal;
      if (hasConfigTax && configTaxRate > 0) {
        targetPreTaxAndDiscount = targetPreTaxAndDiscount / (1 + configTaxRate / 100);
      }
      if (hasConfigDiscount && configDiscountVal > 0) {
        if (configDiscountType === 'percentage') {
          targetPreTaxAndDiscount = targetPreTaxAndDiscount / (1 - configDiscountVal / 100);
        } else {
          targetPreTaxAndDiscount = targetPreTaxAndDiscount + configDiscountVal;
        }
      }
      appliedUnitPrice = Math.max(0, (targetPreTaxAndDiscount / configQty) - customUpliftsSum);
    }

    const itemDiscount: Discount | undefined = hasConfigDiscount && configDiscountVal > 0 
      ? { type: configDiscountType, value: configDiscountVal } 
      : undefined;

    // Filter customs and create separate line items for extras if toggled
    const mainCustoms: LineItemCustomizations = {};
    const separateItemsToAdd: Omit<QuoteLineItem, 'id' | 'total'>[] = [];

    Object.entries(effectiveConfigCustoms).forEach(([optName, cVal]) => {
      const isSeparate = extrasAsSeparate[optName];
      const cValTyped = cVal as SelectedCustomization;
      if (isSeparate) {
        separateItemsToAdd.push({
          productId: `extra_${selectedProductToConfigure.id}_${optName}`,
          productName: `${selectedProductToConfigure.name} - ${optName}: ${cValTyped.value}`,
          productPhoto: cValTyped.photo || selectedProductToConfigure.photo || '',
          hideImage: configHideImage,
          productDescription: `Extra for ${selectedProductToConfigure.name}`,
          quantity: configQty,
          baseUnitPrice: cValTyped.priceUplift,
          appliedUnitPrice: cValTyped.priceUplift,
          selectedCustomizations: {} as LineItemCustomizations,
          itemDiscount: undefined
        });
      } else {
        mainCustoms[optName] = cValTyped;
      }
    });

    // Determine photo for main product (prefer chosen variation image if available)
    let chosenVarPhoto = '';
    Object.entries(mainCustoms).forEach(([optName, cVal]) => {
      const opt = selectedProductToConfigure.customizationOptions?.find(o => o.name === optName);
      if (opt && opt.type !== 'extra' && cVal.photo) {
        chosenVarPhoto = cVal.photo;
      }
    });
    const mainPhoto = chosenVarPhoto || selectedProductToConfigure.photo || '';

    const lineItemTaxRate = hasConfigTax ? configTaxRate : undefined;

    if (editingLineItemIndex !== null) {
      setLineItems(prev => {
        const nextItems = prev.map((item, idx) => {
          if (idx !== editingLineItemIndex) return item;
          return {
            ...item,
            productPhoto: mainPhoto,
            hideImage: configHideImage,
            quantity: configQty,
            appliedUnitPrice,
            selectedCustomizations: mainCustoms,
            itemDiscount,
            taxRate: lineItemTaxRate
          };
        });
        return [...nextItems, ...separateItemsToAdd];
      });
      setEditingLineItemIndex(null);
    } else {
      const newItem: Omit<QuoteLineItem, 'id' | 'total'> = {
        productId: selectedProductToConfigure.id,
        productName: selectedProductToConfigure.name,
        productPhoto: mainPhoto,
        hideImage: configHideImage,
        productDescription: selectedProductToConfigure.description,
        quantity: configQty,
        baseUnitPrice: selectedProductToConfigure.basePrice,
        appliedUnitPrice,
        selectedCustomizations: mainCustoms,
        itemDiscount,
        taxRate: lineItemTaxRate
      };
      setLineItems(prev => [...prev, newItem, ...separateItemsToAdd]);
    }
    
    // Reset and close
    setSelectedProductToConfigure(null);
    setExtrasAsSeparate({});
    setConfigHideImage(false);
    setConfigOverriddenTotal(null);
    setIsTotalDirty(false);
    setIsRateDirty(false);
    setIsProductModalOpen(false);
  };

  const handleUpdateQty = (index: number, quantity: number) => {
    const qty = Math.max(1, quantity);
    setLineItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      const product = products.find(p => p.id === item.productId) || services.find(s => s.id === item.productId);
      const appliedUnitPrice = product ? getTierUnitPrice(product, qty) : item.baseUnitPrice;
      return {
        ...item,
        quantity: qty,
        appliedUnitPrice
      };
    }));
  };

  const handleUpdateCustomization = (index: number, optName: string, value: string, priceUplift: number) => {
    setLineItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      const updatedCustomizations = { ...item.selectedCustomizations };
      if (value === '') {
        delete updatedCustomizations[optName];
      } else {
        updatedCustomizations[optName] = { value, priceUplift };
      }
      return {
        ...item,
        selectedCustomizations: updatedCustomizations
      };
    }));
  };

  const handleRemoveLineItem = (idx: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleEditQuote = (q: Quote) => {
    setEditingQuoteId(q.id);
    setCustomerId(q.customerId);
    setCustomQuoteNumber(q.quoteNumber);
    setQuoteDate(q.date || formatDateToISO(new Date()));
    setLineItems(q.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      productPhoto: item.productPhoto,
      hideImage: item.hideImage,
      productDescription: item.productDescription,
      quantity: item.quantity,
      baseUnitPrice: item.baseUnitPrice,
      appliedUnitPrice: item.appliedUnitPrice,
      selectedCustomizations: item.selectedCustomizations || {},
      itemDiscount: item.itemDiscount,
      taxRate: item.taxRate,
    })));
    setHasQuoteDiscount(q.hasDiscount);
    setQuoteDiscountType(q.discount?.type || 'percentage');
    setQuoteDiscountVal(q.discount?.value || 0);
    setHasQuoteTax(!!q.hasTax);
    setQuoteTaxRate(q.taxRate || (profile.isVatRegistered ? profile.vatRate : 15));
    setQuoteNotes(q.notes || '');
    setSignOffMessage(q.signOffMessage || '');
    setQuoteTemplate(q.templateId || 'artisan-warm');
    setCreatingCustomStyle(q.templateCustomStyle);
    if (q.expiryDate) {
      setCustomExpiryDate(q.expiryDate);
    } else {
      setCustomExpiryDate(addDays(30, q.date));
      setExpiryDays(30);
    }
    setIsCreating(true);
    setCreationStep(1);
  };

  const handleSaveQuote = (e: React.FormEvent) => {
    e.preventDefault();
    handleActionOnQuote('send');
  };

  const handleActionOnQuote = (action: 'download' | 'send' | 'mark_sent' | 'draft') => {
    if (!customerId || lineItems.length === 0) return;

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    // Compile line items with accurate total calculations
    const finalItems: QuoteLineItem[] = lineItems.map((item, idx) => {
      const lineItemTotal = calculateItemBlockTotal(
        item.appliedUnitPrice,
        item.quantity,
        item.selectedCustomizations,
        item.itemDiscount,
        item.taxRate
      );
      return {
        ...item,
        id: `qi_comp_${Date.now()}_${idx}`,
        total: lineItemTotal
      } as QuoteLineItem;
    });

    // Calculate sum before quote-level discount
    const subtotal = finalItems.reduce((sum, item) => sum + item.total, 0);

    const quoteDiscount: Discount = {
      type: quoteDiscountType,
      value: hasQuoteDiscount ? quoteDiscountVal : 0
    };

    const discountAmount = hasQuoteDiscount && quoteDiscountVal > 0
      ? (quoteDiscountType === 'percentage' ? subtotal * (quoteDiscountVal / 100) : quoteDiscountVal)
      : 0;

    const taxableAmount = Math.max(0, subtotal - discountAmount);

    const calculatedTaxAmount = hasQuoteTax && quoteTaxRate > 0
      ? taxableAmount * (quoteTaxRate / 100)
      : 0;

    const selectedPreset = fulfillmentPresets.find(p => p.id === selectedFulfillmentPresetId);
    const fulfillmentPrice = selectedPreset ? (selectedPreset.isVariable ? enteredFulfillmentPrice : selectedPreset.price) : 0;

    const finalTotal = taxableAmount + calculatedTaxAmount + fulfillmentPrice;

    const dateIssuedStr = quoteDate || formatDateToISO(new Date());
    const expiryDateStr = customExpiryDate || addDays(30, dateIssuedStr);

    const targetStatus: Quote['status'] = action === 'draft' ? 'draft' : 'sent';

    const newQuotePayload = {
      customerId,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      customerIsBusiness: customer.isBusiness,
      customerContactPerson: customer.contactPerson,
      customerVatNumber: customer.vatNumber,
      customerCompanyRegNumber: customer.companyRegistrationNumber,
      customerBillingAddress: customer.billingAddress || customer.address,
      customerShippingAddress: customer.shippingAddress || customer.billingAddress || customer.address,
      date: dateIssuedStr,
      expiryDate: expiryDateStr,
      items: finalItems,
      discount: quoteDiscount,
      hasDiscount: hasQuoteDiscount && quoteDiscountVal > 0,
      hasTax: hasQuoteTax,
      taxRate: hasQuoteTax ? quoteTaxRate : 0,
      taxAmount: hasQuoteTax ? parseFloat(calculatedTaxAmount.toFixed(2)) : 0,
      notes: quoteNotes,
      signOffMessage: signOffMessage.trim(),
      status: targetStatus,
      templateId: quoteTemplate,
      templateCustomStyle: creatingCustomStyle,
      totalAmount: parseFloat(finalTotal.toFixed(2)),
      quoteNumber: customQuoteNumber.trim() || autoQuoteNumber,
      fulfillmentType: selectedPreset?.type,
      fulfillmentLabel: selectedPreset?.label,
      fulfillmentPrice: fulfillmentPrice,
      fulfillmentAddress: selectedPreset?.type === 'delivery'
        ? (useCustomerAddress ? customer.address : customFulfillmentAddress)
        : undefined,
      useCustomerAddressForDelivery: selectedPreset?.type === 'delivery' ? useCustomerAddress : undefined,
    };

    let savedQ: Quote;
    if (editingQuoteId && onUpdateQuote) {
      savedQ = onUpdateQuote({
        ...newQuotePayload,
        id: editingQuoteId,
      });
    } else {
      savedQ = onCreateQuote(newQuotePayload);
    }
    setIsCreating(false);
    setEditingQuoteId(null);
    setSelectedQuoteId(savedQ.id);

    // Action feedback
    if (action === 'draft') {
      setShowSuccessToast("Quote saved as draft!");
    } else if (action === 'download') {
      setShowSuccessToast("Generating high-resolution Quote PDF...");
      setTimeout(() => {
        downloadElementAsPdf('printable-quote-area', `Quote_${savedQ.quoteNumber}.pdf`);
      }, 400);
    } else if (action === 'send') {
      setSentQuoteData(savedQ);
      setShowSendNotification(true);
      setNotificationEmail(customer.email);
    } else if (action === 'mark_sent') {
      setShowSuccessToast("Quote marked as sent and saved in ledger!");
    }
  };

  const filteredQuotes = quotes.filter(q => {
    const matchesSearch = q.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          q.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' ? true :
                          statusFilter === 'Drafts' ? q.status === 'draft' :
                          q.status === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const itemsSubtotal = lineItems.reduce((sum, item) => {
    const lineItemTotal = calculateItemBlockTotal(
      item.appliedUnitPrice,
      item.quantity,
      item.selectedCustomizations,
      item.itemDiscount,
      item.taxRate
    );
    return sum + lineItemTotal;
  }, 0);

  const discountAmount = hasQuoteDiscount && quoteDiscountVal > 0
    ? (quoteDiscountType === 'percentage' ? itemsSubtotal * (quoteDiscountVal / 100) : quoteDiscountVal)
    : 0;

  const taxableAmount = Math.max(0, itemsSubtotal - discountAmount);

  const calculatedTaxAmount = hasQuoteTax && quoteTaxRate > 0
    ? taxableAmount * (quoteTaxRate / 100)
    : 0;

  const selectedPreset = fulfillmentPresets.find(p => p.id === selectedFulfillmentPresetId);
  const fulfillmentPrice = selectedPreset ? (selectedPreset.isVariable ? enteredFulfillmentPrice : selectedPreset.price) : 0;

  const finalQuoteTotal = taxableAmount + calculatedTaxAmount + fulfillmentPrice;

  const selectedCustomer = customers.find(c => c.id === customerId);

  return (
    <div className="space-y-6 pb-12" id="quotes-tab-view">
      {/* Upper toggle panel */}
      {!isCreating && !selectedQuoteId && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
          <h2 className="text-lg font-bold text-stone-800">Quotes</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-stone-400" size={14} />
              <input
                type="text"
                placeholder="Search quotes by number or buyer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
              />
            </div>
            <button
              onClick={() => {
                setEditingQuoteId(null);
                setIsCreating(true);
                setCreationStep(1);
                setCustomerId('');
                setLineItems([]);
                setHasQuoteDiscount(false);
                setQuoteDiscountVal(0);
              }}
              className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition shrink-0"
            >
              <PlusCircle size={14} /> Create New Quote
            </button>
          </div>
        </div>
      )}

      {/* CREATION VIEW */}
      {isCreating && (
        <form onSubmit={handleSaveQuote} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <h3 className="font-extrabold text-stone-800 text-lg">Create New Quote</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-stone-400 hover:text-stone-600 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {creationStep === 1 && (
            <div className="space-y-6 animate-fadeIn">
              {/* Quote Number, Issue Date, and Expiry Date with DatePicker Shortcuts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                    Quote Number <span className="text-amber-700">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customQuoteNumber}
                    onChange={e => setCustomQuoteNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs sm:text-sm font-medium"
                    placeholder="e.g. QT-2026-001"
                  />
                </div>

                <DatePickerWithShortcuts
                  id="quote-issue-date"
                  label="Quote Issued Date"
                  value={quoteDate}
                  onChange={(newDate) => {
                    setQuoteDate(newDate);
                    // Adjust expiry date if expiry is before the new issued date
                    if (customExpiryDate && customExpiryDate < newDate) {
                      setCustomExpiryDate(addDays(30, newDate));
                    }
                  }}
                  type="issue"
                  required
                />

                <DatePickerWithShortcuts
                  id="quote-expiry-date"
                  label="Quote Expiry Date"
                  value={customExpiryDate || addDays(30, quoteDate)}
                  baseDateForShortcuts={quoteDate}
                  onChange={(newDate) => {
                    setCustomExpiryDate(newDate);
                  }}
                  min={quoteDate}
                  type="expiry"
                  required
                />
              </div>

              {/* Customer search and selection */}
              <div className="relative space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider">
                    Customer <span className="text-amber-700">*</span>
                  </label>
                  {selectedCustomer && (
                    <button
                      type="button"
                      onClick={() => handleOpenCustomerModal(selectedCustomer)}
                      className="text-[11px] text-amber-700 hover:text-amber-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Edit2 size={11} /> Edit Customer Details
                    </button>
                  )}
                </div>
                <div className="relative">
                  {/* Selection Box / Input Trigger */}
                  <div className="relative flex items-center">
                    <Search className="absolute left-3 text-stone-400" size={14} />
                    <input
                      type="text"
                      placeholder="Search or select customer..."
                      value={isCustomerDropdownOpen ? customerSearchQuery : (selectedCustomer ? selectedCustomer.name : '')}
                      onFocus={() => {
                        setIsCustomerDropdownOpen(true);
                        setCustomerSearchQuery('');
                      }}
                      onChange={e => {
                        setCustomerSearchQuery(e.target.value);
                        setIsCustomerDropdownOpen(true);
                      }}
                      className="w-full pl-9 pr-24 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs sm:text-sm font-normal"
                    />
                    <div className="absolute right-2 flex items-center gap-1.5">
                      {selectedCustomer && (
                        <button
                          type="button"
                          onClick={() => {
                            handleOpenCustomerModal(selectedCustomer);
                          }}
                          className="text-[10px] text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/40 px-2 py-0.5 rounded font-extrabold cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                        className="text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Dropdown Menu */}
                  {isCustomerDropdownOpen && (
                    <>
                      {/* Invisible backdrop to close the dropdown */}
                      <div className="fixed inset-0 z-10" onClick={() => setIsCustomerDropdownOpen(false)}></div>
                      
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-20 max-h-60 overflow-y-auto divide-y divide-stone-100 p-1">
                        {/* Quick Add Button inside Dropdown */}
                        <div className="p-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomerDropdownOpen(false);
                              handleOpenCustomerModal(null);
                            }}
                            className="w-full flex items-center justify-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 border border-dashed border-amber-200 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer"
                          >
                            <PlusCircle size={12} /> Add new customer
                          </button>
                        </div>

                        {/* Search Filtered Customers */}
                        {(() => {
                          const filtered = customers.filter(c =>
                            c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                            c.email.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                            c.phone.includes(customerSearchQuery)
                          );

                          if (filtered.length === 0) {
                            return (
                              <div className="p-4 text-center text-xs text-stone-400 italic">
                                No customer found for "{customerSearchQuery}"
                              </div>
                            );
                          }

                          return filtered.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setCustomerId(c.id);
                                setIsCustomerDropdownOpen(false);
                              }}
                              className={`w-full text-left p-2 rounded-lg text-xs transition flex justify-between items-center cursor-pointer ${
                                c.id === customerId ? 'bg-amber-50/50 text-amber-950 font-bold' : 'hover:bg-stone-50 text-stone-700'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="block truncate font-semibold text-left">{c.name}</span>
                                  {c.isBusiness && (
                                    <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-bold uppercase shrink-0">
                                      Business
                                    </span>
                                  )}
                                </div>
                                <span className="block text-[10px] text-stone-400 font-normal truncate text-left">{c.email || 'No email'}</span>
                              </div>
                            </button>
                          ));
                        })()}
                      </div>
                    </>
                  )}
                </div>

                {/* Selected Customer Informational Snapshot Card */}
                {selectedCustomer && (
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-xs space-y-2 animate-fadeIn">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-800">{selectedCustomer.name}</span>
                        {selectedCustomer.isBusiness ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                            Registered Business
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium bg-stone-200 text-stone-700 px-2 py-0.5 rounded-full">
                            Individual Customer
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-500 font-medium">
                        {selectedCustomer.phone && <span className="mr-3">📞 {selectedCustomer.phone}</span>}
                        {selectedCustomer.email && <span>✉️ {selectedCustomer.email}</span>}
                      </div>
                    </div>

                    {/* Business VAT / Reg details if present */}
                    {selectedCustomer.isBusiness && (selectedCustomer.contactPerson || selectedCustomer.vatNumber || selectedCustomer.companyRegistrationNumber) && (
                      <div className="flex flex-wrap gap-4 text-[11px] bg-white p-2 rounded-lg border border-stone-200/60 font-mono text-stone-700">
                        {selectedCustomer.contactPerson && (
                          <div>
                            <span className="font-sans font-bold text-stone-500 uppercase text-[9px] block">Contact Person:</span>
                            <span className="font-sans font-semibold text-stone-800">{selectedCustomer.contactPerson}</span>
                          </div>
                        )}
                        {selectedCustomer.companyRegistrationNumber && (
                          <div>
                            <span className="font-sans font-bold text-stone-500 uppercase text-[9px] block">Company Reg No:</span>
                            {selectedCustomer.companyRegistrationNumber}
                          </div>
                        )}
                        {selectedCustomer.vatNumber && (
                          <div>
                            <span className="font-sans font-bold text-stone-500 uppercase text-[9px] block">Customer VAT No:</span>
                            {selectedCustomer.vatNumber}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Addresses */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-stone-600 pt-1 border-t border-stone-200/50">
                      <div>
                        <span className="font-bold text-stone-500 text-[10px] uppercase block">Billing Address:</span>
                        <p className="line-clamp-2">{selectedCustomer.billingAddress || selectedCustomer.address || 'No billing address provided'}</p>
                      </div>
                      <div>
                        <span className="font-bold text-stone-500 text-[10px] uppercase block">Shipping Address:</span>
                        <p className="line-clamp-2">{selectedCustomer.shippingAddress || selectedCustomer.billingAddress || selectedCustomer.address || 'Same as billing'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            {/* Unified Products and Line Items Section */}
            <div className="space-y-6">
              
              {/* Typical Style Quote Table/List */}
              <div className="space-y-3">
                {lineItems.length > 0 && (
                  <div className="flex justify-end animate-fadeIn">
                    <button
                      type="button"
                      onClick={() => setLineItems([])}
                      className="text-[10px] text-rose-600 hover:underline font-bold"
                    >
                      Clear All
                    </button>
                  </div>
                )}

                {lineItems.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-stone-200 bg-stone-50/20 rounded-2xl text-xs text-stone-400 italic flex flex-col items-center justify-center gap-3">
                    <div className="p-3 bg-stone-100 rounded-full text-stone-400">
                      <Layers size={22} />
                    </div>
                    <div className="space-y-0.5">
                      <span className="font-bold text-stone-700 block">No items added to quote yet</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProductModalOpen(true);
                        setModalSearchQuery('');
                      }}
                      className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all duration-150 active:scale-95"
                    >
                      <PlusCircle size={14} /> Add items
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border border-stone-200 rounded-2xl bg-white overflow-hidden shadow-sm">
                      {/* Table Headers (Hidden on Mobile, Visible on Desktop) */}
                      <div className="hidden md:grid grid-cols-12 gap-4 bg-stone-50/70 border-b border-stone-200 px-4 py-3 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                        <div className="col-span-5">Item</div>
                        <div className="col-span-2 text-right">Unit Price</div>
                        <div className="col-span-1 text-center">Quantity</div>
                        <div className="col-span-2 text-center">Discount</div>
                        <div className="col-span-2 text-right">Line Total</div>
                      </div>

                      {/* Table Rows */}
                      <div className="divide-y divide-stone-100">
                        {lineItems.map((item, idx) => {
                          const lineItemTotal = calculateItemBlockTotal(
                            item.appliedUnitPrice,
                            item.quantity,
                            item.selectedCustomizations,
                            item.itemDiscount,
                            item.taxRate
                          );
                          const customUpliftsSum = Object.values(item.selectedCustomizations || {}).reduce<number>(
                            (sum, c: any) => sum + Number(c?.priceUplift || 0),
                            0
                          );
                          const effectiveUnitPrice = item.appliedUnitPrice + customUpliftsSum;
                          const prod = products.find(p => p.id === item.productId) || services.find(s => s.id === item.productId);

                          return (
                            <div 
                              key={idx} 
                              className="p-4 hover:bg-stone-50/40 transition duration-150 animate-fadeIn"
                            >
                              {/* Responsive Layout */}
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start md:items-center">
                                
                                {/* 1. Product Details (col-span-5) */}
                                <div className="col-span-1 md:col-span-5 space-y-3">
                                  <div className="flex items-center gap-3">
                                    {item.productPhoto ? (
                                      <img 
                                        src={getProductPhotoUrl(item.productPhoto, item.productName)} 
                                        alt={item.productName} 
                                        className="w-10 h-10 object-cover rounded-xl border border-stone-100 shrink-0" 
                                        referrerPolicy="no-referrer" 
                                        onError={(e) => handleImageError(e, item.productName)}
                                      />
                                    ) : (
                                      <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center font-bold text-stone-500 text-[10px] shrink-0">
                                        Craft
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-stone-800 text-xs block truncate" title={item.productName}>
                                          {item.productName}
                                        </span>
                                        {prod && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingLineItemIndex(idx);
                                              setSelectedProductToConfigure(prod);
                                              setConfigQty(item.quantity);
                                              setConfigRate(item.appliedUnitPrice);
                                              const tierPrice = getTierUnitPrice(prod, item.quantity);
                                              setIsRateDirty(item.appliedUnitPrice !== tierPrice);
                                              setConfigHideImage(item.hideImage || false);
                                              setConfigOverriddenTotal(null);
                                              setIsTotalDirty(false);
                                              setConfigCustoms(item.selectedCustomizations);
                                              if (item.itemDiscount) {
                                                setHasConfigDiscount(true);
                                                setConfigDiscountType(item.itemDiscount.type);
                                                setConfigDiscountVal(item.itemDiscount.value);
                                              } else {
                                                setHasConfigDiscount(false);
                                                setConfigDiscountType('percentage');
                                                setConfigDiscountVal(0);
                                              }
                                              if (item.taxRate !== undefined) {
                                                setHasConfigTax(true);
                                                setConfigTaxRate(item.taxRate);
                                              } else {
                                                setHasConfigTax(false);
                                                setConfigTaxRate(profile.isVatRegistered ? profile.vatRate : 15);
                                              }
                                              setIsProductModalOpen(true);
                                            }}
                                            className="text-[9px] text-amber-700 hover:text-amber-800 hover:bg-amber-100/50 font-bold flex items-center gap-0.5 bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded-md shrink-0 cursor-pointer transition-colors"
                                            title="Edit specifications or quantity"
                                          >
                                            <Edit2 size={9} /> Edit
                                          </button>
                                        )}
                                      </div>
                                      {item.productDescription && (
                                        <span className="text-[10px] text-stone-400 font-semibold block truncate" title={item.productDescription}>
                                          {item.productDescription}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Customizations summary nested underneath details */}
                                  {prod && prod.customizationOptions.length > 0 && (
                                    <div className="pl-0 md:pl-13 space-y-1.5 mt-2">
                                      {Object.entries(item.selectedCustomizations).length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                          {Object.entries(item.selectedCustomizations).map(([optName, cVal]) => {
                                            const config = cVal as { value: string; priceUplift: number };
                                            return (
                                              <span 
                                                key={optName} 
                                                className="inline-flex items-center gap-1 text-[10px] bg-stone-100 text-stone-700 border border-stone-200/40 px-2.5 py-0.5 rounded-full font-semibold whitespace-nowrap"
                                              >
                                                <span className="text-stone-500 font-medium">{optName}:</span> {config.value}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-stone-400 font-medium italic block">
                                          Standard specifications
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* 2. Unit Price (col-span-2) */}
                                <div className="col-span-1 md:col-span-2 text-left md:text-right flex md:flex-col justify-between md:justify-center items-center md:items-end">
                                  <span className="text-[9px] md:hidden font-bold text-stone-400 uppercase tracking-wider">Unit Price</span>
                                  <div className="text-right relative">
                                    <span className="font-bold text-stone-700 text-xs block">
                                      {formatZAR(effectiveUnitPrice)}
                                    </span>
                                    {customUpliftsSum > 0 && (
                                      <span className="text-[9px] text-amber-800 font-medium block">
                                        (Base {formatZAR(item.appliedUnitPrice)} + {formatZAR(customUpliftsSum)})
                                      </span>
                                    )}
                                    {item.appliedUnitPrice < item.baseUnitPrice && (
                                      <span className="text-[9px] text-stone-500 font-medium bg-stone-100/80 border border-stone-200/50 px-1.5 py-0.5 rounded-md mt-0.5 inline-block md:absolute md:top-full md:right-0 md:mt-1 whitespace-nowrap">
                                        Bulk Pricing Applied
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* 3. Quantity (col-span-1) */}
                                <div className="col-span-1 md:col-span-1 flex md:justify-center items-center">
                                  <div className="w-full flex md:flex-col justify-between md:justify-center items-center gap-1.5">
                                    <span className="text-[9px] md:hidden font-bold text-stone-400 uppercase tracking-wider">Quantity</span>
                                    <input
                                      type="number"
                                      min={1}
                                      value={item.quantity}
                                      onChange={e => handleUpdateQty(idx, parseInt(e.target.value) || 1)}
                                      className="w-20 md:w-16 bg-stone-50 px-2 py-1 border border-stone-200 rounded-lg text-xs font-normal text-stone-800 text-center focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                    />
                                  </div>
                                </div>

                                {/* 4. Discount (col-span-2) */}
                                <div className="col-span-1 md:col-span-2 flex md:justify-center items-center">
                                  <div className="w-full flex md:flex-col justify-between md:justify-center items-center gap-1.5">
                                    <span className="text-[9px] md:hidden font-bold text-stone-400 uppercase tracking-wider">Discount</span>
                                    {item.itemDiscount && item.itemDiscount.value > 0 ? (
                                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100 animate-fadeIn">
                                        -{item.itemDiscount.type === 'percentage' ? `${item.itemDiscount.value}%` : formatZAR(item.itemDiscount.value)}
                                      </span>
                                    ) : (
                                      <span className="text-xs font-medium text-stone-400">—</span>
                                    )}
                                  </div>
                                </div>

                                {/* 5. Total & Trash Action */}
                                <div className="col-span-1 md:col-span-2 flex md:justify-end items-center gap-3">
                                  <div className="w-full md:w-auto flex md:flex-row justify-between md:justify-end items-center gap-3">
                                    <span className="text-[9px] md:hidden font-bold text-stone-400 uppercase tracking-wider">Line Total</span>
                                    <div className="flex items-center gap-3">
                                      <span className="font-extrabold text-amber-800 text-sm md:text-xs">
                                        {formatZAR(lineItemTotal)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveLineItem(idx)}
                                        className="text-stone-400 hover:text-rose-600 transition p-1 hover:bg-stone-100 rounded-lg cursor-pointer"
                                        title="Remove item"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>

                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* ADD ITEM BUTTON ABOVE TOTALS */}
                      <div className="px-5 py-3 border-t border-stone-100 flex flex-col gap-2 items-start bg-white">
                        <button
                          type="button"
                          onClick={() => {
                            setIsProductModalOpen(true);
                            setModalSearchQuery('');
                            setModalTab('products');
                          }}
                          className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all duration-150 active:scale-95 animate-fadeIn"
                        >
                          <PlusCircle size={14} /> Add items
                        </button>

                        {fulfillmentPresets.length === 0 && (
                          <div className="w-full mt-2 animate-fadeIn">
                            <button
                              type="button"
                              onClick={() => {
                                setIsFulfilmentAddModalOpen(true);
                              }}
                              className="w-full flex items-center justify-center gap-1.5 bg-amber-50/30 hover:bg-amber-50/70 text-amber-800 border border-dashed border-amber-200 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] shadow-2xs"
                            >
                              <PlusCircle size={14} className="text-amber-600" /> Add fulfilment option
                            </button>
                          </div>
                        )}
                      </div>

                      {/* IN-LINE FULFILMENT BAR */}
                      {lineItems.length > 0 && fulfillmentPresets.length > 0 && (
                        <div className="px-5 py-4 border-t border-stone-100 bg-stone-50/50 animate-fadeIn space-y-3 font-sans">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-200/40">
                            <div className="space-y-0.5 text-left">
                              <span className="text-xs font-black text-stone-800 uppercase tracking-wider block">Fulfilment</span>
                              <p className="text-[10px] text-stone-500 font-medium">Select or configure how the items will reach your customer</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsFulfilmentConfigModalOpen(true)}
                              className="text-[10px] font-extrabold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100/60 border border-amber-200/40 px-2.5 py-1 rounded-lg transition cursor-pointer self-start sm:self-auto"
                            >
                              Configure Options
                            </button>
                          </div>

                          {/* Inline options selector */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start text-left">
                            <div className="w-full">
                              <select
                                value={selectedFulfillmentPresetId}
                                onChange={e => {
                                  const targetId = e.target.value;
                                  setSelectedFulfillmentPresetId(targetId);
                                  const preset = fulfillmentPresets.find(p => p.id === targetId);
                                  if (preset) {
                                    setFulfillmentType(preset.type);
                                    setEnteredFulfillmentPrice(0);
                                  } else {
                                    setFulfillmentType(undefined);
                                    setEnteredFulfillmentPrice(0);
                                  }
                                }}
                                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                              >
                                <option value="">Select Option...</option>
                                {fulfillmentPresets.map(preset => {
                                  const methodStr = preset.type === 'collection' ? 'Collection' : 'Delivery';
                                  const labelStr = preset.label ? `: ${preset.label}` : '';
                                  const priceStr = preset.isVariable ? '' : ` — ${preset.price === 0 ? 'Free' : formatZAR(preset.price)}`;
                                  return (
                                    <option key={preset.id} value={preset.id}>
                                      {methodStr}{labelStr}{priceStr}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            {selectedPreset?.isVariable && (
                              <div className="space-y-1 animate-fadeIn text-left">
                                <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider animate-fadeIn">Enter Fulfilment Cost</label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-500">R</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={enteredFulfillmentPrice || ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setEnteredFulfillmentPrice(parseFloat(val.replace(',', '.')) || 0);
                                    }}
                                    className="w-full pl-7 pr-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Address Options (if delivery) */}
                          {selectedPreset?.type === 'delivery' && (
                            <div className="space-y-2 animate-fadeIn border-t border-stone-100 pt-3 text-left">
                              <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider">Delivery Address Option</label>
                              <div className="flex gap-4">
                                <label className="flex items-center gap-1.5 text-xs text-stone-750 font-bold cursor-pointer">
                                  <input
                                    type="radio"
                                    name="addressOption"
                                    checked={useCustomerAddress}
                                    onChange={() => setUseCustomerAddress(true)}
                                    className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                                  />
                                  <span>Use customer address</span>
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-stone-750 font-bold cursor-pointer">
                                  <input
                                    type="radio"
                                    name="addressOption"
                                    checked={!useCustomerAddress}
                                    onChange={() => setUseCustomerAddress(false)}
                                    className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                                  />
                                  <span>Specify different address</span>
                                </label>
                              </div>

                              {useCustomerAddress && (
                                <div className="bg-stone-100/50 p-2.5 rounded-lg border border-stone-200/40 text-xs text-stone-700 animate-fadeIn max-w-xl text-left">
                                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block mb-0.5">Customer Address:</span>
                                  <span className="font-semibold">{selectedCustomer?.address || 'No physical address stored for this customer.'}</span>
                                </div>
                              )}

                              {!useCustomerAddress && (
                                <div className="bg-stone-100/40 p-3 rounded-xl border border-stone-200/40 space-y-2.5 animate-fadeIn max-w-xl text-left">
                                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block">Specify Different Address</span>
                                  <div className="space-y-2">
                                    <div>
                                      <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">Street Address</label>
                                      <input
                                        type="text"
                                        required={!useCustomerAddress}
                                        placeholder="e.g. 123 Maker Street"
                                        value={addrLine}
                                        onChange={e => setAddrLine(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">City</label>
                                        <input
                                          type="text"
                                          required={!useCustomerAddress}
                                          placeholder="e.g. Cape Town"
                                          value={addrCity}
                                          onChange={e => setAddrCity(e.target.value)}
                                          className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">Province</label>
                                        <input
                                          type="text"
                                          required={!useCustomerAddress}
                                          placeholder="e.g. Western Cape"
                                          value={addrProvince}
                                          onChange={e => setAddrProvince(e.target.value)}
                                          className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                                        />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">Postal Code</label>
                                        <input
                                          type="text"
                                          required={!useCustomerAddress}
                                          placeholder="e.g. 8001"
                                          value={addrPostalCode}
                                          onChange={e => setAddrPostalCode(e.target.value)}
                                          className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">Country</label>
                                        <input
                                          type="text"
                                          required={!useCustomerAddress}
                                          placeholder="e.g. South Africa"
                                          value={addrCountry}
                                          onChange={e => setAddrCountry(e.target.value)}
                                          className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Selected Fulfilment Option Cost Aligned Under Line Total Column for larger screens */}
                          {selectedPreset && (
                            <div className="hidden md:grid grid-cols-12 gap-4 pt-3 border-t border-stone-200/40 text-xs animate-fadeIn items-center">
                              <div className="col-span-10 text-right font-semibold text-stone-500">
                                Fulfilment ({selectedPreset.label || (selectedPreset.type === 'collection' ? 'Collection' : 'Delivery')}):
                              </div>
                              <div className="col-span-2 flex justify-end items-center gap-3">
                                <span className="font-extrabold text-stone-700 text-xs">
                                  {fulfillmentPrice === 0 ? 'Free' : formatZAR(fulfillmentPrice)}
                                </span>
                                <div className="w-[22px]" /> {/* Spacer to align with delete trash button of line items */}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Summary Block: Total of items, Add discount, Add tax options */}
                      <div className="bg-stone-50/50 p-4 border-t border-stone-100 flex justify-end">
                        {/* Calculations Summary */}
                        <div className="space-y-2.5 text-right font-medium text-xs text-stone-600 min-w-[240px]">
                          <div className="flex justify-between items-center text-stone-500">
                            <span>Items Total:</span>
                            <span className="font-bold text-stone-700">{formatZAR(itemsSubtotal)}</span>
                          </div>

                          {selectedPreset && (
                            <div className="flex justify-between items-center text-stone-600">
                              <span className="font-semibold text-stone-500">
                                {selectedPreset.type === 'collection' ? 'Collection:' : 'Delivery:'} {selectedPreset.label}
                              </span>
                              <span className="font-bold text-stone-700">
                                {fulfillmentPrice === 0 ? 'Free (R0)' : formatZAR(fulfillmentPrice)}
                              </span>
                            </div>
                          )}

                          {/* Discount Section (Always below Fulfilment) */}
                          {hasQuoteDiscount ? (
                            <div className="flex justify-between items-center text-stone-600 animate-fadeIn">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHasQuoteDiscount(false);
                                    setQuoteDiscountVal(0);
                                  }}
                                  className="text-stone-400 hover:text-red-600 font-bold px-1 text-xs cursor-pointer mr-0.5"
                                  title="Remove discount"
                                >
                                  ×
                                </button>
                                <span className="font-semibold text-stone-500">Discount:</span>
                                <select
                                  value={quoteDiscountType}
                                  onChange={e => setQuoteDiscountType(e.target.value as 'percentage' | 'fixed')}
                                  className="bg-transparent border-0 text-stone-700 font-normal p-0 text-[11px] focus:ring-0 focus:outline-none shrink-0 cursor-pointer"
                                >
                                  <option value="percentage">%</option>
                                  <option value="fixed">R</option>
                                </select>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={quoteDiscountVal || ''}
                                  onChange={e => setQuoteDiscountVal(parseFloat(e.target.value.replace(',', '.')) || 0)}
                                  placeholder="0"
                                  className="w-10 bg-white px-1 py-0.5 border border-stone-200 rounded font-normal text-stone-700 text-center text-[10px] focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                              <span className="font-bold text-amber-800">
                                -{formatZAR(discountAmount)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-end py-0.5 animate-fadeIn">
                              <button
                                type="button"
                                onClick={() => setHasQuoteDiscount(true)}
                                className="text-[10px] font-extrabold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100/60 border border-amber-200/40 px-2.5 py-1 rounded-lg transition cursor-pointer"
                              >
                                + Add discount
                              </button>
                            </div>
                          )}

                          {/* Tax Section (Always Below Discount) */}
                          {hasQuoteTax ? (
                            <div className="flex justify-between items-center text-stone-600 animate-fadeIn">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setHasQuoteTax(false)}
                                  className="text-stone-400 hover:text-red-600 font-bold px-1 text-xs cursor-pointer mr-0.5"
                                  title="Remove tax"
                                >
                                  ×
                                </button>
                                <span className="font-semibold text-stone-500">Tax:</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={quoteTaxRate || ''}
                                  onChange={e => setQuoteTaxRate(parseFloat(e.target.value.replace(',', '.')) || 0)}
                                  placeholder="15"
                                  className="w-10 bg-white px-1 py-0.5 border border-stone-200 rounded font-normal text-stone-700 text-center text-[10px] focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                                <span className="text-[10px] text-stone-500">%</span>
                              </div>
                              <span className="font-bold text-stone-700">
                                {formatZAR(calculatedTaxAmount)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-end py-0.5 animate-fadeIn">
                              <button
                                type="button"
                                onClick={() => setHasQuoteTax(true)}
                                className="text-[10px] font-extrabold text-stone-600 hover:text-stone-800 bg-stone-100/50 hover:bg-stone-100 border border-stone-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                              >
                                + Add tax
                              </button>
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-1.5 border-t border-stone-200 text-stone-800 font-bold">
                            <span className="text-xs">Final Quote Total:</span>
                            <span className="text-sm text-amber-800 font-black">{formatZAR(finalQuoteTotal)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Notes / Terms of Trade</label>
                    <textarea
                      rows={2}
                      value={quoteNotes}
                      onChange={e => setQuoteNotes(e.target.value)}
                      placeholder="Notes / Terms of Trade"
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-sm"
                    />
                  </div>

                  {/* Sign-off Message */}
                  <div>
                    <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Custom Sign-off Message</label>
                    <input
                      type="text"
                      value={signOffMessage}
                      onChange={e => setSignOffMessage(e.target.value)}
                      placeholder="Custom Sign-off Message"
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-sm"
                    />
                  </div>

                  {/* Banking & Settlement Details Card on Creation Screen */}
                  <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Landmark size={15} className="text-amber-700" />
                        <span className="font-bold text-xs uppercase tracking-wider text-amber-950">
                          Bank & Settlement Details (Appears on Quote)
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-700 font-semibold bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200/60">
                        From Business Profile
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-stone-700 pt-1">
                      <div>
                        <span className="text-[10px] font-bold text-stone-500 uppercase block">Bank</span>
                        <span className="font-semibold text-stone-800">{profile.bankingDetails.bankName || 'Not Set'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-stone-500 uppercase block">Account No.</span>
                        <span className="font-mono font-semibold text-stone-800">{profile.bankingDetails.accountNumber || 'Not Set'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-stone-500 uppercase block">Branch Code</span>
                        <span className="font-mono font-semibold text-stone-800">{profile.bankingDetails.branchCode || 'Not Set'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-stone-500 uppercase block">Account Type</span>
                        <span className="font-semibold text-stone-800">{profile.bankingDetails.accountType || 'Cheque / Current'}</span>
                      </div>
                    </div>
                  </div>

                  {/* INTERNAL FINANCIALS SECTION (COSTS & PROFITS) ON NEW QUOTE CREATION SCREEN */}
                  {lineItems.length > 0 && (
                    <InternalQuoteFinancials
                      items={lineItems.map((item, idx) => ({
                        id: `item_${idx}`,
                        productId: item.productId,
                        productName: item.productName,
                        productDescription: item.productDescription,
                        quantity: item.quantity,
                        appliedUnitPrice: item.appliedUnitPrice,
                        selectedCustomizations: item.selectedCustomizations,
                        itemDiscount: item.itemDiscount,
                        total: calculateItemBlockTotal(
                          item.appliedUnitPrice,
                          item.quantity,
                          item.selectedCustomizations,
                          item.itemDiscount
                        ),
                        productPhoto: item.productPhoto,
                      }))}
                      products={products}
                      materials={materials}
                      onEditProductInCatalogue={onEditProductInCatalogue}
                      onAddNewProductInCatalogue={onAddNewProductInCatalogue}
                      quoteTotalAmount={finalQuoteTotal}
                    />
                  )}

                  {/* Step 1 Action Footer */}
                  <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="bg-stone-100 hover:bg-stone-200 text-stone-600 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleActionOnQuote('draft')}
                      disabled={!customerId || lineItems.length === 0}
                      className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold border border-stone-200/80 px-4 py-2 rounded-xl text-xs transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      <Save size={14} className="text-stone-500" />
                      <span>Save Draft</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (customerId && lineItems.length > 0) {
                          setCreationStep(2);
                        }
                      }}
                      disabled={!customerId || lineItems.length === 0}
                      className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      Continue <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

            {creationStep === 2 && (() => {
              const previewCustomer = customers.find(c => c.id === customerId);
              const previewItems: QuoteLineItem[] = lineItems.map((item, idx) => {
                const lineItemTotal = calculateItemBlockTotal(
                  item.appliedUnitPrice,
                  item.quantity,
                  item.selectedCustomizations,
                  item.itemDiscount,
                  item.taxRate
                );
                return {
                  ...item,
                  id: `preview_comp_${idx}`,
                  total: lineItemTotal
                } as QuoteLineItem;
              });

              const previewSubtotal = previewItems.reduce((sum, item) => sum + item.total, 0);
              const previewDiscountAmount = hasQuoteDiscount && quoteDiscountVal > 0
                ? (quoteDiscountType === 'percentage' ? previewSubtotal * (quoteDiscountVal / 100) : quoteDiscountVal)
                : 0;
              const previewTaxableAmount = Math.max(0, previewSubtotal - previewDiscountAmount);
              const previewTaxAmount = hasQuoteTax && quoteTaxRate > 0
                ? previewTaxableAmount * (quoteTaxRate / 100)
                : 0;
              const previewPreset = fulfillmentPresets.find(p => p.id === selectedFulfillmentPresetId);
              const previewFulfillmentPrice = previewPreset ? (previewPreset.isVariable ? enteredFulfillmentPrice : previewPreset.price) : 0;
              const previewFulfillmentAddress = previewPreset?.type === 'delivery'
                ? (useCustomerAddress ? previewCustomer?.address : customFulfillmentAddress)
                : undefined;
              const previewTotal = previewTaxableAmount + previewTaxAmount + previewFulfillmentPrice;

              const todayStr = new Date().toISOString().split('T')[0];
              const expiryDateStr = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              const quoteNo = customQuoteNumber.trim() || autoQuoteNumber;

              return (
                <div className="space-y-6 animate-fadeIn">
                  {/* TOP PANEL: Controls, Styles & Actions */}
                  <div className="bg-white p-5 md:p-6 rounded-2xl border border-stone-200/80 shadow-xs space-y-5">
                    {/* First Row: Step Navigation & Publisher Actions */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-100">
                      {/* Left: Navigation and Step label */}
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setCreationStep(1)}
                          className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-xl text-xs font-bold transition border border-stone-200/50 cursor-pointer flex items-center gap-1.5"
                        >
                          <ArrowRight size={14} className="rotate-180" /> Back
                        </button>
                        <div className="h-4 w-px bg-stone-200 hidden sm:block mx-1" />
                        <div className="hidden sm:block">
                          <span className="text-[10px] font-extrabold uppercase text-stone-400 tracking-wider">Step 2 of 2</span>
                          <h4 className="text-xs font-black text-stone-800">Review & Publish</h4>
                        </div>
                      </div>

                      {/* Right: Publish action buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Save Draft Option */}
                        <button
                          type="button"
                          onClick={() => handleActionOnQuote('draft')}
                          className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border border-stone-300/40"
                        >
                          <Save size={14} className="text-stone-500" />
                          <span>Save as Draft</span>
                        </button>

                        {/* Download option */}
                        <button
                          type="button"
                          onClick={() => handleActionOnQuote('download')}
                          className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border border-stone-300/40"
                        >
                          <Download size={14} className="text-stone-500" />
                          <span>Download</span>
                        </button>

                        {/* Mark as Sent Option */}
                        <button
                          type="button"
                          onClick={() => handleActionOnQuote('mark_sent')}
                          className="flex items-center gap-2 bg-stone-800 hover:bg-stone-900 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          <Check size={14} />
                          <span>Mark as Sent</span>
                        </button>

                        {/* Send Option */}
                        <button
                          type="button"
                          onClick={() => handleActionOnQuote('send')}
                          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          <Mail size={14} />
                          <span>Send quote</span>
                        </button>
                      </div>
                    </div>

                    {/* Second Row: Theme / Style Selection */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-extrabold text-stone-700 uppercase tracking-wider">Document Template & Style</span>
                          <span className="text-[10px] text-stone-400 block mt-0.5 font-medium">Click card to select or remix a document layout in the Gallery</span>
                        </div>
                        <span className="text-[9px] bg-amber-50 text-amber-800 font-extrabold px-2 py-0.5 rounded border border-amber-200/50 uppercase tracking-wider">Live Preview Below</span>
                      </div>

                      {/* Selected Template Display Card */}
                      <div 
                        onClick={() => setIsGalleryOpen(true)}
                        className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-3xs hover:border-amber-400 hover:shadow-xs transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-800 shrink-0 group-hover:bg-amber-100 transition shadow-3xs">
                            <Palette size={20} />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-stone-900 truncate">
                                {resolveQuoteTemplate(quoteTemplate, creatingCustomStyle, customTemplates).name}
                              </span>
                              {creatingCustomStyle?.isCustom ? (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Custom
                                </span>
                              ) : (
                                <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-200/60 uppercase tracking-wider">
                                  {resolveQuoteTemplate(quoteTemplate, creatingCustomStyle, customTemplates).category || 'Standard'}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-stone-500 font-medium truncate mt-0.5">
                              {resolveQuoteTemplate(quoteTemplate, creatingCustomStyle, customTemplates).description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <span className="bg-stone-900 group-hover:bg-amber-800 text-white px-4 py-2 rounded-xl text-xs font-extrabold transition shadow-3xs flex items-center gap-2">
                            <Palette size={14} className="text-amber-400" />
                            <span>Select Template</span>
                            <ChevronRight size={14} className="text-stone-400 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM PANEL: Full Width Live Document Preview using DocumentRenderer */}
                  <div className="bg-white p-2 rounded-3xl border border-stone-200/80 shadow-md">
                    {(() => {
                      const activeTplStyle = resolveQuoteTemplate(
                        quoteTemplate,
                        creatingCustomStyle,
                        customTemplates
                      );

                      const createRenderItems: RenderItem[] = previewItems.map((item, idx) => {
                        const customUpliftsSum = Object.values(item.selectedCustomizations || {}).reduce((sum: number, c: any) => sum + (c?.priceUplift || 0), 0);
                        return {
                          id: `preview_${idx}`,
                          productName: item.productName,
                          productDescription: item.productDescription,
                          quantity: item.quantity,
                          unitPrice: item.appliedUnitPrice + customUpliftsSum,
                          total: item.total,
                          selectedCustomizations: item.selectedCustomizations,
                          productPhoto: item.productPhoto,
                        };
                      });

                      return (
                        <DocumentRenderer
                          documentType="quote"
                          documentNumber={quoteNo}
                          date={todayStr}
                          expiryOrDueDate={expiryDateStr}
                          profile={profile}
                          customerName={previewCustomer ? previewCustomer.name : 'Selected Customer'}
                          customerEmail={previewCustomer ? previewCustomer.email : ''}
                          customerPhone={previewCustomer ? previewCustomer.phone : ''}
                          customerAddress={previewCustomer ? previewCustomer.address : ''}
                          customerIsBusiness={previewCustomer ? previewCustomer.isBusiness : false}
                          customerContactPerson={previewCustomer ? previewCustomer.contactPerson : undefined}
                          customerVatNumber={previewCustomer ? previewCustomer.vatNumber : undefined}
                          customerCompanyRegNumber={previewCustomer ? previewCustomer.companyRegistrationNumber : undefined}
                          customerBillingAddress={previewCustomer ? (previewCustomer.billingAddress || previewCustomer.address) : undefined}
                          customerShippingAddress={previewCustomer ? (previewCustomer.shippingAddress || previewCustomer.billingAddress || previewCustomer.address) : undefined}
                          items={createRenderItems}
                          subtotal={previewSubtotal}
                          discount={{ type: quoteDiscountType, value: quoteDiscountVal }}
                          hasDiscount={hasQuoteDiscount && quoteDiscountVal > 0}
                          vatAmount={previewTaxAmount}
                          hasVat={hasQuoteTax && quoteTaxRate > 0}
                          totalAmount={previewTotal}
                          notes={quoteNotes}
                          signOffMessage={signOffMessage}
                          fulfillmentType={previewPreset?.type}
                          fulfillmentAddress={previewFulfillmentAddress}
                          templateStyle={activeTplStyle}
                        />
                      );
                    })()}
                  </div>
                </div>
              );
            })()}
          </form>
        )}

      {/* DASHBOARD LEDGER & DETAILS VIEW */}
      {!isCreating && (
        <div>
          {selectedQuoteId && selectedQuote ? (
            <div className="space-y-6">
              {/* Navigation Back Button */}
              <button
                type="button"
                onClick={() => setSelectedQuoteId(null)}
                className="flex items-center gap-1.5 text-stone-600 hover:text-stone-800 transition text-xs font-bold cursor-pointer bg-stone-100 hover:bg-stone-200 px-4 py-2 rounded-xl border border-stone-200/50"
              >
                <ArrowRight size={14} className="rotate-180" /> Back to Quotes History
              </button>

              {/* Status Bar */}
              <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-3xs flex flex-wrap gap-4 items-center justify-between print:hidden">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-bold text-stone-500">Quote status:</span>
                  
                  {/* Interactive Status Select */}
                  <div className="relative inline-block">
                    <select
                      value={selectedQuote.status}
                      onChange={(e) => {
                        const newStatus = e.target.value as Quote['status'];
                        if (newStatus === 'accepted') {
                          handleQuoteAcceptedStateTrigger(selectedQuote);
                        } else {
                          onUpdateQuoteStatus(selectedQuote.id, newStatus);
                        }
                      }}
                      className="bg-stone-50 border border-stone-200 text-stone-800 rounded-xl px-3 py-1.5 text-xs font-normal cursor-pointer hover:bg-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all uppercase tracking-wide pr-8 appearance-none"
                    >
                      <option value="draft">Draft 📝</option>
                      <option value="sent">Sent</option>
                      <option value="viewed">Viewed</option>
                      <option value="accepted">Accepted ✅</option>
                      <option value="expired">Expired</option>
                      <option value="declined">Declined ❌</option>
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-2.5 text-stone-500 pointer-events-none" />
                  </div>

                  {/* Resume Editing Draft button if quote is draft */}
                  {selectedQuote.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedQuoteId(null);
                        handleEditQuote(selectedQuote);
                      }}
                      className="text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300/60 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                    >
                      <Edit2 size={12} />
                      Resume Editing Draft
                    </button>
                  )}

                  {/* One-click Mark as Accepted button (if not already accepted) */}
                  {selectedQuote.status !== 'accepted' && (
                    <button
                      type="button"
                      onClick={() => handleQuoteAcceptedStateTrigger(selectedQuote)}
                      className="text-white bg-amber-600 hover:bg-amber-700 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-sm cursor-pointer"
                    >
                      <Check size={12} />
                      Mark as Accepted
                    </button>
                  )}

                  {/* Delete Quote button */}
                  {onDeleteQuote && (
                    <button
                      type="button"
                      onClick={() => setQuoteToDelete(selectedQuote)}
                      className="text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      title="Delete Quote"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Template Style Label */}
                  <div className="text-stone-700 bg-stone-100/80 border border-stone-200/80 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <Palette size={13} className="text-amber-600" />
                    <span>Template: <strong className="font-extrabold">{resolveQuoteTemplate(selectedQuote.templateId, selectedQuote.templateCustomStyle, customTemplates).name}</strong></span>
                  </div>

                  {/* Buyer portal portal links */}
                  <button
                    type="button"
                    onClick={() => onSelectActiveQuoteIdForBuyer(selectedQuote.id)}
                    className="text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    title="Open Simulated Buyer Page to Accept/Decline"
                  >
                    <ExternalLink size={12} />
                    Simulate Buyer Portal
                  </button>

                  {/* Download Quote PDF */}
                  <button
                    type="button"
                    onClick={() => handleDownloadQuotePdf(selectedQuote)}
                    disabled={isGeneratingPdf}
                    className="text-stone-700 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    title="Download high-resolution A4 PDF with full design styling"
                  >
                    <Download size={13} />
                    <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
                  </button>

                  {/* Print Document */}
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="text-stone-700 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    title="Print quote with full color preservation"
                  >
                    <Printer size={13} />
                    <span>Print</span>
                  </button>

                  {/* Convert to... dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsConvertDropdownOpen(!isConvertDropdownOpen)}
                      className="text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                    >
                      <FileCheck size={13} />
                      Convert to...
                      <ChevronDown size={12} className={`transition-transform duration-200 ${isConvertDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isConvertDropdownOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setIsConvertDropdownOpen(false)} 
                        />
                        <div className="absolute right-0 mt-2 w-48 bg-white border border-stone-200 rounded-xl shadow-lg p-1.5 z-50 text-left">
                          <button
                            type="button"
                            onClick={() => {
                              onConvertQuoteToInvoice(selectedQuote.id);
                              setIsConvertDropdownOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Landmark size={12} className="text-emerald-600" />
                            Invoice
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onConvertQuoteToJob(selectedQuote.id);
                              setIsConvertDropdownOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Layers size={12} className="text-amber-600" />
                            Job
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Render Document using DocumentRenderer */}
              {(() => {
                const currentStyle = resolveQuoteTemplate(
                  selectedQuote.templateId,
                  selectedQuote.templateCustomStyle,
                  customTemplates
                );

                const renderItems: RenderItem[] = selectedQuote.items.map((item, idx) => {
                  const customUpliftsSum = Object.values(item.selectedCustomizations || {}).reduce((sum: number, c: any) => sum + (c?.priceUplift || 0), 0);
                  return {
                    id: `item_${idx}`,
                    productName: item.productName,
                    productDescription: item.productDescription,
                    quantity: item.quantity,
                    unitPrice: item.appliedUnitPrice + customUpliftsSum,
                    total: item.total,
                    selectedCustomizations: item.selectedCustomizations,
                    productPhoto: item.productPhoto,
                  };
                });

                const subtotalAmt = selectedQuote.items.reduce((sum, item) => sum + item.total, 0);

                return (
                  <DocumentRenderer
                    documentType="quote"
                    documentNumber={selectedQuote.quoteNumber}
                    date={selectedQuote.date}
                    expiryOrDueDate={selectedQuote.expiryDate}
                    profile={profile}
                    customerName={selectedQuote.customerName}
                    customerEmail={selectedQuote.customerEmail}
                    customerPhone={selectedQuote.customerPhone}
                    customerAddress={selectedQuote.customerAddress}
                    customerIsBusiness={selectedQuote.customerIsBusiness}
                    customerContactPerson={selectedQuote.customerContactPerson}
                    customerVatNumber={selectedQuote.customerVatNumber}
                    customerCompanyRegNumber={selectedQuote.customerCompanyRegNumber}
                    customerBillingAddress={selectedQuote.customerBillingAddress || selectedQuote.customerAddress}
                    customerShippingAddress={selectedQuote.customerShippingAddress || selectedQuote.customerBillingAddress || selectedQuote.customerAddress}
                    items={renderItems}
                    subtotal={subtotalAmt}
                    discount={selectedQuote.discount}
                    hasDiscount={selectedQuote.hasDiscount}
                    vatAmount={selectedQuote.taxAmount}
                    hasVat={selectedQuote.hasTax}
                    totalAmount={selectedQuote.totalAmount}
                    notes={selectedQuote.notes}
                    signOffMessage={selectedQuote.signOffMessage}
                    fulfillmentType={selectedQuote.fulfillmentType}
                    fulfillmentAddress={selectedQuote.fulfillmentAddress}
                    templateStyle={currentStyle}
                    printableId="printable-quote-area"
                  />
                );
              })()}

              {/* Banking Details Banner below Document */}
              <div className="mt-4 bg-amber-50/70 p-4 rounded-2xl text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-4 border border-amber-200/50 shadow-3xs print:hidden">
                <div>
                  <span className="font-extrabold uppercase tracking-wider block mb-1.5 text-amber-900 text-xs">Payment & Settlement Details</span>
                  <div className="space-y-1 text-stone-700 font-semibold">
                    <span><strong>Bank:</strong> {profile.bankingDetails.bankName}</span><br />
                    <span><strong>Account:</strong> {profile.bankingDetails.accountNumber}</span><br />
                    <span><strong>Branch Code:</strong> {profile.bankingDetails.branchCode}</span><br />
                    <span><strong>Type:</strong> {profile.bankingDetails.accountType}</span>
                  </div>
                </div>
                <div className="sm:text-right flex flex-col justify-end">
                  <span className="font-bold uppercase tracking-wider block text-amber-800">MakerFlow Business Ledger</span>
                  <span className="opacity-75 mt-1">Supporting handmade, locally sourced South African craft.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              {/* Status Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200 shadow-3xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  {['All', 'Drafts', 'Sent', 'Viewed', 'Accepted', 'Declined'].map(cat => {
                    const count = cat === 'All' ? quotes.length :
                                  cat === 'Drafts' ? quotes.filter(q => q.status === 'draft').length :
                                  quotes.filter(q => q.status === cat.toLowerCase()).length;
                    const isActive = statusFilter === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setStatusFilter(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-amber-600 text-white shadow-3xs'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200/50'
                        }`}
                      >
                        <span>{cat}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                          isActive ? 'bg-amber-700 text-amber-100' : 'bg-stone-200 text-stone-700'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs text-stone-400 font-medium px-2">
                  Showing {filteredQuotes.length} of {quotes.length} quotes
                </span>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block bg-white rounded-2xl border border-stone-200 shadow-3xs overflow-hidden">
                {filteredQuotes.length === 0 ? (
                  <div className="p-12 text-center text-sm text-stone-400">
                    No quotes found. Create a new quote to get started!
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider">
                          <th className="py-3.5 px-5">Quote Number</th>
                          <th className="py-3.5 px-5">Customer</th>
                          <th className="py-3.5 px-5">Date Issued</th>
                          <th className="py-3.5 px-5">Valid Until</th>
                          <th className="py-3.5 px-5 text-right">Total Amount</th>
                          <th className="py-3.5 px-5 text-center">Status</th>
                          <th className="py-3.5 px-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {filteredQuotes.map((q) => (
                          <tr 
                            key={q.id}
                            onClick={() => setSelectedQuoteId(q.id)}
                            className="hover:bg-amber-50/20 transition cursor-pointer group"
                          >
                            <td className="py-4 px-5 font-bold text-amber-700">
                              {q.quoteNumber}
                            </td>
                            <td className="py-4 px-5">
                              <span className="font-semibold text-stone-800 block">{q.customerName}</span>
                              <span className="text-[10px] text-stone-400 font-medium">{q.customerEmail}</span>
                            </td>
                            <td className="py-4 px-5 text-stone-500 font-medium">
                              {formatSADate(q.date)}
                            </td>
                            <td className="py-4 px-5 text-stone-500 font-medium">
                              {formatSADate(q.expiryDate)}
                            </td>
                            <td className="py-4 px-5 text-right font-bold text-stone-900">
                              {formatZAR(q.totalAmount)}
                            </td>
                            <td className="py-4 px-5 text-center">
                              <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                q.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                q.status === 'sent' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                q.status === 'viewed' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                                q.status === 'declined' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                q.status === 'draft' ? 'bg-stone-100 text-stone-700 border border-stone-200' :
                                'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}>
                                {q.status}
                              </span>
                            </td>
                            <td className="py-4 px-5 text-right">
                              <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                                {q.status === 'draft' && (
                                  <button
                                    type="button"
                                    onClick={() => handleEditQuote(q)}
                                    className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                    title="Edit Draft"
                                  >
                                    <Edit2 size={12} />
                                    Edit
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSelectedQuoteId(q.id)}
                                  className="bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye size={12} />
                                  View
                                </button>
                                {onDeleteQuote && (
                                  <button
                                    type="button"
                                    onClick={() => setQuoteToDelete(q)}
                                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-stone-200 rounded-xl transition cursor-pointer"
                                    title="Delete Quote"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Mobile Card Stack View */}
              <div className="block md:hidden space-y-3">
                {filteredQuotes.length === 0 ? (
                  <div className="bg-stone-50 rounded-2xl border border-stone-200 p-8 text-center text-xs text-stone-400">
                    No quotes found. Create a new estimate to get started!
                  </div>
                ) : (
                  filteredQuotes.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => setSelectedQuoteId(q.id)}
                      className="p-4 rounded-2xl border border-stone-200 bg-white hover:border-amber-300 hover:bg-amber-50/10 cursor-pointer transition space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-lg">
                            {q.quoteNumber}
                          </span>
                          <h4 className="font-extrabold text-stone-800 text-sm mt-2">{q.customerName}</h4>
                          <span className="text-xs text-stone-400">{formatSADate(q.date)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-stone-900 block">{formatZAR(q.totalAmount)}</span>
                          <span className={`inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            q.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            q.status === 'sent' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                            q.status === 'viewed' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                            q.status === 'declined' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                            q.status === 'draft' ? 'bg-stone-100 text-stone-700 border border-stone-200' :
                            'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {q.status}
                          </span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                        {q.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => handleEditQuote(q)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedQuoteId(q.id)}
                          className="bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Eye size={12} /> View
                        </button>
                        {onDeleteQuote && (
                          <button
                            type="button"
                            onClick={() => setQuoteToDelete(q)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-stone-200 rounded-xl transition cursor-pointer"
                            title="Delete Quote"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SEARCHABLE PRODUCT CATALOGUE MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleIn">
            
            {selectedProductToConfigure ? (
              /* CONFIGURATION VIEW SCREEN */
              <div className="flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/50">
                  <button
                    type="button"
                    onClick={() => setSelectedProductToConfigure(null)}
                    className="flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-800 transition cursor-pointer"
                  >
                    <ArrowRight size={14} className="rotate-180" /> Back to Items
                  </button>
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                    {editingLineItemIndex !== null ? 'Edit Specifications' : 'Configure Specification'}
                  </span>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {/* Product Summary Row */}
                  {(() => {
                    let activePhoto = selectedProductToConfigure.photo;
                    // Check if any selected variation has a photo
                    if (selectedProductToConfigure.customizationOptions) {
                      for (const [optName, cVal] of Object.entries(configCustoms)) {
                        const opt = selectedProductToConfigure.customizationOptions.find(o => o.name === optName);
                        const valObj = cVal as { value: string; priceUplift: number; photo?: string } | undefined;
                        if (opt && opt.type !== 'extra' && valObj?.photo) {
                          activePhoto = valObj.photo;
                          break;
                        }
                      }
                    }

                    return (
                      <div className="space-y-3">
                        <div className="flex gap-4 p-3 bg-stone-50 rounded-xl border border-stone-200/60">
                          {activePhoto ? (
                            <img 
                              src={getProductPhotoUrl(activePhoto, selectedProductToConfigure.name)} 
                              alt={selectedProductToConfigure.name} 
                              className={`w-12 h-12 object-cover rounded-lg border border-stone-150 shrink-0 shadow-xs transition-all ${configHideImage ? 'opacity-40 grayscale' : ''}`} 
                              referrerPolicy="no-referrer" 
                              onError={(e) => handleImageError(e, selectedProductToConfigure.name)}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-stone-200 rounded-lg flex items-center justify-center font-bold text-stone-500 text-xs shrink-0">
                              {selectedProductToConfigure.id.startsWith('s_') ? 'Service' : 'Craft'}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-extrabold text-stone-800 text-sm truncate">{selectedProductToConfigure.name}</h4>
                            <p className="text-[11px] text-stone-400 font-medium line-clamp-2 leading-relaxed">{selectedProductToConfigure.description}</p>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-[11px] text-stone-600 font-extrabold">Base Price: {formatZAR(selectedProductToConfigure.basePrice)}</span>
                              {onEditProductInCatalogue && !selectedProductToConfigure.id.startsWith('s_') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onEditProductInCatalogue(selectedProductToConfigure.id);
                                    setSelectedProductToConfigure(null);
                                    setIsProductModalOpen(false);
                                  }}
                                  className="text-[10px] text-amber-700 hover:text-amber-800 font-bold hover:underline cursor-pointer"
                                >
                                  Edit core product
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Hide Image Toggle */}
                        <div className="flex items-center justify-between p-3 bg-stone-50/80 rounded-xl border border-stone-200/60">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded-lg transition-colors ${configHideImage ? 'bg-amber-100 text-amber-800' : 'bg-stone-200/70 text-stone-600'}`}>
                              {configHideImage ? <EyeOff size={15} /> : <Eye size={15} />}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-stone-800 block">Hide Product Image</span>
                              <span className="text-[10px] text-stone-500 font-medium">Do not show product photo on this quote</span>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={configHideImage}
                              onChange={e => setConfigHideImage(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                          </label>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Quantity & Price Row */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Quantity Selector */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">Quantity</label>
                      <div className="flex items-center border border-stone-200 rounded-xl bg-stone-50 overflow-hidden w-full max-w-[140px]">
                        <button
                          type="button"
                          onClick={() => {
                            const newQty = Math.max(1, configQty - 1);
                            setConfigQty(newQty);
                            if (!isRateDirty) {
                              setConfigRate(getTierUnitPrice(selectedProductToConfigure, newQty));
                            }
                          }}
                          className="px-3 py-1.5 hover:bg-stone-200/55 text-stone-600 font-black text-sm transition cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={configQty}
                          onChange={e => {
                            const newQty = Math.max(1, parseInt(e.target.value) || 1);
                            setConfigQty(newQty);
                            if (!isRateDirty) {
                              setConfigRate(getTierUnitPrice(selectedProductToConfigure, newQty));
                            }
                          }}
                          className="w-12 bg-transparent text-center text-xs font-normal text-stone-800 focus:outline-none flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newQty = configQty + 1;
                            setConfigQty(newQty);
                            if (!isRateDirty) {
                              setConfigRate(getTierUnitPrice(selectedProductToConfigure, newQty));
                            }
                          }}
                          className="px-3 py-1.5 hover:bg-stone-200/55 text-stone-600 font-black text-sm transition cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Unit Price Input */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">Unit Price (R)</label>
                      <div className="flex items-center border border-stone-200 rounded-xl bg-stone-50 overflow-hidden px-3 py-1.5">
                        <span className="text-stone-400 font-semibold text-xs mr-1">R</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={configRate}
                          onChange={e => {
                            setIsRateDirty(true);
                            setConfigRate(parseFloat(e.target.value.replace(',', '.')) || 0);
                          }}
                          className="w-full bg-transparent text-xs font-normal text-stone-800 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Volume Tier Discount Notification */}
                  {(() => {
                    const tierPrice = getTierUnitPrice(selectedProductToConfigure, configQty);
                    if (tierPrice < selectedProductToConfigure.basePrice && !isRateDirty) {
                      return (
                        <div className="text-emerald-700 font-semibold text-[11px]">
                          Volume discount active: {formatZAR(tierPrice)} per item
                        </div>
                      );
                    }
                    if (isRateDirty) {
                      return (
                        <div className="text-stone-500 font-medium text-[10px] flex items-center gap-1.5">
                          <span>Rate overridden manually.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsRateDirty(false);
                              setConfigRate(tierPrice);
                            }}
                            className="text-amber-700 hover:text-amber-800 font-extrabold hover:underline cursor-pointer"
                          >
                            Reset to default
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Variations Section - Single Column Layout */}
                  {(() => {
                    const vars = selectedProductToConfigure.customizationOptions.filter(o => o.type !== 'extra');
                    if (vars.length === 0) return null;
                    return (
                      <div className="space-y-3 border-t border-stone-100 pt-4">
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">Variations</label>
                        <div className="space-y-3">
                          {vars.map((opt) => {
                            const selectedVal = configCustoms[opt.name] || (opt.values.length > 0 ? { value: opt.values[0].value, priceUplift: opt.values[0].priceUplift, photo: opt.values[0].photo } : undefined);
                            return (
                              <div key={opt.name} className="space-y-1.5 bg-stone-50/60 p-3 rounded-xl border border-stone-200/80">
                                <div className="flex items-center justify-between">
                                  <label className="block text-[11px] font-bold text-stone-700">
                                    {opt.name} {opt.isRequired && <span className="text-rose-500">*</span>}
                                  </label>
                                  {selectedVal?.photo && (
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                                      <img src={selectedVal.photo} alt={selectedVal.value} className="w-5 h-5 object-cover rounded shrink-0 border border-amber-200" referrerPolicy="no-referrer" />
                                      <span>{selectedVal.value} photo</span>
                                    </div>
                                  )}
                                </div>
                                <select
                                  value={configCustoms[opt.name]?.value || (opt.values[0]?.value || '')}
                                  required
                                  onChange={e => {
                                    const val = opt.values.find(v => v.value === e.target.value);
                                    const updated = { ...configCustoms };
                                    if (val) {
                                      updated[opt.name] = { value: val.value, priceUplift: val.priceUplift, photo: val.photo };
                                    } else {
                                      delete updated[opt.name];
                                    }
                                    setConfigCustoms(updated);
                                  }}
                                  className="w-full bg-white px-3 py-2 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                >
                                  {opt.values.length === 0 && <option value="">No options configured</option>}
                                  {opt.values.map((v, vIdx) => (
                                    <option key={vIdx} value={v.value}>
                                      {v.value} {v.priceUplift > 0 ? `(+R${v.priceUplift})` : ''} {v.photo ? '🖼️' : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Extras Section - Single Column Layout */}
                  {(() => {
                    const extras = selectedProductToConfigure.customizationOptions.filter(o => o.type === 'extra');
                    if (extras.length === 0) return null;
                    return (
                      <div className="space-y-3 border-t border-stone-100 pt-4">
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">Extras</label>
                        <div className="space-y-3">
                          {extras.map((opt) => {
                            const selectedVal = configCustoms[opt.name];
                            return (
                              <div key={opt.name} className="space-y-2 bg-stone-50/60 p-3.5 rounded-xl border border-stone-200/80">
                                <div className="flex items-center justify-between">
                                  <label className="block text-[11px] font-bold text-stone-700">
                                    {opt.name} {opt.isRequired && <span className="text-rose-500">*</span>}
                                  </label>
                                  {selectedVal?.photo && (
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                                      <img src={selectedVal.photo} alt={selectedVal.value} className="w-5 h-5 object-cover rounded shrink-0 border border-amber-200" referrerPolicy="no-referrer" />
                                      <span>{selectedVal.value} photo</span>
                                    </div>
                                  )}
                                </div>
                                <select
                                  value={configCustoms[opt.name]?.value || ''}
                                  required={opt.isRequired}
                                  onChange={e => {
                                    const val = opt.values.find(v => v.value === e.target.value);
                                    const updated = { ...configCustoms };
                                    if (val) {
                                      updated[opt.name] = { value: val.value, priceUplift: val.priceUplift, photo: val.photo };
                                    } else {
                                      delete updated[opt.name];
                                      // Clear separate toggle if deselected
                                      const sepUpdated = { ...extrasAsSeparate };
                                      delete sepUpdated[opt.name];
                                      setExtrasAsSeparate(sepUpdated);
                                    }
                                    setConfigCustoms(updated);
                                  }}
                                  className="w-full bg-white px-3 py-2 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                >
                                  {!opt.isRequired && <option value="">None</option>}
                                  {opt.values.map((v, vIdx) => (
                                    <option key={vIdx} value={v.value}>
                                      {v.value} {v.priceUplift > 0 ? `(+R${v.priceUplift})` : ''} {v.photo ? '🖼️' : ''}
                                    </option>
                                  ))}
                                </select>

                                {/* Separate Line Item Option */}
                                {configCustoms[opt.name] && (
                                  <label className="flex items-center gap-2 mt-2 text-[10px] font-extrabold text-amber-800 cursor-pointer select-none bg-amber-50/70 p-2 rounded-lg border border-amber-200/60">
                                    <input
                                      type="checkbox"
                                      checked={extrasAsSeparate[opt.name] || false}
                                      onChange={e => {
                                        setExtrasAsSeparate({
                                          ...extrasAsSeparate,
                                          [opt.name]: e.target.checked
                                        });
                                      }}
                                      className="rounded text-amber-600 focus:ring-amber-500"
                                    />
                                    <span>List as separate line item on quote (uses extra image)</span>
                                  </label>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Discount Section */}
                  <div className="space-y-2 border-t border-stone-100 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">Item-level Discount</span>
                      <button
                        type="button"
                        onClick={() => setHasConfigDiscount(!hasConfigDiscount)}
                        className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg border transition cursor-pointer ${
                          hasConfigDiscount
                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                            : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-350'
                        }`}
                      >
                        {hasConfigDiscount ? 'Active' : 'Apply Discount'}
                      </button>
                    </div>

                    {hasConfigDiscount && (
                      <div className="flex gap-2 items-center bg-stone-50 p-2.5 border border-stone-200/60 rounded-xl animate-fadeIn">
                        <span className="text-[11px] font-bold text-stone-500">Type:</span>
                        <select
                          value={configDiscountType}
                          onChange={e => setConfigDiscountType(e.target.value as 'percentage' | 'fixed')}
                          className="bg-white border border-stone-200 rounded-lg text-xs p-1 font-normal focus:outline-none shrink-0"
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed Amount (ZAR)</option>
                        </select>
                        <span className="text-[11px] font-bold text-stone-500 ml-1">Value:</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={configDiscountVal || ''}
                          onChange={e => setConfigDiscountVal(parseFloat(e.target.value.replace(',', '.')) || 0)}
                          placeholder="0"
                          className="w-20 bg-white px-2 py-1 border border-stone-200 rounded-lg text-xs font-normal text-stone-800 text-center focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>
                    )}
                  </div>

                  {/* Tax Section */}
                  <div className="space-y-2 border-t border-stone-100 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">Item-level Tax</span>
                      <button
                        type="button"
                        onClick={() => setHasConfigTax(!hasConfigTax)}
                        className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg border transition cursor-pointer ${
                          hasConfigTax
                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                            : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-350'
                        }`}
                      >
                        {hasConfigTax ? 'Active' : 'Add Tax'}
                      </button>
                    </div>

                    {hasConfigTax && (
                      <div className="flex gap-2 items-center bg-stone-50 p-2.5 border border-stone-200/60 rounded-xl animate-fadeIn">
                        <span className="text-[11px] font-bold text-stone-500">Tax Rate:</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={configTaxRate || ''}
                          onChange={e => setConfigTaxRate(parseFloat(e.target.value.replace(',', '.')) || 0)}
                          placeholder="15"
                          className="w-20 bg-white px-2 py-1 border border-stone-200 rounded-lg text-xs font-normal text-stone-800 text-center focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                        <span className="text-[11px] font-bold text-stone-500 shrink-0">%</span>
                      </div>
                    )}
                  </div>

                  {/* Calculations & Subtotal Preview */}
                  {(() => {
                    const baseRate = configRate;
                    const customUpliftsSum = (Object.values(configCustoms) as SelectedCustomization[]).reduce((sum, item) => sum + item.priceUplift, 0);
                    const preDiscountTotal = (baseRate + customUpliftsSum) * configQty;
                    
                    let finalLineTotal = preDiscountTotal;
                    let discountDeduction = 0;
                    if (hasConfigDiscount && configDiscountVal > 0) {
                      if (configDiscountType === 'percentage') {
                        discountDeduction = preDiscountTotal * (configDiscountVal / 100);
                        finalLineTotal = preDiscountTotal - discountDeduction;
                      } else {
                        discountDeduction = configDiscountVal;
                        finalLineTotal = Math.max(0, preDiscountTotal - configDiscountVal);
                      }
                    }

                    let taxAddition = 0;
                    if (hasConfigTax && configTaxRate > 0) {
                      taxAddition = finalLineTotal * (configTaxRate / 100);
                      finalLineTotal = finalLineTotal + taxAddition;
                    }

                    return (
                      <div className="bg-[#FAF8F5] p-4 rounded-xl border border-amber-100/50 space-y-1 text-xs">
                        <div className="flex justify-between text-stone-500 font-semibold">
                          <span>Base Cost ({configQty} x {formatZAR(baseRate)}):</span>
                          <span>{formatZAR(baseRate * configQty)}</span>
                        </div>
                        {customUpliftsSum > 0 && (
                          <div className="flex justify-between text-stone-500 font-semibold">
                            <span>Customizations ({configQty} x {formatZAR(customUpliftsSum)}):</span>
                            <span>{formatZAR(customUpliftsSum * configQty)}</span>
                          </div>
                        )}
                        {discountDeduction > 0 && (
                          <div className="flex justify-between text-emerald-700 font-extrabold">
                            <span>Discount:</span>
                            <span>-{formatZAR(discountDeduction)}</span>
                          </div>
                        )}
                        {taxAddition > 0 && (
                          <div className="flex justify-between text-stone-600 font-semibold">
                            <span>Tax ({configTaxRate}%):</span>
                            <span>{formatZAR(taxAddition)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center border-t border-stone-200/50 pt-2 text-stone-800 font-black text-sm">
                          <span>Est. Line Total:</span>
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center border border-stone-200 rounded-lg bg-white overflow-hidden px-2.5 py-1 max-w-[130px] shadow-3xs">
                              <span className="text-stone-400 font-bold text-xs mr-1">R</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={isTotalDirty && configOverriddenTotal !== null ? configOverriddenTotal : (Math.round(finalLineTotal * 100) / 100).toFixed(2)}
                                onChange={e => {
                                  setIsTotalDirty(true);
                                  const val = parseFloat(e.target.value.replace(',', '.')) || 0;
                                  setConfigOverriddenTotal(val);
                                }}
                                className="w-full bg-transparent text-xs font-black text-amber-800 focus:outline-none text-right"
                              />
                            </div>
                          </div>
                        </div>

                        {isTotalDirty && (
                          <div className="text-stone-500 font-medium text-[10px] flex items-center justify-end gap-1.5 pt-1">
                            <span>Calculated price overridden manually.</span>
                            <button
                              type="button"
                              onClick={() => {
                                setIsTotalDirty(false);
                                setConfigOverriddenTotal(null);
                              }}
                              className="text-amber-700 hover:text-amber-800 font-extrabold hover:underline cursor-pointer"
                            >
                              Reset to default
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-4 border-t border-stone-100 bg-stone-50/50 flex justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedProductToConfigure(null)}
                    className="bg-stone-100 hover:bg-stone-200 text-stone-600 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAddProduct}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 flex items-center gap-1"
                  >
                    <Check size={14} /> {editingLineItemIndex !== null ? 'Update Specifications' : 'Confirm & Add'}
                  </button>
                </div>
              </div>
            ) : (
              /* SEARCHABLE CATALOGUE LIST SCREEN (PRODUCTS & SERVICES TABS) */
              <div className="flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/50">
                  <div>
                    <h3 className="font-extrabold text-stone-800 text-sm">Select Items</h3>
                    <p className="text-[10px] text-stone-400 font-medium">Browse or search products and services from your catalog</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseProductModal}
                    className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-600 transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Tabs for Products vs Services vs Custom Item */}
                <div className="flex border-b border-stone-100 px-4 bg-stone-50/30">
                  <button
                    type="button"
                    onClick={() => {
                      setModalTab('products');
                      setModalSearchQuery('');
                    }}
                    className={`flex-1 py-2.5 text-center text-xs font-bold transition-all border-b-2 -mb-[1px] cursor-pointer ${
                      modalTab === 'products'
                        ? 'border-amber-600 text-amber-800'
                        : 'border-transparent text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    Products
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalTab('services');
                      setModalSearchQuery('');
                    }}
                    className={`flex-1 py-2.5 text-center text-xs font-bold transition-all border-b-2 -mb-[1px] cursor-pointer ${
                      modalTab === 'services'
                        ? 'border-amber-600 text-amber-800'
                        : 'border-transparent text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    Services
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalTab('custom');
                      setModalSearchQuery('');
                    }}
                    className={`flex-1 py-2.5 text-center text-xs font-bold transition-all border-b-2 -mb-[1px] cursor-pointer ${
                      modalTab === 'custom'
                        ? 'border-amber-600 text-amber-800'
                        : 'border-transparent text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    Custom Item
                  </button>
                </div>

                {modalTab === 'custom' ? (
                  <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-white">
                    <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 text-xs text-amber-900 leading-relaxed font-medium">
                      <strong>Once-Off / Custom Item:</strong> Add a unique job or piece that isn't part of your standard catalog.
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Item Title / Name *</label>
                      <input
                        type="text"
                        required
                        value={customItemName}
                        onChange={e => setCustomItemName(e.target.value)}
                        placeholder="e.g. Custom Live-Edge Dining Table"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Specifications & Notes</label>
                      <textarea
                        rows={2}
                        value={customItemDesc}
                        onChange={e => setCustomItemDesc(e.target.value)}
                        placeholder="Details, materials used, finish instructions..."
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Quantity</label>
                        <input
                          type="number"
                          min={1}
                          value={customItemQty}
                          onChange={e => setCustomItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-bold text-center"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Unit Price (R) *</label>
                        <div className="flex items-center border border-stone-200 rounded-xl bg-stone-50 px-2.5 py-1.5">
                          <span className="text-stone-400 font-bold text-xs mr-1">R</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={customItemPrice}
                            onChange={e => setCustomItemPrice(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-transparent text-xs font-bold text-stone-800 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 font-medium">
                      <span>Want to calculate input costs or specify a production process?</span>
                      <button
                        type="button"
                        onClick={() => {
                          handleCloseProductModal();
                          setIsAdvancedCustomItemOpen(true);
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shrink-0 shadow-3xs"
                      >
                        Configure advanced options
                      </button>
                    </div>

                    <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleCloseProductModal}
                        className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!customItemName.trim()}
                        onClick={handleAddCustomItem}
                        className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <PlusCircle size={14} /> Add Custom Item
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Search Bar & Options */}
                    <div className="p-4 border-b border-stone-100 space-y-3 bg-white">
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400 pointer-events-none">
                          <Search size={14} />
                        </span>
                        <input
                          type="text"
                          placeholder={`Search ${modalTab} by name or description...`}
                          value={modalSearchQuery}
                          onChange={e => setModalSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 placeholder-stone-400 transition"
                          autoFocus
                        />
                      </div>

                      <div className="flex justify-end">
                        {modalTab === 'products' && (
                          <button
                            type="button"
                            onClick={() => {
                              handleCloseProductModal();
                              onAddNewProductInCatalogue?.();
                            }}
                            className="text-amber-700 hover:text-amber-800 text-[11px] font-extrabold flex items-center gap-1 bg-amber-50/60 border border-amber-100/50 px-3 py-1.5 rounded-xl transition"
                          >
                            <PlusCircle size={12} /> Add new product
                          </button>
                        )}
                      </div>
                    </div>

                    {/* List of Products or Services */}
                    <div className="flex-1 overflow-y-auto divide-y divide-stone-100 p-2 space-y-1">
                      {(modalTab === 'products' ? products : services)
                        .filter(p => p.isActive && (p.name.toLowerCase().includes(modalSearchQuery.toLowerCase()) || p.description.toLowerCase().includes(modalSearchQuery.toLowerCase())))
                        .map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              handleAddProduct(p);
                            }}
                            className="p-2.5 rounded-xl hover:bg-stone-50 cursor-pointer flex items-center justify-between transition-colors group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {p.photo ? (
                                <img src={getProductPhotoUrl(p.photo, p.id)} alt={p.name} className="w-10 h-10 object-cover rounded-lg border border-stone-100 shrink-0" referrerPolicy="no-referrer" onError={(e) => handleImageError(e, p.id)} />
                              ) : (
                                <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center font-bold text-stone-500 text-xs shrink-0">
                                  {modalTab === 'products' ? 'Craft' : 'Service'}
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="font-bold text-xs text-stone-800 block truncate group-hover:text-amber-800 transition-colors">{p.name}</span>
                                <span className="text-[10px] text-stone-400 font-medium block truncate max-w-[220px]">{p.description}</span>
                                <span className="text-[10px] text-stone-600 font-bold block mt-0.5">{formatZAR(p.basePrice)}</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200/40 px-2.5 py-1 rounded-lg shrink-0 group-hover:bg-amber-600 group-hover:text-white group-hover:border-transparent transition-colors">
                              Configure &rarr;
                            </span>
                          </div>
                        ))}

                      {(modalTab === 'products' ? products : services).filter(p => p.isActive && (p.name.toLowerCase().includes(modalSearchQuery.toLowerCase()) || p.description.toLowerCase().includes(modalSearchQuery.toLowerCase()))).length === 0 && (
                        <div className="p-8 text-center text-xs text-stone-400 italic flex flex-col items-center justify-center gap-1">
                          <span>No matching {modalTab} found.</span>
                          {modalTab === 'products' && (
                            <button
                              type="button"
                              onClick={() => {
                                handleCloseProductModal();
                                onAddNewProductInCatalogue?.();
                              }}
                              className="text-xs text-amber-700 hover:underline font-bold mt-1"
                            >
                              Create new product page
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            
          </div>
        </div>
      )}

      {/* CONFIGURE FULFILMENT OPTIONS MODAL */}
      {isFulfilmentConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleIn">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/50">
              <div>
                <h3 className="font-extrabold text-stone-800 text-sm">Configure Fulfilment Options</h3>
                <p className="text-[10px] text-stone-400 font-medium">Manage reusable collection and delivery options</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFulfilmentConfigModalOpen(false)}
                className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Existing Options List */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block text-left">Current Options</span>
                {fulfillmentPresets.length === 0 ? (
                  <div className="text-center py-6 bg-stone-50 border border-dashed border-stone-200 rounded-xl">
                    <p className="text-[11px] text-stone-400 italic font-medium">No options configured yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {fulfillmentPresets.map((preset) => (
                      <div key={preset.id} className="flex items-center justify-between bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs">
                        <div className="text-left">
                          <span className="font-bold text-stone-700 block">{preset.label || (preset.type === 'collection' ? 'Collection' : 'Delivery')}</span>
                          <span className="text-stone-400 text-[9px] font-extrabold uppercase">{preset.type === 'collection' ? 'Collection' : 'Delivery'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-stone-600">
                            {preset.isVariable ? 'Variable Rate' : (preset.price === 0 ? 'Free' : formatZAR(preset.price))}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = fulfillmentPresets.filter(p => p.id !== preset.id);
                              setFulfillmentPresets(updated);
                              if (selectedFulfillmentPresetId === preset.id) {
                                setSelectedFulfillmentPresetId('');
                                setFulfillmentType(undefined);
                              }
                            }}
                            className="text-rose-600 hover:text-rose-850 p-1 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Delete Option"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-stone-100 bg-stone-50/50 flex justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsFulfilmentConfigModalOpen(false);
                  setIsFulfilmentAddModalOpen(true);
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition active:scale-95 flex items-center justify-center gap-1 shrink-0"
              >
                <PlusCircle size={13} /> Add New Option
              </button>
              <button
                type="button"
                onClick={() => setIsFulfilmentConfigModalOpen(false)}
                className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 flex items-center gap-1"
              >
                <Check size={14} /> Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD FULFILMENT OPTION MODAL */}
      {isFulfilmentAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleIn">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/50">
              <div>
                <h3 className="font-extrabold text-stone-800 text-sm">Add Fulfilment Option</h3>
                <p className="text-[10px] text-stone-400 font-medium">Configure a new delivery or collection option</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFulfilmentAddModalOpen(false)}
                className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-4 text-left">
                {/* 1. Type selection (First) */}
                <div>
                  <label className="block text-[9px] font-bold text-stone-500 uppercase tracking-wider mb-1">Type</label>
                  <select
                    value={newPresetType}
                    onChange={e => {
                      const val = e.target.value as 'collection' | 'delivery';
                      setNewPresetType(val);
                    }}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-normal focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-stone-700"
                  >
                    <option value="collection">Collection (Pickup)</option>
                    <option value="delivery">Delivery (Shipping)</option>
                  </select>
                </div>

                {/* 2. Label Input (Second, Optional) */}
                <div>
                  <label className="block text-[9px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                    Label / Title <span className="text-stone-400 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder={newPresetType === 'collection' ? 'e.g. Business Pickup' : 'e.g. Courier to Door'}
                    value={newPresetLabel}
                    onChange={e => setNewPresetLabel(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-normal focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-stone-800"
                  />
                </div>

                {/* 3. Pricing configuration (Third) */}
                <div className="space-y-2 text-left border-t border-stone-100 pt-3">
                  <span className="block text-[9px] font-bold text-stone-500 uppercase tracking-wider">Pricing</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 items-center bg-stone-50 p-2.5 rounded-xl border border-stone-200/40">
                    <label className="flex items-center gap-1.5 text-xs text-stone-700 font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="newPresetPricingMode_add"
                        checked={newPresetPricingMode === 'free'}
                        onChange={() => {
                          setNewPresetPricingMode('free');
                          setNewPresetPrice(0);
                          setNewPresetIsVariable(false);
                        }}
                        className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <span>Free</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-stone-700 font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="newPresetPricingMode_add"
                        checked={newPresetPricingMode === 'fixed'}
                        onChange={() => {
                          setNewPresetPricingMode('fixed');
                          setNewPresetIsVariable(false);
                        }}
                        className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <span>Fixed Fee</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-stone-700 font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="newPresetPricingMode_add"
                        checked={newPresetPricingMode === 'variable'}
                        onChange={() => {
                          setNewPresetPricingMode('variable');
                          setNewPresetPrice(0);
                          setNewPresetIsVariable(true);
                        }}
                        className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <span>Variable Pricing</span>
                    </label>
                  </div>

                  {newPresetPricingMode === 'fixed' && (
                    <div className="space-y-1 animate-fadeIn pt-1">
                      <label className="block text-[9px] font-bold text-stone-500 uppercase">
                        {newPresetType === 'collection' ? 'Collection Fee (R)' : 'Fixed Delivery Fee (R)'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-500">R</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={newPresetPrice || ''}
                          onChange={e => setNewPresetPrice(parseFloat(e.target.value.replace(',', '.')) || 0)}
                          className="w-full pl-7 pr-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-normal focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-stone-800"
                        />
                      </div>
                    </div>
                  )}

                  {newPresetPricingMode === 'free' && (
                    <div className="text-[10px] text-emerald-800 font-bold bg-emerald-50/50 px-3 py-2 rounded-xl border border-emerald-100/60 animate-fadeIn leading-relaxed">
                      This option is completely free for your customers.
                    </div>
                  )}

                  {newPresetPricingMode === 'variable' && (
                    <div className="text-[10px] text-amber-800 font-bold bg-amber-50/50 px-3 py-2 rounded-xl border border-amber-100/60 animate-fadeIn leading-relaxed">
                      Variable rate enabled. You will enter the specific cost for each quote when selecting this option.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer with Actions */}
            <div className="p-5 border-t border-stone-100 bg-stone-50/50 flex justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsFulfilmentAddModalOpen(false);
                  if (fulfillmentPresets.length > 0) {
                    setIsFulfilmentConfigModalOpen(true);
                  }
                }}
                className="px-4 py-2 bg-white border border-stone-200 text-stone-500 hover:bg-stone-50 font-bold text-xs rounded-xl cursor-pointer transition shrink-0 animate-fadeIn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const labelValue = newPresetLabel.trim() || (newPresetType === 'collection' ? 'Collection' : 'Delivery');
                  const newPreset: FulfillmentPreset = {
                    id: 'fp_' + Date.now(),
                    label: labelValue,
                    type: newPresetType,
                    price: newPresetPricingMode === 'fixed' ? newPresetPrice : 0,
                    isVariable: newPresetPricingMode === 'variable'
                  };
                  const updated = [...fulfillmentPresets, newPreset];
                  setFulfillmentPresets(updated);
                  setSelectedFulfillmentPresetId(newPreset.id);
                  setFulfillmentType(newPresetType);
                  setNewPresetLabel('');
                  setNewPresetPrice(0);
                  setNewPresetPricingMode('free');
                  setIsFulfilmentAddModalOpen(false);
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition active:scale-95 flex items-center justify-center shrink-0 animate-fadeIn"
              >
                <PlusCircle size={13} className="mr-1" /> Add Option
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Notifications and Toast Overlays */}
      {showJobConversionPrompt && promptQuote && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xl max-w-sm w-full space-y-4 animate-scaleUp text-center">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-100">
              <Layers size={22} className="animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <h4 className="font-extrabold text-stone-800 text-sm">Convert to Job?</h4>
              <p className="text-[11px] text-stone-500 leading-normal">
                Quote <strong className="text-stone-700">{promptQuote.quoteNumber}</strong> has been marked as accepted!
              </p>
              <p className="text-[11px] text-stone-400 leading-normal">
                Would you like to turn this accepted quote into an active job to manage material sourcing, batches, and unit tracking?
              </p>
            </div>

            {/* "Don't ask again" checkbox option */}
            <div className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200/50 justify-center">
              <input
                type="checkbox"
                id="dontAskAgainCheckbox"
                checked={dontAskCheckbox}
                onChange={(e) => setDontAskCheckbox(e.target.checked)}
                className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 cursor-pointer h-4 w-4"
              />
              <label htmlFor="dontAskAgainCheckbox" className="text-[10px] text-stone-500 font-bold select-none cursor-pointer">
                Don't ask again (always use this choice)
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleConfirmJobConversionPrompt(false)}
                className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                No, Just Accept
              </button>
              <button
                type="button"
                onClick={() => handleConfirmJobConversionPrompt(true)}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Yes, Create Job
              </button>
            </div>
          </div>
        </div>
      )}

      {showSendNotification && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn print:hidden">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xl max-w-sm w-full text-center space-y-4 animate-scaleUp">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
              <Mail size={22} className="animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-stone-800 text-sm">Quote Sent Successfully!</h4>
              <p className="text-[11px] text-stone-500">
                A copy of the complete quote has been emailed to: <br />
                <strong className="text-stone-700">{notificationEmail}</strong>
              </p>
            </div>
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  const targetQ = sentQuoteData || (selectedQuoteId ? quotes.find(q => q.id === selectedQuoteId) : null);
                  if (targetQ) {
                    handleDownloadQuotePdf(targetQ);
                  } else {
                    window.print();
                  }
                }}
                disabled={isGeneratingPdf}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Download size={14} />
                <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download Quote PDF'}</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer size={14} />
                <span>Print Copy</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSendNotification(false);
                  setNotificationEmail('');
                  setSentQuoteData(null);
                }}
                className="w-full text-stone-500 hover:text-stone-700 py-1.5 text-xs font-semibold transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT CUSTOMER MODAL */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <form 
            onSubmit={handleSaveCustomerModal}
            className="bg-white w-full max-w-md rounded-2xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleIn"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/50">
              <h4 className="font-extrabold text-stone-800 text-sm">
                {editingCustomerForModal ? `Edit Customer: ${editingCustomerForModal.name}` : 'Add Customer'}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setIsCustomerModalOpen(false);
                  setEditingCustomerForModal(null);
                }}
                className="text-stone-400 hover:text-stone-600 cursor-pointer p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Fields */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-1">Customer / Business Name *</label>
                <input
                  type="text"
                  required
                  value={modalCustName}
                  onChange={e => setModalCustName(e.target.value)}
                  placeholder="Customer / Business Name"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-1">Contact Cellphone</label>
                  <input
                    type="text"
                    value={modalCustPhone}
                    onChange={e => setModalCustPhone(e.target.value)}
                    placeholder="Phone Number"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-1">Email Address</label>
                  <input
                    type="email"
                    value={modalCustEmail}
                    onChange={e => setModalCustEmail(e.target.value)}
                    placeholder="Email Address"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs"
                  />
                </div>
              </div>

              {/* Is Business Customer Toggle */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">Is this customer a registered business?</span>
                    <span className="text-[10px] text-stone-500 font-medium">Enable company registration and VAT details</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalCustIsBusiness}
                      onChange={e => setModalCustIsBusiness(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                {modalCustIsBusiness && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-amber-200/60 animate-fadeIn">
                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-bold text-stone-600 uppercase mb-0.5">Contact Person</label>
                      <input
                        type="text"
                        value={modalCustContactPerson}
                        onChange={e => setModalCustContactPerson(e.target.value)}
                        placeholder="e.g. Jane Doe (Procurement / Accounts)"
                        className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-stone-800 text-xs font-normal"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-stone-600 uppercase mb-0.5">Company Reg No.</label>
                      <input
                        type="text"
                        value={modalCustCompanyRegNumber}
                        onChange={e => setModalCustCompanyRegNumber(e.target.value)}
                        placeholder="e.g. 2018/123456/07"
                        className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-stone-800 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-stone-600 uppercase mb-0.5">VAT Registration No.</label>
                      <input
                        type="text"
                        value={modalCustVatNumber}
                        onChange={e => setModalCustVatNumber(e.target.value)}
                        placeholder="e.g. 4123456789 (10 digits)"
                        className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-stone-800 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Billing Address (Primary Default) */}
              <div className="space-y-2 pt-1 border-t border-stone-100">
                <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-1">Billing Address (Default)</label>
                <div>
                  <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">Street Address</label>
                  <input
                    type="text"
                    value={modalCustStreet}
                    onChange={e => setModalCustStreet(e.target.value)}
                    placeholder="Street Address"
                    className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">City</label>
                    <input
                      type="text"
                      value={modalCustCity}
                      onChange={e => setModalCustCity(e.target.value)}
                      placeholder="City"
                      className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">Province</label>
                    <input
                      type="text"
                      value={modalCustProvince}
                      onChange={e => setModalCustProvince(e.target.value)}
                      placeholder="Province"
                      className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">Postal Code</label>
                    <input
                      type="text"
                      value={modalCustPostalCode}
                      onChange={e => setModalCustPostalCode(e.target.value)}
                      placeholder="Postal Code"
                      className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">Country</label>
                    <input
                      type="text"
                      value={modalCustCountry}
                      onChange={e => setModalCustCountry(e.target.value)}
                      placeholder="Country"
                      className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Address Section with Toggle */}
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider">Shipping Address</label>
                  <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={modalCustUseSameAddress}
                      onChange={e => setModalCustUseSameAddress(e.target.checked)}
                      className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold">Same as billing address</span>
                  </label>
                </div>

                {!modalCustUseSameAddress && (
                  <div className="space-y-2 bg-stone-50/70 p-3 rounded-xl border border-stone-200/60 animate-fadeIn">
                    <div>
                      <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">Shipping Street Address</label>
                      <input
                        type="text"
                        value={modalCustShippingStreet}
                        onChange={e => setModalCustShippingStreet(e.target.value)}
                        placeholder="Street Address or Site Location"
                        className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">City</label>
                        <input
                          type="text"
                          value={modalCustShippingCity}
                          onChange={e => setModalCustShippingCity(e.target.value)}
                          placeholder="City"
                          className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">Province</label>
                        <input
                          type="text"
                          value={modalCustShippingProvince}
                          onChange={e => setModalCustShippingProvince(e.target.value)}
                          placeholder="Province"
                          className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">Postal Code</label>
                        <input
                          type="text"
                          value={modalCustShippingPostalCode}
                          onChange={e => setModalCustShippingPostalCode(e.target.value)}
                          placeholder="Postal Code"
                          className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">Country</label>
                        <input
                          type="text"
                          value={modalCustShippingCountry}
                          onChange={e => setModalCustShippingCountry(e.target.value)}
                          placeholder="Country"
                          className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-1">Internal Notes & Specifications</label>
                <textarea
                  value={modalCustNotes}
                  onChange={e => setModalCustNotes(e.target.value)}
                  placeholder="Internal Notes & Specifications"
                  rows={2}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="bg-stone-50 px-5 py-4 flex justify-end gap-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setIsCustomerModalOpen(false);
                  setEditingCustomerForModal(null);
                }}
                className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition flex items-center gap-1.5"
              >
                <Check size={14} /> Save Customer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Template Gallery Modal */}
      <TemplateGalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        activeTemplateId={isCreating ? quoteTemplate : (selectedQuote?.templateId || quoteTemplate)}
        activeCustomStyle={isCreating ? creatingCustomStyle : selectedQuote?.templateCustomStyle}
        customTemplates={customTemplates}
        profile={profile}
        onSelectTemplate={(templateId, customStyle) => {
          if (isCreating) {
            setQuoteTemplate(templateId);
            setCreatingCustomStyle(customStyle);
          } else if (selectedQuote) {
            onUpdateQuoteTemplate(selectedQuote.id, templateId, customStyle);
          }
        }}
        onCreateNewTemplate={() => {
          setCustomizerInitialStyle(undefined);
          setIsCustomizerOpen(true);
        }}
        onRemixTemplate={(templateToRemix) => {
          setCustomizerInitialStyle(templateToRemix);
          setIsCustomizerOpen(true);
        }}
        onDeleteCustomTemplate={onDeleteCustomTemplate}
      />

      {/* Template Customizer Modal */}
      {isCustomizerOpen && (
        <TemplateCustomizerModal
          isOpen={isCustomizerOpen}
          profile={profile}
          initialTemplateStyle={
            customizerInitialStyle ||
            (isCreating
              ? resolveQuoteTemplate(quoteTemplate, creatingCustomStyle, customTemplates)
              : (selectedQuote
                  ? resolveQuoteTemplate(selectedQuote.templateId, selectedQuote.templateCustomStyle, customTemplates)
                  : resolveQuoteTemplate(quoteTemplate, creatingCustomStyle, customTemplates)))
          }
          customTemplates={customTemplates}
          onClose={() => {
            setIsCustomizerOpen(false);
            setCustomizerInitialStyle(undefined);
          }}
          onApplyStyle={(newStyle) => {
            if (isCreating) {
              setCreatingCustomStyle(newStyle);
              setQuoteTemplate(newStyle.id);
            } else if (selectedQuote) {
              onUpdateQuoteTemplate(selectedQuote.id, newStyle.id, newStyle);
            }
          }}
          onSaveCustomTemplate={(newCustomStyle) => {
            onSaveCustomTemplate(newCustomStyle);
            if (isCreating) {
              setCreatingCustomStyle(newCustomStyle);
              setQuoteTemplate(newCustomStyle.id);
            } else if (selectedQuote) {
              onUpdateQuoteTemplate(selectedQuote.id, newCustomStyle.id, newCustomStyle);
            }
          }}
          onDeleteCustomTemplate={onDeleteCustomTemplate}
        />
      )}

      {/* DELETE QUOTE CONFIRMATION MODAL */}
      {quoteToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-stone-200 shadow-2xl space-y-4 animate-scaleIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-stone-900 text-base">Delete Quote</h3>
                <p className="text-xs text-stone-500 font-medium">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-100">
              Are you sure you want to delete quote <span className="font-bold text-stone-800">{quoteToDelete.quoteNumber}</span> for <span className="font-bold text-stone-800">{quoteToDelete.customerName}</span>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setQuoteToDelete(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteQuote?.(quoteToDelete.id);
                  if (selectedQuoteId === quoteToDelete.id) {
                    setSelectedQuoteId(null);
                  }
                  setQuoteToDelete(null);
                  setShowSuccessToast(`Deleted quote ${quoteToDelete.quoteNumber}`);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Delete Quote
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessToast && (
        <div 
          data-print-hide="true"
          className="fixed bottom-6 right-6 bg-stone-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 z-50 text-xs font-semibold animate-slideUp print:hidden"
        >
          <Check size={16} className="text-emerald-400" />
          <span>{showSuccessToast}</span>
          <button
            type="button"
            onClick={() => setShowSuccessToast(null)}
            className="text-stone-400 hover:text-white ml-2"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Advanced Custom Item Modal */}
      <AdvancedCustomItemModal
        isOpen={isAdvancedCustomItemOpen}
        onClose={() => setIsAdvancedCustomItemOpen(false)}
        materials={materials}
        initialData={{
          name: customItemName,
          description: customItemDesc,
          quantity: customItemQty,
          unitPrice: typeof customItemPrice === 'number' ? customItemPrice : parseFloat(String(customItemPrice).replace(',', '.')) || 0,
          unitCost: typeof customItemCost === 'number' ? customItemCost : parseFloat(String(customItemCost).replace(',', '.')) || 0
        }}
        onAddCustomItem={(item: CustomItemResult) => {
          const newItem: QuoteLineItem = {
            id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            productId: '',
            productName: item.name,
            productPhoto: item.photo || '',
            productDescription: item.description,
            quantity: item.quantity,
            baseUnitPrice: item.unitPrice,
            appliedUnitPrice: item.unitPrice,
            selectedCustomizations: {},
            total: item.unitPrice * item.quantity,
            unitCost: item.unitCost
          };
          setLineItems(prev => [...prev, newItem]);
          handleCloseProductModal();
          setIsAdvancedCustomItemOpen(false);
        }}
      />
    </div>
  );
}
