import React, { useState, useEffect } from 'react';
import { 
  FileText, PlusCircle, Search, Calendar, ChevronRight, Eye, EyeOff,
  Trash2, Tag, Percent, ArrowRight, Printer, Check, X, Sparkles, Zap,
  ExternalLink, FileCheck, Layers, Landmark, Edit2, Download, Mail,
  ChevronDown, Palette, Truck, Paintbrush, Save, Receipt, Clock,
  AlertTriangle, CheckCircle, DollarSign, RotateCcw, FileSpreadsheet
} from 'lucide-react';
import { 
  Customer, Product, Invoice, InvoiceLineItem, Discount, 
  LineItemCustomizations, SelectedCustomization, BusinessProfile, Job,
  parseAddress, formatAddress, QuoteTemplateStyle, FulfillmentPreset, Material, InvoiceStatus,
  CreditNote
} from '../types';
import { STANDARD_QUOTE_TEMPLATES, resolveQuoteTemplate } from '../data/quoteTemplates';
import { DocumentRenderer, RenderItem } from './DocumentRenderer';
import { TemplateCustomizerModal } from './TemplateCustomizerModal';
import { TemplateGalleryModal } from './TemplateGalleryModal';
import { InternalQuoteFinancials } from './InternalQuoteFinancials';
import { getProductPhotoUrl, handleImageError } from '../lib/imageUtils';
import { AdvancedCustomItemModal, CustomItemResult } from './AdvancedCustomItemModal';
import { DatePickerWithShortcuts, addDays } from './DatePickerWithShortcuts';
import { formatSADate } from '../lib/dateUtils';
import { CreateCreditNoteModal } from './CreateCreditNoteModal';
import { downloadElementAsPdf } from '../lib/pdfUtils';

interface InvoicesProps {
  profile: BusinessProfile;
  invoices: Invoice[];
  creditNotes?: CreditNote[];
  customers: Customer[];
  products: Product[];
  services?: Product[];
  materials?: Material[];
  jobs?: Job[];
  customTemplates?: QuoteTemplateStyle[];
  onSaveCustomTemplate?: (style: QuoteTemplateStyle) => void;
  onDeleteCustomTemplate?: (templateId: string) => void;
  onUpdateInvoiceTemplate?: (invoiceId: string, templateId: string, customStyle?: Partial<QuoteTemplateStyle>) => void;
  onCreateInvoiceDirect: (invoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'vatAmount' | 'subtotal'>) => Invoice;
  onUpdateInvoice?: (invoice: Invoice) => Invoice;
  onDeleteInvoice?: (invoiceId: string) => void;
  onUpdateInvoiceStatus: (invoiceId: string, status: InvoiceStatus) => void;
  onCreateCreditNote?: (creditNote: Omit<CreditNote, 'id' | 'creditNoteNumber' | 'subtotal' | 'vatAmount' | 'hasVat'>) => CreditNote;
  onDeleteCreditNote?: (creditNoteId: string) => void;
  onSelectActiveInvoiceIdForBuyer: (invoiceId: string | null) => void;
  onEditProductInCatalogue?: (productId: string) => void;
  onAddNewProductInCatalogue?: () => void;
  onAddCustomer?: (customer: Omit<Customer, 'id' | 'createdAt'>) => Customer;
  onUpdateCustomer?: (customer: Customer) => void;
  invoicesStartInCreationMode?: boolean;
  onResetInvoicesStartInCreationMode?: () => void;
}

