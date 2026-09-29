import React, { useState, useEffect } from 'react';
import { 
  Check, X, Printer, Download, Sparkles, MessageSquare, ArrowLeft, 
  Landmark, AlertCircle, CheckCircle, Send, ShieldAlert, Heart, Clock, Palette
} from 'lucide-react';
import { Quote, Invoice, BusinessProfile, QuoteTemplateStyle } from '../types';
import { STANDARD_QUOTE_TEMPLATES, resolveQuoteTemplate } from '../data/quoteTemplates';
import { DocumentRenderer, RenderItem } from './DocumentRenderer';
import { downloadElementAsPdf } from '../lib/pdfUtils';

interface BuyerViewProps {
  profile: BusinessProfile;
  activeQuoteId: string | null;
  activeInvoiceId: string | null;
  quotes: Quote[];
  invoices: Invoice[];
  customTemplates?: QuoteTemplateStyle[];
  onAcceptQuote: (quoteId: string) => void;
  onDeclineQuote: (quoteId: string) => void;
  onUpdateInvoiceStatus: (invoiceId: string, status: 'paid' | 'unpaid') => void;
  onBackToMaker: () => void;
  onRecordQuoteViewed: (quoteId: string) => void;
}

export default function BuyerView({
  profile,
  activeQuoteId,
  activeInvoiceId,
  quotes,
  invoices,
  customTemplates = [],
  onAcceptQuote,
  onDeclineQuote,
  onUpdateInvoiceStatus,
  onBackToMaker,
  onRecordQuoteViewed
}: BuyerViewProps) {
  // If viewing quote
  const quote = quotes.find(q => q.id === activeQuoteId);
  // If viewing invoice
  const invoice = invoices.find(i => i.id === activeInvoiceId);

  // Layout template overriding
  const [activeTemplateId, setActiveTemplateId] = useState<string>('artisan-warm');

  // Customer Decline state
  const [isDeclining, setIsDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Proof of payment
  const [popSubmitted, setPopSubmitted] = useState(false);
  const [popReference, setPopReference] = useState('');

  // Record viewed log on mount
  useEffect(() => {
    if (quote) {
      onRecordQuoteViewed(quote.id);
      setActiveTemplateId(quote.templateId);
    } else if (invoice) {
      setActiveTemplateId(invoice.templateId);
    }
  }, [activeQuoteId, activeInvoiceId]);

  const formatZAR = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
  };

  const handleAccept = () => {
    if (!quote) return;
    onAcceptQuote(quote.id);
    // Alert user that quote is accepted and converted to invoice, and that the artisan has been notified to start production
  };

  const handleDeclineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote) return;
    onDeclineQuote(quote.id);
    setIsDeclining(false);
    alert(`Feedback Sent: "${declineReason}". The artisan has been notified.`);
  };

  const handlePopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    onUpdateInvoiceStatus(invoice.id, 'paid');
    setPopSubmitted(true);
    alert("Proof of payment submitted! Tax invoice status updated to 'Paid' instantly.");
  };

  // Render Error
  if (!quote && !invoice) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <ShieldAlert size={48} className="text-amber-600" />
        <h3 className="font-bold text-xl text-stone-800">No active link found</h3>
        <p className="text-xs text-stone-500 max-w-sm">Use the artisan quotes/invoices hub, click "Simulate Buyer Portal" to preview customer links.</p>
        <button
          onClick={onBackToMaker}
          className="bg-stone-800 text-white text-xs font-semibold px-4 py-2 rounded-xl"
        >
          Return to Business Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col" id="buyer-portal-root">
      {/* Top micro simulator bar */}
      <div className="bg-stone-950 text-stone-300 py-2.5 px-4 flex items-center justify-between text-xs font-medium border-b border-stone-800 print:hidden">
        <div className="flex items-center gap-2">
          <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Buyer Hub Simulator</span>
          <span className="hidden sm:inline">This is exactly what your customers see from their phone, tablet, or PC.</span>
        </div>
        <button
          onClick={onBackToMaker}
          className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1 rounded-lg text-[10px] transition cursor-pointer"
        >
          <ArrowLeft size={10} /> Exit Simulation
        </button>
      </div>

      <div className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Floating Sidebar Portal actions */}
        <div className="lg:col-span-1 space-y-6 print:hidden" id="buyer-sidebar">
          {/* Main Action Block */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-3xs space-y-4">
            <div className="flex items-center gap-1.5 text-stone-800 font-bold text-sm">
              <Sparkles size={16} className="text-amber-500" />
              <span>Artisan Portal Controls</span>
            </div>

            {quote && (
              <div className="space-y-3 pt-2">
                <span className="text-[11px] text-stone-500 font-semibold block">Would you like to accept this quote?</span>
                
                {quote.status === 'accepted' ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 font-medium space-y-1">
                    <span className="font-bold flex items-center gap-1"><CheckCircle size={14} /> Approved</span>
                    <p className="text-[10px] opacity-80">You approved this quote! Work is already scheduled inside the business.</p>
                  </div>
                ) : quote.status === 'declined' ? (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-800 font-medium space-y-1">
                    <span className="font-bold flex items-center gap-1"><X size={14} /> Declined</span>
                    <p className="text-[10px] opacity-80">You declined this quote. Please contact us for renegotiating rates.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={handleAccept}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check size={14} /> Accept Quote
                    </button>
                    
                    {!isDeclining ? (
                      <button
                        onClick={() => setIsDeclining(true)}
                        className="w-full bg-stone-100 hover:bg-stone-200 text-stone-600 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                      >
                        Decline with Feedback
                      </button>
                    ) : (
                      <form onSubmit={handleDeclineSubmit} className="space-y-2 pt-2 bg-stone-50 p-3 rounded-xl border border-stone-100">
                        <label className="block text-[10px] font-bold text-stone-500 uppercase">Reason for decline:</label>
                        <textarea
                          required
                          value={declineReason}
                          onChange={e => setDeclineReason(e.target.value)}
                          placeholder="e.g. Price too high; lead time is too long..."
                          rows={2}
                          className="w-full p-2 bg-white border border-stone-200 rounded text-xs"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setIsDeclining(false)}
                            className="bg-white hover:bg-stone-100 border border-stone-200 text-stone-600 text-[10px] font-bold px-2.5 py-1 rounded-md"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-3 py-1 rounded-md"
                          >
                            Send
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}

            {invoice && (
              <div className="space-y-3 pt-2">
                <span className="text-[11px] text-stone-500 font-semibold block">Submit Payment Settlement</span>

                {invoice.status === 'paid' ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 font-medium space-y-1">
                    <span className="font-bold flex items-center gap-1"><CheckCircle size={14} /> Fully Paid</span>
                    <p className="text-[10px] opacity-80">This tax invoice is fully settled. Thank you for supporting South African artisan design!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 font-medium space-y-0.5">
                      <span className="font-bold flex items-center gap-1"><Clock size={14} /> Awaiting Settlement</span>
                      <p className="text-[10px] opacity-80">FNB electronic deposit details are listed at the bottom of the invoice.</p>
                    </div>

                    {!popSubmitted ? (
                      <form onSubmit={handlePopSubmit} className="space-y-2 bg-stone-50 p-3 rounded-xl border border-stone-100">
                        <label className="block text-[10px] font-bold text-stone-500 uppercase">EFT / POP Reference Code:</label>
                        <input
                          type="text"
                          required
                          value={popReference}
                          onChange={e => setPopReference(e.target.value)}
                          placeholder="e.g. FNB-REF-9921"
                          className="w-full p-2 bg-white border border-stone-200 rounded text-xs font-normal"
                        />
                        <button
                          type="submit"
                          className="w-full bg-stone-800 hover:bg-stone-900 text-white py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Send size={12} /> Submit Proof of Payment
                        </button>
                      </form>
                    ) : (
                      <p className="text-xs text-stone-400 italic">Proof of payment reference submitted.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Print / Export Action Card */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-3xs space-y-2.5">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Official Document Copies</span>
            
            <button
              onClick={async () => {
                if (quote) {
                  await downloadElementAsPdf('printable-quote-area', `Quote_${quote.quoteNumber}.pdf`);
                } else if (invoice) {
                  await downloadElementAsPdf('printable-invoice-area', `Invoice_${invoice.invoiceNumber}.pdf`);
                } else {
                  window.print();
                }
              }}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
              title="Download official PDF copy"
            >
              <Download size={14} /> Download Official PDF
            </button>

            <button
              onClick={() => window.print()}
              className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} /> Print Document
            </button>
          </div>
        </div>

        {/* Formatted Invoice/Quote Sheet */}
        <div className="lg:col-span-3">
          {quote ? (
            /* QUOTE PRESENTATION CARD USING DocumentRenderer */
            <div>
              {(() => {
                const currentStyle = resolveQuoteTemplate(
                  quote.templateId,
                  quote.templateCustomStyle,
                  customTemplates
                );

                const renderItems: RenderItem[] = quote.items.map((item, idx) => {
                  const customUpliftsSum = Object.values(item.selectedCustomizations || {}).reduce((sum: number, c: any) => sum + (c?.priceUplift || 0), 0);
                  return {
                    id: `buyer_q_${idx}`,
                    productName: item.productName,
                    productDescription: item.productDescription,
                    quantity: item.quantity,
                    unitPrice: item.appliedUnitPrice + customUpliftsSum,
                    total: item.total,
                    selectedCustomizations: item.selectedCustomizations,
                    productPhoto: item.productPhoto,
                  };
                });

                const subtotalAmt = quote.items.reduce((sum, item) => sum + item.total, 0);

                return (
                  <DocumentRenderer
                    documentType="quote"
                    documentNumber={quote.quoteNumber}
                    date={quote.date}
                    expiryOrDueDate={quote.expiryDate}
                    profile={profile}
                    customerName={quote.customerName}
                    customerEmail={quote.customerEmail}
                    customerPhone={quote.customerPhone}
                    customerAddress={quote.customerAddress}
                    items={renderItems}
                    subtotal={subtotalAmt}
                    discount={quote.discount}
                    hasDiscount={quote.hasDiscount}
                    vatAmount={quote.taxAmount}
                    hasVat={quote.hasTax}
                    totalAmount={quote.totalAmount}
                    notes={quote.notes}
                    signOffMessage={quote.signOffMessage}
                    fulfillmentType={quote.fulfillmentType}
                    fulfillmentAddress={quote.fulfillmentAddress}
                    templateStyle={currentStyle}
                    printableId="printable-quote-area"
                  />
                );
              })()}
            </div>
          ) : invoice ? (
            /* TAX INVOICE PRESENTATION CARD USING DocumentRenderer */
            <div>
              {(() => {
                const currentStyle = resolveQuoteTemplate(
                  invoice.templateId,
                  invoice.templateCustomStyle,
                  customTemplates
                );

                const renderItems: RenderItem[] = invoice.items.map((item, idx) => {
                  const customUpliftsSum = Object.values(item.selectedCustomizations || {}).reduce((sum: number, c: any) => sum + (c?.priceUplift || 0), 0);
                  return {
                    id: `buyer_inv_${idx}`,
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
                    documentType="invoice"
                    documentNumber={invoice.invoiceNumber}
                    date={invoice.date}
                    expiryOrDueDate={invoice.dueDate}
                    profile={profile}
                    customerName={invoice.customerName}
                    customerEmail={invoice.customerEmail}
                    customerPhone={invoice.customerPhone}
                    customerAddress={invoice.customerAddress}
                    items={renderItems}
                    subtotal={invoice.subtotal}
                    vatAmount={invoice.vatAmount}
                    hasVat={invoice.hasVat}
                    totalAmount={invoice.totalAmount}
                    notes={invoice.notes}
                    fulfillmentType={invoice.fulfillmentType}
                    fulfillmentAddress={invoice.fulfillmentAddress}
                    templateStyle={currentStyle}
                    printableId="printable-invoice-area"
                  />
                );
              })()}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
