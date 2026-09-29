import React, { useState, useEffect } from 'react';
import { Invoice, CreditNote, CreditNoteReason, CreditNoteLineItem, BusinessProfile } from '../types';
import { X, RotateCcw, Check, AlertCircle, PackageCheck, FileText, Info } from 'lucide-react';
import { formatSADate } from '../lib/dateUtils';

interface CreateCreditNoteModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateCreditNote: (creditNoteData: Omit<CreditNote, 'id' | 'creditNoteNumber' | 'subtotal' | 'vatAmount' | 'hasVat'>) => CreditNote;
  profile: BusinessProfile;
  onCreditNoteCreated?: (creditNote: CreditNote) => void;
}

const CREDIT_REASONS: CreditNoteReason[] = [
  'Goods Returned / Defective',
  'Order Cancellation / Reduction',
  'Billing / Pricing Adjustment',
  'Discount / Rebate Allowed',
  'Damaged / Short Delivered',
  'Other'
];

export const CreateCreditNoteModal: React.FC<CreateCreditNoteModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onCreateCreditNote,
  profile,
  onCreditNoteCreated
}) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<CreditNoteReason>('Goods Returned / Defective');
  const [notes, setNotes] = useState('');
  
  // Selected items to credit: map of invoice item id to { selected: boolean, quantity: number, unitPrice: number, restock: boolean }
  const [selectedItems, setSelectedItems] = useState<Record<string, {
    selected: boolean;
    quantity: number;
    unitPrice: number;
    restock: boolean;
  }>>({});

  useEffect(() => {
    if (invoice) {
      setDate(new Date().toISOString().split('T')[0]);
      setReason('Goods Returned / Defective');
      setNotes(`SARS Section 21 Credit Note for invoice ${invoice.invoiceNumber}.`);

      const initialSelected: Record<string, { selected: boolean; quantity: number; unitPrice: number; restock: boolean }> = {};
      invoice.items.forEach(item => {
        initialSelected[item.id] = {
          selected: true,
          quantity: item.quantity,
          unitPrice: item.appliedUnitPrice || (item.total / item.quantity),
          restock: true
        };
      });
      setSelectedItems(initialSelected);
    }
  }, [invoice]);

  if (!isOpen || !invoice) return null;

  const previousCredited = invoice.creditedAmount || 0;
  const remainingInvoiceBalance = Math.max(0, invoice.totalAmount - previousCredited);

  const toggleItem = (id: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        selected: !prev[id]?.selected
      }
    }));
  };

  const updateQuantity = (id: string, qty: number, maxQty: number) => {
    const safeQty = Math.max(1, Math.min(maxQty, qty || 1));
    setSelectedItems(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        quantity: safeQty
      }
    }));
  };

  const updateUnitPrice = (id: string, price: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        unitPrice: Math.max(0, price || 0)
      }
    }));
  };

  const toggleRestock = (id: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        restock: !prev[id]?.restock
      }
    }));
  };

  // Calculate totals
  const creditedLineItems: CreditNoteLineItem[] = [];
  let calculatedSubtotal = 0;

  invoice.items.forEach(item => {
    const sel = selectedItems[item.id];
    if (sel && sel.selected) {
      const lineTotal = sel.quantity * sel.unitPrice;
      calculatedSubtotal += lineTotal;
      creditedLineItems.push({
        id: 'cni_' + Date.now() + '_' + item.id,
        invoiceLineItemId: item.id,
        productId: item.productId,
        productName: item.productName,
        productPhoto: item.productPhoto,
        productDescription: item.productDescription,
        quantity: sel.quantity,
        unitPrice: sel.unitPrice,
        total: lineTotal,
        restockQuantity: sel.restock
      });
    }
  });

  // Apply overall invoice discount ratio if invoice had a discount
  let totalCreditAmount = calculatedSubtotal;
  if (invoice.hasDiscount && invoice.discount) {
    if (invoice.discount.type === 'percentage') {
      totalCreditAmount = calculatedSubtotal * (1 - invoice.discount.value / 100);
    }
  }

  const vatAmount = profile.isVatRegistered
    ? totalCreditAmount - (totalCreditAmount / (1 + (profile.vatRate || 15) / 100))
    : 0;
  const netSubtotal = totalCreditAmount - vatAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (creditedLineItems.length === 0 || totalCreditAmount <= 0) return;

    const newCreditNote = onCreateCreditNote({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.date,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerPhone: invoice.customerPhone,
      customerAddress: invoice.customerAddress,
      customerIsBusiness: invoice.customerIsBusiness,
      customerContactPerson: invoice.customerContactPerson,
      customerVatNumber: invoice.customerVatNumber,
      customerCompanyRegNumber: invoice.customerCompanyRegNumber,
      customerBillingAddress: invoice.customerBillingAddress,
      customerShippingAddress: invoice.customerShippingAddress,
      date,
      reason,
      notes,
      items: creditedLineItems,
      totalAmount: totalCreditAmount,
      templateId: invoice.templateId || 'artisan-warm',
      templateCustomStyle: invoice.templateCustomStyle,
      status: 'issued'
    });

    if (onCreditNoteCreated) {
      onCreditNoteCreated(newCreditNote);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-600/10 text-amber-800 flex items-center justify-center font-bold">
              <RotateCcw size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 leading-tight">Issue Tax Credit Note</h2>
              <p className="text-xs text-stone-500">
                SARS Section 21 Credit Note linked to <span className="font-bold text-stone-700">{invoice.invoiceNumber}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-xl transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Invoice Summary Banner */}
        <div className="bg-amber-50/60 border-b border-amber-200/60 px-6 py-3 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="space-y-0.5">
            <span className="text-stone-500 font-medium">Customer:</span>{' '}
            <span className="font-bold text-stone-900">{invoice.customerName}</span>
            <span className="text-stone-400 text-[11px] block">Invoice Date: {formatSADate(invoice.date)}</span>
          </div>
          <div className="text-right">
            <span className="text-stone-500 font-medium">Invoice Value:</span>{' '}
            <span className="font-bold text-stone-900">R{invoice.totalAmount.toFixed(2)}</span>
            {previousCredited > 0 && (
              <span className="text-amber-700 text-[11px] block font-semibold">
                Previously Credited: R{previousCredited.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          
          {/* Reason & Date Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                SARS Reason for Credit Note <span className="text-rose-500">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as CreditNoteReason)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                required
              >
                {CREDIT_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Credit Issue Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                required
              />
            </div>
          </div>

          {/* Line Items Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-stone-800">
                Select Items & Quantities to Credit:
              </label>
              <span className="text-[11px] text-stone-500">
                {creditedLineItems.length} of {invoice.items.length} items selected
              </span>
            </div>

            <div className="space-y-2 border border-stone-200 rounded-xl p-3 bg-stone-50/40 divide-y divide-stone-200/60">
              {invoice.items.map(item => {
                const sel = selectedItems[item.id] || { selected: false, quantity: item.quantity, unitPrice: item.appliedUnitPrice, restock: true };
                return (
                  <div key={item.id} className="pt-2 first:pt-0 space-y-2">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={sel.selected}
                        onChange={() => toggleItem(item.id)}
                        className="mt-1 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-stone-900 text-xs block">{item.productName}</span>
                            <span className="text-stone-500 text-[11px]">
                              Original Invoiced: {item.quantity} units @ R{item.appliedUnitPrice.toFixed(2)} (Total R{item.total.toFixed(2)})
                            </span>
                          </div>
                          <span className="font-bold text-stone-800 text-xs">
                            R{(sel.quantity * sel.unitPrice).toFixed(2)}
                          </span>
                        </div>

                        {sel.selected && (
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 items-center bg-white p-2.5 rounded-lg border border-stone-200">
                            <div>
                              <label className="block text-[10px] font-bold text-stone-500 uppercase">Qty to Credit</label>
                              <input
                                type="number"
                                min={1}
                                max={item.quantity}
                                value={sel.quantity}
                                onChange={(e) => updateQuantity(item.id, parseInt(e.target.value, 10), item.quantity)}
                                className="w-full px-2 py-1 bg-stone-50 border border-stone-200 rounded text-stone-800 text-xs font-bold"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-stone-500 uppercase">Credit Rate (R)</label>
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={sel.unitPrice}
                                onChange={(e) => updateUnitPrice(item.id, parseFloat(e.target.value), )}
                                className="w-full px-2 py-1 bg-stone-50 border border-stone-200 rounded text-stone-800 text-xs font-bold"
                              />
                            </div>

                            <div className="flex items-center gap-1.5 pt-3 sm:pt-0">
                              <input
                                type="checkbox"
                                id={`restock-${item.id}`}
                                checked={sel.restock}
                                onChange={() => toggleRestock(item.id)}
                                className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                              />
                              <label htmlFor={`restock-${item.id}`} className="text-[11px] text-stone-600 cursor-pointer select-none">
                                Restock items to inventory
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes & Explanation */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Circumstances / Explanation (SARS Requirement)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              placeholder="e.g. Return of damaged bookbinding cloth covers, pricing adjustment per revised scope..."
            />
          </div>

          {/* Financial Breakdown */}
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>Gross Credited Subtotal:</span>
              <span className="font-semibold">R{calculatedSubtotal.toFixed(2)}</span>
            </div>
            {invoice.hasDiscount && invoice.discount && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Original Invoice Discount Applied:</span>
                <span>-{invoice.discount.type === 'percentage' ? `${invoice.discount.value}%` : `R${invoice.discount.value}`}</span>
              </div>
            )}
            {profile.isVatRegistered && (
              <div className="flex justify-between text-stone-600">
                <span>SARS VAT Credit (15%):</span>
                <span className="font-semibold">R{vatAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-stone-200 flex justify-between items-center text-sm font-bold text-stone-900">
              <span>Total Credit Note Value:</span>
              <span className="text-base text-amber-900 font-mono font-black">
                R{totalCreditAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-stone-200 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-50 cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creditedLineItems.length === 0 || totalCreditAmount <= 0}
              className="flex items-center gap-1.5 bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm cursor-pointer transition"
            >
              <RotateCcw size={14} /> Issue & Finalize Credit Note
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
