import React, { useState } from 'react';
import { 
  Plus, Edit2, Trash2, Search, Layers, Box, DollarSign, Tag, Info, X, ShieldAlert, Check,
  AlertTriangle, RefreshCw, Minus, Bell, Sliders, Truck, User, Mail, Phone, MapPin, Copy, Building2,
  ArrowLeft, BookOpen, PackageCheck, ChevronRight
} from 'lucide-react';
import { Material, Job, Product, parseAddress, formatAddress, SupplierInfo } from '../types';
import { getMaterialUnitCost, COMMON_UNITS, getItemMaterialRequirements, convertMaterialAmount } from '../lib/costUtils';

function CopyButton({ text, label, className = '' }: { text?: string; label?: string; className?: string }) {
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
      className={`inline-flex items-center gap-1 text-stone-400 hover:text-amber-800 hover:bg-stone-200/60 p-1 rounded-md transition cursor-pointer shrink-0 ${className}`}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
      {label && <span className="text-[10px] font-semibold">{copied ? 'Copied' : label}</span>}
      {!label && copied && <span className="text-[10px] text-emerald-600 font-bold">Copied</span>}
    </button>
  );
}

interface MaterialsProps {
  materials: Material[];
  jobs?: Job[];
  products?: Product[];
  onAddMaterial: (mat: Omit<Material, 'id'>) => Material;
  onUpdateMaterial: (mat: Material) => void;
  onUpdateMaterialStock?: (id: string, newStock: number) => void;
  onDeleteMaterial: (id: string) => void;
}

