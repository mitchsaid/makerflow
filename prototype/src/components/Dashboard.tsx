import { useState } from 'react';
import { 
  TrendingUp, Clock, CheckCircle, AlertCircle, FileText, PlusCircle, 
  Settings, Users, Package, ArrowRight, Bell, Eye, Check, X, RotateCcw,
  ChevronDown, Receipt, Wrench, FlaskConical, Trash2, ExternalLink, Sparkles, Building2, AlertTriangle
} from 'lucide-react';
import { Quote, Invoice, AppNotification, BusinessProfile, CompanyPreset } from '../types';
import { COMPANY_PRESETS } from '../data/companyPresets';
import { motion } from 'motion/react';

interface DashboardProps {
  profile: BusinessProfile;
  quotes: Quote[];
  invoices: Invoice[];
  notifications: AppNotification[];
  onNavigate: (tab: string) => void;
  onSelectQuote: (quoteId: string) => void;
  onSelectInvoice: (invoiceId: string) => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onReset: () => void;
  onClearAllData?: () => void;
  onLoadCompanyPreset?: (preset: CompanyPreset) => void;
  onCreateQuoteClick?: () => void;
  onCreateInvoiceClick?: () => void;
  onCreateProductClick?: () => void;
  onCreateJobClick?: () => void;
}

