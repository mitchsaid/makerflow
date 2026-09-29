/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  LayoutDashboard, FileText, Receipt, Package, Users, 
  Wrench, User, Bell, Menu, X, Check, Eye, RotateCcw, Landmark, Layers, Briefcase
} from 'lucide-react';
import { useAppState } from './hooks/useAppState';
import { motion, AnimatePresence } from 'motion/react';

// Components
import Dashboard from './components/Dashboard';
import Quotes from './components/Quotes';
import Invoices from './components/Invoices';
import Products from './components/Products';
import Materials from './components/Materials';
import Customers from './components/Customers';
import Jobs from './components/Jobs';
import Profile from './components/Profile';
import BuyerView from './components/BuyerView';
import MakerFloatingTools from './components/MakerFloatingTools';

type TabType = 'Dashboard' | 'Quotes' | 'Invoices' | 'Products' | 'Services' | 'Materials' | 'Customers' | 'Jobs' | 'Profile';

export default function App() {
  const state = useAppState();
  const [activeTab, setActiveTab] = useState<TabType>('Dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [quotesStartInCreationMode, setQuotesStartInCreationMode] = useState(false);
  const [invoicesStartInCreationMode, setInvoicesStartInCreationMode] = useState(false);
  const [jobsStartInCreationMode, setJobsStartInCreationMode] = useState(false);

  // Router for Buyer Simulation vs Maker Dashboard
  const [buyerSimulationMode, setBuyerSimulationMode] = useState(false);
  const [buyerQuoteId, setBuyerQuoteId] = useState<string | null>(null);
  const [buyerInvoiceId, setBuyerInvoiceId] = useState<string | null>(null);
  const [initialEditProductId, setInitialEditProductId] = useState<string | null>(null);
  const [productsStartInAddMode, setProductsStartInAddMode] = useState(false);

  const handleEditProductInProductsTab = (productId: string) => {
    setInitialEditProductId(productId);
    setActiveTab('Products');
  };

  const handleAddNewProductInProductsTab = () => {
    setProductsStartInAddMode(true);
    setActiveTab('Products');
  };

  // Active counts for side nav indicators
  const activeJobsCount = (state.jobs || []).filter(j => j.status !== 'Done').length;
  const unpaidInvoicesCount = (state.invoices || []).filter(i => i.status === 'unpaid').length;
  const unreadNotifCount = (state.notifications || []).filter(n => !n.isRead).length;

  const handleSelectQuoteFromBuyer = (quoteId: string | null) => {
    setBuyerQuoteId(quoteId);
    setBuyerInvoiceId(null);
    setBuyerSimulationMode(true);
  };

  const handleSelectInvoiceFromBuyer = (invoiceId: string | null) => {
    setBuyerInvoiceId(invoiceId);
    setBuyerQuoteId(null);
    setBuyerSimulationMode(true);
  };

  // Nav handler
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
    setMobileMenuOpen(false);
  };

  // Render the current view
  const renderViewContent = () => {
    switch (activeTab) {
      case 'Dashboard':
        return (
          <Dashboard
            profile={state.profile}
            quotes={state.quotes}
            invoices={state.invoices}
            notifications={state.notifications}
            onNavigate={handleTabChange}
            onSelectQuote={(id) => { setActiveTab('Quotes'); }} // Opens and selects in quotes
            onSelectInvoice={(id) => { setActiveTab('Invoices'); }}
            onMarkRead={state.markNotificationRead}
            onMarkAllRead={state.markAllNotificationsRead}
            onReset={state.resetToDefaults}
            onClearAllData={state.clearAllData}
            onLoadCompanyPreset={state.loadCompanyPreset}
            onCreateQuoteClick={() => {
              setQuotesStartInCreationMode(true);
              handleTabChange('Quotes');
            }}
            onCreateInvoiceClick={() => {
              setInvoicesStartInCreationMode(true);
              handleTabChange('Invoices');
            }}
            onCreateProductClick={() => {
              handleAddNewProductInProductsTab();
            }}
            onCreateJobClick={() => {
              setJobsStartInCreationMode(true);
              handleTabChange('Jobs');
            }}
          />
        );
      case 'Quotes':
        return (
          <Quotes
            profile={state.profile}
            quotes={state.quotes}
            customers={state.customers}
            products={state.products}
            services={state.services}
            materials={state.materials}
            jobs={state.jobs}
            customTemplates={state.customTemplates}
            onSaveCustomTemplate={state.saveCustomTemplate}
            onDeleteCustomTemplate={state.deleteCustomTemplate}
            onUpdateQuoteTemplate={state.updateQuoteTemplate}
            onCreateQuote={state.createQuote}
            onUpdateQuote={state.updateQuote}
            onDeleteQuote={state.deleteQuote}
            onUpdateQuoteStatus={state.updateQuoteStatus}
            onConvertQuoteToInvoice={state.convertQuoteToInvoice}
            onConvertQuoteToJob={state.convertQuoteToJob}
            onSelectActiveQuoteIdForBuyer={handleSelectQuoteFromBuyer}
            quotesStartInCreationMode={quotesStartInCreationMode}
            onResetQuotesStartInCreationMode={() => setQuotesStartInCreationMode(false)}
            onEditProductInCatalogue={handleEditProductInProductsTab}
            onAddNewProductInCatalogue={handleAddNewProductInProductsTab}
            onAddCustomer={state.addCustomer}
            onUpdateCustomer={state.updateCustomer}
          />
        );
      case 'Invoices':
        return (
          <Invoices
            profile={state.profile}
            invoices={state.invoices}
            creditNotes={state.creditNotes}
            customers={state.customers}
            products={state.products}
            services={state.services}
            materials={state.materials}
            jobs={state.jobs}
            customTemplates={state.customTemplates}
            onSaveCustomTemplate={state.saveCustomTemplate}
            onDeleteCustomTemplate={state.deleteCustomTemplate}
            onUpdateInvoiceTemplate={state.updateInvoiceTemplate}
            onCreateInvoiceDirect={state.createInvoiceDirect}
            onUpdateInvoice={state.updateInvoice}
            onDeleteInvoice={state.deleteInvoice}
            onUpdateInvoiceStatus={state.updateInvoiceStatus}
            onCreateCreditNote={state.createCreditNote}
            onDeleteCreditNote={state.deleteCreditNote}
            onSelectActiveInvoiceIdForBuyer={handleSelectInvoiceFromBuyer}
            onEditProductInCatalogue={handleEditProductInProductsTab}
            onAddNewProductInCatalogue={handleAddNewProductInProductsTab}
            onAddCustomer={state.addCustomer}
            onUpdateCustomer={state.updateCustomer}
            invoicesStartInCreationMode={invoicesStartInCreationMode}
            onResetInvoicesStartInCreationMode={() => setInvoicesStartInCreationMode(false)}
          />
        );
      case 'Products':
        return (
          <Products
            products={state.products}
            services={state.services}
            groups={state.groups}
            materials={state.materials}
            defaultTab="products"
            onAddProduct={state.addProduct}
            onUpdateProduct={state.updateProduct}
            onDeleteProduct={state.deleteProduct}
            onAddService={state.addService}
            onUpdateService={state.updateService}
            onDeleteService={state.deleteService}
            onAddGroup={state.addGroup}
            onUpdateGroup={state.updateGroup}
            onDeleteGroup={state.deleteGroup}
            initialEditProductId={initialEditProductId}
            onClearInitialEditProductId={() => setInitialEditProductId(null)}
            startInAddMode={productsStartInAddMode}
            onResetStartInAddMode={() => setProductsStartInAddMode(false)}
            reusableStages={state.reusableStages}
            onAddReusableStage={state.addReusableStage}
          />
        );
      case 'Services':
        return (
          <Products
            products={state.products}
            services={state.services}
            groups={state.groups}
            materials={state.materials}
            defaultTab="services"
            onAddProduct={state.addProduct}
            onUpdateProduct={state.updateProduct}
            onDeleteProduct={state.deleteProduct}
            onAddService={state.addService}
            onUpdateService={state.updateService}
            onDeleteService={state.deleteService}
            onAddGroup={state.addGroup}
            onUpdateGroup={state.updateGroup}
            onDeleteGroup={state.deleteGroup}
            initialEditProductId={initialEditProductId}
            onClearInitialEditProductId={() => setInitialEditProductId(null)}
            startInAddMode={productsStartInAddMode}
            onResetStartInAddMode={() => setProductsStartInAddMode(false)}
            reusableStages={state.reusableStages}
            onAddReusableStage={state.addReusableStage}
          />
        );
      case 'Materials':
        return (
          <Materials
            materials={state.materials}
            onAddMaterial={state.addMaterial}
            onUpdateMaterial={state.updateMaterial}
            onUpdateMaterialStock={state.updateMaterialStock}
            onDeleteMaterial={state.deleteMaterial}
          />
        );
      case 'Customers':
        return (
          <Customers
            profile={state.profile}
            customers={state.customers}
            quotes={state.quotes}
            invoices={state.invoices}
            creditNotes={state.creditNotes}
            onAddCustomer={state.addCustomer}
            onUpdateCustomer={state.updateCustomer}
            onDeleteCustomer={state.deleteCustomer}
            onSelectQuote={(id) => handleTabChange('Quotes')}
            onSelectInvoice={(id) => handleTabChange('Invoices')}
          />
        );
      case 'Jobs':
        return (
          <Jobs
            jobs={state.jobs}
            customers={state.customers}
            products={state.products}
            services={state.services}
            materials={state.materials}
            onUpdateMaterial={state.updateMaterial}
            onUpdateMaterialStock={state.updateMaterialStock}
            jobsStartInCreationMode={jobsStartInCreationMode}
            onResetJobsStartInCreationMode={() => setJobsStartInCreationMode(false)}
            onUpdateJob={state.updateJob}
            onUpdateJobStatus={state.updateJobStatus}
            onDeleteJob={state.deleteJob}
            onUpdateJobTaskStatus={state.updateJobTaskStatus}
            onUpdateJobTaskTrackingType={state.updateJobTaskTrackingType}
            onUpdateJobTaskUnitStatus={state.updateJobTaskUnitStatus}
            onUpdateJobTaskCounts={state.updateJobTaskCounts}
            onCreateJobDirect={state.createJobDirect}
            onApplyStockToJobTask={state.applyStockToJobTask}
            onRemoveStockFromJobTask={state.removeStockFromJobTask}
            reusableStages={state.reusableStages}
            onAddReusableStage={state.addReusableStage}
            onUpdateJobTaskTrackingMode={state.updateJobTaskTrackingMode}
            onUpdateJobTaskStages={state.updateJobTaskStages}
          />
        );
      case 'Profile':
        return (
          <Profile
            profile={state.profile}
            onUpdateProfile={state.updateProfile}
          />
        );
    }
  };

  // If in customer preview, show the clean simulation view bypassing the entire business sidebar
  if (buyerSimulationMode) {
    return (
      <BuyerView
        profile={state.profile}
        activeQuoteId={buyerQuoteId}
        activeInvoiceId={buyerInvoiceId}
        quotes={state.quotes}
        invoices={state.invoices}
        customTemplates={state.customTemplates}
        onAcceptQuote={state.recordQuoteAccepted}
        onDeclineQuote={state.recordQuoteDeclined}
        onUpdateInvoiceStatus={(id, status) => state.updateInvoiceStatus(id, status)}
        onBackToMaker={() => { setBuyerSimulationMode(false); setBuyerQuoteId(null); setBuyerInvoiceId(null); }}
        onRecordQuoteViewed={state.recordQuoteViewed}
      />
    );
  }

  const menuItems = [
    { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'Quotes', label: 'Quotes', icon: FileText },
    { 
      id: 'Invoices', 
      label: 'Invoices', 
      icon: Receipt,
      badge: unpaidInvoicesCount > 0 ? unpaidInvoicesCount : undefined,
      badgeColor: 'bg-amber-100 text-amber-800'
    },
    { id: 'Products', label: 'Products', icon: Package },
    { id: 'Services', label: 'Services', icon: Briefcase },
    { 
      id: 'Jobs', 
      label: 'Jobs', 
      icon: Wrench,
      badge: activeJobsCount > 0 ? activeJobsCount : undefined,
      badgeColor: 'bg-purple-100 text-purple-800'
    },
    { id: 'Materials', label: 'Materials', icon: Layers },
    { id: 'Customers', label: 'Customers', icon: Users },
    { id: 'Profile', label: 'My Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#FBF9F6] text-stone-800 flex flex-col font-sans relative antialiased" id="maker-app-root">
      
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40 px-4 md:px-8 py-3 flex items-center justify-between print:hidden" id="app-header">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-stone-50 rounded-xl lg:hidden text-stone-500 cursor-pointer min-h-[44px] min-w-[44px]"
            id="mobile-menu-trigger"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-amber-700 bg-amber-50 px-3 py-1 rounded-xl border border-amber-100/50">M</span>
            <div>
              <span className="font-extrabold text-stone-800 text-sm block md:text-base tracking-tight leading-tight">MakerFlow</span>
            </div>
          </div>
        </div>

        {/* Global actions: Alerts & profile shortcut */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <button 
              onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
              className="p-2 bg-stone-50 hover:bg-stone-100 text-stone-600 rounded-xl transition cursor-pointer relative min-h-[44px] min-w-[44px]"
              id="header-bell-btn"
            >
              <Bell size={18} />
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 bg-amber-600 text-white font-extrabold text-[9px] h-4.5 w-4.5 rounded-full flex items-center justify-center border-2 border-white">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {/* Micro Alerts dropdown */}
            <AnimatePresence>
              {notifDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-80 bg-white border border-stone-200 rounded-2xl shadow-lg p-4 space-y-3 z-50 text-xs"
                  id="header-notif-dropdown"
                >
                  <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                    <span className="font-bold text-stone-700">Notifications ({unreadNotifCount})</span>
                    <button 
                      onClick={() => { state.markAllNotificationsRead(); setNotifDropdownOpen(false); }}
                      className="text-amber-700 hover:underline font-bold"
                    >
                      Clear
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {state.notifications.length === 0 ? (
                      <p className="text-center text-stone-400 py-6 italic">No notifications yet.</p>
                    ) : (
                      state.notifications.slice(0, 5).map(n => (
                        <div 
                          key={n.id} 
                          onClick={() => { state.markNotificationRead(n.id); setNotifDropdownOpen(false); }}
                          className={`p-2.5 rounded-xl border text-left transition relative cursor-pointer ${
                            n.isRead ? 'bg-stone-50 border-stone-100' : 'bg-amber-50/20 border-amber-100'
                          }`}
                        >
                          <p className="font-semibold text-stone-800 leading-snug">{n.message}</p>
                          <span className="text-[9px] text-stone-400 block mt-1">
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div 
            onClick={() => handleTabChange('Profile')}
            className="flex items-center gap-2 bg-stone-50 px-3.5 py-1.5 rounded-xl border border-stone-100 cursor-pointer hover:bg-stone-100 transition hidden md:flex"
            id="header-profile-btn"
          >
            <div className="w-6 h-6 bg-amber-100 text-amber-800 rounded-lg flex items-center justify-center font-bold text-xs">
              {state.profile.name[0]}
            </div>
            <div className="text-left">
              <span className="font-bold text-stone-800 text-xs block leading-tight truncate max-w-[120px]">{state.profile.name}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row relative" id="app-body">
        
        {/* DESKTOP SIDEBAR NAVIGATION */}
        <aside className="w-64 bg-white border-r border-stone-200 p-6 space-y-6 shrink-0 hidden lg:block print:hidden" id="desktop-sidebar">
          <div className="space-y-1">
            <nav className="space-y-1">
              {menuItems.map((item) => {
                const IconComp = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition text-xs font-bold cursor-pointer min-h-[40px] ${
                      isActive 
                        ? 'bg-amber-50/85 text-amber-900 shadow-3xs' 
                        : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <IconComp size={16} className={isActive ? 'text-amber-700' : 'text-stone-400'} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
          
          {/* Copyright removed */}
        </aside>

        {/* MOBILE DRAWER NAVIGATION */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              {/* Overlay */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-stone-950/45 z-40 lg:hidden print:hidden"
              />
              {/* Drawer Container */}
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'tween', duration: 0.25 }}
                className="fixed top-0 bottom-0 left-0 w-72 bg-white shadow-xl z-50 p-6 flex flex-col justify-between lg:hidden print:hidden"
                id="mobile-drawer"
              >
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-stone-50 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-xl border border-amber-100/50">M</span>
                      <span className="font-extrabold text-stone-800 text-sm">MakerFlow</span>
                    </div>
                    <button 
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-2 hover:bg-stone-50 text-stone-400 rounded-xl min-h-[44px] min-w-[44px]"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <nav className="space-y-1">
                    {menuItems.map((item) => {
                      const IconComp = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleTabChange(item.id)}
                          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition text-xs font-bold cursor-pointer min-h-[44px] ${
                            isActive 
                              ? 'bg-amber-50 text-amber-900' 
                              : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <IconComp size={16} className={isActive ? 'text-amber-700' : 'text-stone-400'} />
                            <span>{item.label}</span>
                          </div>
                          {item.badge && (
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>

                <div className="text-[10px] text-stone-400 font-medium">
                  <span>MakerFlow • 2026</span>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* MAIN WORKING CANVAS */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full" id="main-working-canvas">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.18 }}
              className="w-full"
            >
              {renderViewContent()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Floating Tools Dock (Scratchpad & Time Tracker) */}
        {!buyerSimulationMode && (
          <MakerFloatingTools 
            jobs={state.jobs} 
            materials={state.materials}
            products={state.products}
            quotes={state.quotes}
            customers={state.customers}
            onUpdateMaterial={state.updateMaterial}
            onUpdateProduct={state.updateProduct}
            onUpdateJob={state.updateJob}
            onUpdateQuote={state.updateQuote}
            onUpdateCustomer={state.updateCustomer}
          />
        )}
      </div>
    </div>
  );
}
