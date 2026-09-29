import React, { useState } from 'react';
import { 
  UserPlus, Mail, Phone, MapPin, Edit2, Trash2, FileText, 
  BookOpen, Sparkles, X, ChevronRight, CheckCircle, Clock, Save,
  ArrowLeft, Search, Plus, PlusCircle, Copy, Check, User, RotateCcw
} from 'lucide-react';
import { Customer, Quote, Invoice, CreditNote, BusinessProfile, parseAddress, formatAddress } from '../types';
import { formatSADate } from '../lib/dateUtils';
import { CustomerStatementModal } from './CustomerStatementModal';

function formatZAR(amount: number) {
  return `R${amount.toFixed(2)}`;
}

function CopyButton({ text, className = '' }: { text?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 text-stone-400 hover:text-amber-800 hover:bg-stone-200/60 p-1.5 rounded-lg transition cursor-pointer shrink-0 ${className}`}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
      {copied && <span className="text-[10px] text-emerald-600 font-bold">Copied</span>}
    </button>
  );
}

interface CustomersProps {
  customers: Customer[];
  quotes: Quote[];
  invoices: Invoice[];
  creditNotes?: CreditNote[];
  profile?: BusinessProfile;
  onAddCustomer: (customer: Omit<Customer, 'id'>) => void;
  onUpdateCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onSelectQuote: (quoteId: string) => void;
  onSelectInvoice: (invoiceId: string) => void;
}

export default function Customers({
  customers,
  quotes,
  invoices,
  creditNotes = [],
  profile = {
    name: 'Pulp Paperworks',
    email: 'studio@pulppaperworks.com',
    phone: '+27 82 456 7890',
    address: 'Victoria Yards, 16 Viljoen St, Lorentzville, Johannesburg, 2094',
    isVatRegistered: true,
    vatNumber: '4920194821',
    vatRate: 15,
    logo: '',
    bankingDetails: {
      bankName: 'First National Bank (FNB)',
      accountNumber: '62849102844',
      branchCode: '250655',
      accountType: 'Business Cheque'
    }
  },
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onSelectQuote,
  onSelectInvoice
}: CustomersProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  // Form states
  const [cName, setCName] = useState('');
  const [cIsBusiness, setCIsBusiness] = useState(false);
  const [cContactPerson, setCContactPerson] = useState('');
  const [cVatNumber, setCVatNumber] = useState('');
  const [cCompanyRegNumber, setCCompanyRegNumber] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  
  // Billing Address (Sensible Default Address)
  const [cStreet, setCStreet] = useState('');
  const [cCity, setCCity] = useState('');
  const [cProvince, setCProvince] = useState('');
  const [cPostalCode, setCPostalCode] = useState('');
  const [cCountry, setCCountry] = useState('South Africa');
  
  // Shipping Address
  const [cUseSameAddress, setCUseSameAddress] = useState(true);
  const [cShippingStreet, setCShippingStreet] = useState('');
  const [cShippingCity, setCShippingCity] = useState('');
  const [cShippingProvince, setCShippingProvince] = useState('');
  const [cShippingPostalCode, setCShippingPostalCode] = useState('');
  const [cShippingCountry, setCShippingCountry] = useState('South Africa');

  const [cNotes, setCNotes] = useState('');

  // Interactive Notes State
  const [notesDraft, setNotesDraft] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  
  // Get history for selected customer
  const customerQuotes = quotes.filter(q => q.customerId === selectedCustomerId);
  const customerInvoices = invoices.filter(i => i.customerId === selectedCustomerId);
  const customerCreditNotes = creditNotes.filter(cn => cn.customerId === selectedCustomerId);

  // Filter list
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    (c.contactPerson && c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.vatNumber && c.vatNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.companyRegistrationNumber && c.companyRegistrationNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.shippingAddress && c.shippingAddress.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const startAddCustomer = () => {
    setCName('');
    setCIsBusiness(false);
    setCContactPerson('');
    setCVatNumber('');
    setCCompanyRegNumber('');
    setCPhone('');
    setCEmail('');
    setCStreet('');
    setCCity('');
    setCProvince('');
    setCPostalCode('');
    setCCountry('South Africa');
    setCUseSameAddress(true);
    setCShippingStreet('');
    setCShippingCity('');
    setCShippingProvince('');
    setCShippingPostalCode('');
    setCShippingCountry('South Africa');
    setCNotes('');
    setIsAddingCustomer(true);
    setEditingCustomer(null);
  };

  const startEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setCName(c.name);
    setCIsBusiness(Boolean(c.isBusiness));
    setCContactPerson(c.contactPerson || '');
    setCVatNumber(c.vatNumber || '');
    setCCompanyRegNumber(c.companyRegistrationNumber || '');
    setCPhone(c.phone);
    setCEmail(c.email);
    
    // Billing address (from billingAddress or address)
    const billingParsed = parseAddress(c.billingAddress || c.address || '');
    setCStreet(billingParsed.street);
    setCCity(billingParsed.city);
    setCProvince(billingParsed.province);
    setCPostalCode(billingParsed.postalCode);
    setCCountry(billingParsed.country || 'South Africa');

    // Shipping address
    const hasDifferentShipping = Boolean(c.shippingAddress && c.shippingAddress !== (c.billingAddress || c.address));
    const same = c.useSameAddress !== undefined ? c.useSameAddress : !hasDifferentShipping;
    setCUseSameAddress(same);

    if (c.shippingAddress) {
      const shippingParsed = parseAddress(c.shippingAddress);
      setCShippingStreet(shippingParsed.street);
      setCShippingCity(shippingParsed.city);
      setCShippingProvince(shippingParsed.province);
      setCShippingPostalCode(shippingParsed.postalCode);
      setCShippingCountry(shippingParsed.country || 'South Africa');
    } else {
      setCShippingStreet(billingParsed.street);
      setCShippingCity(billingParsed.city);
      setCShippingProvince(billingParsed.province);
      setCShippingPostalCode(billingParsed.postalCode);
      setCShippingCountry(billingParsed.country || 'South Africa');
    }

    setCNotes(c.notes);
    setIsAddingCustomer(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName) return;

    const formattedBillingAddress = formatAddress({
      street: cStreet,
      city: cCity,
      province: cProvince,
      postalCode: cPostalCode,
      country: cCountry
    });

    const formattedShippingAddress = cUseSameAddress
      ? formattedBillingAddress
      : formatAddress({
          street: cShippingStreet,
          city: cShippingCity,
          province: cShippingProvince,
          postalCode: cShippingPostalCode,
          country: cShippingCountry
        });

    const payload: Omit<Customer, 'id'> = {
      name: cName,
      isBusiness: cIsBusiness,
      contactPerson: cIsBusiness && cContactPerson.trim() ? cContactPerson.trim() : undefined,
      vatNumber: cIsBusiness && cVatNumber.trim() ? cVatNumber.trim() : undefined,
      companyRegistrationNumber: cIsBusiness && cCompanyRegNumber.trim() ? cCompanyRegNumber.trim() : undefined,
      phone: cPhone,
      email: cEmail,
      address: formattedBillingAddress,
      billingAddress: formattedBillingAddress,
      shippingAddress: formattedShippingAddress,
      useSameAddress: cUseSameAddress,
      notes: cNotes
    };

    if (editingCustomer) {
      onUpdateCustomer({
        ...editingCustomer,
        ...payload
      });
      if (selectedCustomerId === editingCustomer.id) {
        setNotesDraft(cNotes);
      }
    } else {
      const added = onAddCustomer(payload);
      // Automatically select the newly created customer
      setSelectedCustomerId((added as any)?.id || null);
    }

    setIsAddingCustomer(false);
    setEditingCustomer(null);
  };

  const saveQuickNotes = () => {
    if (!selectedCustomer) return;
    onUpdateCustomer({
      ...selectedCustomer,
      notes: notesDraft
    });
    setIsEditingNotes(false);
  };

  const formatZAR = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
  };

  // SCREEN 1: ADD/EDIT CUSTOMER FORM
  if (isAddingCustomer) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-fadeIn" id="customers-form-container">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => { setIsAddingCustomer(false); setEditingCustomer(null); }}
            className="flex items-center gap-1.5 text-stone-600 hover:text-stone-900 text-xs font-bold transition cursor-pointer"
          >
            <ArrowLeft size={16} /> Back to Customers
          </button>
        </div>

        <form onSubmit={handleSaveCustomer} className="bg-white p-6 md:p-8 rounded-2xl border border-stone-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div>
              <h3 className="font-extrabold text-stone-800 text-xl">
                {editingCustomer ? `Edit Customer: ${editingCustomer.name}` : 'Add Customer'}
              </h3>
              <p className="text-xs text-stone-400 font-medium mt-0.5">
                {editingCustomer ? 'Update contact details, delivery address and notes' : 'Add customer details to use in quotes, invoices, and jobs'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setIsAddingCustomer(false); setEditingCustomer(null); }}
              className="text-stone-400 hover:text-stone-600 cursor-pointer p-1"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Customer Type Selector */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">Customer Type</label>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => setCIsBusiness(false)}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    !cIsBusiness 
                      ? 'bg-amber-50/80 border-amber-300 text-amber-900 shadow-2xs' 
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <span>Individual Customer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCIsBusiness(true)}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    cIsBusiness 
                      ? 'bg-amber-50/80 border-amber-300 text-amber-900 shadow-2xs' 
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <Sparkles size={14} className={cIsBusiness ? 'text-amber-600' : 'text-stone-400'} />
                  <span>Company / Business</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                {cIsBusiness ? 'Company / Business Name *' : 'Customer Name *'}
              </label>
              <input
                type="text"
                required
                value={cName}
                onChange={e => setCName(e.target.value)}
                placeholder={cIsBusiness ? "e.g. Apex Timber Works (Pty) Ltd" : "e.g. Jane Doe"}
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-normal"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Contact Cellphone</label>
              <input
                type="text"
                value={cPhone}
                onChange={e => setCPhone(e.target.value)}
                placeholder="e.g. +27 82 123 4567"
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
              />
            </div>

            <div className={cIsBusiness ? 'md:col-span-2' : 'md:col-span-2'}>
              <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Email Address</label>
              <input
                type="email"
                value={cEmail}
                onChange={e => setCEmail(e.target.value)}
                placeholder="e.g. customer@example.com"
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
              />
            </div>

            {/* South African Business Fields */}
            {cIsBusiness && (
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-amber-50/30 border border-amber-200/60 animate-fadeIn">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={cContactPerson}
                    onChange={e => setCContactPerson(e.target.value)}
                    placeholder="e.g. Jane Doe (Procurement / Accounts)"
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                  />
                  <span className="text-[10px] text-stone-500 mt-1 block">Primary contact representative for this business</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">
                    Company Registration No. (CIPC)
                  </label>
                  <input
                    type="text"
                    value={cCompanyRegNumber}
                    onChange={e => setCCompanyRegNumber(e.target.value)}
                    placeholder="e.g. 2021/123456/07"
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-mono"
                  />
                  <span className="text-[10px] text-stone-500 mt-1 block">Format: YYYY/NNNNNN/NN</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">
                    Customer VAT Registration No.
                  </label>
                  <input
                    type="text"
                    value={cVatNumber}
                    onChange={e => setCVatNumber(e.target.value)}
                    placeholder="e.g. 4123456789"
                    maxLength={10}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-mono"
                  />
                  <span className="text-[10px] text-stone-500 mt-1 block">SARS 10-digit tax number starting with 4</span>
                </div>
              </div>
            )}

            {/* Structured Billing Address (Sensible Default) */}
            <div className="md:col-span-2 space-y-3 pt-2 border-t border-stone-100">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Billing / Physical Address (Default)
                </label>
                <span className="text-[10px] text-stone-400">Appears on invoices and quotes</span>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">Street Address</label>
                <input
                  type="text"
                  value={cStreet}
                  onChange={e => setCStreet(e.target.value)}
                  placeholder="e.g. 12 Baker Street"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-normal"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">City</label>
                  <input
                    type="text"
                    value={cCity}
                    onChange={e => setCCity(e.target.value)}
                    placeholder="e.g. Cape Town"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-normal"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">Province</label>
                  <input
                    type="text"
                    value={cProvince}
                    onChange={e => setCProvince(e.target.value)}
                    placeholder="e.g. Western Cape"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-normal"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">Postal Code</label>
                  <input
                    type="text"
                    value={cPostalCode}
                    onChange={e => setCPostalCode(e.target.value)}
                    placeholder="e.g. 8001"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-normal"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">Country</label>
                  <input
                    type="text"
                    value={cCountry}
                    onChange={e => setCCountry(e.target.value)}
                    placeholder="e.g. South Africa"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-normal"
                  />
                </div>
              </div>
            </div>

            {/* Separate Shipping Address Option */}
            <div className="md:col-span-2 space-y-3 pt-2 border-t border-stone-100">
              <div className="flex items-center gap-2.5 bg-stone-50 p-3 rounded-xl border border-stone-200">
                <input
                  type="checkbox"
                  id="useSameAddressCheckbox"
                  checked={cUseSameAddress}
                  onChange={e => setCUseSameAddress(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-stone-300 cursor-pointer"
                />
                <label htmlFor="useSameAddressCheckbox" className="text-xs font-bold text-stone-700 cursor-pointer select-none">
                  Use same address for shipping
                </label>
              </div>

              {!cUseSameAddress && (
                <div className="space-y-3 p-4 bg-stone-50/70 border border-stone-200 rounded-xl animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">
                      Shipping Address
                    </label>
                    <span className="text-[10px] text-stone-400">Used for courier & delivery dispatches</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">Shipping Street Address</label>
                    <input
                      type="text"
                      value={cShippingStreet}
                      onChange={e => setCShippingStreet(e.target.value)}
                      placeholder="e.g. Unit 4, Industrial Park, 45 Main Rd"
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">City</label>
                      <input
                        type="text"
                        value={cShippingCity}
                        onChange={e => setCShippingCity(e.target.value)}
                        placeholder="e.g. Durban"
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">Province</label>
                      <input
                        type="text"
                        value={cShippingProvince}
                        onChange={e => setCShippingProvince(e.target.value)}
                        placeholder="e.g. KwaZulu-Natal"
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">Postal Code</label>
                      <input
                        type="text"
                        value={cShippingPostalCode}
                        onChange={e => setCShippingPostalCode(e.target.value)}
                        placeholder="e.g. 4001"
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">Country</label>
                      <input
                        type="text"
                        value={cShippingCountry}
                        onChange={e => setCShippingCountry(e.target.value)}
                        placeholder="e.g. South Africa"
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Internal Notes</label>
              <textarea
                value={cNotes}
                onChange={e => setCNotes(e.target.value)}
                rows={3}
                placeholder="Internal notes, custom delivery instructions or specs..."
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => { setIsAddingCustomer(false); setEditingCustomer(null); }}
              className="bg-stone-100 hover:bg-stone-200 text-stone-600 px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm active:scale-95"
            >
              {editingCustomer ? 'Save Details' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // SCREEN 2: DETAILED VIEW (WHEN A CUSTOMER IS SELECTED)
  if (selectedCustomer) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-fadeIn" id="customers-detail-container">
        {/* Navigation header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedCustomerId(null)}
            className="flex items-center gap-1.5 text-stone-600 hover:text-stone-900 text-xs font-bold transition cursor-pointer"
          >
            <ArrowLeft size={16} /> Back to Customers List
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setStatementCustomer(selectedCustomer);
                setIsStatementOpen(true);
              }}
              className="text-amber-900 hover:text-black bg-amber-50 hover:bg-amber-100 border border-amber-300/80 px-3.5 py-1.5 rounded-xl transition text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <FileText size={13} className="text-amber-700" /> Generate Statement
            </button>
            <button
              onClick={() => startEditCustomer(selectedCustomer)}
              className="text-stone-600 hover:text-stone-900 bg-white border border-stone-200 hover:bg-stone-50 px-3 py-1.5 rounded-xl transition text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Edit2 size={13} /> Edit Customer
            </button>
            <button
              onClick={() => {
                if(confirm(`Are you sure you want to delete ${selectedCustomer.name}? All history will be unlinked.`)) {
                  onDeleteCustomer(selectedCustomer.id);
                  setSelectedCustomerId(null);
                }
              }}
              className="text-rose-600 hover:text-rose-800 bg-white border border-rose-200 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>

        {/* Header Detail Box */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-stone-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 pb-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <h2 className="font-black text-stone-800 text-2xl">{selectedCustomer.name}</h2>
                {selectedCustomer.isBusiness && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200/60">
                    Business
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500 font-mono">
                <span>Customer ID: {selectedCustomer.id}</span>
                {selectedCustomer.companyRegistrationNumber && (
                  <span>• CIPC Reg: <strong className="text-stone-700">{selectedCustomer.companyRegistrationNumber}</strong></span>
                )}
                {selectedCustomer.vatNumber && (
                  <span>• VAT: <strong className="text-stone-700">{selectedCustomer.vatNumber}</strong></span>
                )}
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <div className="bg-amber-50/60 border border-amber-200/50 px-3.5 py-2 rounded-xl text-center min-w-[70px]">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Quotes</span>
                <span className="text-base font-black text-amber-900">{customerQuotes.length}</span>
              </div>
              <div className="bg-stone-50 border border-stone-200 px-3.5 py-2 rounded-xl text-center min-w-[70px]">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Invoices</span>
                <span className="text-base font-black text-stone-800">{customerInvoices.length}</span>
              </div>
              <div className="bg-rose-50/60 border border-rose-200/50 px-3.5 py-2 rounded-xl text-center min-w-[70px]">
                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Credits</span>
                <span className="text-base font-black text-rose-900">{customerCreditNotes.length}</span>
              </div>
            </div>
          </div>

          {/* Contact Details Stack */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-stone-700 font-medium">
            {selectedCustomer.isBusiness && selectedCustomer.contactPerson && (
              <div className="flex items-center justify-between gap-3 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/60 md:col-span-2">
                <div className="flex items-start gap-3 min-w-0">
                  <User size={16} className="text-amber-700 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-amber-900/60 uppercase tracking-wider block mb-0.5">Contact Person</span>
                    <span className="truncate block font-bold text-stone-800">{selectedCustomer.contactPerson}</span>
                  </div>
                </div>
                <CopyButton text={selectedCustomer.contactPerson} />
              </div>
            )}
            <div className="flex items-center justify-between gap-3 bg-stone-50/80 p-3.5 rounded-xl border border-stone-150">
              <div className="flex items-start gap-3 min-w-0">
                <Mail size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Email</span>
                  <span className="truncate block font-semibold text-stone-800">{selectedCustomer.email || 'No email registered'}</span>
                </div>
              </div>
              {selectedCustomer.email && <CopyButton text={selectedCustomer.email} />}
            </div>
            <div className="flex items-center justify-between gap-3 bg-stone-50/80 p-3.5 rounded-xl border border-stone-150">
              <div className="flex items-start gap-3 min-w-0">
                <Phone size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Phone</span>
                  <span className="block font-semibold text-stone-800">{selectedCustomer.phone || 'No phone registered'}</span>
                </div>
              </div>
              {selectedCustomer.phone && <CopyButton text={selectedCustomer.phone} />}
            </div>
            <div className="flex items-center justify-between gap-3 bg-stone-50/80 p-3.5 rounded-xl border border-stone-150">
              <div className="flex items-start gap-3 min-w-0">
                <MapPin size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Billing Address</span>
                  <span className="block font-semibold text-stone-800 leading-snug">
                    {selectedCustomer.billingAddress || selectedCustomer.address || 'No billing address registered'}
                  </span>
                </div>
              </div>
              {(selectedCustomer.billingAddress || selectedCustomer.address) && (
                <CopyButton text={selectedCustomer.billingAddress || selectedCustomer.address} />
              )}
            </div>
            <div className="flex items-center justify-between gap-3 bg-stone-50/80 p-3.5 rounded-xl border border-stone-150">
              <div className="flex items-start gap-3 min-w-0">
                <MapPin size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Shipping Address</span>
                  <span className="block font-semibold text-stone-800 leading-snug">
                    {selectedCustomer.shippingAddress || selectedCustomer.billingAddress || selectedCustomer.address || 'Same as billing address'}
                  </span>
                </div>
              </div>
              {selectedCustomer.shippingAddress && <CopyButton text={selectedCustomer.shippingAddress} />}
            </div>
          </div>
        </div>

        {/* Notebook / Remarks area */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-stone-800 text-sm flex items-center gap-1.5">
              <BookOpen size={16} className="text-amber-600" />
              Notes
            </h4>
            <span className="text-[10px] text-stone-400 font-mono">Auto-saved</span>
          </div>

          <textarea
            value={selectedCustomer.notes || ''}
            onChange={e => onUpdateCustomer({ ...selectedCustomer, notes: e.target.value })}
            placeholder="Add custom notes, preferences, or packaging constraints here..."
            rows={4}
            className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-xs focus:ring-amber-500/25 focus:ring-2 focus:outline-none leading-relaxed font-sans"
          />
        </div>

        {/* Orders, Quotes & Credit Histories */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="history-grid">
          {/* Quotes history */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            <h4 className="font-bold text-stone-800 text-sm flex items-center gap-1.5">
              <FileText size={16} className="text-amber-600" />
              Quotes Ledger ({customerQuotes.length})
            </h4>

            {customerQuotes.length === 0 ? (
              <p className="text-xs text-stone-400 italic py-4 text-center bg-stone-50 rounded-xl">No quotes generated for this customer.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {customerQuotes.map(q => (
                  <div
                    key={q.id}
                    onClick={() => onSelectQuote(q.id)}
                    className="p-3.5 bg-stone-50 hover:bg-stone-100 rounded-xl border border-stone-200/70 flex items-center justify-between text-xs cursor-pointer transition group"
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold text-amber-800 group-hover:underline block">{q.quoteNumber}</span>
                      <span className="text-[10px] text-stone-400 block">{formatSADate(q.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        q.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        q.status === 'sent' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-stone-100 text-stone-700'
                      }`}>
                        {q.status}
                      </span>
                      <span className="font-bold text-stone-800">{formatZAR(q.totalAmount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoices history */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            <h4 className="font-bold text-stone-800 text-sm flex items-center gap-1.5">
              <CheckCircle size={16} className="text-amber-600" />
              Invoices Ledger ({customerInvoices.length})
            </h4>

            {customerInvoices.length === 0 ? (
              <p className="text-xs text-stone-400 italic py-4 text-center bg-stone-50 rounded-xl">No invoices converted/generated for this customer.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {customerInvoices.map(inv => (
                  <div
                    key={inv.id}
                    onClick={() => onSelectInvoice(inv.id)}
                    className="p-3.5 bg-stone-50 hover:bg-stone-100 rounded-xl border border-stone-200/70 flex items-center justify-between text-xs cursor-pointer transition group"
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold text-amber-800 group-hover:underline block">{inv.invoiceNumber}</span>
                      <span className="text-[10px] text-stone-400 block">Due {formatSADate(inv.dueDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        inv.status === 'overdue' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        inv.status === 'credited' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                        inv.status === 'partially_credited' ? 'bg-amber-50 text-amber-800 border border-amber-300' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {inv.status === 'partially_credited' ? 'partial credit' : inv.status}
                      </span>
                      <span className="font-bold text-stone-800">{formatZAR(inv.totalAmount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Credit Notes history */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            <h4 className="font-bold text-stone-800 text-sm flex items-center gap-1.5">
              <RotateCcw size={16} className="text-rose-600" />
              Tax Credit Notes ({customerCreditNotes.length})
            </h4>

            {customerCreditNotes.length === 0 ? (
              <p className="text-xs text-stone-400 italic py-4 text-center bg-stone-50 rounded-xl">No credit notes issued for this customer.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {customerCreditNotes.map(cn => (
                  <div
                    key={cn.id}
                    onClick={() => {
                      setStatementCustomer(selectedCustomer);
                      setIsStatementOpen(true);
                    }}
                    className="p-3.5 bg-stone-50 hover:bg-stone-100 rounded-xl border border-stone-200/70 flex items-center justify-between text-xs cursor-pointer transition group"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-bold text-rose-800 group-hover:underline block">{cn.creditNoteNumber}</span>
                      <span className="text-[10px] text-stone-400 block">re {cn.invoiceNumber} • {formatSADate(cn.date)}</span>
                      <span className="text-[10px] text-stone-500 truncate block">{cn.reason}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-black text-rose-700 block font-mono">-{formatZAR(cn.totalAmount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Customer Statement Modal */}
        <CustomerStatementModal
          customer={statementCustomer}
          invoices={invoices}
          creditNotes={creditNotes}
          profile={profile}
          isOpen={isStatementOpen}
          onClose={() => setIsStatementOpen(false)}
          onSelectInvoice={onSelectInvoice}
        />
      </div>
    );
  }

  // SCREEN 3: FIRST SCREEN - PLAIN LIST VIEW (DEFAULT)
  return (
    <div className="space-y-6 pb-12 animate-fadeIn" id="customers-list-screen">
      {/* Top Bar / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
        <h2 className="text-lg font-bold text-stone-800">Customers</h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 text-stone-400" size={14} />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button
            onClick={startAddCustomer}
            className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition shrink-0"
          >
            <PlusCircle size={14} /> Add Customer
          </button>
        </div>
      </div>

      {/* Customers List Grid / Cards */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-stone-200 text-center space-y-3">
          <p className="text-stone-400 text-xs italic">No customers found matching your search.</p>
          <button
            onClick={startAddCustomer}
            className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-bold hover:underline cursor-pointer"
          >
            <Plus size={14} /> Register a new customer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="customer-cards-grid">
          {filteredCustomers.map((c) => {
            const cQuotesCount = quotes.filter(q => q.customerId === c.id).length;
            const cInvoicesCount = invoices.filter(i => i.customerId === c.id).length;

            return (
              <div
                key={c.id}
                onClick={() => {
                  setSelectedCustomerId(c.id);
                  setNotesDraft(c.notes);
                  setIsEditingNotes(false);
                }}
                className="bg-white p-5 rounded-2xl border border-stone-200 hover:border-amber-300 hover:bg-amber-50/20 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  {/* Top row: Name & Chevron */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-extrabold text-stone-800 text-base group-hover:text-amber-900 transition-colors truncate">
                          {c.name}
                        </h3>
                        {c.isBusiness && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 shrink-0">
                            Business
                          </span>
                        )}
                      </div>
                      {(c.companyRegistrationNumber || c.vatNumber) && (
                        <div className="text-[10px] text-stone-400 font-mono mt-0.5 truncate">
                          {c.companyRegistrationNumber && `Reg: ${c.companyRegistrationNumber}`}
                          {c.companyRegistrationNumber && c.vatNumber && ' • '}
                          {c.vatNumber && `VAT: ${c.vatNumber}`}
                        </div>
                      )}
                    </div>
                    <div className="p-1.5 bg-stone-50 rounded-lg group-hover:bg-amber-100 text-stone-400 group-hover:text-amber-800 transition-colors shrink-0">
                      <ChevronRight size={16} />
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1.5 text-xs text-stone-600">
                    {c.email && (
                      <div className="flex items-center justify-between gap-1 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <Mail size={13} className="text-stone-400 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                        <CopyButton text={c.email} />
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center justify-between gap-1 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <Phone size={13} className="text-stone-400 shrink-0" />
                          <span>{c.phone}</span>
                        </div>
                        <CopyButton text={c.phone} />
                      </div>
                    )}
                    {c.address && (
                      <div className="flex items-center justify-between gap-1 text-xs text-stone-500">
                        <div className="flex items-center gap-2 truncate">
                          <MapPin size={13} className="text-stone-400 shrink-0" />
                          <span className="truncate">{c.address}</span>
                        </div>
                        <CopyButton text={c.address} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Badges */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2 font-semibold text-stone-500">
                    <span className="bg-stone-100 px-2 py-0.5 rounded-md text-stone-700">
                      {cQuotesCount} {cQuotesCount === 1 ? 'quote' : 'quotes'}
                    </span>
                    <span className="bg-stone-100 px-2 py-0.5 rounded-md text-stone-700">
                      {cInvoicesCount} {cInvoicesCount === 1 ? 'invoice' : 'invoices'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatementCustomer(c);
                        setIsStatementOpen(true);
                      }}
                      className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-md text-[10px] font-bold cursor-pointer transition flex items-center gap-1"
                      title="Generate Statement"
                    >
                      <FileText size={11} className="text-amber-700" /> Statement
                    </button>
                    <span className="text-amber-700 font-bold group-hover:underline">
                      View &rarr;
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Customer Statement Modal (when opened from list view) */}
      <CustomerStatementModal
        customer={statementCustomer}
        invoices={invoices}
        creditNotes={creditNotes}
        profile={profile}
        isOpen={isStatementOpen}
        onClose={() => setIsStatementOpen(false)}
        onSelectInvoice={onSelectInvoice}
      />
    </div>
  );
}