export default function Dashboard({
  profile,
  quotes,
  invoices,
  notifications,
  onNavigate,
  onSelectQuote,
  onSelectInvoice,
  onMarkRead,
  onMarkAllRead,
  onReset,
  onClearAllData,
  onLoadCompanyPreset,
  onCreateQuoteClick,
  onCreateInvoiceClick,
  onCreateProductClick,
  onCreateJobClick
}: DashboardProps) {
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
  const [confirmClearModalOpen, setConfirmClearModalOpen] = useState(false);
  const [presetToLoad, setPresetToLoad] = useState<CompanyPreset | null>(null);

  // Safeguard to prevent TypeScript/linter errors for unused parameters
  const _ignored = { notifications, onMarkRead, onMarkAllRead };

  // Financial metrics
  const safeInvoices = invoices || [];
  const safeNotifications = notifications || [];

  // Outstanding: unpaid invoices
  const outstandingInvoices = safeInvoices.filter(inv => inv?.status === 'unpaid');
  const outstandingAmount = outstandingInvoices.reduce((sum, inv) => sum + (inv?.totalAmount || 0), 0);

  // Collected: paid invoices
  const collectedInvoices = safeInvoices.filter(inv => inv?.status === 'paid');
  const collectedAmount = collectedInvoices.reduce((sum, inv) => sum + (inv?.totalAmount || 0), 0);

  // Overdue: unpaid and due date is past today
  const todayStr = new Date().toISOString().split('T')[0];
  const overdueInvoices = outstandingInvoices.filter(inv => inv?.dueDate && inv.dueDate < todayStr);
  const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv?.totalAmount || 0), 0);

  // Notification count
  const unreadNotifications = safeNotifications.filter(n => !n?.isRead);

  // Format currency
  const formatZAR = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount || 0);
  };

  return (
    <div className="space-y-8 pb-12" id="dashboard-container">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-amber-50 p-6 rounded-2xl border border-amber-100" id="welcome-banner">
        <div>
          <h1 className="text-2xl font-bold text-stone-800" id="dashboard-title">
            Hi, {profile?.name || 'Maker'}!
          </h1>
          <p className="text-stone-600 text-sm mt-1" id="dashboard-subtitle">
            Welcome back to your business tracker. Manage your jobs, customize products, and create tax invoices with ease.
          </p>
        </div>
        <div className="relative shrink-0" id="create-new-container">
          <button
            onClick={() => setIsCreateDropdownOpen(!isCreateDropdownOpen)}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-md cursor-pointer"
            id="create-new-btn"
          >
            <PlusCircle size={16} />
            Create New
            <ChevronDown size={14} className={`transition-transform duration-200 ${isCreateDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isCreateDropdownOpen && (
            <>
              {/* Backing overlay to close when clicking outside */}
              <div 
                className="fixed inset-0 z-45" 
                onClick={() => setIsCreateDropdownOpen(false)} 
              />
              <div 
                className="absolute right-0 mt-2 w-48 bg-white border border-stone-200 rounded-2xl shadow-xl p-2 z-50 focus:outline-none"
                id="create-new-dropdown"
              >
                <button
                  onClick={() => {
                    setIsCreateDropdownOpen(false);
                    if (onCreateQuoteClick) {
                      onCreateQuoteClick();
                    } else {
                      onNavigate('Quotes');
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-xs font-bold text-stone-700 hover:bg-stone-50 hover:text-amber-700 rounded-xl transition cursor-pointer"
                >
                  <FileText size={15} className="text-amber-600" />
                  <span>Quote</span>
                </button>
                
                <button
                  onClick={() => {
                    setIsCreateDropdownOpen(false);
                    if (onCreateInvoiceClick) {
                      onCreateInvoiceClick();
                    } else {
                      onNavigate('Invoices');
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-xs font-bold text-stone-700 hover:bg-stone-50 hover:text-amber-700 rounded-xl transition cursor-pointer"
                >
                  <Receipt size={15} className="text-stone-600" />
                  <span>Invoice</span>
                </button>

                <button
                  onClick={() => {
                    setIsCreateDropdownOpen(false);
                    if (onCreateJobClick) {
                      onCreateJobClick();
                    } else {
                      onNavigate('Jobs');
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-xs font-bold text-stone-700 hover:bg-stone-50 hover:text-amber-700 rounded-xl transition cursor-pointer"
                >
                  <Wrench size={15} className="text-purple-600" />
                  <span>Job</span>
                </button>

                <button
                  onClick={() => {
                    setIsCreateDropdownOpen(false);
                    if (onCreateProductClick) {
                      onCreateProductClick();
                    } else {
                      onNavigate('Products');
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-xs font-bold text-stone-700 hover:bg-stone-50 hover:text-amber-700 rounded-xl transition cursor-pointer"
                >
                  <Package size={15} className="text-amber-700" />
                  <span>Product</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="metrics-grid">
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs flex items-start justify-between"
          id="collected-metric-card"
        >
          <div className="space-y-2">
            <span className="text-stone-500 font-medium text-sm block">Collected Earnings</span>
            <span className="text-3xl font-extrabold text-emerald-600 block">{formatZAR(collectedAmount)}</span>
            <span className="text-xs text-stone-400 block">From {collectedInvoices.length} paid tax invoices</span>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
            <CheckCircle size={24} />
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs flex items-start justify-between"
          id="outstanding-metric-card"
        >
          <div className="space-y-2">
            <span className="text-stone-500 font-medium text-sm block">Outstanding Amount</span>
            <span className="text-3xl font-extrabold text-amber-600 block">{formatZAR(outstandingAmount)}</span>
            <span className="text-xs text-stone-400 block">{outstandingInvoices.length} invoices awaiting payment</span>
          </div>
          <div className="bg-amber-50 p-3 rounded-xl text-amber-500">
            <Clock size={24} />
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs flex items-start justify-between"
          id="overdue-metric-card"
        >
          <div className="space-y-2">
            <span className="text-stone-500 font-medium text-sm block">Overdue Balances</span>
            <span className="text-3xl font-extrabold text-rose-600 block">{formatZAR(overdueAmount)}</span>
            <span className="text-xs text-stone-400 block">{overdueInvoices.length} invoices past due dates</span>
          </div>
          <div className="bg-rose-50 p-3 rounded-xl text-rose-500">
            <AlertCircle size={24} />
          </div>
        </motion.div>
      </div>

      <div className="space-y-8" id="dashboard-details-container">
        {/* Recent Quotes and Quick Stats */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6" id="recent-quotes-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
              <FileText size={18} className="text-stone-500" />
              Recent Quotes
            </h2>
            <button 
              onClick={() => onNavigate('Quotes')}
              className="text-amber-600 hover:text-amber-700 font-semibold text-sm flex items-center gap-1 transition"
              id="view-all-quotes-link"
            >
              View Quotes <ArrowRight size={14} />
            </button>
          </div>

          {quotes.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-stone-100 rounded-xl" id="empty-quotes">
              <p className="text-stone-400 text-sm">No quotes generated yet.</p>
              <button
                onClick={() => onNavigate('Quotes')}
                className="mt-3 text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 px-4 py-2 rounded-lg font-medium transition cursor-pointer"
              >
                Create Your First Quote
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto" id="recent-quotes-table">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-100 text-xs text-stone-400 font-semibold uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Quote #</th>
                    <th className="pb-3 font-semibold">Customer</th>
                    <th className="pb-3 font-semibold">Date</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50 text-sm text-stone-600">
                  {quotes.slice(0, 5).map((q) => (
                    <tr 
                      key={q.id} 
                      onClick={() => onSelectQuote(q.id)}
                      className="hover:bg-stone-50 transition cursor-pointer group"
                    >
                      <td className="py-3.5 font-semibold text-amber-700 group-hover:underline">{q.quoteNumber}</td>
                      <td className="py-3.5 max-w-[180px] truncate">{q.customerName}</td>
                      <td className="py-3.5">{q.date}</td>
                      <td className="py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          q.status === 'accepted' ? 'bg-emerald-50 text-emerald-700' :
                          q.status === 'sent' ? 'bg-blue-50 text-blue-700' :
                          q.status === 'viewed' ? 'bg-purple-50 text-purple-700' :
                          q.status === 'declined' ? 'bg-rose-50 text-rose-700' :
                          'bg-stone-50 text-stone-700'
                        }`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-bold text-stone-800">{formatZAR(q.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Action Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="quick-links">
          <button
            onClick={() => onNavigate('Products')}
            className="p-5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-left transition group flex flex-col justify-between h-32 cursor-pointer"
            id="goto-products-btn"
          >
            <div className="bg-white p-2 rounded-lg text-stone-700 shadow-2xs w-fit">
              <Package size={18} />
            </div>
            <div>
              <span className="font-bold text-stone-800 block">Catalogue</span>
              <span className="text-xs text-stone-500 block">Manage pricing & specs</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('Customers')}
            className="p-5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-left transition group flex flex-col justify-between h-32 cursor-pointer"
            id="goto-customers-btn"
          >
            <div className="bg-white p-2 rounded-lg text-stone-700 shadow-2xs w-fit">
              <Users size={18} />
            </div>
            <div>
              <span className="font-bold text-stone-800 block">Customers</span>
              <span className="text-xs text-stone-500 block">View payment histories</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('Jobs')}
            className="p-5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-left transition group flex flex-col justify-between h-32 cursor-pointer"
            id="goto-jobs-btn"
          >
            <div className="bg-white p-2 rounded-lg text-stone-700 shadow-2xs w-fit">
              <TrendingUp size={18} />
            </div>
            <div>
              <span className="font-bold text-stone-800 block">Job Progress</span>
              <span className="text-xs text-stone-500 block">Check active business jobs</span>
            </div>
          </button>
        </div>

        {/* Testing Area Section */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-6" id="testing-area-container">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
            <div>
              <h3 className="text-lg font-extrabold text-stone-900 flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 rounded-xl text-amber-700">
                  <FlaskConical size={20} />
                </div>
                Testing Area
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Test different artisan company profiles, switch product catalogues, or clear your workspace data to test fresh onboarding.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => setConfirmClearModalOpen(true)}
                className="flex items-center gap-1.5 text-xs bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/80 px-3.5 py-2 rounded-xl font-bold transition cursor-pointer shadow-2xs"
                id="reset-clear-all-btn"
              >
                <Trash2 size={14} className="text-rose-600" />
                <span>Reset (clear all info)</span>
              </button>

              <button
                onClick={() => {
                  if (confirm("Are you sure you want to restore the default Capetonian workspace? This will replace your current data with the default sample items.")) {
                    onReset();
                  }
                }}
                className="flex items-center gap-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3.5 py-2 rounded-xl font-bold transition cursor-pointer"
                id="restore-defaults-btn"
              >
                <RotateCcw size={14} />
                <span>Restore Default Workspace</span>
              </button>
            </div>
          </div>

          {/* Preconfigured Company Profiles */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-extrabold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={14} className="text-stone-500" />
                Preconfigured Company Profiles
              </h4>
              <span className="text-[11px] text-stone-400 font-medium">1-Click Demo Datasets</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {COMPANY_PRESETS.map((preset) => {
                const isCurrentCompany = profile.name.trim().toLowerCase() === preset.profile.name.trim().toLowerCase();

                return (
                  <div 
                    key={preset.id}
                    className={`p-4 rounded-xl border text-left transition flex flex-col justify-between space-y-3.5 ${
                      isCurrentCompany 
                        ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-500/20 shadow-xs' 
                        : 'bg-stone-50/70 hover:bg-stone-50 border-stone-200'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{preset.icon}</span>
                          <div>
                            <h5 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                              {preset.name}
                              {isCurrentCompany && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-600 text-white uppercase tracking-wider">
                                  Active
                                </span>
                              )}
                            </h5>
                            <span className="text-[10.5px] font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md inline-block mt-0.5">
                              {preset.category}
                            </span>
                          </div>
                        </div>

                        {preset.websiteUrl && (
                          <a
                            href={preset.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-stone-600 hover:text-amber-700 bg-white border border-stone-200 px-2 py-1 rounded-lg transition inline-flex items-center gap-1 shrink-0 shadow-2xs"
                            title={`Visit ${preset.name} website`}
                          >
                            <span>Website</span>
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>

                      <p className="text-xs text-stone-600 font-medium italic">
                        "{preset.tagline}"
                      </p>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {preset.products.map(p => (
                          <span key={p.id} className="text-[10px] bg-white border border-stone-200 text-stone-600 font-medium px-2 py-0.5 rounded-md truncate max-w-[170px]">
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-stone-500 font-medium">
                        {preset.products.length} Products &bull; {preset.quotes.length} Quotes
                      </span>

                      <button
                        onClick={() => setPresetToLoad(preset)}
                        disabled={isCurrentCompany}
                        className={`text-xs px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          isCurrentCompany
                            ? 'bg-amber-200/80 text-amber-900 cursor-default opacity-80'
                            : 'bg-stone-900 hover:bg-stone-800 text-white shadow-2xs'
                        }`}
                      >
                        <Sparkles size={13} />
                        <span>{isCurrentCompany ? 'Active Profile' : 'Load Company Data'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Confirm Reset (Clear All Info) */}
      {confirmClearModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4"
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-extrabold text-stone-900 text-base">Reset (clear all info)</h3>
                <p className="text-xs text-stone-500">Confirm workspace clear step</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-3.5 rounded-xl border border-stone-200">
              Are you sure you want to clear all information? This will permanently erase all catalogue products, services, quotes, invoices, jobs, and customer profiles, leaving a completely blank slate.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmClearModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  setConfirmClearModalOpen(false);
                  if (onClearAllData) {
                    onClearAllData();
                  } else {
                    onReset();
                  }
                }}
                className="px-4 py-2 text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Yes, Clear All Info</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL 2: Confirm Load Preset */}
      {presetToLoad && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4"
          >
            <div className="flex items-center gap-3 text-amber-700">
              <span className="text-3xl">{presetToLoad.icon}</span>
              <div>
                <h3 className="font-extrabold text-stone-900 text-base">Load {presetToLoad.name}?</h3>
                <p className="text-xs text-stone-500">{presetToLoad.category}</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80">
              This will populate your workspace with <strong>{presetToLoad.name}</strong>'s profile, banking details, catalogue ({presetToLoad.products.length} products with custom options), and pre-built sample quotes and tax invoices.
            </p>

            {presetToLoad.websiteUrl && (
              <a
                href={presetToLoad.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-800 hover:underline flex items-center gap-1 font-bold pt-1"
              >
                <span>Visit official website ({presetToLoad.websiteUrl})</span>
                <ExternalLink size={12} />
              </a>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
              <button
                onClick={() => setPresetToLoad(null)}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  if (onLoadCompanyPreset) {
                    onLoadCompanyPreset(presetToLoad);
                  }
                  setPresetToLoad(null);
                }}
                className="px-4.5 py-2 text-xs font-extrabold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles size={14} />
                <span>Load {presetToLoad.name}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