export default function Materials({
  materials,
  jobs = [],
  products = [],
  onAddMaterial,
  onUpdateMaterial,
  onUpdateMaterialStock,
  onDeleteMaterial
}: MaterialsProps) {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [showSupplierForm, setShowSupplierForm] = useState<boolean>(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState<boolean>(false);

  const [isAdding, setIsAdding] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [materialToDelete, setMaterialToDelete] = useState<Material | null>(null);

  // Direct Inline Stock Editing
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockVal, setEditingStockVal] = useState<string>('');

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Raw Material');
  const [unit, setUnit] = useState('kg');
  const [customUnit, setCustomUnit] = useState('');
  const [bulkQuantity, setBulkQuantity] = useState<number | string>(1);
  const [bulkCost, setBulkCost] = useState<number | string>(0);
  const [stockQuantity, setStockQuantity] = useState<number | string>(1);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | string>(0.15);
  const [lowStockWarningEnabled, setLowStockWarningEnabled] = useState<boolean>(true);
  const [notes, setNotes] = useState('');

  // Supplier form states
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supStreet, setSupStreet] = useState('');
  const [supCity, setSupCity] = useState('');
  const [supProvince, setSupProvince] = useState('');
  const [supPostalCode, setSupPostalCode] = useState('');
  const [supCountry, setSupCountry] = useState('');

  const formatZAR = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
  };

  const categories = Array.from(new Set(materials.map(m => m.category || 'Uncategorized').filter(Boolean)));
  const selectedMaterial = materials.find(m => m.id === selectedMaterialId);

  // Low stock check helper
  const isLowStock = (m: Material) => {
    const stock = m.stockQuantity !== undefined ? m.stockQuantity : m.bulkQuantity;
    const thresh = m.lowStockThreshold !== undefined ? m.lowStockThreshold : 0;
    const warningOn = m.lowStockWarningEnabled !== false;
    return warningOn && stock <= thresh;
  };

  const lowStockCount = materials.filter(isLowStock).length;

  const resetForm = () => {
    setName('');
    setCategory('Raw Material');
    setUnit('kg');
    setCustomUnit('');
    setBulkQuantity(1);
    setBulkCost(0);
    setStockQuantity(1);
    setLowStockThreshold(0.15);
    setLowStockWarningEnabled(true);
    setNotes('');
    setSupplierName('');
    setSupplierContact('');
    setSupplierEmail('');
    setSupplierPhone('');
    setSupStreet('');
    setSupCity('');
    setSupProvince('');
    setSupPostalCode('');
    setSupCountry('');
    setShowSupplierForm(false);
    setIsAdding(false);
    setEditingMaterial(null);
  };

  const handleStartAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleStartEdit = (mat: Material) => {
    setName(mat.name);
    setCategory(mat.category || 'Raw Material');
    
    const matchedUnit = COMMON_UNITS.find(u => u.value === mat.unit);
    if (matchedUnit) {
      setUnit(mat.unit);
      setCustomUnit('');
    } else {
      setUnit('custom');
      setCustomUnit(mat.unit);
    }

    setBulkQuantity(mat.bulkQuantity);
    setBulkCost(mat.bulkCost);
    setStockQuantity(mat.stockQuantity !== undefined ? mat.stockQuantity : mat.bulkQuantity);
    setLowStockThreshold(mat.lowStockThreshold !== undefined ? mat.lowStockThreshold : Math.round(mat.bulkQuantity * 0.15 * 100) / 100);
    setLowStockWarningEnabled(mat.lowStockWarningEnabled !== undefined ? mat.lowStockWarningEnabled : true);
    setNotes(mat.notes || '');

    setSupplierName(mat.supplier?.name || '');
    setSupplierContact(mat.supplier?.contactName || '');
    setSupplierEmail(mat.supplier?.email || '');
    setSupplierPhone(mat.supplier?.phone || '');
    const parsedSup = parseAddress(mat.supplier?.address || '');
    setSupStreet(parsedSup.street);
    setSupCity(parsedSup.city);
    setSupProvince(parsedSup.province);
    setSupPostalCode(parsedSup.postalCode);
    setSupCountry(parsedSup.country);

    const hasSupplierData = Boolean(mat.supplier && (mat.supplier.name || mat.supplier.contactName || mat.supplier.email || mat.supplier.phone || mat.supplier.address));
    setShowSupplierForm(hasSupplierData);

    setEditingMaterial(mat);
    setIsAdding(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalUnit = unit === 'custom' ? (customUnit.trim() || 'pcs') : unit;
    const qtyNum = Math.max(0.0001, Number(bulkQuantity) || 1);
    const costNum = Math.max(0, Number(bulkCost) || 0);
    const stockNum = Math.max(0, Number(stockQuantity) ?? qtyNum);
    const threshNum = Math.max(0, Number(lowStockThreshold) ?? 0);

    const formattedSupAddress = formatAddress({
      street: supStreet,
      city: supCity,
      province: supProvince,
      postalCode: supPostalCode,
      country: supCountry
    });

    const hasSupplier = Boolean(
      supplierName.trim() || 
      supplierContact.trim() || 
      supplierEmail.trim() || 
      supplierPhone.trim() || 
      formattedSupAddress.trim()
    );

    const supplierPayload: SupplierInfo | undefined = hasSupplier ? {
      name: supplierName.trim() || undefined,
      contactName: supplierContact.trim() || undefined,
      email: supplierEmail.trim() || undefined,
      phone: supplierPhone.trim() || undefined,
      address: formattedSupAddress.trim() || undefined
    } : undefined;

    const payload = {
      name: name.trim(),
      category: category.trim() || 'Raw Material',
      unit: finalUnit,
      bulkQuantity: qtyNum,
      bulkCost: costNum,
      stockQuantity: stockNum,
      lowStockThreshold: threshNum,
      lowStockWarningEnabled,
      notes: notes.trim() || undefined,
      supplier: supplierPayload
    };

    if (editingMaterial) {
      onUpdateMaterial({
        ...editingMaterial,
        ...payload
      });
    } else {
      onAddMaterial(payload);
    }

    resetForm();
  };

  const handleQuickStockUpdate = (mat: Material, newStock: number) => {
    const targetStock = Math.max(0, Math.round(newStock * 1000) / 1000);
    if (onUpdateMaterialStock) {
      onUpdateMaterialStock(mat.id, targetStock);
    } else {
      onUpdateMaterial({
        ...mat,
        stockQuantity: targetStock
      });
    }
  };

  const handleSaveInlineStock = (mat: Material) => {
    const val = Number(editingStockVal);
    if (!isNaN(val)) {
      handleQuickStockUpdate(mat, val);
    }
    setEditingStockId(null);
  };

  const filteredMaterials = materials.filter(m => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = m.name.toLowerCase().includes(term) ||
                          (m.category && m.category.toLowerCase().includes(term)) ||
                          (m.notes && m.notes.toLowerCase().includes(term)) ||
                          (m.supplier?.name && m.supplier.name.toLowerCase().includes(term)) ||
                          (m.supplier?.contactName && m.supplier.contactName.toLowerCase().includes(term)) ||
                          (m.supplier?.email && m.supplier.email.toLowerCase().includes(term));
    const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
    const matchesLowStock = !filterLowStockOnly || isLowStock(m);
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const totalBulkValue = materials.reduce((acc, m) => acc + (m.bulkCost || 0), 0);
  const totalStockValue = materials.reduce((acc, m) => {
    const unitCost = getMaterialUnitCost(m);
    const stock = m.stockQuantity !== undefined ? m.stockQuantity : m.bulkQuantity;
    return acc + (stock * unitCost);
  }, 0);

  // Calculated Preview for form
  const formQty = Number(bulkQuantity) || 0;
  const formCost = Number(bulkCost) || 0;
  const formUnit = unit === 'custom' ? (customUnit || 'unit') : unit;
  const formUnitCost = formQty > 0 ? formCost / formQty : 0;

  return (
    <div className="space-y-6 pb-12" id="materials-container">
      {/* Top Header */}
      {!isAdding && !editingMaterial && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 pb-4">
          <div>
            <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
              <Layers className="text-amber-700" size={22} /> Materials & Inventory
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Manage raw materials, bulk costs, live inventory stock levels, and automated completion deductions.
            </p>
          </div>
          <button
            onClick={handleStartAdd}
            className="bg-amber-700 hover:bg-amber-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            id="add-material-btn"
          >
            <Plus size={16} /> Add Material
          </button>
        </div>
      )}

      {/* Summary KPI Cards Banner */}
      {!isAdding && !editingMaterial && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Total Materials</span>
              <span className="text-xl font-black text-stone-800">{materials.length}</span>
            </div>
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-700">
              <Box size={20} />
            </div>
          </div>

          <button 
            onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
            className={`p-4 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
              lowStockCount > 0 
                ? filterLowStockOnly 
                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                  : 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100/80'
                : 'bg-white border-stone-200/80 text-stone-800'
            }`}
          >
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                filterLowStockOnly ? 'text-rose-100' : lowStockCount > 0 ? 'text-rose-700' : 'text-stone-500'
              }`}>
                Low Stock Warnings
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black">{lowStockCount}</span>
                {lowStockCount > 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    filterLowStockOnly ? 'bg-rose-800 text-rose-100' : 'bg-rose-200 text-rose-800'
                  }`}>
                    {filterLowStockOnly ? 'Showing' : 'Click to Filter'}
                  </span>
                )}
              </div>
            </div>
            <div className={`p-2.5 rounded-xl ${
              filterLowStockOnly ? 'bg-rose-700 text-white' : lowStockCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-stone-100 text-stone-400'
            }`}>
              <AlertTriangle size={20} />
            </div>
          </button>

          <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Total On-Hand Inventory Value</span>
              <span className="text-xl font-black text-emerald-700">{formatZAR(totalStockValue)}</span>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-700">
              <DollarSign size={20} />
            </div>
          </div>
        </div>
      )}

      {/* Form view */}
      {(isAdding || editingMaterial) && (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <h3 className="font-extrabold text-stone-800 text-base flex items-center gap-2">
              <Box className="text-amber-700" size={18} />
              {editingMaterial ? `Edit Material: ${editingMaterial.name}` : 'Add New Material'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-stone-400 hover:text-stone-600 cursor-pointer p-1 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-stone-700">Material Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Isomalt Sugar, Sterling Silver Sheet 1mm, Wooden Dowels..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Category</label>
              <input
                type="text"
                list="material-categories"
                placeholder="e.g. Raw Material, Packaging, Hardware..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <datalist id="material-categories">
                <option value="Raw Material" />
                <option value="Packaging" />
                <option value="Hardware" />
                <option value="Consumable" />
                <option value="Finishing" />
              </datalist>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Unit of Measurement</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              >
                {COMMON_UNITS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
                <option value="custom">Custom Unit...</option>
              </select>
              {unit === 'custom' && (
                <input
                  type="text"
                  placeholder="Enter custom unit (e.g. spool, jar)..."
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  className="w-full mt-1.5 px-3 py-1.5 border border-stone-200 rounded-lg text-xs font-normal text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Bulk Quantity Purchased</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  required
                  value={bulkQuantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBulkQuantity(val);
                    // Automatically update default stock and threshold if creating fresh
                    if (!editingMaterial) {
                      setStockQuantity(val);
                      setLowStockThreshold(Math.round((Number(val) || 0) * 0.15 * 100) / 100);
                    }
                  }}
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-stone-400 font-bold">
                  {formUnit}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Bulk Cost Paid (ZAR)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-stone-400 font-bold">R</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={bulkCost}
                  onChange={(e) => setBulkCost(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Inventory Stock Settings Box */}
            <div className="sm:col-span-2 p-4 bg-amber-50/50 rounded-xl border border-amber-200/60 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <Sliders size={14} className="text-amber-700" /> Stock & Low-Stock Warning Settings
                </h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lowStockWarningEnabled}
                    onChange={(e) => setLowStockWarningEnabled(e.target.checked)}
                    className="rounded text-amber-700 focus:ring-amber-500 h-4 w-4"
                  />
                  <span className="text-xs font-bold text-stone-700">Enable Low Stock Warning</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">Current Available Stock</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-stone-400 font-bold">
                      {formUnit}
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-500">
                    Will auto-deduct when tasks using this material are completed.
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">Low-Stock Alert Threshold</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      disabled={!lowStockWarningEnabled}
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-stone-100 disabled:text-stone-400"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-stone-400 font-bold">
                      {formUnit}
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-500">
                    Triggers a warning when stock falls below or equal to this amount.
                  </span>
                </div>
              </div>
            </div>

            {/* Dedicated Supplier Section */}
            {!showSupplierForm && !supplierName && !supplierContact && !supplierEmail && !supplierPhone && !supStreet ? (
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierForm(true)}
                  className="w-full py-3.5 px-4 bg-stone-50 hover:bg-amber-50/80 border border-dashed border-stone-300 hover:border-amber-300 rounded-xl text-stone-700 hover:text-amber-900 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
                >
                  <Truck size={16} className="text-amber-700" />
                  + Add Supplier Information
                </button>
              </div>
            ) : (
              <div className="sm:col-span-2 p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-stone-200/60">
                  <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Truck size={14} className="text-amber-700" /> Supplier Information
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setSupplierName('');
                      setSupplierContact('');
                      setSupplierEmail('');
                      setSupplierPhone('');
                      setSupStreet('');
                      setSupCity('');
                      setSupProvince('');
                      setSupPostalCode('');
                      setSupCountry('');
                      setShowSupplierForm(false);
                    }}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                  >
                    Remove Supplier
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700">Supplier / Vendor Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Cape Chemical Supplies"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700">Contact Person Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Smith"
                      value={supplierContact}
                      onChange={(e) => setSupplierContact(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700">Supplier Email</label>
                    <input
                      type="email"
                      placeholder="e.g. orders@capechem.co.za"
                      value={supplierEmail}
                      onChange={(e) => setSupplierEmail(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-700">Supplier Phone / Cell</label>
                    <input
                      type="text"
                      placeholder="e.g. +27 21 555 0199"
                      value={supplierPhone}
                      onChange={(e) => setSupplierPhone(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Structured Supplier Address */}
                <div className="space-y-3 pt-2 border-t border-stone-200/60">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Supplier Address</label>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">Street Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 15 Industrial Ring Road"
                      value={supStreet}
                      onChange={(e) => setSupStreet(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">City</label>
                      <input
                        type="text"
                        placeholder="e.g. Parow"
                        value={supCity}
                        onChange={(e) => setSupCity(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">Province</label>
                      <input
                        type="text"
                        placeholder="e.g. Western Cape"
                        value={supProvince}
                        onChange={(e) => setSupProvince(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">Postal Code</label>
                      <input
                        type="text"
                        placeholder="e.g. 7500"
                        value={supPostalCode}
                        onChange={(e) => setSupPostalCode(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">Country</label>
                      <input
                        type="text"
                        placeholder="e.g. South Africa"
                        value={supCountry}
                        onChange={(e) => setSupCountry(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Copy Helpers in Form */}
                {(supplierName || supplierEmail || supplierPhone || supStreet) && (
                  <div className="pt-2 border-t border-stone-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                        Supplier Contact Summary
                      </span>
                      <CopyButton
                        text={[
                          supplierName && `Supplier: ${supplierName}`,
                          supplierContact && `Contact: ${supplierContact}`,
                          supplierEmail && `Email: ${supplierEmail}`,
                          supplierPhone && `Phone: ${supplierPhone}`,
                          formatAddress({ street: supStreet, city: supCity, province: supProvince, postalCode: supPostalCode, country: supCountry }) && `Address: ${formatAddress({ street: supStreet, city: supCity, province: supProvince, postalCode: supPostalCode, country: supCountry })}`
                        ].filter(Boolean).join('\n')}
                        label="Copy All"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {supplierEmail && (
                        <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-stone-200/80">
                          <span className="truncate text-stone-700 font-medium">{supplierEmail}</span>
                          <CopyButton text={supplierEmail} />
                        </div>
                      )}
                      {supplierPhone && (
                        <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-stone-200/80">
                          <span className="text-stone-700 font-medium">{supplierPhone}</span>
                          <CopyButton text={supplierPhone} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-stone-700">Notes</label>
              <textarea
                rows={2}
                placeholder="e.g. Grade A finish, store in cool dry space..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-xs font-normal text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Unit Cost Preview Banner */}
          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Info className="text-amber-700 shrink-0" size={18} />
              <div>
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Calculated Material Unit Cost</span>
                <span className="text-sm font-black text-amber-950">
                  {formatZAR(formUnitCost)} per {formUnit}
                </span>
                {formUnit === 'kg' && (
                  <span className="text-xs text-amber-700 ml-2 font-medium">
                    ({formatZAR(formUnitCost / 1000)} per g)
                  </span>
                )}
                {formUnit === 'l' && (
                  <span className="text-xs text-amber-700 ml-2 font-medium">
                    ({formatZAR(formUnitCost / 1000)} per ml)
                  </span>
                )}
                {formUnit === 'm' && (
                  <span className="text-xs text-amber-700 ml-2 font-medium">
                    ({formatZAR(formUnitCost / 1000)} per mm)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-stone-200 text-stone-600 rounded-xl text-xs font-bold hover:bg-stone-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-amber-700 hover:bg-amber-800 text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
            >
              {editingMaterial ? 'Update Material' : 'Save Material'}
            </button>
          </div>
        </form>
      )}

      {/* Material Detail View State OR Material List */}
      {!isAdding && !editingMaterial && (
        selectedMaterial ? (
          /* DEDICATED MATERIAL DETAIL VIEW (Modelled on Customer View State) */
          <div className="space-y-6">
            {/* Navigation Header */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setSelectedMaterialId(null)}
                className="flex items-center gap-1.5 text-stone-600 hover:text-stone-900 font-bold text-xs bg-stone-100 hover:bg-stone-200 border border-stone-200/60 px-3.5 py-2 rounded-xl transition cursor-pointer"
              >
                <ArrowLeft size={16} /> Back to Materials
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStartEdit(selectedMaterial)}
                  className="text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-200/80 px-3.5 py-2 rounded-xl transition text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Edit2 size={13} /> Edit Material
                </button>
                <button
                  onClick={() => setMaterialToDelete(selectedMaterial)}
                  className="text-rose-600 hover:text-rose-800 bg-white border border-rose-200 hover:bg-rose-50 px-3.5 py-2 rounded-xl transition text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>

            {/* Header Detail Box */}
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-stone-200 shadow-xs space-y-6">
              {(() => {
                const unitCost = getMaterialUnitCost(selectedMaterial);
                const currentStock = selectedMaterial.stockQuantity !== undefined ? selectedMaterial.stockQuantity : selectedMaterial.bulkQuantity;
                const threshold = selectedMaterial.lowStockThreshold !== undefined ? selectedMaterial.lowStockThreshold : 0;
                const warningEnabled = selectedMaterial.lowStockWarningEnabled !== false;
                const low = warningEnabled && currentStock <= threshold;
                const outOfStock = currentStock <= 0;

                // Active job requirements calculation
                let totalJobDemand = 0;
                let activeJobCount = 0;
                const activeJobs = jobs.filter(j => j.status !== 'Done');
                activeJobs.forEach(j => {
                  let jobUsesMat = false;
                  j.items.forEach(item => {
                    const unitsToMake = Math.max(0, item.quantity - (item.stockCount || 0) - (item.completedCount || 0));
                    if (unitsToMake > 0) {
                      const reqs = getItemMaterialRequirements(item, products);
                      const req = reqs.find(r => r.materialId === selectedMaterial.id);
                      if (req) {
                        jobUsesMat = true;
                        const amountInBulk = convertMaterialAmount(req.amountPerUnit * unitsToMake, req.unit, selectedMaterial.unit);
                        totalJobDemand += amountInBulk;
                      }
                    }
                  });
                  if (jobUsesMat) activeJobCount++;
                });
                totalJobDemand = Math.round(totalJobDemand * 1000) / 1000;
                const isShortForActiveJobs = totalJobDemand > currentStock;
                const activeJobShortage = isShortForActiveJobs ? Math.round((totalJobDemand - currentStock) * 1000) / 1000 : 0;

                const linkedProducts = products.filter(p => p.inputs?.some(r => r.type === 'material' && r.materialId === selectedMaterial.id));

                return (
                  <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 pb-5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-700 px-2.5 py-1 rounded-md">
                            {selectedMaterial.category || 'Raw Material'}
                          </span>
                          {outOfStock ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 px-2.5 py-1 rounded-md inline-flex items-center gap-1">
                              <AlertTriangle size={11} /> Out of Stock
                            </span>
                          ) : low ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md inline-flex items-center gap-1">
                              <AlertTriangle size={11} /> Low Stock
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md inline-flex items-center gap-1">
                              <Check size={11} /> In Stock
                            </span>
                          )}
                        </div>
                        <h2 className="font-black text-stone-800 text-2xl md:text-3xl">{selectedMaterial.name}</h2>
                        <span className="text-xs text-stone-400 font-mono block">Material ID: {selectedMaterial.id}</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="bg-amber-50/80 border border-amber-200/60 px-4 py-2.5 rounded-xl text-center">
                          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Calculated Unit Rate</span>
                          <span className="text-lg font-black text-amber-950">{formatZAR(unitCost)} / {selectedMaterial.unit}</span>
                        </div>
                      </div>
                    </div>

                    {/* TOP-LEVEL INTERACTIVE STOCK MANAGEMENT CONTROL */}
                    <div className={`p-5 rounded-2xl border space-y-4 ${
                      outOfStock
                        ? 'bg-rose-50/80 border-rose-200'
                        : low
                          ? 'bg-amber-50/80 border-amber-200'
                          : 'bg-stone-50/80 border-stone-200'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block mb-0.5">
                            Top-Level Available Inventory Stock
                          </span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-stone-900">
                              {currentStock}
                            </span>
                            <span className="text-sm font-bold text-stone-600">{selectedMaterial.unit}</span>
                          </div>
                          {warningEnabled && (
                            <span className="text-[11px] text-stone-500 font-medium block mt-1">
                              Alert Threshold: &le; {threshold} {selectedMaterial.unit}
                            </span>
                          )}
                        </div>

                        {/* Top-Level Quick Adjustment Control Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleQuickStockUpdate(selectedMaterial, Math.max(0, currentStock - 5))}
                            className="px-3 py-1.5 bg-white border border-stone-200 text-stone-700 hover:bg-stone-100 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                            title="Decrease stock by 5"
                          >
                            -5
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickStockUpdate(selectedMaterial, Math.max(0, currentStock - 1))}
                            className="p-1.5 bg-white border border-stone-200 text-stone-700 hover:bg-stone-100 rounded-xl transition cursor-pointer shadow-2xs"
                            title="Decrease stock by 1"
                          >
                            <Minus size={16} />
                          </button>
                          <div className="flex items-center gap-1 bg-white border border-stone-300 rounded-xl px-2.5 py-1">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={currentStock}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) handleQuickStockUpdate(selectedMaterial, val);
                              }}
                              className="w-20 text-center font-black text-stone-800 text-sm focus:outline-none"
                            />
                            <span className="text-xs font-bold text-stone-500">{selectedMaterial.unit}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleQuickStockUpdate(selectedMaterial, currentStock + 1)}
                            className="p-1.5 bg-white border border-stone-200 text-stone-700 hover:bg-stone-100 rounded-xl transition cursor-pointer shadow-2xs"
                            title="Increase stock by 1"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickStockUpdate(selectedMaterial, currentStock + 5)}
                            className="px-3 py-1.5 bg-white border border-stone-200 text-stone-700 hover:bg-stone-100 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                            title="Increase stock by 5"
                          >
                            +5
                          </button>
                        </div>
                      </div>

                      {/* Active Job Shortage Banner in Detail View */}
                      {totalJobDemand > 0 && (
                        <div className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          isShortForActiveJobs ? 'bg-amber-100/70 border-amber-300' : 'bg-emerald-50 border-emerald-200'
                        }`}>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-stone-600 block">
                              Active Job Material Requirements
                            </span>
                            <span className="font-bold text-stone-800 text-xs">
                              {totalJobDemand} {selectedMaterial.unit} needed for {activeJobCount} active job{activeJobCount > 1 ? 's' : ''}
                            </span>
                          </div>
                          {isShortForActiveJobs && (
                            <button
                              type="button"
                              onClick={() => handleQuickStockUpdate(selectedMaterial, Math.round((currentStock + activeJobShortage) * 1000) / 1000)}
                              className="px-3 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-extrabold text-xs transition cursor-pointer shadow-2xs self-start sm:self-auto"
                            >
                              + Restock Shortage ({activeJobShortage} {selectedMaterial.unit})
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Financial Specs */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div className="bg-stone-50 p-4 rounded-xl border border-stone-200/80">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Bulk Purchase Package</span>
                        <span className="text-sm font-bold text-stone-800">{selectedMaterial.bulkQuantity} {selectedMaterial.unit}</span>
                      </div>
                      <div className="bg-stone-50 p-4 rounded-xl border border-stone-200/80">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Bulk Package Cost</span>
                        <span className="text-sm font-bold text-stone-800">{formatZAR(selectedMaterial.bulkCost)}</span>
                      </div>
                      <div className="bg-stone-50 p-4 rounded-xl border border-stone-200/80">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Unit Rate</span>
                        <span className="text-sm font-bold text-stone-800">{formatZAR(unitCost)} / {selectedMaterial.unit}</span>
                      </div>
                    </div>

                    {/* DEDICATED SUPPLIER SECTION (Modelled on Customer contact stack) */}
                    <div className="bg-stone-50/80 p-5 rounded-2xl border border-stone-200 space-y-4">
                      <div className="flex items-center justify-between border-b border-stone-200/60 pb-3">
                        <h4 className="font-bold text-stone-800 text-sm flex items-center gap-2 uppercase tracking-wider">
                          <Truck size={16} className="text-amber-700" />
                          Supplier & Vendor Details
                        </h4>
                        {selectedMaterial.supplier && (
                          <div className="flex items-center gap-2">
                            <CopyButton
                              text={[
                                selectedMaterial.supplier.name && `Supplier: ${selectedMaterial.supplier.name}`,
                                selectedMaterial.supplier.contactName && `Contact: ${selectedMaterial.supplier.contactName}`,
                                selectedMaterial.supplier.email && `Email: ${selectedMaterial.supplier.email}`,
                                selectedMaterial.supplier.phone && `Phone: ${selectedMaterial.supplier.phone}`,
                                selectedMaterial.supplier.address && `Address: ${selectedMaterial.supplier.address}`
                              ].filter(Boolean).join('\n')}
                              label="Copy All Supplier Details"
                            />
                            <button
                              onClick={() => {
                                handleStartEdit(selectedMaterial);
                                setShowSupplierForm(true);
                              }}
                              className="text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-100/60 hover:bg-amber-100 px-3 py-1 rounded-lg transition cursor-pointer"
                            >
                              Edit Supplier
                            </button>
                          </div>
                        )}
                      </div>

                      {selectedMaterial.supplier && (selectedMaterial.supplier.name || selectedMaterial.supplier.contactName || selectedMaterial.supplier.email || selectedMaterial.supplier.phone || selectedMaterial.supplier.address) ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {selectedMaterial.supplier.name && (
                            <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-stone-200/80">
                              <div className="flex items-start gap-3 min-w-0">
                                <Building2 size={16} className="text-amber-700 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Supplier Name</span>
                                  <span className="font-bold text-stone-800 block truncate">{selectedMaterial.supplier.name}</span>
                                </div>
                              </div>
                              <CopyButton text={selectedMaterial.supplier.name} />
                            </div>
                          )}

                          {selectedMaterial.supplier.contactName && (
                            <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-stone-200/80">
                              <div className="flex items-start gap-3 min-w-0">
                                <User size={16} className="text-amber-700 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Contact Person</span>
                                  <span className="font-bold text-stone-800 block truncate">{selectedMaterial.supplier.contactName}</span>
                                </div>
                              </div>
                              <CopyButton text={selectedMaterial.supplier.contactName} />
                            </div>
                          )}

                          {selectedMaterial.supplier.email && (
                            <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-stone-200/80">
                              <div className="flex items-start gap-3 min-w-0">
                                <Mail size={16} className="text-amber-700 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Supplier Email</span>
                                  <span className="font-bold text-stone-800 block truncate">{selectedMaterial.supplier.email}</span>
                                </div>
                              </div>
                              <CopyButton text={selectedMaterial.supplier.email} />
                            </div>
                          )}

                          {selectedMaterial.supplier.phone && (
                            <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-stone-200/80">
                              <div className="flex items-start gap-3 min-w-0">
                                <Phone size={16} className="text-amber-700 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Supplier Phone</span>
                                  <span className="font-bold text-stone-800 block">{selectedMaterial.supplier.phone}</span>
                                </div>
                              </div>
                              <CopyButton text={selectedMaterial.supplier.phone} />
                            </div>
                          )}

                          {selectedMaterial.supplier.address && (
                            <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-stone-200/80 md:col-span-2">
                              <div className="flex items-start gap-3 min-w-0">
                                <MapPin size={16} className="text-amber-700 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Supplier Address</span>
                                  <span className="font-bold text-stone-800 block leading-snug">{selectedMaterial.supplier.address}</span>
                                </div>
                              </div>
                              <CopyButton text={selectedMaterial.supplier.address} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white p-6 rounded-xl border border-dashed border-stone-300 text-center space-y-2">
                          <p className="text-xs text-stone-500 font-medium">No supplier information registered for this material.</p>
                          <button
                            onClick={() => {
                              handleStartEdit(selectedMaterial);
                              setShowSupplierForm(true);
                            }}
                            className="mt-1 bg-amber-700 hover:bg-amber-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <Plus size={14} /> Add Supplier Information
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Notes Section */}
                    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-stone-800 text-sm flex items-center gap-1.5">
                          <BookOpen size={16} className="text-amber-700" />
                          Notes
                        </h4>
                        {selectedMaterial.notes && <CopyButton text={selectedMaterial.notes} label="Copy Notes" />}
                      </div>
                      <textarea
                        value={selectedMaterial.notes || ''}
                        onChange={(e) => {
                          const updated = { ...selectedMaterial, notes: e.target.value };
                          onUpdateMaterial(updated);
                        }}
                        placeholder="Add custom material notes, storage conditions, or usage guidelines here..."
                        rows={3}
                        className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-xs focus:ring-amber-500/25 focus:ring-2 focus:outline-none leading-relaxed"
                      />
                    </div>

                    {/* Usage in Products & Active Jobs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-3">
                        <h4 className="font-bold text-stone-800 text-sm flex items-center gap-1.5">
                          <PackageCheck size={16} className="text-amber-700" />
                          Products Using This Material ({linkedProducts.length})
                        </h4>
                        {linkedProducts.length === 0 ? (
                          <p className="text-xs text-stone-400 italic py-4 text-center bg-stone-50 rounded-xl">No products configured with this material.</p>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {linkedProducts.map(prod => {
                              const req = prod.inputs?.find(r => r.type === 'material' && r.materialId === selectedMaterial.id);
                              return (
                                <div key={prod.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 flex items-center justify-between gap-2 text-xs">
                                  <div>
                                    <span className="font-bold text-stone-800 block">{prod.name}</span>
                                    <span className="text-[10px] text-stone-500">Requires {req?.amount || 1} {req?.unit} per product unit</span>
                                  </div>
                                  <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                                    Stock: {prod.stockQuantity || 0}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-3">
                        <h4 className="font-bold text-stone-800 text-sm flex items-center gap-1.5">
                          <Box size={16} className="text-amber-700" />
                          Active Job Demand ({activeJobs.filter(j => j.items.some(i => getItemMaterialRequirements(i, products).some(r => r.materialId === selectedMaterial.id))).length})
                        </h4>
                        {activeJobCount === 0 ? (
                          <p className="text-xs text-stone-400 italic py-4 text-center bg-stone-50 rounded-xl">No active jobs requiring this material.</p>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {activeJobs.map(job => {
                              let jobMatAmount = 0;
                              job.items.forEach(item => {
                                const unitsToMake = Math.max(0, item.quantity - (item.stockCount || 0) - (item.completedCount || 0));
                                if (unitsToMake > 0) {
                                  const reqs = getItemMaterialRequirements(item, products);
                                  const req = reqs.find(r => r.materialId === selectedMaterial.id);
                                  if (req) {
                                    jobMatAmount += convertMaterialAmount(req.amountPerUnit * unitsToMake, req.unit, selectedMaterial.unit);
                                  }
                                }
                              });
                              if (jobMatAmount <= 0) return null;
                              return (
                                <div key={job.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 flex items-center justify-between gap-2 text-xs">
                                  <div>
                                    <span className="font-bold text-stone-800 block">Job #{job.jobNumber || job.id.slice(0, 6)}</span>
                                    <span className="text-[10px] text-stone-500">Status: {job.status}</span>
                                  </div>
                                  <span className="font-black text-amber-900 text-xs">
                                    {Math.round(jobMatAmount * 100) / 100} {selectedMaterial.unit}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
          /* MATERIAL LIST GRID (When no material is selected) */
          <>
            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 text-stone-400" size={16} />
                <input
                  type="text"
                  placeholder="Search materials by name, category, or supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => { setSelectedCategory('all'); setFilterLowStockOnly(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedCategory === 'all' && !filterLowStockOnly
                      ? 'bg-amber-800 text-white'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  All ({materials.length})
                </button>

                {lowStockCount > 0 && (
                  <button
                    onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      filterLowStockOnly
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <AlertTriangle size={13} /> Low Stock ({lowStockCount})
                  </button>
                )}

                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setSelectedCategory(cat); setFilterLowStockOnly(false); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      selectedCategory === cat && !filterLowStockOnly
                        ? 'bg-amber-800 text-white'
                        : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid of Material Cards */}
            {filteredMaterials.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-stone-200/80 p-6">
                <Layers className="mx-auto text-stone-300 mb-3" size={40} />
                <h3 className="font-extrabold text-stone-700 text-base">No Materials Found</h3>
                <p className="text-xs text-stone-400 max-w-sm mx-auto mt-1">
                  {filterLowStockOnly
                    ? 'All material stock levels are currently above low-stock thresholds!'
                    : searchTerm || selectedCategory !== 'all'
                      ? 'No materials match your current filter criteria.'
                      : 'Start by listing raw materials, ingredients, or packaging items you purchase in bulk.'}
                </p>
                {!searchTerm && selectedCategory === 'all' && !filterLowStockOnly && (
                  <button
                    onClick={handleStartAdd}
                    className="mt-4 bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus size={14} /> Add First Material
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="materials-grid">
                {filteredMaterials.map(mat => {
                  const unitCost = getMaterialUnitCost(mat);
                  const currentStock = mat.stockQuantity !== undefined ? mat.stockQuantity : mat.bulkQuantity;
                  const threshold = mat.lowStockThreshold !== undefined ? mat.lowStockThreshold : 0;
                  const warningEnabled = mat.lowStockWarningEnabled !== false;
                  const low = warningEnabled && currentStock <= threshold;
                  const outOfStock = currentStock <= 0;

                  // Active job requirements calculation
                  let totalJobDemand = 0;
                  let activeJobCount = 0;
                  const activeJobs = jobs.filter(j => j.status !== 'Done');
                  activeJobs.forEach(j => {
                    let jobUsesMat = false;
                    j.items.forEach(item => {
                      const unitsToMake = Math.max(0, item.quantity - (item.stockCount || 0) - (item.completedCount || 0));
                      if (unitsToMake > 0) {
                        const reqs = getItemMaterialRequirements(item, products);
                        const req = reqs.find(r => r.materialId === mat.id);
                        if (req) {
                          jobUsesMat = true;
                          const amountInBulk = convertMaterialAmount(req.amountPerUnit * unitsToMake, req.unit, mat.unit);
                          totalJobDemand += amountInBulk;
                        }
                      }
                    });
                    if (jobUsesMat) activeJobCount++;
                  });
                  totalJobDemand = Math.round(totalJobDemand * 1000) / 1000;
                  const isShortForActiveJobs = totalJobDemand > currentStock;
                  const activeJobShortage = isShortForActiveJobs ? Math.round((totalJobDemand - currentStock) * 1000) / 1000 : 0;

                  const isEditingInline = editingStockId === mat.id;

                  return (
                    <div
                      key={mat.id}
                      onClick={() => setSelectedMaterialId(mat.id)}
                      className={`bg-white rounded-2xl border transition-all shadow-xs p-5 flex flex-col justify-between cursor-pointer hover:shadow-md group ${
                        outOfStock
                          ? 'border-rose-300 bg-rose-50/20 hover:border-rose-400'
                          : low
                            ? 'border-amber-300 bg-amber-50/20 hover:border-amber-400'
                            : 'border-stone-200/90 hover:border-amber-400'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md inline-block">
                                {mat.category || 'Raw Material'}
                              </span>
                              {outOfStock ? (
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                  <AlertTriangle size={10} /> Out of Stock
                                </span>
                              ) : low ? (
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                  <AlertTriangle size={10} /> Low Stock
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                  <Check size={10} /> In Stock
                                </span>
                              )}
                            </div>
                            <h3 className="font-bold text-stone-800 text-base leading-snug group-hover:text-amber-800 transition">
                              {mat.name}
                            </h3>
                          </div>
                          <div className="p-1.5 text-stone-400 group-hover:text-amber-700 transition rounded-lg">
                            <ChevronRight size={18} />
                          </div>
                        </div>

                      {/* Available Inventory Stock Summary */}
                      <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                        outOfStock
                          ? 'bg-rose-50 border-rose-200'
                          : low
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-stone-50 border-stone-200/80'
                      }`}>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-0.5">
                            Available Inventory
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-xl font-black ${
                              outOfStock ? 'text-rose-700' : low ? 'text-amber-800' : 'text-stone-900'
                            }`}>
                              {currentStock}
                            </span>
                            <span className="text-xs font-bold text-stone-500">{mat.unit}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          {warningEnabled && (
                            <span className="text-[10px] text-stone-400 font-medium block">
                              Alert &le; {threshold} {mat.unit}
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-amber-900/70 group-hover:text-amber-900 transition flex items-center justify-end gap-1 mt-0.5">
                            Manage stock <ChevronRight size={12} />
                          </span>
                        </div>
                      </div>

                      {/* Active Job Demand Section */}
                      {totalJobDemand > 0 && (
                        <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                          isShortForActiveJobs ? 'bg-amber-100/50 border-amber-300' : 'bg-emerald-50/50 border-emerald-200'
                        }`}>
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 block">
                              Active Job Demand
                            </span>
                            <span className="font-extrabold text-stone-800 text-[11px] block truncate">
                              {totalJobDemand} {mat.unit} needed ({activeJobCount} job{activeJobCount > 1 ? 's' : ''})
                            </span>
                          </div>
                          {isShortForActiveJobs && (
                            <button
                              type="button"
                              onClick={() => handleQuickStockUpdate(mat, Math.round((currentStock + activeJobShortage) * 1000) / 1000)}
                              className="px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-extrabold text-[10px] shrink-0 transition cursor-pointer shadow-2xs"
                              title="Instantly restock the exact shortage needed for active jobs"
                            >
                              + Restock {activeJobShortage} {mat.unit}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Bulk purchase & cost rates */}
                      <div className="bg-stone-50/60 p-3 rounded-xl border border-stone-100 space-y-1.5 text-xs">
                        <div className="flex justify-between text-stone-600">
                          <span>Bulk Lot Size:</span>
                          <span className="font-bold text-stone-800">{mat.bulkQuantity} {mat.unit}</span>
                        </div>
                        <div className="flex justify-between text-stone-600">
                          <span>Bulk Cost Paid:</span>
                          <span className="font-bold text-stone-800">{formatZAR(mat.bulkCost)}</span>
                        </div>
                        <div className="flex justify-between text-stone-600 pt-1 border-t border-stone-200/50">
                          <span className="font-bold text-amber-900">Calculated Unit Cost:</span>
                          <span className="font-black text-amber-950">{formatZAR(unitCost)} / {mat.unit}</span>
                        </div>
                      </div>

                      {/* Supplier Information Block */}
                      {mat.supplier && (mat.supplier.name || mat.supplier.contactName || mat.supplier.email || mat.supplier.phone || mat.supplier.address) && (
                        <div className="bg-stone-50/80 p-3 rounded-xl border border-stone-200/80 space-y-2 text-xs">
                          <div className="flex items-center justify-between pb-1 border-b border-stone-200/60">
                            <span className="font-bold text-stone-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                              <Truck size={13} className="text-amber-700 shrink-0" />
                              {mat.supplier.name || 'Supplier Info'}
                            </span>
                            <CopyButton
                              text={[
                                mat.supplier.name && `Supplier: ${mat.supplier.name}`,
                                mat.supplier.contactName && `Contact: ${mat.supplier.contactName}`,
                                mat.supplier.email && `Email: ${mat.supplier.email}`,
                                mat.supplier.phone && `Phone: ${mat.supplier.phone}`,
                                mat.supplier.address && `Address: ${mat.supplier.address}`
                              ].filter(Boolean).join('\n')}
                              label="Copy All"
                            />
                          </div>

                          {mat.supplier.contactName && (
                            <div className="flex items-center justify-between text-stone-600 text-[11px]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <User size={12} className="text-stone-400 shrink-0" />
                                <span className="font-semibold text-stone-700 truncate">{mat.supplier.contactName}</span>
                              </div>
                              <CopyButton text={mat.supplier.contactName} />
                            </div>
                          )}

                          {mat.supplier.email && (
                            <div className="flex items-center justify-between text-stone-600 text-[11px]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Mail size={12} className="text-stone-400 shrink-0" />
                                <span className="truncate">{mat.supplier.email}</span>
                              </div>
                              <CopyButton text={mat.supplier.email} />
                            </div>
                          )}

                          {mat.supplier.phone && (
                            <div className="flex items-center justify-between text-stone-600 text-[11px]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Phone size={12} className="text-stone-400 shrink-0" />
                                <span>{mat.supplier.phone}</span>
                              </div>
                              <CopyButton text={mat.supplier.phone} />
                            </div>
                          )}

                          {mat.supplier.address && (
                            <div className="flex items-center justify-between text-stone-600 text-[11px]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <MapPin size={12} className="text-stone-400 shrink-0" />
                                <span className="truncate">{mat.supplier.address}</span>
                              </div>
                              <CopyButton text={mat.supplier.address} />
                            </div>
                          )}
                        </div>
                      )}

                      {mat.notes && (
                        <div className="flex items-start justify-between gap-2 pt-1 border-t border-stone-100 text-xs text-stone-500 italic">
                          <p className="leading-relaxed">"{mat.notes}"</p>
                          <CopyButton text={mat.notes} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )
    )}

      {/* Delete Confirmation Modal */}
      {materialToDelete && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <ShieldAlert size={24} />
              <h3 className="font-extrabold text-stone-800 text-base">Delete Material?</h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-stone-800">"{materialToDelete.name}"</span>?
              Products using this material as an input will keep their saved input values.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setMaterialToDelete(null)}
                className="px-4 py-2 border border-stone-200 text-stone-600 rounded-xl text-xs font-bold hover:bg-stone-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteMaterial(materialToDelete.id);
                  setMaterialToDelete(null);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Delete Material
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