export default function Invoices({
  profile,
  invoices,
  creditNotes = [],
  customers,
  products,
  services = [],
  materials = [],
  jobs = [],
  customTemplates = [],
  onSaveCustomTemplate,
  onDeleteCustomTemplate,
  onUpdateInvoiceTemplate,
  onCreateInvoiceDirect,
  onUpdateInvoice,
  onDeleteInvoice,
  onUpdateInvoiceStatus,
  onCreateCreditNote,
  onDeleteCreditNote,
  onSelectActiveInvoiceIdForBuyer,
  onEditProductInCatalogue,
  onAddNewProductInCatalogue,
  onAddCustomer,
  onUpdateCustomer,
  invoicesStartInCreationMode = false,
  onResetInvoicesStartInCreationMode
}: InvoicesProps) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'overdue' | 'credited'>('all');
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [isCreditNoteModalOpen, setIsCreditNoteModalOpen] = useState(false);
  const [selectedCreditNoteForView, setSelectedCreditNoteForView] = useState<CreditNote | null>(null);
  
  // Modals & Catalog state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [modalTab, setModalTab] = useState<'products' | 'services' | 'custom'>('products');
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [customizerInitialStyle, setCustomizerInitialStyle] = useState<QuoteTemplateStyle | undefined>(undefined);

  // Quick custom item form in modal
  const [customItemName, setCustomItemName] = useState('');
  const [customItemDesc, setCustomItemDesc] = useState('');
  const [customItemQty, setCustomItemQty] = useState<number>(1);
  const [customItemPrice, setCustomItemPrice] = useState<number | string>('');
  const [customItemCost, setCustomItemCost] = useState<number | string>('');

  // Customer Modal Form states
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomerForModal, setEditingCustomerForModal] = useState<Customer | null>(null);
  const [modalCustName, setModalCustName] = useState('');
  const [modalCustPhone, setModalCustPhone] = useState('');
  const [modalCustEmail, setModalCustEmail] = useState('');
  const [modalCustContactPerson, setModalCustContactPerson] = useState('');
  const [modalCustStreet, setModalCustStreet] = useState('');
  const [modalCustCity, setModalCustCity] = useState('');
  const [modalCustProvince, setModalCustProvince] = useState('');
  const [modalCustPostalCode, setModalCustPostalCode] = useState('');
  const [modalCustCountry, setModalCustCountry] = useState('');
  const [modalCustNotes, setModalCustNotes] = useState('');
  const [modalCustIsBusiness, setModalCustIsBusiness] = useState(false);
  const [modalCustVatNumber, setModalCustVatNumber] = useState('');
  const [modalCustCompanyRegNumber, setModalCustCompanyRegNumber] = useState('');
  const [modalCustUseSameAddress, setModalCustUseSameAddress] = useState(true);
  const [modalCustShippingStreet, setModalCustShippingStreet] = useState('');
  const [modalCustShippingCity, setModalCustShippingCity] = useState('');
  const [modalCustShippingProvince, setModalCustShippingProvince] = useState('');
  const [modalCustShippingPostalCode, setModalCustShippingPostalCode] = useState('');
  const [modalCustShippingCountry, setModalCustShippingCountry] = useState('');

  // Date States
  const [invoiceDate, setInvoiceDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>(() => addDays(30));
  const [isExportingPdf, setIsExportingPdf] = useState(false);

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
    setConfigHideImage(false);
    setConfigOverriddenTotal(null);
    setIsTotalDirty(false);
    setExtrasAsSeparate({});
  };

  const handleOpenCustomerModal = (cust: Customer | null) => {
    if (cust) {
      setEditingCustomerForModal(cust);
      setModalCustName(cust.name);
      setModalCustPhone(cust.phone || '');
      setModalCustEmail(cust.email || '');
      setModalCustContactPerson(cust.contactPerson || '');
      setModalCustIsBusiness(cust.isBusiness || false);
      setModalCustVatNumber(cust.vatNumber || '');
      setModalCustCompanyRegNumber(cust.companyRegistrationNumber || '');

      const parsedBilling = parseAddress(cust.billingAddress || cust.address || '');
      setModalCustStreet(parsedBilling.street);
      setModalCustCity(parsedBilling.city);
      setModalCustProvince(parsedBilling.province);
      setModalCustPostalCode(parsedBilling.postalCode);
      setModalCustCountry(parsedBilling.country);

      setModalCustUseSameAddress(cust.useSameAddress ?? (!cust.shippingAddress || cust.shippingAddress === (cust.billingAddress || cust.address)));
      
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
      setModalCustStreet('');
      setModalCustCity('');
      setModalCustProvince('');
      setModalCustPostalCode('');
      setModalCustCountry('');
      setModalCustUseSameAddress(true);
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

    const formattedBillingAddress = formatAddress({
      street: modalCustStreet,
      city: modalCustCity,
      province: modalCustProvince,
      postalCode: modalCustPostalCode,
      country: modalCustCountry
    });

    const formattedShippingAddress = modalCustUseSameAddress
      ? formattedBillingAddress
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
      address: formattedBillingAddress,
      billingAddress: formattedBillingAddress,
      shippingAddress: formattedShippingAddress,
      useSameAddress: modalCustUseSameAddress,
      isBusiness: modalCustIsBusiness,
      contactPerson: modalCustIsBusiness && modalCustContactPerson.trim() ? modalCustContactPerson.trim() : undefined,
      vatNumber: modalCustIsBusiness ? modalCustVatNumber.trim() : undefined,
      companyRegistrationNumber: modalCustIsBusiness ? modalCustCompanyRegNumber.trim() : undefined,
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

  // Auto Invoice Number logic
  const nextIndex = invoices.length + 1;
  const autoInvoiceNumber = `INV-${new Date().getFullYear()}-${String(nextIndex).padStart(3, '0')}`;
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState('');

  const [customerId, setCustomerId] = useState('');
  const [dueDays, setDueDays] = useState<number>(30);
  const [invoiceNotes, setInvoiceNotes] = useState('Payment is due within 30 days. Please use the invoice number as reference when making electronic transfers. Send proof of payment to accounts.');
  const [invoiceTemplate, setInvoiceTemplate] = useState<string>('artisan-warm');
  const [creatingCustomStyle, setCreatingCustomStyle] = useState<QuoteTemplateStyle | undefined>(undefined);

  // Invoice-level Discount
  const [hasInvoiceDiscount, setHasInvoiceDiscount] = useState(false);
  const [invoiceDiscountType, setInvoiceDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [invoiceDiscountVal, setInvoiceDiscountVal] = useState<number>(0);

  // Invoice-level Tax
  const [hasInvoiceTax, setHasInvoiceTax] = useState(profile.isVatRegistered);
  const [invoiceTaxRate, setInvoiceTaxRate] = useState<number>(profile.isVatRegistered ? profile.vatRate : 15);

  // Active line items
  const [lineItems, setLineItems] = useState<Omit<InvoiceLineItem, 'id' | 'total'>[]>([]);

  // Fulfillment presets & state
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
  const [isFulfilmentAddModalOpen, setIsFulfilmentAddModalOpen] = useState<boolean>(false);
  const [isFulfilmentConfigModalOpen, setIsFulfilmentConfigModalOpen] = useState<boolean>(false);
  const [newPresetLabel, setNewPresetLabel] = useState<string>('');
  const [newPresetType, setNewPresetType] = useState<'collection' | 'delivery'>('delivery');
  const [newPresetPricingMode, setNewPresetPricingMode] = useState<'free' | 'fixed' | 'variable'>('free');
  const [newPresetPrice, setNewPresetPrice] = useState<number>(0);
  const [enteredFulfillmentPrice, setEnteredFulfillmentPrice] = useState<number>(0);

  // Separate address parts
  const [addrLine, setAddrLine] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrProvince, setAddrProvince] = useState('');
  const [addrPostalCode, setAddrPostalCode] = useState('');
  const [addrCountry, setAddrCountry] = useState('South Africa');

  useEffect(() => {
    const parts = [addrLine, addrCity, addrProvince, addrPostalCode, addrCountry]
      .map(p => p.trim())
      .filter(Boolean);
    setCustomFulfillmentAddress(parts.join(', '));
  }, [addrLine, addrCity, addrProvince, addrPostalCode, addrCountry]);

  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => {
        setShowSuccessToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  // Auto-start in creation mode if requested
  useEffect(() => {
    if (invoicesStartInCreationMode) {
      setIsCreating(true);
      setEditingInvoiceId(null);
      setLineItems([]);
      setHasInvoiceDiscount(false);
      setInvoiceDiscountVal(0);
      setCustomInvoiceNumber(`INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`);
      setCustomerId('');
      setCreatingCustomStyle(undefined);
      setInvoiceTemplate('artisan-warm');
      onResetInvoicesStartInCreationMode?.();
    }
  }, [invoicesStartInCreationMode, invoices.length, onResetInvoicesStartInCreationMode]);

  useEffect(() => {
    if (isCreating && !editingInvoiceId && !customInvoiceNumber) {
      setCustomInvoiceNumber(autoInvoiceNumber);
    } else if (!isCreating) {
      setCustomInvoiceNumber('');
    }
  }, [isCreating, editingInvoiceId, autoInvoiceNumber, customInvoiceNumber]);

  const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);

  const formatZAR = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
  };

  const getTierUnitPrice = (product: Product, quantity: number): number => {
    const matchedBreak = product.priceBreaks?.find(
      b => quantity >= b.minQty && (b.maxQty === undefined || quantity <= b.maxQty)
    );
    return matchedBreak ? matchedBreak.unitPrice : product.basePrice;
  };

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
    const initialCustoms: LineItemCustomizations = {};
    product.customizationOptions?.forEach(opt => {
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

    const newItem: Omit<InvoiceLineItem, 'id' | 'total'> = {
      productId: 'custom_' + Date.now(),
      productName: customItemName.trim(),
      productPhoto: '',
      productDescription: customItemDesc.trim(),
      quantity: qtyNum,
      baseUnitPrice: priceNum,
      appliedUnitPrice: priceNum,
      selectedCustomizations: {},
      unitCost: costNum > 0 ? costNum : undefined
    };

    setLineItems(prev => [...prev, newItem]);
    setCustomItemName('');
    setCustomItemDesc('');
    setCustomItemQty(1);
    setCustomItemPrice('');
    setCustomItemCost('');
    setIsProductModalOpen(false);
  };

  const handleAddAdvancedCustomItem = (res: CustomItemResult) => {
    const newItem: Omit<InvoiceLineItem, 'id' | 'total'> = {
      productId: 'adv_' + Date.now(),
      productName: res.name,
      productPhoto: res.photo || '',
      productDescription: res.description,
      quantity: res.quantity,
      baseUnitPrice: res.unitPrice,
      appliedUnitPrice: res.unitPrice,
      selectedCustomizations: {},
      unitCost: res.unitCost
    };

    setLineItems(prev => [...prev, newItem]);
    setIsAdvancedModalOpen(false);
    setIsProductModalOpen(false);
  };

  const handleConfirmAddProduct = () => {
    if (!selectedProductToConfigure) return;

    let appliedUnitPrice = configRate;
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

    if (isTotalDirty && configOverriddenTotal !== null) {
      const customUpliftsSum = (Object.values(effectiveConfigCustoms) as SelectedCustomization[]).reduce((sum, item) => sum + item.priceUplift, 0);
      let targetPreTax = configOverriddenTotal;
      if (hasConfigTax && configTaxRate > 0) {
        targetPreTax = configOverriddenTotal / (1 + configTaxRate / 100);
      }
      let targetPreDiscount = targetPreTax;
      if (hasConfigDiscount && configDiscountVal > 0) {
        if (configDiscountType === 'percentage') {
          targetPreDiscount = targetPreTax / (1 - configDiscountVal / 100);
        } else {
          targetPreDiscount = targetPreTax + configDiscountVal;
        }
      }
      const derivedUnitPriceWithCustoms = targetPreDiscount / Math.max(1, configQty);
      appliedUnitPrice = Math.max(0, derivedUnitPriceWithCustoms - customUpliftsSum);
    }

    const itemDiscount: Discount | undefined = hasConfigDiscount && configDiscountVal > 0 
      ? { type: configDiscountType, value: configDiscountVal } 
      : undefined;

    const mainCustoms: LineItemCustomizations = {};
    const separateItemsToAdd: Omit<InvoiceLineItem, 'id' | 'total'>[] = [];

    Object.entries(effectiveConfigCustoms).forEach(([optName, cVal]) => {
      const isSeparate = extrasAsSeparate[optName];
      const cValTyped = cVal as SelectedCustomization;
      if (isSeparate) {
        separateItemsToAdd.push({
          productId: `extra_${selectedProductToConfigure.id}_${optName}`,
          productName: `${selectedProductToConfigure.name} - ${optName}: ${cValTyped.value}`,
          productPhoto: cValTyped.photo || selectedProductToConfigure.photo || '',
          productDescription: `Extra for ${selectedProductToConfigure.name}`,
          quantity: configQty,
          baseUnitPrice: cValTyped.priceUplift,
          appliedUnitPrice: cValTyped.priceUplift,
          selectedCustomizations: {} as LineItemCustomizations,
          itemDiscount: undefined,
          hideImage: configHideImage
        });
      } else {
        mainCustoms[optName] = cValTyped;
      }
    });

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
            quantity: configQty,
            appliedUnitPrice,
            selectedCustomizations: mainCustoms,
            itemDiscount,
            taxRate: lineItemTaxRate,
            hideImage: configHideImage
          };
        });
        return [...nextItems, ...separateItemsToAdd];
      });
      setEditingLineItemIndex(null);
    } else {
      const newItem: Omit<InvoiceLineItem, 'id' | 'total'> = {
        productId: selectedProductToConfigure.id,
        productName: selectedProductToConfigure.name,
        productPhoto: mainPhoto,
        productDescription: selectedProductToConfigure.description,
        quantity: configQty,
        baseUnitPrice: selectedProductToConfigure.basePrice,
        appliedUnitPrice,
        selectedCustomizations: mainCustoms,
        itemDiscount,
        taxRate: lineItemTaxRate,
        hideImage: configHideImage
      };
      setLineItems(prev => [...prev, newItem, ...separateItemsToAdd]);
    }
    
    setSelectedProductToConfigure(null);
    setExtrasAsSeparate({});
    setIsProductModalOpen(false);
  };

  const handleUpdateQty = (index: number, quantity: number) => {
    const qty = Math.max(1, quantity);
    setLineItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      const product = products.find(p => p.id === item.productId);
      const appliedUnitPrice = product ? getTierUnitPrice(product, qty) : item.appliedUnitPrice;
      return {
        ...item,
        quantity: qty,
        appliedUnitPrice
      };
    }));
  };

  const handleRemoveLineItem = (idx: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleStartEditInvoice = (inv: Invoice) => {
    setEditingInvoiceId(inv.id);
    setSelectedInvoiceId(null);
    setIsCreating(true);
    setCustomInvoiceNumber(inv.invoiceNumber);
    setCustomerId(inv.customerId);
    setInvoiceDate(inv.date || new Date().toISOString().split('T')[0]);
    setInvoiceDueDate(inv.dueDate || addDays(30, inv.date));
    setInvoiceNotes(inv.notes || '');
    setInvoiceTemplate(inv.templateId || 'artisan-warm');
    setCreatingCustomStyle(inv.templateCustomStyle);
    
    // Set line items
    setLineItems(inv.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      productPhoto: item.productPhoto,
      productDescription: item.productDescription,
      quantity: item.quantity,
      baseUnitPrice: item.baseUnitPrice || item.appliedUnitPrice,
      appliedUnitPrice: item.appliedUnitPrice,
      selectedCustomizations: item.selectedCustomizations || {},
      itemDiscount: item.itemDiscount,
      taxRate: item.taxRate,
      unitCost: item.unitCost
    })));

    // Set discount
    if (inv.hasDiscount && inv.discount) {
      setHasInvoiceDiscount(true);
      setInvoiceDiscountType(inv.discount.type);
      setInvoiceDiscountVal(inv.discount.value);
    } else {
      setHasInvoiceDiscount(false);
      setInvoiceDiscountVal(0);
    }

    // Set tax
    setHasInvoiceTax(inv.hasVat);

    // Set fulfillment
    if (inv.fulfillmentType) {
      setFulfillmentType(inv.fulfillmentType);
      const matchedPreset = fulfillmentPresets.find(p => p.label === inv.fulfillmentLabel);
      if (matchedPreset) {
        setSelectedFulfillmentPresetId(matchedPreset.id);
      }
      setEnteredFulfillmentPrice(inv.fulfillmentPrice || 0);
      setCustomFulfillmentAddress(inv.fulfillmentAddress || '');
      setUseCustomerAddress(inv.useCustomerAddressForDelivery !== false);
    } else {
      setSelectedFulfillmentPresetId('');
      setFulfillmentType(undefined);
    }
  };

  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || lineItems.length === 0) return;

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const finalItems: InvoiceLineItem[] = lineItems.map((item, idx) => {
      const lineItemTotal = calculateItemBlockTotal(
        item.appliedUnitPrice,
        item.quantity,
        item.selectedCustomizations,
        item.itemDiscount,
        item.taxRate
      );
      return {
        ...item,
        id: `ii_${Date.now()}_${idx}`,
        total: lineItemTotal
      } as InvoiceLineItem;
    });

    const itemsSubtotal = finalItems.reduce((sum, item) => sum + item.total, 0);

    // Calculate invoice-level discount
    let overallDiscountAmount = 0;
    if (hasInvoiceDiscount && invoiceDiscountVal > 0) {
      if (invoiceDiscountType === 'percentage') {
        overallDiscountAmount = itemsSubtotal * (invoiceDiscountVal / 100);
      } else {
        overallDiscountAmount = Math.min(itemsSubtotal, invoiceDiscountVal);
      }
    }

    const taxableAmount = Math.max(0, itemsSubtotal - overallDiscountAmount);

    // Calculate VAT (Tax) on taxableAmount (Items subtotal minus discount, matching Quotes)
    let vatAmount = 0;
    if (hasInvoiceTax && invoiceTaxRate > 0) {
      const vatRateDec = invoiceTaxRate / 100;
      vatAmount = taxableAmount * vatRateDec;
    }

    // Calculate Fulfillment
    const selectedPreset = fulfillmentPresets.find(p => p.id === selectedFulfillmentPresetId);
    let fulfillmentPrice = 0;
    let fulfillmentLabel = '';

    if (selectedPreset) {
      fulfillmentLabel = selectedPreset.label || (selectedPreset.type === 'collection' ? 'Collection' : 'Delivery');
      if (selectedPreset.isVariable) {
        fulfillmentPrice = enteredFulfillmentPrice;
      } else {
        fulfillmentPrice = selectedPreset.price;
      }
    }

    const totalAmount = parseFloat((taxableAmount + vatAmount + fulfillmentPrice).toFixed(2));

    const invoicePayload = {
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
      date: invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: invoiceDueDate || addDays(30, invoiceDate),
      items: finalItems,
      discount: { type: invoiceDiscountType, value: invoiceDiscountVal },
      hasDiscount: hasInvoiceDiscount,
      notes: invoiceNotes,
      status: 'unpaid' as InvoiceStatus,
      templateId: invoiceTemplate,
      templateCustomStyle: creatingCustomStyle,
      totalAmount,
      subtotal: parseFloat(taxableAmount.toFixed(2)),
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      hasVat: hasInvoiceTax,
      fulfillmentType,
      fulfillmentLabel,
      fulfillmentPrice,
      fulfillmentAddress: customFulfillmentAddress,
      useCustomerAddressForDelivery: useCustomerAddress
    };

    if (editingInvoiceId && onUpdateInvoice) {
      const existing = invoices.find(inv => inv.id === editingInvoiceId);
      if (existing) {
        const updated = onUpdateInvoice({
          ...existing,
          ...invoicePayload,
          invoiceNumber: customInvoiceNumber || existing.invoiceNumber
        });
        setSelectedInvoiceId(updated.id);
        setShowSuccessToast(`Invoice "${updated.invoiceNumber}" updated successfully!`);
      }
    } else {
      const savedInv = onCreateInvoiceDirect(invoicePayload);
      setSelectedInvoiceId(savedInv.id);
      setShowSuccessToast(`Direct invoice "${savedInv.invoiceNumber}" created successfully!`);
    }

    setIsCreating(false);
    setEditingInvoiceId(null);
  };

  const selectedCustomer = customers.find(c => c.id === customerId);
  const selectedPreset = fulfillmentPresets.find(p => p.id === selectedFulfillmentPresetId);

  // In-Line financial totals for creating/editing invoice
  const currentItemsSubtotal = lineItems.reduce((sum, item) => {
    return sum + calculateItemBlockTotal(
      item.appliedUnitPrice,
      item.quantity,
      item.selectedCustomizations || {},
      item.itemDiscount,
      item.taxRate
    );
  }, 0);

  let currentDiscountAmount = 0;
  if (hasInvoiceDiscount && invoiceDiscountVal > 0) {
    if (invoiceDiscountType === 'percentage') {
      currentDiscountAmount = currentItemsSubtotal * (invoiceDiscountVal / 100);
    } else {
      currentDiscountAmount = Math.min(currentItemsSubtotal, invoiceDiscountVal);
    }
  }

  const currentTaxableAmount = Math.max(0, currentItemsSubtotal - currentDiscountAmount);

  let currentFulfillmentPrice = 0;
  if (selectedPreset) {
    if (selectedPreset.isVariable) {
      currentFulfillmentPrice = enteredFulfillmentPrice;
    } else {
      currentFulfillmentPrice = selectedPreset.price;
    }
  }

  let currentTaxAmount = 0;
  if (hasInvoiceTax && invoiceTaxRate > 0) {
    currentTaxAmount = currentTaxableAmount * (invoiceTaxRate / 100);
  }

  const currentFinalTotal = currentTaxableAmount + currentTaxAmount + currentFulfillmentPrice;

  // Filter invoices for list
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' 
      ? true 
      : statusFilter === 'credited' 
        ? (inv.status === 'credited' || inv.status === 'partially_credited')
        : inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12" id="invoices-tab-view">
      {/* Toast Notification */}
      {showSuccessToast && (
        <div 
          data-print-hide="true"
          className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fadeIn print:hidden"
        >
          <div className="p-1 bg-emerald-500 rounded-full text-white">
            <Check size={14} />
          </div>
          <span className="text-xs font-bold">{showSuccessToast}</span>
          <button onClick={() => setShowSuccessToast(null)} className="text-stone-400 hover:text-white p-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* SEARCH & FILTERS HEADER */}
      {!isCreating && !selectedInvoiceId && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-stone-800">Invoices</h2>
            <div className="flex items-center bg-stone-100 p-1 rounded-xl text-xs font-semibold flex-wrap gap-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${statusFilter === 'all' ? 'bg-white text-stone-900 shadow-2xs font-extrabold' : 'text-stone-500 hover:text-stone-800'}`}
              >
                All ({invoices.length})
              </button>
              <button
                onClick={() => setStatusFilter('unpaid')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${statusFilter === 'unpaid' ? 'bg-white text-amber-900 shadow-2xs font-extrabold' : 'text-stone-500 hover:text-stone-800'}`}
              >
                Unpaid
              </button>
              <button
                onClick={() => setStatusFilter('paid')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${statusFilter === 'paid' ? 'bg-white text-emerald-900 shadow-2xs font-extrabold' : 'text-stone-500 hover:text-stone-800'}`}
              >
                Paid
              </button>
              <button
                onClick={() => setStatusFilter('overdue')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${statusFilter === 'overdue' ? 'bg-white text-rose-900 shadow-2xs font-extrabold' : 'text-stone-500 hover:text-stone-800'}`}
              >
                Overdue
              </button>
              <button
                onClick={() => setStatusFilter('credited')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${statusFilter === 'credited' ? 'bg-white text-purple-900 shadow-2xs font-extrabold' : 'text-stone-500 hover:text-stone-800'}`}
              >
                Credited
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-stone-400" size={14} />
              <input
                type="text"
                placeholder="Search invoices by number or buyer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
              />
            </div>
            <button
              onClick={() => {
                setIsCreating(true);
                setEditingInvoiceId(null);
                setCustomerId('');
                setLineItems([]);
                setHasInvoiceDiscount(false);
                setInvoiceDiscountVal(0);
                setCustomInvoiceNumber(`INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`);
              }}
              className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition shrink-0"
            >
              <PlusCircle size={14} /> Create New Invoice
            </button>
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {!isCreating && !selectedInvoiceId && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium px-1">
            <span>
              Showing <strong className="text-stone-800">{filteredInvoices.length}</strong> of <strong className="text-stone-800">{invoices.length}</strong> invoices
            </span>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-8">
              <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-3">
                <Receipt size={24} />
              </div>
              <h3 className="font-bold text-stone-800 text-base mb-1">No invoices found</h3>
              <p className="text-stone-500 text-xs mb-4">Get started by generating a new invoice or accepting a quote.</p>
              <button
                onClick={() => {
                  setIsCreating(true);
                  setEditingInvoiceId(null);
                  setCustomerId('');
                  setLineItems([]);
                }}
                className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <PlusCircle size={14} /> Create New Invoice
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white rounded-2xl border border-stone-200 shadow-3xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider">
                        <th className="py-3.5 px-5">Invoice Number</th>
                        <th className="py-3.5 px-5">Customer</th>
                        <th className="py-3.5 px-5">Date Issued</th>
                        <th className="py-3.5 px-5">Due Date</th>
                        <th className="py-3.5 px-5 text-right">Total Amount</th>
                        <th className="py-3.5 px-5 text-center">Status</th>
                        <th className="py-3.5 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredInvoices.map((inv) => (
                        <tr
                          key={inv.id}
                          onClick={() => setSelectedInvoiceId(inv.id)}
                          className="hover:bg-amber-50/20 transition cursor-pointer group"
                        >
                          <td className="py-4 px-5 font-bold text-amber-700">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-4 px-5">
                            <span className="font-semibold text-stone-800 block">{inv.customerName}</span>
                            <span className="text-[10px] text-stone-400 font-medium">{inv.customerEmail || 'No email stored'}</span>
                          </td>
                          <td className="py-4 px-5 text-stone-500 font-medium">
                            {formatSADate(inv.date)}
                          </td>
                          <td className="py-4 px-5 text-stone-500 font-medium">
                            {formatSADate(inv.dueDate)}
                          </td>
                          <td className="py-4 px-5 text-right font-bold text-stone-900">
                            {formatZAR(inv.totalAmount)}
                          </td>
                          <td className="py-4 px-5 text-center">
                            <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                              inv.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : inv.status === 'overdue'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : inv.status === 'credited'
                                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                                    : inv.status === 'partially_credited'
                                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                                      : 'bg-stone-50 text-stone-800 border-stone-200'
                            }`}>
                              {inv.status === 'partially_credited' ? 'Partially Credited' : inv.status}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                              {onCreateCreditNote && inv.status !== 'credited' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedInvoiceId(inv.id);
                                    setIsCreditNoteModalOpen(true);
                                  }}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="Issue Credit Note"
                                >
                                  <RotateCcw size={12} />
                                  Credit
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleStartEditInvoice(inv)}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                title="Edit Invoice"
                              >
                                <Edit2 size={12} />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedInvoiceId(inv.id)}
                                className="bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <Eye size={12} />
                                View
                              </button>
                              {onDeleteInvoice && (
                                <button
                                  type="button"
                                  onClick={() => setInvoiceToDelete(inv)}
                                  className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-stone-200 rounded-xl transition cursor-pointer"
                                  title="Delete Invoice"
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
              </div>

              {/* Mobile Card Stack View */}
              <div className="block md:hidden space-y-3">
                {filteredInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => setSelectedInvoiceId(inv.id)}
                    className="p-4 rounded-2xl border border-stone-200 bg-white hover:border-amber-300 hover:bg-amber-50/10 cursor-pointer transition space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-lg">
                          {inv.invoiceNumber}
                        </span>
                        <h4 className="font-extrabold text-stone-800 text-sm mt-2">{inv.customerName}</h4>
                        <span className="text-xs text-stone-400">Issued: {formatSADate(inv.date)} • Due: {formatSADate(inv.dueDate)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-stone-900 block">{formatZAR(inv.totalAmount)}</span>
                        <span className={`inline-block mt-1 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                          inv.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : inv.status === 'overdue'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : inv.status === 'credited'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : inv.status === 'partially_credited'
                                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                                  : 'bg-stone-50 text-stone-800 border-stone-200'
                        }`}>
                          {inv.status === 'partially_credited' ? 'Partially Credited' : inv.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100" onClick={e => e.stopPropagation()}>
                      {onCreateCreditNote && inv.status !== 'credited' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoiceId(inv.id);
                            setIsCreditNoteModalOpen(true);
                          }}
                          className="bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw size={12} /> Credit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStartEditInvoice(inv)}
                        className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedInvoiceId(inv.id)}
                        className="bg-stone-50 text-stone-700 border border-stone-200 px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye size={12} /> View
                      </button>
                      {onDeleteInvoice && (
                        <button
                          type="button"
                          onClick={() => setInvoiceToDelete(inv)}
                          className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-stone-200 rounded-xl transition cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* CREATE & EDIT VIEW */}
      {isCreating && (
        <form onSubmit={handleSaveInvoice} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <h3 className="font-extrabold text-stone-800 text-lg">
                {editingInvoiceId ? 'Edit Invoice' : 'Create New Invoice'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingInvoiceId(null);
              }}
              className="text-stone-400 hover:text-stone-600 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6 animate-fadeIn">
            {/* Invoice Number & Dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Invoice Number *</label>
                <input
                  type="text"
                  required
                  value={customInvoiceNumber}
                  onChange={e => setCustomInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                  placeholder="e.g. INV-2026-001"
                />
              </div>

              <div>
                <DatePickerWithShortcuts
                  label="Date of Issue *"
                  value={invoiceDate}
                  onChange={setInvoiceDate}
                  type="issue"
                />
              </div>

              <div>
                <DatePickerWithShortcuts
                  label="Payment Due Date *"
                  value={invoiceDueDate}
                  onChange={setInvoiceDueDate}
                  type="expiry"
                  baseDateForShortcuts={invoiceDate}
                />
              </div>
            </div>

            {/* Customer Selector */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider">Customer *</label>
                {selectedCustomer && (
                  <span className="text-[11px] text-stone-400 font-medium">
                    {selectedCustomer.isBusiness ? '🏢 Registered Business' : '👤 Individual Client'}
                  </span>
                )}
              </div>
              <div className="relative">
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
                    className="w-full pl-9 pr-24 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                  />
                  <div className="absolute right-2 flex items-center gap-1.5">
                    {selectedCustomer && (
                      <button
                        type="button"
                        onClick={() => handleOpenCustomerModal(selectedCustomer)}
                        className="text-[10px] text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/40 px-2 py-0.5 rounded font-extrabold cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                      className="text-stone-400 hover:text-stone-600 p-0.5"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>

                {isCustomerDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsCustomerDropdownOpen(false)}></div>
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-20 max-h-60 overflow-y-auto divide-y divide-stone-100 p-1">
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

                      {(() => {
                        const filtered = customers.filter(c =>
                          c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                          c.email?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                          c.phone?.includes(customerSearchQuery)
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
                                  <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded border border-amber-200">
                                    Business
                                  </span>
                                )}
                              </div>
                              <span className="block text-[10px] text-stone-400 font-normal truncate text-left">{c.email || c.phone || 'No email'}</span>
                            </div>
                          </button>
                        ));
                      })()}
                    </div>
                  </>
                )}
              </div>

              {/* Selected Customer Details Card Preview */}
              {selectedCustomer && (
                <div className="mt-2.5 p-3.5 bg-stone-50/80 rounded-xl border border-stone-200/80 text-xs text-stone-700 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900">{selectedCustomer.name}</span>
                      {selectedCustomer.isBusiness ? (
                        <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                          Registered Business
                        </span>
                      ) : (
                        <span className="text-[10px] bg-stone-200/80 text-stone-700 font-bold px-2 py-0.5 rounded-full">
                          Individual
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenCustomerModal(selectedCustomer)}
                      className="text-[11px] text-amber-700 hover:text-amber-800 hover:underline font-bold"
                    >
                      Edit details
                    </button>
                  </div>

                  {selectedCustomer.isBusiness && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] bg-white p-2 rounded-lg border border-stone-200/60">
                      {selectedCustomer.contactPerson && (
                        <div>
                          <span className="text-stone-400 font-medium block text-[10px] uppercase tracking-wider">Contact Person</span>
                          <span className="font-semibold text-stone-800">{selectedCustomer.contactPerson}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-stone-400 font-medium block text-[10px] uppercase tracking-wider">Company Reg No.</span>
                        <span className="font-semibold text-stone-800">{selectedCustomer.companyRegistrationNumber || 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 font-medium block text-[10px] uppercase tracking-wider">Customer VAT No.</span>
                        <span className="font-semibold text-stone-800">{selectedCustomer.vatNumber || 'Not specified'}</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <span className="text-stone-400 font-medium block text-[10px] uppercase tracking-wider">Billing Address</span>
                      <p className="text-stone-700 font-normal mt-0.5">{selectedCustomer.billingAddress || selectedCustomer.address || 'No billing address provided'}</p>
                    </div>
                    <div>
                      <span className="text-stone-400 font-medium block text-[10px] uppercase tracking-wider">Shipping Address</span>
                      <p className="text-stone-700 font-normal mt-0.5">
                        {selectedCustomer.shippingAddress || selectedCustomer.billingAddress || selectedCustomer.address || 'Same as billing address'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Line Items Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider">Invoice Items *</label>
                {lineItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setLineItems([])}
                    className="text-[10px] text-rose-600 hover:underline font-bold"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {lineItems.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-stone-200 bg-stone-50/20 rounded-2xl text-xs text-stone-400 italic flex flex-col items-center justify-center gap-3">
                  <div className="p-3 bg-stone-100 rounded-full text-stone-400">
                    <Layers size={22} />
                  </div>
                  <div className="space-y-0.5">
                    <span className="font-bold text-stone-700 block">No items added to invoice yet</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProductModalOpen(true);
                      setModalSearchQuery('');
                    }}
                    className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all duration-150 active:scale-95"
                  >
                    <PlusCircle size={14} /> Add items
                  </button>
                </div>
              ) : (
                <div className="border border-stone-200 rounded-2xl bg-white overflow-hidden shadow-xs">
                  {/* Table Headers */}
                  <div className="hidden md:grid grid-cols-12 gap-4 bg-stone-50/70 border-b border-stone-200 px-4 py-3 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                    <div className="col-span-5">Item</div>
                    <div className="col-span-2 text-right">Unit Price</div>
                    <div className="col-span-1 text-center">Quantity</div>
                    <div className="col-span-2 text-center">Discount</div>
                    <div className="col-span-2 text-right">Line Total</div>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-stone-100">
                    {lineItems.map((item, idx) => {
                      const lineItemTotal = calculateItemBlockTotal(
                        item.appliedUnitPrice,
                        item.quantity,
                        item.selectedCustomizations || {},
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
                        <div key={idx} className="p-4 hover:bg-stone-50/40 transition duration-150 animate-fadeIn">
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start md:items-center">
                            
                            {/* Product Details */}
                            <div className="col-span-1 md:col-span-5 space-y-2">
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
                                    Item
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
                                          setConfigCustoms(item.selectedCustomizations || {});
                                          if (item.itemDiscount) {
                                            setHasConfigDiscount(true);
                                            setConfigDiscountType(item.itemDiscount.type);
                                            setConfigDiscountVal(item.itemDiscount.value);
                                          } else {
                                            setHasConfigDiscount(false);
                                            setConfigDiscountType('percentage');
                                            setConfigDiscountVal(0);
                                          }
                                          setIsProductModalOpen(true);
                                        }}
                                        className="text-[9px] text-amber-700 hover:text-amber-800 hover:bg-amber-100/50 font-bold flex items-center gap-0.5 bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded-md shrink-0 cursor-pointer transition-colors"
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

                              {/* Customizations */}
                              {item.selectedCustomizations && Object.keys(item.selectedCustomizations).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {Object.entries(item.selectedCustomizations).map(([optName, cVal]) => {
                                    const config = cVal as { value: string; priceUplift: number };
                                    return (
                                      <span key={optName} className="inline-flex items-center gap-1 text-[10px] bg-stone-100 text-stone-700 border border-stone-200/40 px-2.5 py-0.5 rounded-full font-semibold">
                                        <span className="text-stone-500 font-medium">{optName}:</span> {config.value}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Unit Price */}
                            <div className="col-span-1 md:col-span-2 text-left md:text-right flex md:flex-col justify-between md:justify-center items-center md:items-end">
                              <span className="text-[9px] md:hidden font-bold text-stone-400 uppercase">Unit Price</span>
                              <span className="font-bold text-stone-700 text-xs block">
                                {formatZAR(effectiveUnitPrice)}
                              </span>
                            </div>

                            {/* Quantity */}
                            <div className="col-span-1 md:col-span-1 flex md:justify-center items-center">
                              <div className="w-full flex md:flex-col justify-between md:justify-center items-center gap-1.5">
                                <span className="text-[9px] md:hidden font-bold text-stone-400 uppercase">Quantity</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={e => handleUpdateQty(idx, parseInt(e.target.value) || 1)}
                                  className="w-20 md:w-16 bg-stone-50 px-2 py-1 border border-stone-200 rounded-lg text-xs font-normal text-stone-800 text-center focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                />
                              </div>
                            </div>

                            {/* Discount */}
                            <div className="col-span-1 md:col-span-2 flex md:justify-center items-center">
                              <div className="w-full flex md:flex-col justify-between md:justify-center items-center gap-1.5">
                                <span className="text-[9px] md:hidden font-bold text-stone-400 uppercase">Discount</span>
                                {item.itemDiscount && item.itemDiscount.value > 0 ? (
                                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-xl border border-emerald-100">
                                    -{item.itemDiscount.type === 'percentage' ? `${item.itemDiscount.value}%` : formatZAR(item.itemDiscount.value)}
                                  </span>
                                ) : (
                                  <span className="text-xs font-medium text-stone-400">—</span>
                                )}
                              </div>
                            </div>

                            {/* Line Total & Remove */}
                            <div className="col-span-1 md:col-span-2 flex md:justify-end items-center gap-3">
                              <div className="w-full md:w-auto flex md:flex-row justify-between md:justify-end items-center gap-3">
                                <span className="text-[9px] md:hidden font-bold text-stone-400 uppercase">Line Total</span>
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

                  <div className="px-5 py-3 border-t border-stone-100 flex items-center justify-between bg-white">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProductModalOpen(true);
                        setModalSearchQuery('');
                        setModalTab('products');
                      }}
                      className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all duration-150 active:scale-95"
                    >
                      <PlusCircle size={14} /> Add items
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* In-Line Fulfillment */}
            {lineItems.length > 0 && (
              <div className="p-4 border border-stone-200 rounded-2xl bg-stone-50/50 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-stone-200/50">
                  <span className="text-xs font-black text-stone-800 uppercase tracking-wider block">Fulfilment</span>
                  <button
                    type="button"
                    onClick={() => setIsFulfilmentConfigModalOpen(true)}
                    className="text-[10px] font-extrabold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100/60 border border-amber-200/40 px-2.5 py-1 rounded-lg transition cursor-pointer"
                  >
                    Configure Options
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
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
                      <option value="">Select Fulfilment Option...</option>
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
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-500">R</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Enter Fulfilment Cost"
                        value={enteredFulfillmentPrice || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setEnteredFulfillmentPrice(parseFloat(val.replace(',', '.')) || 0);
                        }}
                        className="w-full pl-7 pr-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                      />
                    </div>
                  )}
                </div>

                {selectedPreset?.type === 'delivery' && (
                  <div className="space-y-2 border-t border-stone-200/50 pt-3">
                    <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider">Delivery Address</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-xs text-stone-750 font-bold cursor-pointer">
                        <input
                          type="radio"
                          name="invAddressOption"
                          checked={useCustomerAddress}
                          onChange={() => setUseCustomerAddress(true)}
                          className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <span>Use customer address</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-stone-750 font-bold cursor-pointer">
                        <input
                          type="radio"
                          name="invAddressOption"
                          checked={!useCustomerAddress}
                          onChange={() => setUseCustomerAddress(false)}
                          className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <span>Specify different address</span>
                      </label>
                    </div>

                    {!useCustomerAddress && (
                      <div className="bg-white p-3 rounded-xl border border-stone-200/60 space-y-2">
                        <input
                          type="text"
                          placeholder="Street Address"
                          value={addrLine}
                          onChange={e => setAddrLine(e.target.value)}
                          className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="City"
                            value={addrCity}
                            onChange={e => setAddrCity(e.target.value)}
                            className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                          />
                          <input
                            type="text"
                            placeholder="Province"
                            value={addrProvince}
                            onChange={e => setAddrProvince(e.target.value)}
                            className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Summary Block: Total of items, Add discount, Add tax options */}
            {lineItems.length > 0 && (
              <div className="bg-stone-50/50 p-4 border-t border-stone-100 flex justify-end rounded-2xl">
                {/* Calculations Summary */}
                <div className="space-y-2.5 text-right font-medium text-xs text-stone-600 min-w-[240px]">
                  <div className="flex justify-between items-center text-stone-500">
                    <span>Items Total:</span>
                    <span className="font-bold text-stone-700">{formatZAR(currentItemsSubtotal)}</span>
                  </div>

                  {selectedPreset && (
                    <div className="flex justify-between items-center text-stone-600">
                      <span className="font-semibold text-stone-500">
                        {selectedPreset.type === 'collection' ? 'Collection:' : 'Delivery:'} {selectedPreset.label}
                      </span>
                      <span className="font-bold text-stone-700">
                        {currentFulfillmentPrice === 0 ? 'Free (R0)' : formatZAR(currentFulfillmentPrice)}
                      </span>
                    </div>
                  )}

                  {/* Discount Section (Always below Fulfilment) */}
                  {hasInvoiceDiscount ? (
                    <div className="flex justify-between items-center text-stone-600 animate-fadeIn">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setHasInvoiceDiscount(false);
                            setInvoiceDiscountVal(0);
                          }}
                          className="text-stone-400 hover:text-red-600 font-bold px-1 text-xs cursor-pointer mr-0.5"
                          title="Remove discount"
                        >
                          ×
                        </button>
                        <span className="font-semibold text-stone-500">Discount:</span>
                        <select
                          value={invoiceDiscountType}
                          onChange={e => setInvoiceDiscountType(e.target.value as 'percentage' | 'fixed')}
                          className="bg-transparent border-0 text-stone-700 font-normal p-0 text-[11px] focus:ring-0 focus:outline-none shrink-0 cursor-pointer"
                        >
                          <option value="percentage">%</option>
                          <option value="fixed">R</option>
                        </select>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={invoiceDiscountVal || ''}
                          onChange={e => setInvoiceDiscountVal(parseFloat(e.target.value.replace(',', '.')) || 0)}
                          placeholder="0"
                          className="w-10 bg-white px-1 py-0.5 border border-stone-200 rounded font-normal text-stone-700 text-center text-[10px] focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <span className="font-bold text-amber-800">
                        -{formatZAR(currentDiscountAmount)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-end py-0.5 animate-fadeIn">
                      <button
                        type="button"
                        onClick={() => setHasInvoiceDiscount(true)}
                        className="text-[10px] font-extrabold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100/60 border border-amber-200/40 px-2.5 py-1 rounded-lg transition cursor-pointer"
                      >
                        + Add discount
                      </button>
                    </div>
                  )}

                  {/* Tax Section (Always Below Discount) */}
                  {hasInvoiceTax ? (
                    <div className="flex justify-between items-center text-stone-600 animate-fadeIn">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setHasInvoiceTax(false)}
                          className="text-stone-400 hover:text-red-600 font-bold px-1 text-xs cursor-pointer mr-0.5"
                          title="Remove tax"
                        >
                          ×
                        </button>
                        <span className="font-semibold text-stone-500">Tax:</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={invoiceTaxRate || ''}
                          onChange={e => setInvoiceTaxRate(parseFloat(e.target.value.replace(',', '.')) || 0)}
                          placeholder="15"
                          className="w-10 bg-white px-1 py-0.5 border border-stone-200 rounded font-normal text-stone-700 text-center text-[10px] focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <span className="text-[10px] text-stone-500">%</span>
                      </div>
                      <span className="font-bold text-stone-700">
                        {formatZAR(currentTaxAmount)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-end py-0.5 animate-fadeIn">
                      <button
                        type="button"
                        onClick={() => setHasInvoiceTax(true)}
                        className="text-[10px] font-extrabold text-stone-600 hover:text-stone-800 bg-stone-100/50 hover:bg-stone-100 border border-stone-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                      >
                        + Add tax
                      </button>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-1.5 border-t border-stone-200 text-stone-800 font-bold">
                    <span className="text-xs">Final Invoice Total:</span>
                    <span className="text-sm text-amber-800 font-black">{formatZAR(currentFinalTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Banking Details Card on Invoice Creation Screen */}
            <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Landmark size={15} className="text-amber-700" />
                  <span className="font-bold text-xs uppercase tracking-wider text-amber-950">
                    Bank & Settlement Details (Appears on Invoice)
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

            {/* Invoice Notes */}
            <div>
              <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Notes & Banking Instructions</label>
              <textarea
                rows={2}
                value={invoiceNotes}
                onChange={e => setInvoiceNotes(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                placeholder="Payment terms, banking details, etc."
              />
            </div>

            {/* Internal Financials */}
            {lineItems.length > 0 && (
              <div className="border-t border-stone-200/60 pt-4">
                <InternalQuoteFinancials
                  items={lineItems as any}
                  products={products}
                  materials={materials}
                  quoteTotalAmount={lineItems.reduce((acc, item) => acc + (item.appliedUnitPrice * item.quantity), 0)}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingInvoiceId(null);
                }}
                className="px-4 py-2 border border-stone-200 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-50 cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!customerId || lineItems.length === 0}
                className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-6 py-2 rounded-xl text-xs font-bold shadow-sm cursor-pointer transition"
              >
                <Save size={14} /> {editingInvoiceId ? 'Update Invoice' : 'Save & Issue Invoice'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* DETAIL / DOCUMENT VIEW */}
      {!isCreating && selectedInvoice && (() => {
        const invoiceCreditNotes = (creditNotes || []).filter(cn => cn.invoiceId === selectedInvoice.id);
        const totalCredited = selectedInvoice.creditedAmount || invoiceCreditNotes.reduce((acc, c) => acc + c.totalAmount, 0);

        return (
          <div className="space-y-6 animate-fadeIn">
            {/* Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs print:hidden">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedInvoiceId(null)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 bg-stone-50 hover:bg-stone-100 rounded-xl cursor-pointer transition"
                >
                  <ArrowRight size={18} className="rotate-180" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold text-stone-900">{selectedInvoice.invoiceNumber}</h2>
                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                      selectedInvoice.status === 'paid'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : selectedInvoice.status === 'overdue'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : selectedInvoice.status === 'credited'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : selectedInvoice.status === 'partially_credited'
                              ? 'bg-amber-50 text-amber-900 border-amber-300'
                              : 'bg-stone-50 text-stone-800 border-stone-200'
                    }`}>
                      {selectedInvoice.status === 'partially_credited' ? 'Partially Credited' : selectedInvoice.status}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500">Issued to <span className="font-bold text-stone-700">{selectedInvoice.customerName}</span> on {formatSADate(selectedInvoice.date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {onCreateCreditNote && (
                  <button
                    type="button"
                    onClick={() => setIsCreditNoteModalOpen(true)}
                    disabled={selectedInvoice.status === 'credited'}
                    className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-800 border border-rose-200 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                    title={selectedInvoice.status === 'credited' ? 'Invoice is fully credited' : 'Issue a SARS Section 21 Credit Note'}
                  >
                    <RotateCcw size={14} /> Issue Credit Note
                  </button>
                )}

                {selectedInvoice.status !== 'paid' ? (
                  <button
                    onClick={() => {
                      onUpdateInvoiceStatus(selectedInvoice.id, 'paid');
                      setShowSuccessToast(`Invoice ${selectedInvoice.invoiceNumber} marked as Paid!`);
                    }}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                  >
                    <CheckCircle size={14} /> Mark Paid
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onUpdateInvoiceStatus(selectedInvoice.id, 'unpaid');
                      setShowSuccessToast(`Invoice ${selectedInvoice.invoiceNumber} marked as Unpaid.`);
                    }}
                    className="flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <Clock size={14} /> Mark Unpaid
                  </button>
                )}

                <button
                  onClick={() => onSelectActiveInvoiceIdForBuyer(selectedInvoice.id)}
                  className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <ExternalLink size={14} /> Buyer Portal
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setIsExportingPdf(true);
                    setShowSuccessToast(`Generating PDF for Invoice ${selectedInvoice.invoiceNumber}...`);
                    try {
                      await downloadElementAsPdf('printable-invoice-area', `Invoice_${selectedInvoice.invoiceNumber}.pdf`);
                      setShowSuccessToast(`Invoice ${selectedInvoice.invoiceNumber} downloaded as PDF!`);
                    } catch (e) {
                      window.print();
                    } finally {
                      setIsExportingPdf(false);
                    }
                  }}
                  disabled={isExportingPdf}
                  className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  title="Download crisp A4 PDF with full styling"
                >
                  <Download size={14} /> {isExportingPdf ? 'Generating...' : 'Download PDF'}
                </button>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Printer size={14} /> Print
                </button>

                <button
                  onClick={() => handleStartEditInvoice(selectedInvoice)}
                  className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-900 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                >
                  <Edit2 size={14} /> Edit
                </button>

                {onDeleteInvoice && (
                  <button
                    onClick={() => {
                      onDeleteInvoice(selectedInvoice.id);
                      setSelectedInvoiceId(null);
                    }}
                    className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                    title="Delete Invoice"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* SARS Section 21 Credit Notes Ledger Card */}
            {invoiceCreditNotes.length > 0 && (
              <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4.5 space-y-3 print:hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                      <RotateCcw size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-rose-950 uppercase tracking-wider">
                        SARS Section 21 Tax Credit Notes ({invoiceCreditNotes.length})
                      </h4>
                      <p className="text-[11px] text-rose-700 font-medium">
                        Credited against this invoice: <strong>{formatZAR(totalCredited)}</strong> (Original Total: {formatZAR(selectedInvoice.totalAmount)})
                      </p>
                    </div>
                  </div>
                  {onCreateCreditNote && selectedInvoice.status !== 'credited' && (
                    <button
                      type="button"
                      onClick={() => setIsCreditNoteModalOpen(true)}
                      className="text-xs font-bold text-rose-800 hover:text-rose-900 bg-rose-100 hover:bg-rose-200 border border-rose-300/60 px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw size={12} /> Issue Another Credit Note
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                  {invoiceCreditNotes.map(cn => (
                    <div key={cn.id} className="bg-white p-3.5 rounded-xl border border-rose-200/80 shadow-3xs flex flex-col justify-between gap-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-rose-900">{cn.creditNoteNumber}</span>
                          <span className="text-xs font-black text-stone-900">{formatZAR(cn.totalAmount)}</span>
                        </div>
                        <p className="text-[11px] text-stone-500 font-medium">
                          Issued: {formatSADate(cn.date)} • <span className="italic text-stone-700">{cn.reason}</span>
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                        <span className="text-[10px] text-stone-400 font-medium">{cn.items.length} item(s) credited</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCreditNoteForView(cn)}
                            className="text-[11px] font-bold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                          >
                            <Eye size={12} /> View Document
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Document Renderer */}
          {(() => {
            const currentStyle = resolveQuoteTemplate(
              selectedInvoice.templateId || 'artisan-warm',
              selectedInvoice.templateCustomStyle,
              customTemplates
            );

            const renderItems: RenderItem[] = selectedInvoice.items.map((item, idx) => {
              const customUpliftsSum = Object.values(item.selectedCustomizations || {}).reduce((sum: number, c: any) => sum + (c?.priceUplift || 0), 0);
              return {
                id: `inv_render_${idx}`,
                productName: item.productName,
                productDescription: item.productDescription,
                quantity: item.quantity,
                unitPrice: item.appliedUnitPrice + customUpliftsSum,
                total: item.total,
                selectedCustomizations: item.selectedCustomizations,
                productPhoto: item.productPhoto,
                hideImage: item.hideImage,
              };
            });

            return (
              <DocumentRenderer
                documentType="invoice"
                documentNumber={selectedInvoice.invoiceNumber}
                date={selectedInvoice.date}
                expiryOrDueDate={selectedInvoice.dueDate}
                profile={profile}
                customerName={selectedInvoice.customerName}
                customerEmail={selectedInvoice.customerEmail}
                customerPhone={selectedInvoice.customerPhone}
                customerAddress={selectedInvoice.customerAddress}
                customerIsBusiness={selectedInvoice.customerIsBusiness}
                customerContactPerson={selectedInvoice.customerContactPerson}
                customerVatNumber={selectedInvoice.customerVatNumber}
                customerCompanyRegNumber={selectedInvoice.customerCompanyRegNumber}
                customerBillingAddress={selectedInvoice.customerBillingAddress}
                customerShippingAddress={selectedInvoice.customerShippingAddress}
                items={renderItems}
                subtotal={selectedInvoice.subtotal}
                discount={selectedInvoice.discount}
                hasDiscount={selectedInvoice.hasDiscount}
                vatAmount={selectedInvoice.vatAmount}
                hasVat={selectedInvoice.hasVat}
                totalAmount={selectedInvoice.totalAmount}
                notes={selectedInvoice.notes}
                fulfillmentType={selectedInvoice.fulfillmentType}
                fulfillmentAddress={selectedInvoice.fulfillmentAddress}
                templateStyle={currentStyle}
                printableId="printable-invoice-area"
              />
            );
          })()}

          {/* Internal Financials */}
          <div className="print:hidden" data-print-hide="true">
            <InternalQuoteFinancials
              items={selectedInvoice.items as any}
              products={products}
              materials={materials}
              quoteTotalAmount={selectedInvoice.totalAmount}
            />
          </div>
        </div>
      );
    })()}

      {/* PRODUCT CATALOG & ITEM SELECTION MODAL */}
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
                              <span className="text-[10px] text-stone-500 font-medium">Do not show product photo on this invoice</span>
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
                    const vars = (selectedProductToConfigure.customizationOptions || []).filter(o => o.type !== 'extra');
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
                    const extras = (selectedProductToConfigure.customizationOptions || []).filter(o => o.type === 'extra');
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
                                    <span>List as separate line item on invoice (uses extra image)</span>
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
                    className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-600 transition cursor-pointer"
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
                          setIsAdvancedModalOpen(true);
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
                            className="text-amber-700 hover:text-amber-800 text-[11px] font-extrabold flex items-center gap-1 bg-amber-50/60 border border-amber-100/50 px-3 py-1.5 rounded-xl transition cursor-pointer"
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
                              className="text-xs text-amber-700 hover:underline font-bold mt-1 cursor-pointer"
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

      {/* ADVANCED CUSTOM ITEM MODAL */}
      {isAdvancedModalOpen && (
        <AdvancedCustomItemModal
          isOpen={isAdvancedModalOpen}
          onClose={() => setIsAdvancedModalOpen(false)}
          onAddCustomItem={handleAddAdvancedCustomItem}
          materials={materials}
        />
      )}

      {/* CUSTOMER ADD/EDIT MODAL */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveCustomerModal} className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="font-extrabold text-stone-800 text-base">
                {editingCustomerForModal ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="text-stone-400 hover:text-stone-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Customer / Company Name *</label>
                <input
                  type="text"
                  required
                  value={modalCustName}
                  onChange={e => setModalCustName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-xs font-normal"
                  placeholder="e.g. Acro Craft Studios"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-1">Phone Number</label>
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

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="px-4 py-2 border border-stone-200 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Check size={14} /> Save Customer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE INVOICE CONFIRMATION MODAL */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-sm w-full space-y-4 shadow-xl animate-fadeIn">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-xl">
                <AlertTriangle size={20} />
              </div>
              <h4 className="font-extrabold text-stone-800 text-sm">Delete Invoice?</h4>
            </div>
            <p className="text-xs text-stone-600">
              Are you sure you want to delete invoice <strong className="text-stone-900">{invoiceToDelete.invoiceNumber}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInvoiceToDelete(null)}
                className="px-3 py-1.5 border border-stone-200 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteInvoice) {
                    onDeleteInvoice(invoiceToDelete.id);
                  }
                  if (selectedInvoiceId === invoiceToDelete.id) {
                    setSelectedInvoiceId(null);
                  }
                  setInvoiceToDelete(null);
                  setShowSuccessToast(`Invoice "${invoiceToDelete.invoiceNumber}" deleted.`);
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer"
              >
                Delete Invoice
              </button>
            </div>
          </div>
        </div>
      )}
      {/* CREATE CREDIT NOTE MODAL */}
      {selectedInvoice && isCreditNoteModalOpen && onCreateCreditNote && (
        <CreateCreditNoteModal
          invoice={selectedInvoice}
          isOpen={isCreditNoteModalOpen}
          onClose={() => setIsCreditNoteModalOpen(false)}
          onCreateCreditNote={onCreateCreditNote}
          profile={profile}
          onCreditNoteCreated={(createdCn) => {
            setIsCreditNoteModalOpen(false);
            setShowSuccessToast(`Tax Credit Note ${createdCn.creditNoteNumber} issued successfully!`);
          }}
        />
      )}

      {/* VIEW CREDIT NOTE MODAL */}
      {selectedCreditNoteForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto animate-scaleIn">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                  <RotateCcw size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-sm">SARS Section 21 Tax Credit Note</h3>
                  <p className="text-[11px] text-stone-500 font-medium">{selectedCreditNoteForView.creditNoteNumber} • Original Invoice: {selectedCreditNoteForView.invoiceNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setIsExportingPdf(true);
                    try {
                      await downloadElementAsPdf('printable-credit-note-area', `CreditNote_${selectedCreditNoteForView.creditNoteNumber}.pdf`);
                      setShowSuccessToast(`Credit Note ${selectedCreditNoteForView.creditNoteNumber} downloaded as PDF!`);
                    } catch (e) {
                      window.print();
                    } finally {
                      setIsExportingPdf(false);
                    }
                  }}
                  disabled={isExportingPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Download crisp Credit Note PDF"
                >
                  <Download size={14} /> {isExportingPdf ? 'Generating...' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Printer size={14} /> Print
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCreditNoteForView(null)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-stone-100/50">
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm max-w-3xl mx-auto">
                <DocumentRenderer
                  documentType="credit_note"
                  documentNumber={selectedCreditNoteForView.creditNoteNumber}
                  date={selectedCreditNoteForView.date}
                  expiryOrDueDate={selectedCreditNoteForView.date}
                  profile={profile}
                  customerName={selectedCreditNoteForView.customerName}
                  customerEmail={selectedCreditNoteForView.customerEmail}
                  customerPhone={selectedCreditNoteForView.customerPhone}
                  customerAddress={selectedCreditNoteForView.customerAddress}
                  creditInvoiceNumber={selectedCreditNoteForView.invoiceNumber}
                  creditInvoiceDate={selectedCreditNoteForView.invoiceDate}
                  creditReason={selectedCreditNoteForView.reason}
                  items={selectedCreditNoteForView.items.map((item, idx) => ({
                    id: `cn_item_${idx}`,
                    productName: item.productName,
                    productDescription: item.productDescription || '',
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.total
                  }))}
                  subtotal={selectedCreditNoteForView.subtotal}
                  vatAmount={selectedCreditNoteForView.vatAmount}
                  hasVat={selectedCreditNoteForView.hasVat}
                  totalAmount={selectedCreditNoteForView.totalAmount}
                  notes={selectedCreditNoteForView.notes}
                  templateStyle={resolveQuoteTemplate('artisan-warm', undefined, customTemplates)}
                  printableId="printable-credit-note-area"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
