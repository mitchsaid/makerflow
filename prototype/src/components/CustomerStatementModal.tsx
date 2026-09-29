import React, { useState, useMemo } from 'react';
import { Customer, Invoice, CreditNote, BusinessProfile, StatementTransaction, AgingSummary } from '../types';
import { 
  X, Printer, Download, Calendar, Filter, FileText, 
  RotateCcw, CheckCircle, Clock, Copy, ArrowDownRight, ArrowUpRight, Building2, Landmark, Check
} from 'lucide-react';
import { formatSADate } from '../lib/dateUtils';
import { downloadElementAsPdf } from '../lib/pdfUtils';

interface CustomerStatementModalProps {
  customer: Customer | null;
  invoices: Invoice[];
  creditNotes: CreditNote[];
  profile: BusinessProfile;
  isOpen: boolean;
  onClose: () => void;
  onSelectInvoice?: (invoiceId: string) => void;
  onSelectCreditNote?: (creditNoteId: string) => void;
}

type PeriodFilter = 'all' | 'this_month' | 'last_30_days' | 'last_90_days' | 'ytd' | 'custom';
type StatusFilter = 'all' | 'unpaid_only';

export const CustomerStatementModal: React.FC<CustomerStatementModalProps> = ({
  customer,
  invoices,
  creditNotes,
  profile,
  isOpen,
  onClose,
  onSelectInvoice,
  onSelectCreditNote
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  if (!isOpen || !customer) return null;

  // Filter and build ledger transactions
  const customerInvoices = invoices.filter(inv => inv.customerId === customer.id);
  const customerCreditNotes = creditNotes.filter(cn => cn.customerId === customer.id);

  // Compute date thresholds
  const today = new Date();
  const dateRange = useMemo(() => {
    let start: Date | null = null;
    let end: Date | null = new Date();

    if (period === 'this_month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (period === 'last_30_days') {
      start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === 'last_90_days') {
      start = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (period === 'ytd') {
      start = new Date(today.getFullYear(), 0, 1);
    } else if (period === 'custom') {
      start = customStartDate ? new Date(customStartDate) : null;
      end = customEndDate ? new Date(customEndDate) : new Date();
    }

    return { start, end };
  }, [period, customStartDate, customEndDate]);

  // Build raw list of transactions sorted chronologically
  const transactions = useMemo(() => {
    const raw: {
      id: string;
      date: string;
      type: 'Invoice' | 'Credit Note';
      reference: string;
      description: string;
      debit: number;
      credit: number;
      originalItem: Invoice | CreditNote;
      status?: string;
      dueDate?: string;
    }[] = [];

    // Add Invoices
    customerInvoices.forEach(inv => {
      if (statusFilter === 'unpaid_only' && inv.status === 'paid') return;

      const desc = inv.items.map(i => `${i.quantity}x ${i.productName}`).join(', ');
      raw.push({
        id: inv.id,
        date: inv.date,
        type: 'Invoice',
        reference: inv.invoiceNumber,
        description: `Tax Invoice - ${desc.length > 50 ? desc.slice(0, 47) + '...' : desc}`,
        debit: inv.totalAmount,
        credit: 0,
        originalItem: inv,
        status: inv.status,
        dueDate: inv.dueDate
      });
    });

    // Add Credit Notes
    if (statusFilter !== 'unpaid_only') {
      customerCreditNotes.forEach(cn => {
        raw.push({
          id: cn.id,
          date: cn.date,
          type: 'Credit Note',
          reference: cn.creditNoteNumber,
          description: `Tax Credit Note (re ${cn.invoiceNumber}) - ${cn.reason || 'Goods Credited'}`,
          debit: 0,
          credit: cn.totalAmount,
          originalItem: cn,
          status: 'applied'
        });
      });
    }

    // Filter by date range
    const filtered = raw.filter(tx => {
      const txDate = new Date(tx.date);
      if (dateRange.start && txDate < dateRange.start) return false;
      if (dateRange.end && txDate > dateRange.end) return false;
      return true;
    });

    // Sort by date ascending for running ledger
    filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let running = 0;
    const finalTx: StatementTransaction[] = filtered.map(tx => {
      running += (tx.debit - tx.credit);
      return {
        id: tx.id,
        date: tx.date,
        type: tx.type,
        reference: tx.reference,
        description: tx.description,
        debit: tx.debit,
        credit: tx.credit,
        balance: running,
        status: tx.status,
        dueDate: tx.dueDate
      };
    });

    return finalTx;
  }, [customerInvoices, customerCreditNotes, dateRange, statusFilter]);

  // Aging Summary calculation (0-30, 31-60, 61-90, 90+ days)
  const aging = useMemo<AgingSummary>(() => {
    let current = 0;
    let days30 = 0;
    let days60 = 0;
    let days90Plus = 0;
    const nowMs = new Date().getTime();

    customerInvoices.forEach(inv => {
      if (inv.status === 'paid') return;
      // Calculate net unpaid amount on this invoice (total minus credited)
      const netOwed = Math.max(0, inv.totalAmount - (inv.creditedAmount || 0));
      if (netOwed <= 0) return;

      const invDate = new Date(inv.date).getTime();
      const ageDays = Math.floor((nowMs - invDate) / (1000 * 60 * 60 * 24));

      if (ageDays <= 30) {
        current += netOwed;
      } else if (ageDays <= 60) {
        days30 += netOwed;
      } else if (ageDays <= 90) {
        days60 += netOwed;
      } else {
        days90Plus += netOwed;
      }
    });

    const totalOutstanding = current + days30 + days60 + days90Plus;

    return {
      current,
      days30,
      days60,
      days90Plus,
      totalOutstanding
    };
  }, [customerInvoices]);

  const totalInvoiced = customerInvoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
  const totalCredited = customerCreditNotes.reduce((acc, cn) => acc + cn.totalAmount, 0);
  const netAccountBalance = Math.max(0, aging.totalOutstanding);

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const text = `STATEMENT OF ACCOUNT - ${customer.name}
Date: ${new Date().toLocaleDateString('en-ZA')}
Total Invoiced: R${totalInvoiced.toFixed(2)}
Total Credited: R${totalCredited.toFixed(2)}
Current Outstanding Balance: R${netAccountBalance.toFixed(2)}

Banking Details:
Bank: ${profile.bankingDetails?.bankName || 'FNB'}
Account Number: ${profile.bankingDetails?.accountNumber || ''}
Branch Code: ${profile.bankingDetails?.branchCode || ''}
Account Reference: ${customer.name}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn print:p-0 print:bg-white print:static print:overflow-visible">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-6 flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none print:my-0">
        
        {/* Modal Top Controls (Hidden during print) */}
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-600/10 text-amber-800 flex items-center justify-center font-bold">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 leading-tight">Customer Statement of Account</h2>
              <p className="text-xs text-stone-500">Live ledger, aging analysis & remittance for {customer.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 text-xs font-semibold rounded-xl transition cursor-pointer shadow-2xs"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              {copied ? 'Copied Summary' : 'Copy Summary'}
            </button>

            <button
              onClick={async () => {
                setIsExportingPdf(true);
                try {
                  const safeName = customer.name.replace(/[^a-zA-Z0-9_-]/g, '_');
                  await downloadElementAsPdf('customer-statement-printable', `Statement_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
                } finally {
                  setIsExportingPdf(false);
                }
              }}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs disabled:opacity-50"
              title="Download high-resolution Statement PDF"
            >
              <Download size={14} /> {isExportingPdf ? 'Generating PDF...' : 'Download PDF'}
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs"
            >
              <Printer size={14} /> Print
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-xl transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter Bar (Hidden during print) */}
        <div className="px-6 py-3 bg-stone-50/50 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 print:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-stone-500 font-semibold flex items-center gap-1">
              <Calendar size={13} /> Period:
            </span>
            {(['all', 'this_month', 'last_30_days', 'last_90_days', 'ytd'] as PeriodFilter[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  period === p 
                    ? 'bg-amber-800 text-white font-bold shadow-2xs' 
                    : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                {p === 'all' && 'All Time'}
                {p === 'this_month' && 'This Month'}
                {p === 'last_30_days' && 'Last 30 Days'}
                {p === 'last_90_days' && 'Last 90 Days'}
                {p === 'ytd' && 'Year to Date'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-stone-500 font-semibold flex items-center gap-1">
              <Filter size={13} /> Status:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-stone-800 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">All Transactions</option>
              <option value="unpaid_only">Outstanding / Unpaid Only</option>
            </select>
          </div>
        </div>

        {/* PRINTABLE STATEMENT BODY */}
        <div className="p-8 overflow-y-auto flex-1 print:p-0 print:overflow-visible space-y-6 text-stone-900 bg-white" id="customer-statement-printable">
          
          {/* Statement Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-stone-200 pb-6">
            <div className="space-y-2 max-w-md">
              <div className="flex items-center gap-3">
                {profile.logo && (
                  <img 
                    src={profile.logo} 
                    alt={profile.name} 
                    className="w-14 h-14 rounded-xl object-cover border border-stone-200 shadow-2xs print:w-12 print:h-12"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight text-stone-950 font-serif">{profile.name}</h1>
                  <p className="text-xs text-stone-500">{profile.tagline || 'Studio & Workshop'}</p>
                </div>
              </div>

              <div className="text-xs text-stone-600 space-y-0.5 pt-1">
                {profile.address && <div>{profile.address}</div>}
                <div>{[profile.phone && `Tel: ${profile.phone}`, profile.email && `Email: ${profile.email}`].filter(Boolean).join(' • ')}</div>
                {profile.vatNumber && profile.isVatRegistered && (
                  <div className="font-bold text-stone-800">Supplier VAT Reg: {profile.vatNumber}</div>
                )}
              </div>
            </div>

            <div className="text-left sm:text-right space-y-1 sm:min-w-[200px]">
              <div className="inline-block bg-amber-900 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md mb-1">
                Statement of Account
              </div>
              <div className="text-xs text-stone-600">
                <div><strong>Statement Date:</strong> {new Date().toLocaleDateString('en-ZA')}</div>
                <div><strong>Account Reference:</strong> <span className="font-mono font-bold text-stone-900">{customer.name.slice(0, 12).toUpperCase()}</span></div>
                <div><strong>Currency:</strong> ZAR (South African Rand)</div>
              </div>
            </div>
          </div>

          {/* Account Details & Customer Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-stone-50/70 p-4 rounded-xl border border-stone-200/80 text-xs">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block mb-1">Account Holder / Customer</span>
              <h3 className="font-bold text-sm text-stone-900">{customer.name}</h3>
              {customer.contactPerson && (
                <div className="text-stone-700 font-medium">Attn: {customer.contactPerson}</div>
              )}
              {customer.billingAddress && (
                <div className="text-stone-600 mt-1 whitespace-pre-line">{customer.billingAddress}</div>
              )}
              <div className="text-stone-500 mt-1">
                {[customer.phone, customer.email].filter(Boolean).join(' • ')}
              </div>
              {(customer.vatNumber || customer.companyRegistrationNumber) && (
                <div className="mt-1 pt-1 border-t border-stone-200/60 font-medium text-stone-700 flex flex-wrap gap-2">
                  {customer.companyRegistrationNumber && <span>Reg: {customer.companyRegistrationNumber}</span>}
                  {customer.vatNumber && <span>VAT: {customer.vatNumber}</span>}
                </div>
              )}
            </div>

            <div className="sm:text-right flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block mb-1">Account Overview</span>
                <div className="space-y-1">
                  <div className="flex sm:justify-end justify-between gap-4 text-stone-600">
                    <span>Total Invoiced (All Time):</span>
                    <span className="font-bold text-stone-900">R{totalInvoiced.toFixed(2)}</span>
                  </div>
                  <div className="flex sm:justify-end justify-between gap-4 text-stone-600">
                    <span>Total Credit Notes Issued:</span>
                    <span className="font-bold text-amber-700">-R{totalCredited.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-200 mt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Current Amount Due</div>
                <div className="text-xl font-black text-amber-950 font-mono">
                  R{netAccountBalance.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">Transaction History</h4>
            <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-100 text-stone-700 border-b border-stone-200 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Debit (R)</th>
                    <th className="py-2.5 px-3 text-right">Credit (R)</th>
                    <th className="py-2.5 px-3 text-right">Balance (R)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-stone-400 italic">
                        No transactions found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={`${tx.type}-${tx.id}`} className="hover:bg-stone-50/80 transition">
                        <td className="py-2.5 px-3 whitespace-nowrap text-stone-600 font-medium">{formatSADate(tx.date)}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                            tx.type === 'Invoice'
                              ? 'bg-stone-100 text-stone-800 border-stone-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {tx.type === 'Invoice' ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-stone-900 whitespace-nowrap">
                          {tx.reference}
                        </td>
                        <td className="py-2.5 px-3 text-stone-600 max-w-xs truncate">{tx.description}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-stone-900 whitespace-nowrap">
                          {tx.debit > 0 ? `R${tx.debit.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-amber-800 whitespace-nowrap">
                          {tx.credit > 0 ? `R${tx.credit.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-stone-950 font-mono whitespace-nowrap">
                          R{tx.balance.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Aging Analysis Block (SARS & Standard South African Commercial Accounting) */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">Aging Analysis (Days Outstanding)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                <span className="text-[10px] font-bold text-stone-500 uppercase block">Current (0-30)</span>
                <span className="text-sm font-bold text-stone-900 font-mono mt-1 block">R{aging.current.toFixed(2)}</span>
              </div>
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                <span className="text-[10px] font-bold text-stone-500 uppercase block">31 - 60 Days</span>
                <span className="text-sm font-bold text-stone-900 font-mono mt-1 block">R{aging.days30.toFixed(2)}</span>
              </div>
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                <span className="text-[10px] font-bold text-stone-500 uppercase block">61 - 90 Days</span>
                <span className="text-sm font-bold text-stone-900 font-mono mt-1 block">R{aging.days60.toFixed(2)}</span>
              </div>
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                <span className="text-[10px] font-bold text-stone-500 uppercase block">90+ Days</span>
                <span className="text-sm font-bold text-rose-700 font-mono mt-1 block">R{aging.days90Plus.toFixed(2)}</span>
              </div>
              <div className="p-3 bg-amber-900 text-white rounded-xl col-span-2 sm:col-span-1 shadow-xs">
                <span className="text-[10px] font-bold text-amber-200 uppercase block">Total Due</span>
                <span className="text-sm font-black font-mono mt-1 block">R{aging.totalOutstanding.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Remittance Advice & Banking Details */}
          <div className="border-t-2 border-dashed border-stone-300 pt-6 mt-6">
            <div className="flex items-center justify-between text-stone-400 text-[10px] uppercase font-bold tracking-widest mb-3">
              <span>✂ Remittance Advice (Please detach or quote reference with payment)</span>
              <span>{profile.name}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200 text-xs">
              <div>
                <span className="font-bold text-stone-900 block mb-1">Electronic Funds Transfer (EFT) Banking Details:</span>
                <div className="space-y-0.5 text-stone-600 text-[11px]">
                  <div><strong>Bank:</strong> {profile.bankingDetails?.bankName || 'First National Bank (FNB)'}</div>
                  <div><strong>Account Number:</strong> <span className="font-mono font-bold text-stone-900">{profile.bankingDetails?.accountNumber || '62849102844'}</span></div>
                  <div><strong>Branch Code:</strong> <span className="font-mono">{profile.bankingDetails?.branchCode || '250655'}</span></div>
                  <div><strong>Account Type:</strong> {profile.bankingDetails?.accountType || 'Business Cheque'}</div>
                </div>
              </div>

              <div>
                <span className="font-bold text-stone-900 block mb-1">Payment Instructions:</span>
                <div className="text-stone-600 text-[11px] space-y-1">
                  <div>Please use <strong>{customer.name}</strong> as your payment reference.</div>
                  <div>Email proof of payment to: <span className="font-bold text-stone-800">{profile.email || 'studio@pulppaperworks.com'}</span></div>
                  <div className="text-stone-400 italic text-[10px]">Thank you for supporting handcrafted independent publishing & book arts.</div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
