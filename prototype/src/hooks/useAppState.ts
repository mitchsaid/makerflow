import { useState, useEffect } from 'react';
import { getProductPhotoUrl } from '../lib/imageUtils';
import { 
  BusinessProfile, Product, Customer, Quote, Invoice, CreditNote, Job, JobTaskItem, AppNotification, ProductGroup,
  QuoteStatus, InvoiceStatus, JobStatus, JobTaskStatus, Discount, LineItemCustomizations,
  QuoteLineItem, InvoiceLineItem, CreditNoteLineItem, TrackingType, SelectedCustomization, QuoteTemplateStyle,
  CompanyPreset, CustomizationOption, CustomizationOptionValue, Material
} from '../types';
import { 
  DEFAULT_PROFILE, DEFAULT_PRODUCTS, DEFAULT_CUSTOMERS, 
  DEFAULT_QUOTES, DEFAULT_INVOICES, DEFAULT_CREDIT_NOTES, DEFAULT_JOBS, DEFAULT_NOTIFICATIONS, DEFAULT_GROUPS,
  DEFAULT_SERVICES, DEFAULT_MATERIALS
} from '../data/defaultData';
import { convertMaterialAmount, getItemMaterialRequirements, evaluateProductStagesForTask } from '../lib/costUtils';

function migrateProductsList(productList: Product[]): Product[] {
  if (!Array.isArray(productList)) return [];
  return productList.map(prod => {
    let updatedProd = { ...prod };

    if (prod.id === 'lp1' || prod.name === 'Speciality Lollipops') {
      updatedProd.photo = '/images/speciality_lollipops.jpg';
    } else if (prod.id === 'lp2' || prod.name === 'Picture / Logo Lollipops') {
      updatedProd.photo = '/images/logo_lollipops.jpg';
    } else if (prod.id === 'lp3' || prod.name === 'Lace & Cutout Lollipops') {
      updatedProd.photo = '/images/lace_lollipops.jpg';
    } else if (prod.id === 'lp4' || prod.name === 'Gift Jars') {
      updatedProd.photo = '/images/gift_jars.jpg';
    } else {
      updatedProd.photo = getProductPhotoUrl(prod.photo, prod.id || prod.name);
    }

    if (!updatedProd.customizationOptions || updatedProd.customizationOptions.length === 0) return updatedProd;

    const hasCocktail = updatedProd.customizationOptions.some(o => o.name.includes('Cocktail-Inspired'));
    const hasFruitFloral = updatedProd.customizationOptions.some(o => o.name.includes('Fruit, Floral'));

    if (hasCocktail || hasFruitFloral) {
      const combinedValues: CustomizationOptionValue[] = [];
      const newCustomizations: CustomizationOption[] = [];

      updatedProd.customizationOptions.forEach(opt => {
        if (opt.name.includes('Cocktail-Inspired') || opt.name.includes('Fruit, Floral')) {
          opt.values.forEach(val => {
            if (!combinedValues.some(v => v.value === val.value)) {
              combinedValues.push(val);
            }
          });
        } else if (opt.name !== 'Flavour') {
          newCustomizations.push(opt);
        }
      });

      newCustomizations.push({
        name: 'Flavour',
        isRequired: true,
        type: 'variation',
        values: combinedValues
      });

      return {
        ...updatedProd,
        customizationOptions: newCustomizations
      };
    }

    return updatedProd;
  });
}

function safeLoadObject<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...fallback, ...parsed };
    }
    return fallback;
  } catch (e) {
    console.warn(`Failed to parse ${key} from localStorage, using default:`, e);
    return fallback;
  }
}

function safeLoadArray<T>(key: string, fallback: T[]): T[] {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return fallback;
  } catch (e) {
    console.warn(`Failed to parse ${key} from localStorage, using default:`, e);
    return fallback;
  }
}

export function useAppState() {
  // Check if we need to upgrade from the old default business to Pulp Paperworks
  const isOldDefault = (() => {
    try {
      const saved = localStorage.getItem('maker_profile');
      if (!saved) return true;
      const parsed = JSON.parse(saved);
      return !parsed.name || parsed.name === 'The Lollipop League';
    } catch {
      return true;
    }
  })();

  const [profile, setProfile] = useState<BusinessProfile>(() => {
    if (isOldDefault) return DEFAULT_PROFILE;
    return safeLoadObject('maker_profile', DEFAULT_PROFILE);
  });

  const [customTemplates, setCustomTemplates] = useState<QuoteTemplateStyle[]>(() => {
    return safeLoadArray('maker_custom_templates', []);
  });

  const [groups, setGroups] = useState<ProductGroup[]>(() => {
    if (isOldDefault) return DEFAULT_GROUPS;
    return safeLoadArray('maker_groups', DEFAULT_GROUPS);
  });

  const migrateMaterialsList = (list: Material[]): Material[] => {
    if (!Array.isArray(list)) return [];
    return list.map(m => {
      const stockQuantity = m.stockQuantity !== undefined ? m.stockQuantity : m.bulkQuantity;
      const lowStockThreshold = m.lowStockThreshold !== undefined ? m.lowStockThreshold : Math.max(0, Math.round((m.bulkQuantity || 1) * 0.15 * 100) / 100);
      const lowStockWarningEnabled = m.lowStockWarningEnabled !== undefined ? m.lowStockWarningEnabled : true;
      return {
        ...m,
        stockQuantity,
        lowStockThreshold,
        lowStockWarningEnabled
      };
    });
  };

  const [materials, setMaterials] = useState<Material[]>(() => {
    if (isOldDefault) return migrateMaterialsList(DEFAULT_MATERIALS);
    const parsed = safeLoadArray('maker_materials', DEFAULT_MATERIALS);
    return migrateMaterialsList(parsed);
  });

  const [products, setProducts] = useState<Product[]>(() => {
    if (isOldDefault) return migrateProductsList(DEFAULT_PRODUCTS);
    const parsed = safeLoadArray('maker_products', DEFAULT_PRODUCTS);
    return migrateProductsList(parsed);
  });

  const [services, setServices] = useState<Product[]>(() => {
    if (isOldDefault) return DEFAULT_SERVICES;
    return safeLoadArray('maker_services', DEFAULT_SERVICES);
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    if (isOldDefault) return DEFAULT_CUSTOMERS;
    return safeLoadArray('maker_customers', DEFAULT_CUSTOMERS);
  });

  const [quotes, setQuotes] = useState<Quote[]>(() => {
    if (isOldDefault) return DEFAULT_QUOTES;
    return safeLoadArray('maker_quotes', DEFAULT_QUOTES);
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    if (isOldDefault) return DEFAULT_INVOICES;
    return safeLoadArray('maker_invoices', DEFAULT_INVOICES);
  });

  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(() => {
    if (isOldDefault) return DEFAULT_CREDIT_NOTES;
    return safeLoadArray('maker_credit_notes', DEFAULT_CREDIT_NOTES);
  });

  const [jobs, setJobs] = useState<Job[]>(() => {
    if (isOldDefault) return DEFAULT_JOBS;
    return safeLoadArray('maker_jobs', DEFAULT_JOBS);
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    if (isOldDefault) return DEFAULT_NOTIFICATIONS;
    return safeLoadArray('maker_notifications', DEFAULT_NOTIFICATIONS);
  });

  const DEFAULT_REUSABLE_STAGES = [
    'Base Product Made',
    'Custom Finishing & Extras',
    'Quality Control Review',
    'Packaging & Ready'
  ];

  const [reusableStages, setReusableStages] = useState<string[]>(() => {
    return safeLoadArray('maker_reusable_stages', DEFAULT_REUSABLE_STAGES);
  });


  // Persist all state arrays to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('maker_reusable_stages', JSON.stringify(reusableStages));
  }, [reusableStages]);
  useEffect(() => {
    localStorage.setItem('maker_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('maker_groups', JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem('maker_materials', JSON.stringify(materials));
  }, [materials]);

  useEffect(() => {
    localStorage.setItem('maker_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('maker_services', JSON.stringify(services));
  }, [services]);

  useEffect(() => {
    localStorage.setItem('maker_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('maker_quotes', JSON.stringify(quotes));
  }, [quotes]);

  useEffect(() => {
    localStorage.setItem('maker_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('maker_credit_notes', JSON.stringify(creditNotes));
  }, [creditNotes]);

  useEffect(() => {
    localStorage.setItem('maker_custom_templates', JSON.stringify(customTemplates));
  }, [customTemplates]);

  useEffect(() => {
    localStorage.setItem('maker_jobs', JSON.stringify(jobs));
  }, [jobs]);

  useEffect(() => {
    localStorage.setItem('maker_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Methods
  const updateProfile = (updated: BusinessProfile) => {
    setProfile(updated);
  };

  const addGroup = (newGroup: Omit<ProductGroup, 'id'>) => {
    const g: ProductGroup = {
      ...newGroup,
      id: 'g_' + Date.now()
    };
    setGroups(prev => [...prev, g]);
    return g;
  };

  const updateGroup = (updated: ProductGroup) => {
    setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
  };

  const deleteGroup = (id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    setProducts(prev => prev.map(p => p.groupId === id ? { ...p, groupId: undefined } : p));
  };

  const addMaterial = (newMat: Omit<Material, 'id'>) => {
    const stockQuantity = newMat.stockQuantity !== undefined ? newMat.stockQuantity : newMat.bulkQuantity;
    const lowStockThreshold = newMat.lowStockThreshold !== undefined ? newMat.lowStockThreshold : Math.max(0, Math.round((newMat.bulkQuantity || 1) * 0.15 * 100) / 100);
    const lowStockWarningEnabled = newMat.lowStockWarningEnabled !== undefined ? newMat.lowStockWarningEnabled : true;

    const mat: Material = {
      ...newMat,
      id: 'mat_' + Date.now(),
      stockQuantity,
      lowStockThreshold,
      lowStockWarningEnabled
    };
    setMaterials(prev => [...prev, mat]);
    return mat;
  };

  const updateMaterial = (updated: Material) => {
    setMaterials(prev => prev.map(m => m.id === updated.id ? updated : m));
  };

  const updateMaterialStock = (materialId: string, newStock: number) => {
    setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, stockQuantity: Math.max(0, newStock) } : m));
  };

  const deleteMaterial = (id: string) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  const addProduct = (newProduct: Omit<Product, 'id'>) => {
    const p: Product = {
      ...newProduct,
      id: 'p_' + Date.now()
    };
    setProducts(prev => [...prev, p]);
    return p;
  };

  const updateProduct = (updated: Product) => {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const addService = (newService: Omit<Product, 'id'>) => {
    const s: Product = {
      ...newService,
      id: 's_' + Date.now()
    };
    setServices(prev => [...prev, s]);
    return s;
  };

  const updateService = (updated: Product) => {
    setServices(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const deleteService = (id: string) => {
    setServices(prev => prev.filter(s => s.id !== id));
  };

  const addCustomer = (newCustomer: Omit<Customer, 'id'>) => {
    const c: Customer = {
      ...newCustomer,
      id: 'c_' + Date.now()
    };
    setCustomers(prev => [...prev, c]);
    return c;
  };

  const updateCustomer = (updated: Customer) => {
    setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const deleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  // Helper: notify
  const addNotification = (message: string, type: AppNotification['type'], referenceId: string) => {
    const n: AppNotification = {
      id: 'n_' + Date.now(),
      message,
      timestamp: new Date().toISOString(),
      type,
      isRead: false,
      referenceId
    };
    setNotifications(prev => [n, ...prev]);
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  // Quotes Management
  const createQuote = (newQuote: Omit<Quote, 'id' | 'quoteNumber'> & { quoteNumber?: string }) => {
    const year = new Date().getFullYear();
    const index = quotes.length + 1;
    const quoteNumber = newQuote.quoteNumber || `QT-${year}-${String(index).padStart(3, '0')}`;
    const q: Quote = {
      ...newQuote,
      id: 'q_' + Date.now(),
      quoteNumber
    };
    setQuotes(prev => [...prev, q]);

    addNotification(`Created quote ${quoteNumber} for ${q.customerName}`, 'general', q.id);
    return q;
  };

  const updateQuote = (updatedQuote: Quote) => {
    setQuotes(prev => prev.map(q => q.id === updatedQuote.id ? updatedQuote : q));
    addNotification(`Updated quote ${updatedQuote.quoteNumber}`, 'general', updatedQuote.id);
    return updatedQuote;
  };

  const deleteQuote = (quoteId: string) => {
    const q = quotes.find(quote => quote.id === quoteId);
    setQuotes(prev => prev.filter(quote => quote.id !== quoteId));
    if (q) {
      addNotification(`Deleted quote ${q.quoteNumber}`, 'general', quoteId);
    }
  };

  const updateQuoteStatus = (quoteId: string, status: QuoteStatus) => {
    setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status } : q));
    addNotification(`Quote status updated to ${status}`, 'general', quoteId);
  };

  // Convert Quote to Job
  const convertQuoteToJob = (quoteId: string) => {
    const q = quotes.find(quote => quote.id === quoteId);
    if (!q) return null;

    // Check if job already exists
    const existingJob = jobs.find(job => job.quoteId === q.id);
    if (existingJob) {
      setJobs(prev => prev.map(j => j.id === existingJob.id ? { ...j, status: 'Not Started' } : j));
      return existingJob;
    }

    const year = new Date().getFullYear();
    const index = jobs.length + 1;

    const jobItems = q.items.map((item, idx) => {
      const prod = products.find(p => p.id === item.productId) ||
                   products.find(p => p.name.toLowerCase().trim() === item.productName.toLowerCase().trim()) ||
                   products.find(p => item.productName.toLowerCase().includes(p.name.toLowerCase().trim()) || p.name.toLowerCase().includes(item.productName.toLowerCase().trim()));

      const isStagesMode = prod?.trackingMode === 'stages' || (prod?.trackingMode !== 'whole' && prod?.defaultStages && prod.defaultStages.length > 0);
      const hasDefaultStages = isStagesMode && prod?.defaultStages && prod.defaultStages.length > 0;

      const evalStages = hasDefaultStages 
        ? evaluateProductStagesForTask(prod!.defaultStages, item.quantity, item.selectedCustomizations, 0)
        : undefined;

      return {
        id: `jt_${Date.now()}_${idx}`,
        productId: item.productId,
        title: item.productName,
        quantity: item.quantity,
        status: 'Pending' as JobTaskStatus,
        customizationSummary: Object.entries(item.selectedCustomizations)
          .map(([optName, selectVal]) => `${optName}: ${(selectVal as SelectedCustomization).value}`)
          .join(', ') || 'Standard',
        selectedCustomizations: item.selectedCustomizations,
        trackingMode: (evalStages && evalStages.length > 0 ? 'stages' : (hasDefaultStages ? 'stages' : 'whole')) as 'whole' | 'stages',
        stages: evalStages && evalStages.length > 0 ? evalStages : undefined
      };
    });

    const newJob: Job = {
      id: 'j_' + Date.now(),
      jobNumber: `JOB-${year}-${String(index).padStart(3, '0')}`,
      quoteId: q.id,
      customerId: q.customerId,
      clientName: q.customerName,
      status: 'Not Started',
      items: jobItems,
      dateCreated: new Date().toISOString().split('T')[0],
      fulfillmentType: q.fulfillmentType
    };

    setJobs(prev => [...prev, newJob]);
    addNotification(`Job ${newJob.jobNumber} created from Quote ${q.quoteNumber}`, 'general', newJob.id);
    return newJob;
  };

  const updateJob = (updatedJob: Job) => {
    setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
    return updatedJob;
  };

  // When a Quote is viewed by a buyer
  const recordQuoteViewed = (quoteId: string) => {
    setQuotes(prev => prev.map(q => {
      if (q.id === quoteId && q.status === 'sent') {
        addNotification(`${q.customerName} viewed Quote ${q.quoteNumber}`, 'quote_viewed', q.id);
        return { ...q, status: 'viewed' };
      }
      return q;
    }));
  };

  // Convert Quote to Invoice
  const convertQuoteToInvoice = (quoteId: string) => {
    const q = quotes.find(quote => quote.id === quoteId);
    if (!q) return null;

    const year = new Date().getFullYear();
    const index = invoices.length + 1;
    const invoiceNumber = `INV-${year}-${String(index).padStart(3, '0')}`;

    // Convert items
    const invoiceItems: InvoiceLineItem[] = q.items.map(item => ({
      id: `ii_${Date.now()}_${item.id}`,
      productId: item.productId,
      productName: item.productName,
      productPhoto: item.productPhoto,
      productDescription: item.productDescription,
      quantity: item.quantity,
      appliedUnitPrice: item.appliedUnitPrice,
      selectedCustomizations: item.selectedCustomizations,
      itemDiscount: item.itemDiscount,
      total: item.total
    }));

    // Calculate SARS VAT details
    const subtotal = q.totalAmount;
    let vatAmount = 0;
    let finalTotal = q.totalAmount;

    if (profile.isVatRegistered) {
      // If the total amount of the quote ALREADY includes VAT (consumer style) or if we want to add VAT, let's treat the quote total as VAT-inclusive.
      // In South Africa, advertised prices are standardly VAT-inclusive. We extract the VAT.
      // Formula: VAT = Total - (Total / 1.15)
      const exVat = subtotal / (1 + (profile.vatRate / 100));
      vatAmount = subtotal - exVat;
    }

    const newInvoice: Invoice = {
      id: 'i_' + Date.now(),
      invoiceNumber,
      quoteId: q.id,
      customerId: q.customerId,
      customerName: q.customerName,
      customerEmail: q.customerEmail,
      customerPhone: q.customerPhone,
      customerAddress: q.customerAddress,
      customerIsBusiness: q.customerIsBusiness,
      customerContactPerson: q.customerContactPerson,
      customerVatNumber: q.customerVatNumber,
      customerCompanyRegNumber: q.customerCompanyRegNumber,
      customerBillingAddress: q.customerBillingAddress || q.customerAddress,
      customerShippingAddress: q.customerShippingAddress || q.customerBillingAddress || q.customerAddress,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days due
      items: invoiceItems,
      discount: q.discount,
      hasDiscount: q.hasDiscount,
      notes: `Tax invoice converted from Quote ${q.quoteNumber}. ${q.notes}`,
      status: 'unpaid',
      templateId: q.templateId,
      totalAmount: finalTotal,
      subtotal: subtotal - vatAmount,
      vatAmount,
      hasVat: profile.isVatRegistered,
      fulfillmentType: q.fulfillmentType,
      fulfillmentLabel: q.fulfillmentLabel,
      fulfillmentPrice: q.fulfillmentPrice,
      fulfillmentAddress: q.fulfillmentAddress,
      useCustomerAddressForDelivery: q.useCustomerAddressForDelivery,
    };

    setInvoices(prev => [...prev, newInvoice]);
    addNotification(`Invoice ${invoiceNumber} created from Quote ${q.quoteNumber}`, 'general', newInvoice.id);

    // Also update the job status if it was "Awaiting quote acceptance" to "Not Started"
    setJobs(prev => prev.map(job => {
      if (job.quoteId === q.id && job.status === 'Awaiting quote acceptance') {
        return {
          ...job,
          status: 'Not Started',
          items: job.items.map(item => ({ ...item, status: 'Pending' }))
        };
      }
      return job;
    }));

    return newInvoice;
  };

  // Record Quote Accepted by buyer
  const recordQuoteAccepted = (quoteId: string) => {
    let targetQuote: Quote | null = null;
    setQuotes(prev => prev.map(q => {
      if (q.id === quoteId) {
        targetQuote = q;
        addNotification(`${q.customerName} accepted Quote ${q.quoteNumber}!`, 'quote_accepted', q.id);
        return { ...q, status: 'accepted' as QuoteStatus };
      }
      return q;
    }));

    // Convert to Invoice and trigger Job status update automatically
    if (targetQuote) {
      setTimeout(() => {
        convertQuoteToInvoice(quoteId);
      }, 100);
    }
  };

  // Record Quote Declined by buyer
  const recordQuoteDeclined = (quoteId: string) => {
    setQuotes(prev => prev.map(q => {
      if (q.id === quoteId) {
        addNotification(`${q.customerName} declined Quote ${q.quoteNumber}`, 'quote_declined', q.id);
        return { ...q, status: 'declined' as QuoteStatus };
      }
      return q;
    }));

    // Update job status to Done / Cancelled
    setJobs(prev => prev.map(job => {
      if (job.quoteId === quoteId) {
        return { ...job, status: 'Done' as JobStatus }; // Mark finished or remove
      }
      return job;
    }));
  };

  // Direct Job Creation (without quote)
  const createJobDirect = (jobData: {
    jobType?: 'customer_order' | 'stock_creation';
    customerId?: string;
    clientName?: string;
    fulfillmentType?: 'collection' | 'delivery';
    items: {
      productId?: string;
      title: string;
      quantity: number;
      customizationSummary: string;
      selectedCustomizations?: LineItemCustomizations;
    }[];
  }) => {
    const year = new Date().getFullYear();
    const index = jobs.length + 1;
    const isStockJob = jobData.jobType === 'stock_creation';
    const prefix = isStockJob ? 'STK' : 'JOB';
    const jobNumber = `${prefix}-${year}-${String(index).padStart(3, '0')}`;

    const jobItems: JobTaskItem[] = jobData.items.map((item, idx) => {
      const prod = products.find(p => p.id === item.productId) ||
                   products.find(p => p.name.toLowerCase().trim() === item.title.toLowerCase().trim()) ||
                   products.find(p => item.title.toLowerCase().includes(p.name.toLowerCase().trim()) || p.name.toLowerCase().includes(item.title.toLowerCase().trim()));

      const isStagesMode = prod?.trackingMode === 'stages' || (prod?.trackingMode !== 'whole' && prod?.defaultStages && prod.defaultStages.length > 0);
      const hasDefaultStages = isStagesMode && prod?.defaultStages && prod.defaultStages.length > 0;

      const evalStages = hasDefaultStages 
        ? evaluateProductStagesForTask(prod!.defaultStages, item.quantity, item.selectedCustomizations, 0)
        : undefined;

      return {
        id: `jt_${Date.now()}_${idx}`,
        productId: item.productId,
        title: item.title,
        quantity: item.quantity,
        status: 'Pending' as JobTaskStatus,
        customizationSummary: item.customizationSummary || 'Standard',
        selectedCustomizations: item.selectedCustomizations,
        completedCount: 0,
        stockCount: 0,
        trackingMode: (evalStages && evalStages.length > 0 ? 'stages' : (hasDefaultStages ? 'stages' : 'whole')) as 'whole' | 'stages',
        stages: evalStages && evalStages.length > 0 ? evalStages : undefined
      };
    });

    const newJob: Job = {
      id: 'j_' + Date.now(),
      jobNumber,
      jobType: jobData.jobType || 'customer_order',
      customerId: jobData.customerId || (isStockJob ? 'stock_creation' : ''),
      clientName: jobData.clientName || (isStockJob ? 'Internal Stock Creation' : 'Direct Order'),
      status: 'Not Started',
      items: jobItems,
      dateCreated: new Date().toISOString().split('T')[0],
      fulfillmentType: jobData.fulfillmentType || 'collection'
    };

    setJobs(prev => [newJob, ...prev]);
    addNotification(
      `Created new ${isStockJob ? 'Stock Creation' : 'Order'} Job ${jobNumber}`,
      'general',
      newJob.id
    );
    return newJob;
  };

  // Direct Product Stock update
  const updateProductStock = (productId: string, stockQuantity: number) => {
    const validStock = Math.max(0, stockQuantity);
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, stockQuantity: validStock } : p));
  };

  // Deduct from Product Stock and apply to a Job Task item
  const applyStockToJobTask = (jobId: string, taskId: string, quantityToUse: number, chosenProductId?: string) => {
    if (quantityToUse <= 0) return;

    const targetJob = jobs.find(j => j.id === jobId);
    const targetItem = targetJob?.items.find(i => i.id === taskId);
    if (!targetJob || !targetItem) return;

    const targetItemTitle = targetItem.title;
    const targetProductId = chosenProductId || targetItem.productId || '';

    // Find the product matching chosenProductId, targetProductId, or title
    const targetProduct = products.find(p => p.id === targetProductId) || 
                          products.find(p => p.name.toLowerCase().trim() === targetItemTitle.toLowerCase().trim()) ||
                          products.find(p => targetItemTitle.toLowerCase().includes(p.name.toLowerCase().trim()) || p.name.toLowerCase().includes(targetItemTitle.toLowerCase().trim()));

    if (targetProduct) {
      const availableStock = targetProduct.stockQuantity || 0;
      const actualDeduct = Math.min(availableStock, quantityToUse);

      if (actualDeduct > 0) {
        // 1. Deduct from product stock
        setProducts(prev => prev.map(p => {
          if (p.id === targetProduct.id) {
            return {
              ...p,
              stockQuantity: Math.max(0, (p.stockQuantity || 0) - actualDeduct)
            };
          }
          return p;
        }));

        // 2. Add to job task item stockCount
        setJobs(prev => {
          const updatedJobs = prev.map(j => {
            if (j.id === jobId) {
              const updatedItems = j.items.map(item => {
                if (item.id === taskId) {
                  const currentStockCount = item.stockCount || 0;
                  const newStockCount = currentStockCount + actualDeduct;
                  const completedCount = item.completedCount || 0;
                  const totalFinished = completedCount + newStockCount;

                  let nextStatus = item.status;
                  if (totalFinished >= item.quantity) {
                    nextStatus = 'Done';
                  } else if (totalFinished > 0) {
                    nextStatus = 'In Production';
                  }

                  return {
                    ...item,
                    productId: targetProduct.id,
                    stockCount: newStockCount,
                    status: nextStatus
                  };
                }
                return item;
              });

              const allDone = updatedItems.every(i => i.status === 'Done');
              let jobStatus = j.status;
              if (allDone && (j.status === 'Not Started' || j.status === 'In Progress')) {
                jobStatus = j.fulfillmentType === 'delivery' ? 'Ready for Delivery' : 'Ready for Collection';
              } else if (j.status === 'Not Started') {
                jobStatus = 'In Progress';
              }

              return { ...j, status: jobStatus, items: updatedItems };
            }
            return j;
          });
          return applyDeductionsForUpdatedJobs(updatedJobs);
        });

        addNotification(
          `Allocated ${actualDeduct} unit(s) from stock for "${targetItemTitle}" on ${targetJob.jobNumber}`,
          'general',
          jobId
        );
      }
    }
  };

  // Return stock from a Job Task item back to Product Stock
  const removeStockFromJobTask = (jobId: string, taskId: string, quantityToRemove: number) => {
    if (quantityToRemove <= 0) return;

    const targetJob = jobs.find(j => j.id === jobId);
    const targetItem = targetJob?.items.find(i => i.id === taskId);
    if (!targetJob || !targetItem) return;

    const currentStockCount = targetItem.stockCount || 0;
    if (currentStockCount <= 0) return;

    const actualRemove = Math.min(currentStockCount, quantityToRemove);
    if (actualRemove <= 0) return;

    const targetItemTitle = targetItem.title;
    const targetProductId = targetItem.productId || '';

    const targetProduct = products.find(p => p.id === targetProductId) || 
                          products.find(p => p.name.toLowerCase().trim() === targetItemTitle.toLowerCase().trim()) ||
                          products.find(p => targetItemTitle.toLowerCase().includes(p.name.toLowerCase().trim()) || p.name.toLowerCase().includes(targetItemTitle.toLowerCase().trim()));

    // 1. Return stock to product if found
    if (targetProduct) {
      setProducts(prev => prev.map(p => {
        if (p.id === targetProduct.id) {
          return {
            ...p,
            stockQuantity: (p.stockQuantity || 0) + actualRemove
          };
        }
        return p;
      }));
    }

    // 2. Reduce job task item stockCount
    setJobs(prev => {
      const updatedJobs = prev.map(j => {
        if (j.id === jobId) {
          const updatedItems = j.items.map(item => {
            if (item.id === taskId) {
              const newStockCount = Math.max(0, (item.stockCount || 0) - actualRemove);
              const completedCount = item.completedCount || 0;
              const totalFinished = completedCount + newStockCount;

              let nextStatus = item.status;
              if (totalFinished >= item.quantity) {
                nextStatus = 'Done';
              } else if (totalFinished > 0) {
                nextStatus = 'In Production';
              } else {
                nextStatus = 'Pending';
              }

              return {
                ...item,
                stockCount: newStockCount,
                status: nextStatus
              };
            }
            return item;
          });

          const allDone = updatedItems.every(i => i.status === 'Done');
          let jobStatus = j.status;
          if (!allDone && (j.status === 'Ready for Delivery' || j.status === 'Ready for Collection' || j.status === 'Done')) {
            jobStatus = 'In Progress';
          }

          return { ...j, status: jobStatus, items: updatedItems };
        }
        return j;
      });
      return applyDeductionsForUpdatedJobs(updatedJobs);
    });

    addNotification(
      `Returned ${actualRemove} unit(s) from "${targetItemTitle}" on ${targetJob.jobNumber} back to stock`,
      'general',
      jobId
    );
  };

  const addReusableStage = (stageName: string) => {
    const trimmed = stageName.trim();
    if (!trimmed) return;
    setReusableStages(prev => {
      if (prev.some(s => s.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [...prev, trimmed];
    });
  };

  const deleteJob = (jobId: string) => {
    const target = jobs.find(j => j.id === jobId);
    setJobs(prev => prev.filter(j => j.id !== jobId));
    if (target) {
      addNotification(`Deleted Job ${target.jobNumber}`, 'general', target.id);
    }
  };

  const updateJobTaskTrackingMode = (jobId: string, taskId: string, mode: 'whole' | 'stages') => {
    setJobs(prev => prev.map(j => {
      if (j.id === jobId) {
        const updatedItems = j.items.map(item => {
          if (item.id === taskId) {
            let stages = item.stages;
            if (mode === 'stages' && (!stages || stages.length === 0)) {
              const prod = products.find(p => p.id === item.productId) ||
                           products.find(p => p.name.toLowerCase().trim() === item.title.toLowerCase().trim()) ||
                           products.find(p => item.title.toLowerCase().includes(p.name.toLowerCase().trim()) || p.name.toLowerCase().includes(item.title.toLowerCase().trim()));

              if (prod && prod.defaultStages && prod.defaultStages.length > 0) {
                stages = evaluateProductStagesForTask(
                  prod.defaultStages,
                  item.quantity,
                  item.selectedCustomizations,
                  item.completedCount || 0
                );
              }
              if (!stages || stages.length === 0) {
                stages = [
                  { id: `stg-${Date.now()}-1`, name: 'Base Product Made', completedQty: item.completedCount || 0 },
                  { id: `stg-${Date.now()}-2`, name: 'Packaging & Ready', completedQty: item.completedCount || 0 }
                ];
              }
            }
            return { ...item, trackingMode: mode, stages };
          }
          return item;
        });
        return { ...j, items: updatedItems };
      }
      return j;
    }));
  };

  const updateJobTaskStages = (jobId: string, taskId: string, newStages: { id: string; name: string; completedQty: number }[]) => {
    setJobs(prev => prev.map(j => {
      if (j.id === jobId) {
        const updatedItems = j.items.map(item => {
          if (item.id === taskId) {
            const currentStock = item.stockCount || 0;
            const qtyToMake = Math.max(0, item.quantity - currentStock);

            const clampedStages = newStages.map(s => ({
              ...s,
              completedQty: Math.max(0, Math.min(qtyToMake, s.completedQty))
            }));

            let computedCompletedCount = 0;
            if (clampedStages.length > 0) {
              computedCompletedCount = Math.min(...clampedStages.map(s => s.completedQty));
            }

            const totalFinished = computedCompletedCount + currentStock;
            let nextStatus: JobTaskStatus = item.status;
            if (totalFinished >= item.quantity) {
              nextStatus = 'Done';
            } else if (totalFinished > 0 || clampedStages.some(s => s.completedQty > 0)) {
              nextStatus = 'In Production';
            } else {
              nextStatus = 'Pending';
            }

            return {
              ...item,
              stages: clampedStages,
              completedCount: computedCompletedCount,
              status: nextStatus
            };
          }
          return item;
        });

        const allDone = updatedItems.every(i => i.status === 'Done');
        let jobStatus = j.status;
        if (allDone && (j.status === 'Not Started' || j.status === 'In Progress')) {
          jobStatus = j.fulfillmentType === 'delivery' ? 'Ready for Delivery' : 'Ready for Collection';
        } else if (!allDone && (j.status === 'Ready for Delivery' || j.status === 'Ready for Collection' || j.status === 'Done')) {
          jobStatus = 'In Progress';
        }

        return { ...j, status: jobStatus, items: updatedItems };
      }
      return j;
    }));
  };

  const createInvoiceDirect = (newInvoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'subtotal' | 'vatAmount' | 'hasVat'>) => {
    const year = new Date().getFullYear();
    const index = invoices.length + 1;
    const invoiceNumber = `INV-${year}-${String(index).padStart(3, '0')}`;

    const subtotal = newInvoice.totalAmount;
    let vatAmount = 0;
    if (profile.isVatRegistered) {
      const exVat = subtotal / (1 + (profile.vatRate / 100));
      vatAmount = subtotal - exVat;
    }

    const inv: Invoice = {
      ...newInvoice,
      id: 'i_' + Date.now(),
      invoiceNumber,
      subtotal: subtotal - vatAmount,
      vatAmount,
      hasVat: profile.isVatRegistered
    };

    setInvoices(prev => [...prev, inv]);
    addNotification(`Created tax invoice ${invoiceNumber} for ${inv.customerName}`, 'general', inv.id);

    // Also automatically spin up a Job for this invoice!
    const jobItems = inv.items.map((item, idx) => ({
      id: `jt_${Date.now()}_${idx}`,
      title: item.productName,
      quantity: item.quantity,
      status: 'Pending' as JobTaskStatus,
      customizationSummary: Object.entries(item.selectedCustomizations)
        .map(([optName, selectVal]) => `${optName}: ${selectVal.value}`)
        .join(', ') || 'Standard'
    }));

    const newJob: Job = {
      id: 'j_' + Date.now(),
      jobNumber: `JOB-${year}-${String(index).padStart(3, '0')}`,
      customerId: inv.customerId,
      clientName: inv.customerName,
      status: 'Not Started',
      items: jobItems,
      dateCreated: new Date().toISOString().split('T')[0]
    };
    setJobs(prev => [...prev, newJob]);

    return inv;
  };

  const updateInvoiceStatus = (invoiceId: string, status: InvoiceStatus) => {
    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status } : inv));
    addNotification(`Invoice status updated to ${status}`, 'general', invoiceId);
  };

  const updateInvoice = (updated: Invoice) => {
    setInvoices(prev => prev.map(inv => inv.id === updated.id ? updated : inv));
    addNotification(`Tax invoice ${updated.invoiceNumber} updated`, 'general', updated.id);
    return updated;
  };

  const deleteInvoice = (invoiceId: string) => {
    setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
    addNotification(`Tax invoice deleted`, 'general', '');
  };

  const createCreditNote = (creditNoteData: Omit<CreditNote, 'id' | 'creditNoteNumber' | 'subtotal' | 'vatAmount' | 'hasVat'>) => {
    const year = new Date().getFullYear();
    const index = creditNotes.length + 1;
    const creditNoteNumber = `CN-${year}-${String(index).padStart(3, '0')}`;

    const subtotal = creditNoteData.totalAmount;
    let vatAmount = 0;
    if (profile.isVatRegistered) {
      const exVat = subtotal / (1 + (profile.vatRate / 100));
      vatAmount = subtotal - exVat;
    }

    const cn: CreditNote = {
      ...creditNoteData,
      id: 'cn_' + Date.now(),
      creditNoteNumber,
      subtotal: subtotal - vatAmount,
      vatAmount,
      hasVat: profile.isVatRegistered,
      status: 'issued'
    };

    setCreditNotes(prev => [...prev, cn]);

    // Update parent invoice credited amount and list
    setInvoices(prev => prev.map(inv => {
      if (inv.id === cn.invoiceId) {
        const prevCredited = inv.creditedAmount || 0;
        const newCredited = prevCredited + cn.totalAmount;
        const prevCnIds = inv.creditNoteIds || [];
        const isFullyCredited = newCredited >= inv.totalAmount;
        return {
          ...inv,
          creditedAmount: newCredited,
          creditNoteIds: prevCnIds.includes(cn.id) ? prevCnIds : [...prevCnIds, cn.id],
          status: isFullyCredited ? 'credited' : (newCredited > 0 ? 'partially_credited' : inv.status)
        };
      }
      return inv;
    }));

    // Optional stock return for items marked restockQuantity
    cn.items.forEach(item => {
      if (item.restockQuantity && item.productId) {
        setProducts(prev => prev.map(p => {
          if (p.id === item.productId) {
            return {
              ...p,
              stockQuantity: (p.stockQuantity || 0) + item.quantity
            };
          }
          return p;
        }));
      }
    });

    addNotification(`Issued Tax Credit Note ${creditNoteNumber} for invoice ${cn.invoiceNumber} (R${cn.totalAmount.toFixed(2)})`, 'general', cn.id);

    return cn;
  };

  const updateCreditNote = (updated: CreditNote) => {
    setCreditNotes(prev => prev.map(cn => cn.id === updated.id ? updated : cn));
    addNotification(`Credit note ${updated.creditNoteNumber} updated`, 'general', updated.id);
    return updated;
  };

  const deleteCreditNote = (creditNoteId: string) => {
    const cnToDelete = creditNotes.find(c => c.id === creditNoteId);
    if (cnToDelete) {
      // Revert creditedAmount on invoice
      setInvoices(prev => prev.map(inv => {
        if (inv.id === cnToDelete.invoiceId) {
          const prevCredited = inv.creditedAmount || 0;
          const newCredited = Math.max(0, prevCredited - cnToDelete.totalAmount);
          const newCnIds = (inv.creditNoteIds || []).filter(id => id !== creditNoteId);
          return {
            ...inv,
            creditedAmount: newCredited,
            creditNoteIds: newCnIds,
            status: newCredited === 0 && inv.status === 'credited' ? 'unpaid' : inv.status
          };
        }
        return inv;
      }));
    }
    setCreditNotes(prev => prev.filter(c => c.id !== creditNoteId));
    addNotification(`Credit note deleted`, 'general', '');
  };

  const saveCustomTemplate = (template: QuoteTemplateStyle) => {
    setCustomTemplates(prev => {
      const exists = prev.some(t => t.id === template.id);
      if (exists) {
        return prev.map(t => t.id === template.id ? template : t);
      }
      return [...prev, template];
    });
  };

  const deleteCustomTemplate = (templateId: string) => {
    setCustomTemplates(prev => prev.filter(t => t.id !== templateId));
    setQuotes(prev => prev.map(q => q.templateId === templateId ? { ...q, templateId: 'artisan-warm', templateCustomStyle: undefined } : q));
    setInvoices(prev => prev.map(inv => inv.templateId === templateId ? { ...inv, templateId: 'artisan-warm', templateCustomStyle: undefined } : inv));
    addNotification('Custom quote theme deleted', 'general', templateId);
  };

  const updateQuoteTemplate = (quoteId: string, templateId: string, templateCustomStyle?: QuoteTemplateStyle) => {
    setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, templateId, templateCustomStyle } : q));
  };

  const updateInvoiceTemplate = (invoiceId: string, templateId: string, templateCustomStyle?: QuoteTemplateStyle) => {
    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, templateId, templateCustomStyle } : inv));
  };

  // Material Auto-Deduction Engine & Inventory Return Engine
  const applyDeductionsForUpdatedJobs = (newJobs: Job[]): Job[] => {
    let hasAnyChange = false;
    const notifsToSend: { message: string; refId: string }[] = [];

    const processedJobs = newJobs.map(job => {
      let jobChanged = false;
      const updatedItems = job.items.map(item => {
        // Calculate the maximum units that require raw material manufacturing
        const unitsToMake = Math.max(0, item.quantity - (item.stockCount || 0));
        let targetCompleted = item.completedCount || 0;
        if (item.status === 'Done') {
          targetCompleted = Math.max(unitsToMake, targetCompleted);
        } else {
          targetCompleted = Math.min(unitsToMake, targetCompleted);
        }

        const prevDeducted = item.deductedCount || 0;
        const delta = targetCompleted - prevDeducted;

        if (delta === 0) return item;

        jobChanged = true;
        hasAnyChange = true;

        return {
          ...item,
          deductedCount: targetCompleted
        };
      });

      return jobChanged ? { ...job, items: updatedItems } : job;
    });

    if (!hasAnyChange) {
      return processedJobs;
    }

    setMaterials(prevMaterials => {
      let matList = [...prevMaterials];

      processedJobs.forEach(job => {
        const oldJob = newJobs.find(j => j.id === job.id);
        job.items.forEach(item => {
          const unitsToMake = Math.max(0, item.quantity - (item.stockCount || 0));
          let targetCompleted = item.completedCount || 0;
          if (item.status === 'Done') {
            targetCompleted = Math.max(unitsToMake, targetCompleted);
          } else {
            targetCompleted = Math.min(unitsToMake, targetCompleted);
          }

          const oldItem = oldJob?.items.find(i => i.id === item.id);
          const prevDeducted = oldItem?.deductedCount || 0;
          const delta = targetCompleted - prevDeducted;

          if (delta !== 0) {
            const reqs = getItemMaterialRequirements(item, products);
            if (reqs.length > 0) {
              matList = matList.map(m => {
                const req = reqs.find(r => r.materialId === m.id);
                if (!req) return m;

                const currentStock = m.stockQuantity !== undefined ? m.stockQuantity : m.bulkQuantity;
                const changeAmountInBulkUnit = convertMaterialAmount(req.amountPerUnit * delta, req.unit, m.unit);
                
                // If delta > 0, stock decreases. If delta < 0, stock increases (returned to inventory).
                const newStock = Math.max(0, Math.round((currentStock - changeAmountInBulkUnit) * 1000) / 1000);

                const threshold = m.lowStockThreshold !== undefined ? m.lowStockThreshold : 0;
                const isWarningEnabled = m.lowStockWarningEnabled !== false;

                if (delta > 0 && isWarningEnabled && currentStock > threshold && newStock <= threshold) {
                  notifsToSend.push({
                    message: `⚠️ Low Material Stock Warning: ${m.name} is down to ${newStock} ${m.unit} (Threshold: ${threshold} ${m.unit})`,
                    refId: m.id
                  });
                } else if (delta < 0) {
                  const returnedQty = Math.round(Math.abs(changeAmountInBulkUnit) * 1000) / 1000;
                  notifsToSend.push({
                    message: `🔄 Material Restored: ${returnedQty} ${m.unit} of ${m.name} returned to inventory (New Stock: ${newStock} ${m.unit})`,
                    refId: m.id
                  });
                }

                return {
                  ...m,
                  stockQuantity: newStock
                };
              });
            }
          }
        });
      });

      return matList;
    });

    notifsToSend.forEach(n => {
      addNotification(n.message, 'general', n.refId);
    });

    return processedJobs;
  };

  // Jobs Tracking
  const updateJobStatus = (jobId: string, status: JobStatus) => {
    const isFullyCompletedStatus = 
      status === 'Ready for Collection' || 
      status === 'Ready for Delivery' || 
      status === 'Being Delivered' || 
      status === 'Done';

    setJobs(prev => {
      const updatedJobs = prev.map(j => {
        if (j.id === jobId) {
          const updatedItems = isFullyCompletedStatus
            ? j.items.map(item => {
                const unitsToMake = Math.max(0, item.quantity - (item.stockCount || 0));
                const trackingType = item.trackingType || 'consolidated';
                const actualBatchSize = item.batchSize || Math.max(1, Math.round(item.quantity / 5)) || 5;
                const expectedLen = trackingType === 'individual' 
                  ? unitsToMake 
                  : trackingType === 'batch'
                    ? Math.ceil(unitsToMake / actualBatchSize)
                    : 0;

                return {
                  ...item,
                  status: 'Done' as JobTaskStatus,
                  completedCount: item.quantity,
                  unitStatuses: expectedLen > 0 
                    ? Array(expectedLen).fill('Done' as JobTaskStatus) 
                    : item.unitStatuses ? item.unitStatuses.map(() => 'Done' as JobTaskStatus) : undefined
                };
              })
            : j.items;
          return { ...j, status, items: updatedItems };
        }
        return j;
      });
      return applyDeductionsForUpdatedJobs(updatedJobs);
    });
  };

  const updateJobTaskStatus = (jobId: string, taskId: string, status: JobTaskStatus) => {
    setJobs(prev => {
      const updatedJobs = prev.map(j => {
        if (j.id === jobId) {
          const updatedItems = j.items.map(item => {
            if (item.id === taskId) {
              const unitStatuses = item.unitStatuses 
                ? item.unitStatuses.map(() => status)
                : undefined;
              const completedCount = status === 'Done' ? item.quantity : (status === 'Pending' ? 0 : item.completedCount);
              return { ...item, status, completedCount, unitStatuses };
            }
            return item;
          });
          // If all items are Done, automatically set Job to In Progress or Ready for Collection / Delivery
          const allDone = updatedItems.every(item => item.status === 'Done');
          const anyInProduction = updatedItems.some(item => ['Sourcing Materials', 'In Production', 'Quality Check'].includes(item.status));
          let jobStatus = j.status;
          if (allDone) {
            if (j.status === 'Not Started' || j.status === 'In Progress') {
              jobStatus = j.fulfillmentType === 'delivery' ? 'Ready for Delivery' : 'Ready for Collection';
            }
          } else if (anyInProduction && (j.status === 'Not Started' || j.status === 'Ready for Collection' || j.status === 'Ready for Delivery' || j.status === 'Being Delivered')) {
            jobStatus = 'In Progress';
          }
          return { ...j, status: jobStatus, items: updatedItems };
        }
        return j;
      });
      return applyDeductionsForUpdatedJobs(updatedJobs);
    });
  };

  const updateJobTaskTrackingType = (jobId: string, taskId: string, trackingType: TrackingType, batchSize?: number) => {
    setJobs(prev => prev.map(j => {
      if (j.id === jobId) {
        const updatedItems = j.items.map(item => {
          if (item.id === taskId) {
            const actualBatchSize = batchSize || item.batchSize || Math.max(1, Math.round(item.quantity / 5)) || 5;
            
            let unitStatuses: JobTaskStatus[] | undefined = undefined;
            if (trackingType === 'individual') {
              unitStatuses = Array(item.quantity).fill(item.status);
            } else if (trackingType === 'batch') {
              const numBatches = Math.ceil(item.quantity / actualBatchSize);
              unitStatuses = Array(numBatches).fill(item.status);
            }
            
            return { 
              ...item, 
              trackingType, 
              batchSize: actualBatchSize,
              unitStatuses 
            };
          }
          return item;
        });
        return { ...j, items: updatedItems };
      }
      return j;
    }));
  };

  const updateJobTaskUnitStatus = (jobId: string, taskId: string, unitIndex: number, status: JobTaskStatus) => {
    setJobs(prev => {
      const updatedJobs = prev.map(j => {
        if (j.id === jobId) {
          const updatedItems = j.items.map(item => {
            if (item.id === taskId) {
              const trackingType = item.trackingType || 'consolidated';
              const actualBatchSize = item.batchSize || Math.max(1, Math.round(item.quantity / 5)) || 5;
              const unitsToMake = Math.max(0, item.quantity - (item.stockCount || 0));
              const expectedLen = trackingType === 'individual' 
                ? unitsToMake 
                : Math.ceil(unitsToMake / actualBatchSize);
                
              const currentUnitStatuses = item.unitStatuses && item.unitStatuses.length === expectedLen
                ? [...item.unitStatuses]
                : Array(expectedLen).fill(item.status);
                
              currentUnitStatuses[unitIndex] = status;

              // Compute parent item status based on sub-statuses
              const allDone = currentUnitStatuses.every(s => s === 'Done');
              const allPending = currentUnitStatuses.every(s => s === 'Pending');
              let nextStatus = item.status;
              if (allDone) {
                nextStatus = 'Done';
              } else if (allPending) {
                nextStatus = 'Pending';
              } else {
                nextStatus = 'In Production';
              }

              // Keep completedCount in sync with checkoffs
              let completedCount = item.completedCount || 0;
              if (trackingType === 'individual') {
                completedCount = currentUnitStatuses.filter(s => s === 'Done').length;
              } else if (trackingType === 'batch') {
                const doneBatches = currentUnitStatuses.filter(s => s === 'Done').length;
                completedCount = Math.min(unitsToMake, doneBatches * actualBatchSize);
              }

              return { 
                ...item, 
                status: nextStatus, 
                completedCount,
                unitStatuses: currentUnitStatuses
              };
            }
            return item;
          });

          // Compute overall job status
          const allDone = updatedItems.every(item => item.status === 'Done');
          const anyInProduction = updatedItems.some(item => ['Sourcing Materials', 'In Production', 'Quality Check'].includes(item.status));
          let jobStatus = j.status;
          if (allDone) {
            if (j.status === 'Not Started' || j.status === 'In Progress') {
              jobStatus = j.fulfillmentType === 'delivery' ? 'Ready for Delivery' : 'Ready for Collection';
            }
          } else if (anyInProduction && (j.status === 'Not Started' || j.status === 'Ready for Collection' || j.status === 'Ready for Delivery' || j.status === 'Being Delivered')) {
            jobStatus = 'In Progress';
          }

          return { ...j, status: jobStatus, items: updatedItems };
        }
        return j;
      });
      return applyDeductionsForUpdatedJobs(updatedJobs);
    });
  };

  const updateJobTaskCounts = (jobId: string, taskId: string, completedCount: number, stockCount: number) => {
    setJobs(prev => {
      const updatedJobs = prev.map(j => {
        if (j.id === jobId) {
          const updatedItems = j.items.map(item => {
            if (item.id === taskId) {
              const totalFinished = completedCount + stockCount;
              let nextStatus: JobTaskStatus = item.status;
              if (totalFinished >= item.quantity) {
                nextStatus = 'Done';
              } else if (totalFinished > 0) {
                nextStatus = 'In Production';
              } else {
                nextStatus = 'Pending';
              }

              const currentTrackingType = item.trackingType || 'consolidated';
              const unitsToMake = Math.max(0, item.quantity - stockCount);
              const actualBatchSize = item.batchSize || 5;
              const expectedLen = currentTrackingType === 'individual' 
                ? unitsToMake 
                : currentTrackingType === 'batch'
                  ? Math.ceil(unitsToMake / actualBatchSize)
                  : 1;

              let unitStatuses = item.unitStatuses ? [...item.unitStatuses] : [];
              
              // Resize the array to the expectedLen
              if (unitStatuses.length < expectedLen) {
                unitStatuses = [
                  ...unitStatuses,
                  ...Array(expectedLen - unitStatuses.length).fill('Pending')
                ];
              } else if (unitStatuses.length > expectedLen) {
                unitStatuses = unitStatuses.slice(0, expectedLen);
              }

              // Adjust the number of 'Done' statuses to match completedCount / completed batches
              const currentDoneCount = unitStatuses.filter(s => s === 'Done').length;
              
              // Determine target done checkoffs
              let targetDoneCount = 0;
              if (currentTrackingType === 'individual') {
                targetDoneCount = completedCount;
              } else if (currentTrackingType === 'batch') {
                targetDoneCount = Math.ceil(completedCount / actualBatchSize);
              }

              if (targetDoneCount !== currentDoneCount) {
                if (targetDoneCount > currentDoneCount) {
                  let toMark = targetDoneCount - currentDoneCount;
                  for (let i = 0; i < unitStatuses.length && toMark > 0; i++) {
                    if (unitStatuses[i] !== 'Done') {
                      unitStatuses[i] = 'Done';
                      toMark--;
                    }
                  }
                } else {
                  let toUnmark = currentDoneCount - targetDoneCount;
                  for (let i = unitStatuses.length - 1; i >= 0 && toUnmark > 0; i--) {
                    if (unitStatuses[i] === 'Done') {
                      unitStatuses[i] = 'Pending';
                      toUnmark--;
                    }
                  }
                }
              }

              let updatedStages = item.stages;
              if (updatedStages && updatedStages.length > 0) {
                if (completedCount === 0) {
                  updatedStages = updatedStages.map(s => ({ ...s, completedQty: 0 }));
                } else if (completedCount >= unitsToMake) {
                  updatedStages = updatedStages.map(s => ({ ...s, completedQty: unitsToMake }));
                } else {
                  updatedStages = updatedStages.map(s => ({
                    ...s,
                    completedQty: Math.min(unitsToMake, Math.min(s.completedQty, completedCount))
                  }));
                }
              }

              return { 
                ...item, 
                completedCount, 
                stockCount, 
                status: nextStatus,
                unitStatuses,
                stages: updatedStages
              };
            }
            return item;
          });

          const allDone = updatedItems.every(item => item.status === 'Done');
          const anyInProduction = updatedItems.some(item => ['Sourcing Materials', 'In Production', 'Quality Check'].includes(item.status));
          let jobStatus = j.status;
          if (allDone) {
            if (j.status === 'Not Started' || j.status === 'In Progress') {
              jobStatus = j.fulfillmentType === 'delivery' ? 'Ready for Delivery' : 'Ready for Collection';
            }
          } else if (anyInProduction && (j.status === 'Not Started' || j.status === 'Ready for Collection' || j.status === 'Ready for Delivery' || j.status === 'Being Delivered')) {
            jobStatus = 'In Progress';
          }

          return { ...j, status: jobStatus, items: updatedItems };
        }
        return j;
      });
      return applyDeductionsForUpdatedJobs(updatedJobs);
    });
  };

  // Clear all data completely (empty workspace)
  const clearAllData = () => {
    localStorage.removeItem('maker_profile');
    localStorage.removeItem('maker_groups');
    localStorage.removeItem('maker_materials');
    localStorage.removeItem('maker_products');
    localStorage.removeItem('maker_services');
    localStorage.removeItem('maker_customers');
    localStorage.removeItem('maker_quotes');
    localStorage.removeItem('maker_invoices');
    localStorage.removeItem('maker_credit_notes');
    localStorage.removeItem('maker_jobs');
    localStorage.removeItem('maker_notifications');

    const BLANK_PROFILE: BusinessProfile = {
      name: "My Workshop",
      logo: "",
      phone: "",
      email: "",
      address: "",
      bankingDetails: {
        bankName: "",
        accountNumber: "",
        branchCode: "",
        accountType: "Business Cheque",
      },
      vatNumber: "",
      isVatRegistered: false,
      vatRate: 15,
    };

    setProfile(BLANK_PROFILE);
    setGroups([]);
    setMaterials([]);
    setProducts([]);
    setServices([]);
    setCustomers([]);
    setQuotes([]);
    setInvoices([]);
    setCreditNotes([]);
    setJobs([]);
    setNotifications([]);
  };

  // Load a preconfigured company profile and catalog
  const loadCompanyPreset = (preset: CompanyPreset) => {
    const migratedProducts = migrateProductsList(preset.products);
    setProfile(preset.profile);
    setGroups(preset.groups);
    if (preset.materials) {
      setMaterials(preset.materials);
      localStorage.setItem('maker_materials', JSON.stringify(preset.materials));
    }
    setProducts(migratedProducts);
    setServices(preset.services || []);
    setCustomers(preset.customers);
    setQuotes(preset.quotes);
    setInvoices(preset.invoices);
    setCreditNotes(preset.creditNotes || []);
    setJobs(preset.jobs);
    setNotifications(preset.notifications);

    localStorage.setItem('maker_profile', JSON.stringify(preset.profile));
    localStorage.setItem('maker_groups', JSON.stringify(preset.groups));
    localStorage.setItem('maker_products', JSON.stringify(migratedProducts));
    localStorage.setItem('maker_services', JSON.stringify(preset.services || []));
    localStorage.setItem('maker_customers', JSON.stringify(preset.customers));
    localStorage.setItem('maker_quotes', JSON.stringify(preset.quotes));
    localStorage.setItem('maker_invoices', JSON.stringify(preset.invoices));
    localStorage.setItem('maker_credit_notes', JSON.stringify(preset.creditNotes || []));
    localStorage.setItem('maker_jobs', JSON.stringify(preset.jobs));
    localStorage.setItem('maker_notifications', JSON.stringify(preset.notifications));
  };

  // Clear data back to defaults
  const resetToDefaults = () => {
    localStorage.removeItem('maker_profile');
    localStorage.removeItem('maker_groups');
    localStorage.removeItem('maker_materials');
    localStorage.removeItem('maker_products');
    localStorage.removeItem('maker_services');
    localStorage.removeItem('maker_customers');
    localStorage.removeItem('maker_quotes');
    localStorage.removeItem('maker_invoices');
    localStorage.removeItem('maker_credit_notes');
    localStorage.removeItem('maker_jobs');
    localStorage.removeItem('maker_notifications');

    setProfile(DEFAULT_PROFILE);
    setGroups(DEFAULT_GROUPS);
    setMaterials(DEFAULT_MATERIALS);
    setProducts(DEFAULT_PRODUCTS);
    setServices(DEFAULT_SERVICES);
    setCustomers(DEFAULT_CUSTOMERS);
    setQuotes(DEFAULT_QUOTES);
    setInvoices(DEFAULT_INVOICES);
    setCreditNotes(DEFAULT_CREDIT_NOTES);
    setJobs(DEFAULT_JOBS);
    setNotifications(DEFAULT_NOTIFICATIONS);
  };

  return {
    profile,
    groups,
    materials,
    products,
    services,
    customers,
    quotes,
    invoices,
    creditNotes,
    jobs,
    notifications,
    customTemplates,
    reusableStages,
    addReusableStage: (stageName: string) => {
      if (!reusableStages.includes(stageName)) {
        setReusableStages(prev => [...prev, stageName]);
      }
    },
    updateProfile,
    addGroup,
    updateGroup,
    deleteGroup,
    addMaterial,
    updateMaterial,
    updateMaterialStock,
    deleteMaterial,
    addProduct,
    updateProduct,
    deleteProduct,
    addService,
    updateService,
    deleteService,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    createQuote,
    updateQuote,
    deleteQuote,
    updateQuoteStatus,
    convertQuoteToJob,
    recordQuoteViewed,
    recordQuoteAccepted,
    recordQuoteDeclined,
    convertQuoteToInvoice,
    createInvoiceDirect,
    updateInvoice,
    deleteInvoice,
    updateInvoiceStatus,
    createCreditNote,
    updateCreditNote,
    deleteCreditNote,
    saveCustomTemplate,
    deleteCustomTemplate,
    updateQuoteTemplate,
    updateInvoiceTemplate,
    updateJobStatus,
    updateJob,
    deleteJob,
    updateJobTaskStatus,
    updateJobTaskTrackingType,
    updateJobTaskUnitStatus,
    updateJobTaskTrackingMode,
    updateJobTaskStages,
    updateJobTaskCounts,
    createJobDirect,
    updateProductStock,
    applyStockToJobTask,
    removeStockFromJobTask,
    markNotificationRead,
    markAllNotificationsRead,
    resetToDefaults,
    clearAllData,
    loadCompanyPreset
  };
}
