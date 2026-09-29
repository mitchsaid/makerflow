import React, { useState, useEffect } from 'react';
import {
  X, Plus, PlusCircle, Edit2, Box, Clock, DollarSign, Calculator, Sliders, Check,
  ListTodo, Layers, GripVertical, ChevronUp, ChevronDown, Zap, Sparkles, ImageIcon, Lock
} from 'lucide-react';
import {
  Material, ProductInput, CustomizationOption, CustomizationOptionValue,
  ProductStageConfig, StageCondition, Product, InputType
} from '../types';
import {
  calculateMaterialInputCost, calculateLabourInputCost, calculateProductBaseUnitCost,
  calculateProductOptionExtraCost, isInputBase, COMMON_UNITS, getMaterialUnitCost,
  getStageConditionSummary
} from '../lib/costUtils';

export interface CustomItemResult {
  name: string;
  description: string;
  photo?: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  customizationOptions?: CustomizationOption[];
  trackingMode?: 'whole' | 'stages';
  stages?: ProductStageConfig[];
  inputs?: ProductInput[];
}

export interface AdvancedCustomItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCustomItem: (item: CustomItemResult) => void;
  materials?: Material[];
  reusableStages?: string[];
  onAddReusableStage?: (stageName: string) => void;
  initialData?: {
    name?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    unitCost?: number;
  };
}

export const AdvancedCustomItemModal: React.FC<AdvancedCustomItemModalProps> = ({
  isOpen,
  onClose,
  onAddCustomItem,
  materials = [],
  reusableStages = [],
  onAddReusableStage,
  initialData
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'stages' | 'costs'>('details');

  // Core details state
  const [itemName, setItemName] = useState(initialData?.name || '');
  const [itemDesc, setItemDesc] = useState(initialData?.description || '');
  const [itemPhoto, setItemPhoto] = useState('');
  const [itemBasePrice, setItemBasePrice] = useState<number | string>(initialData?.unitPrice ?? 100);
  const [itemQuantity, setItemQuantity] = useState<number>(initialData?.quantity || 1);

  // Variations & Extras state
  const [tempCustomizations, setTempCustomizations] = useState<CustomizationOption[]>([]);

  // Helpers for Variations
  const [newVarName, setNewVarName] = useState('');
  const [newVarValText, setNewVarValText] = useState('');
  const [newVarValUplift, setNewVarValUplift] = useState<number | string>(0);
  const [newVarValPhoto, setNewVarValPhoto] = useState('');
  const [tempVarValues, setTempVarValues] = useState<CustomizationOptionValue[]>([]);
  const [showAddVar, setShowAddVar] = useState(false);

  // Helpers for Extras
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraValText, setNewExtraValText] = useState('');
  const [newExtraValUplift, setNewExtraValUplift] = useState<number | string>(0);
  const [newExtraValPhoto, setNewExtraValPhoto] = useState('');
  const [tempExtraValues, setTempExtraValues] = useState<CustomizationOptionValue[]>([]);
  const [showAddExtra, setShowAddExtra] = useState(false);

  // Edit Option State
  const [editingOptIndex, setEditingOptIndex] = useState<number | null>(null);
  const [editOptName, setEditOptName] = useState('');
  const [editOptValues, setEditOptValues] = useState<CustomizationOptionValue[]>([]);
  const [editValText, setEditValText] = useState('');
  const [editValUplift, setEditValUplift] = useState<number | string>(0);
  const [editValPhoto, setEditValPhoto] = useState('');

  // Production Tracking & Stages state
  const [trackingMode, setTrackingMode] = useState<'whole' | 'stages'>('whole');
  const [pDefaultStages, setPDefaultStages] = useState<ProductStageConfig[]>([]);
  const [expandedStageIndex, setExpandedStageIndex] = useState<number | null>(null);
  const [newDefaultStageName, setNewDefaultStageName] = useState('');
  const [draggedStageIdx, setDraggedStageIdx] = useState<number | null>(null);

  // Inputs state
  const [pInputs, setPInputs] = useState<ProductInput[]>([]);
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [editingInputIdx, setEditingInputIdx] = useState<number | null>(null);

  // Input modal fields
  const [newInputType, setNewInputType] = useState<InputType>('material');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [inputAmount, setInputAmount] = useState<number | string>(1);
  const [inputUnit, setInputUnit] = useState('g');
  const [labourName, setLabourName] = useState('');
  const [labourHourlyRate, setLabourHourlyRate] = useState<number | string>(120);
  const [labourTimeAmount, setLabourTimeAmount] = useState<number | string>(15);
  const [labourTimeUnit, setLabourTimeUnit] = useState('mins');
  const [directInputName, setDirectInputName] = useState('');
  const [directInputCost, setDirectInputCost] = useState<number | string>(0);
  const [newInputTargetKeys, setNewInputTargetKeys] = useState<string[]>([]);
  const [testVariationSelection, setTestVariationSelection] = useState<Record<string, string>>({});

  // Sync initialData when modal opens
  useEffect(() => {
    if (isOpen) {
      setItemName(initialData?.name || '');
      setItemDesc(initialData?.description || '');
      setItemBasePrice(initialData?.unitPrice ?? (initialData?.unitPrice === 0 ? 0 : 100));
      setItemQuantity(initialData?.quantity || 1);
      setItemPhoto('');
      setTempCustomizations([]);
      setTrackingMode('whole');
      setPDefaultStages([]);
      setPInputs([]);
      setActiveTab('details');

      if (materials.length > 0) {
        setSelectedMaterialId(materials[0].id);
        setInputUnit(materials[0].unit || 'g');
      }
    }
  }, [isOpen, initialData, materials]);

  if (!isOpen) return null;

  const parsePrice = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const normalized = String(val).replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatZAR = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setItemPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Variation Helpers ---
  const addVarValue = () => {
    if (!newVarValText.trim()) return;
    setTempVarValues(prev => [
      ...prev,
      {
        value: newVarValText.trim(),
        priceUplift: parsePrice(newVarValUplift),
        photo: newVarValPhoto || undefined
      }
    ]);
    setNewVarValText('');
    setNewVarValUplift(0);
    setNewVarValPhoto('');
  };

  const removeVarValue = (idx: number) => {
    setTempVarValues(prev => prev.filter((_, i) => i !== idx));
  };

  const saveVariationOption = () => {
    if (!newVarName.trim() || tempVarValues.length === 0) return;
    const opt: CustomizationOption = {
      name: newVarName.trim(),
      type: 'variation',
      isRequired: false,
      values: tempVarValues
    };
    setTempCustomizations(prev => [...prev, opt]);
    setNewVarName('');
    setTempVarValues([]);
    setShowAddVar(false);
  };

  // --- Extra Helpers ---
  const addExtraValue = () => {
    if (!newExtraValText.trim()) return;
    setTempExtraValues(prev => [
      ...prev,
      {
        value: newExtraValText.trim(),
        priceUplift: parsePrice(newExtraValUplift),
        photo: newExtraValPhoto || undefined
      }
    ]);
    setNewExtraValText('');
    setNewExtraValUplift(0);
    setNewExtraValPhoto('');
  };

  const removeExtraValue = (idx: number) => {
    setTempExtraValues(prev => prev.filter((_, i) => i !== idx));
  };

  const saveExtraOption = () => {
    if (!newExtraName.trim() || tempExtraValues.length === 0) return;
    const opt: CustomizationOption = {
      name: newExtraName.trim(),
      type: 'extra',
      isRequired: false,
      values: tempExtraValues
    };
    setTempCustomizations(prev => [...prev, opt]);
    setNewExtraName('');
    setTempExtraValues([]);
    setShowAddExtra(false);
  };

  // --- Option Editing ---
  const startEditOption = (optIdx: number) => {
    const opt = tempCustomizations[optIdx];
    setEditingOptIndex(optIdx);
    setEditOptName(opt.name);
    setEditOptValues([...opt.values]);
    setEditValText('');
    setEditValUplift(0);
    setEditValPhoto('');
  };

  const cancelEditOpt = () => {
    setEditingOptIndex(null);
    setEditOptName('');
    setEditOptValues([]);
  };

  const saveEditOpt = (optIdx: number) => {
    if (!editOptName.trim() || editOptValues.length === 0) return;
    setTempCustomizations(prev => prev.map((o, idx) => {
      if (idx === optIdx) {
        return {
          ...o,
          name: editOptName.trim(),
          values: editOptValues
        };
      }
      return o;
    }));
    cancelEditOpt();
  };

  const deleteOption = (optIdx: number) => {
    setTempCustomizations(prev => prev.filter((_, idx) => idx !== optIdx));
  };

  // --- Input Modal Helpers ---
  const openAddInputModal = () => {
    setEditingInputIdx(null);
    setNewInputType('material');
    setNewInputTargetKeys([]);
    if (materials.length > 0) {
      setSelectedMaterialId(materials[0].id);
      setInputUnit(materials[0].unit || 'g');
    } else {
      setSelectedMaterialId('');
      setInputUnit('g');
    }
    setInputAmount(1);
    setLabourName('');
    setLabourHourlyRate(120);
    setLabourTimeAmount(15);
    setLabourTimeUnit('mins');
    setDirectInputName('');
    setDirectInputCost(0);
    setIsInputModalOpen(true);
  };

  const startEditInput = (idx: number) => {
    const inp = pInputs[idx];
    setEditingInputIdx(idx);
    setNewInputType(inp.type);
    const keys = inp.applicableValueKeys || (inp.optionName && inp.optionValue ? [`${inp.optionName}:::${inp.optionValue}`] : []);
    setNewInputTargetKeys(keys);

    if (inp.type === 'material') {
      setSelectedMaterialId(inp.materialId || (materials[0]?.id || ''));
      setInputAmount(inp.amount || 1);
      setInputUnit(inp.unit || 'g');
    } else if (inp.type === 'labour') {
      setLabourName(inp.name);
      setLabourHourlyRate(inp.hourlyRate || 120);
      setLabourTimeAmount(inp.amount || 15);
      setLabourTimeUnit(inp.unit || 'mins');
    } else {
      setDirectInputName(inp.name);
      setDirectInputCost(inp.cost || 0);
    }
    setIsInputModalOpen(true);
  };

  const saveInputItem = () => {
    let inpObj: ProductInput;
    const targetKeys = newInputTargetKeys.length > 0 ? newInputTargetKeys : undefined;

    if (newInputType === 'material') {
      const mat = materials.find(m => m.id === selectedMaterialId);
      if (!mat) return;
      const amtNum = parsePrice(inputAmount);
      const cost = calculateMaterialInputCost(mat, amtNum, inputUnit);
      inpObj = {
        id: editingInputIdx !== null ? pInputs[editingInputIdx].id : `inp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        type: 'material',
        name: mat.name,
        materialId: mat.id,
        amount: amtNum,
        unit: inputUnit,
        cost,
        applicableValueKeys: targetKeys
      };
    } else if (newInputType === 'labour') {
      if (!labourName.trim()) return;
      const amtNum = parsePrice(labourTimeAmount);
      const rateNum = parsePrice(labourHourlyRate);
      const cost = calculateLabourInputCost(amtNum, labourTimeUnit, rateNum);
      inpObj = {
        id: editingInputIdx !== null ? pInputs[editingInputIdx].id : `inp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        type: 'labour',
        name: labourName.trim(),
        amount: amtNum,
        unit: labourTimeUnit,
        hourlyRate: rateNum,
        cost,
        applicableValueKeys: targetKeys
      };
    } else {
      if (!directInputName.trim()) return;
      const costNum = parsePrice(directInputCost);
      inpObj = {
        id: editingInputIdx !== null ? pInputs[editingInputIdx].id : `inp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        type: 'direct',
        name: directInputName.trim(),
        amount: 1,
        unit: 'item',
        cost: costNum,
        applicableValueKeys: targetKeys
      };
    }

    if (editingInputIdx !== null) {
      setPInputs(prev => prev.map((item, i) => i === editingInputIdx ? inpObj : item));
    } else {
      setPInputs(prev => [...prev, inpObj]);
    }
    setIsInputModalOpen(false);
  };

  // --- Dummy product calculation for Cost Summary ---
  const dummyProduct: Product = {
    id: 'temp_custom',
    name: itemName || 'Custom Item',
    description: itemDesc,
    photo: itemPhoto,
    isActive: true,
    basePrice: parsePrice(itemBasePrice),
    priceBreaks: [],
    inputs: pInputs,
    customizationOptions: tempCustomizations
  };

  const calculatedBaseCost = calculateProductBaseUnitCost(dummyProduct, materials);
  const basePriceNum = parsePrice(itemBasePrice);
  const baseProfit = basePriceNum - calculatedBaseCost;
  const baseMargin = basePriceNum > 0 ? (baseProfit / basePriceNum) * 100 : 0;

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    onAddCustomItem({
      name: itemName.trim(),
      description: itemDesc.trim(),
      photo: itemPhoto || undefined,
      quantity: Math.max(1, itemQuantity),
      unitPrice: parsePrice(itemBasePrice),
      unitCost: calculatedBaseCost || (typeof initialData?.unitCost === 'number' ? initialData.unitCost : 0),
      customizationOptions: tempCustomizations.length > 0 ? tempCustomizations : undefined,
      trackingMode: trackingMode,
      stages: pDefaultStages.length > 0 ? pDefaultStages : undefined,
      inputs: pInputs.length > 0 ? pInputs : undefined
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-3xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-white border-b border-stone-200 shrink-0">
          <div className="flex items-center justify-between p-5 pb-3">
            <div>
              <h3 className="font-extrabold text-stone-900 text-lg">
                Add Custom Item
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Configure once-off specifications, production stages, materials, and cost breakdowns.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 cursor-pointer p-2 hover:bg-stone-100 rounded-xl transition"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form Tabs */}
          <div className="flex items-center gap-6 text-sm font-bold px-5 border-t border-stone-100 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`pb-2.5 -mb-px border-b-2 transition cursor-pointer ${
                activeTab === 'details'
                  ? 'border-amber-600 text-amber-800 font-extrabold'
                  : 'border-transparent text-stone-500 hover:text-stone-800 font-semibold'
              }`}
            >
              Core Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stages')}
              className={`pb-2.5 -mb-px border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'stages'
                  ? 'border-amber-600 text-amber-800 font-extrabold'
                  : 'border-transparent text-stone-500 hover:text-stone-800 font-semibold'
              }`}
            >
              Production Process
              {trackingMode === 'stages' && pDefaultStages.length > 0 && (
                <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">
                  {pDefaultStages.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('costs')}
              className={`pb-2.5 -mb-px border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'costs'
                  ? 'border-amber-600 text-amber-800 font-extrabold'
                  : 'border-transparent text-stone-500 hover:text-stone-800 font-semibold'
              }`}
            >
              Inputs & Costs
              {pInputs.length > 0 && (
                <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">
                  {pInputs.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: CORE DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              {/* Item Name */}
              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Custom Item Name / Title *
                </label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  placeholder="e.g. Bespoke Live-Edge Walnut Dining Table"
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-normal"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Specifications & Notes
                </label>
                <textarea
                  value={itemDesc}
                  onChange={e => setItemDesc(e.target.value)}
                  rows={3}
                  placeholder="Describe unique measurements, materials used, finish instructions, custom engraving notes..."
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-normal"
                />
              </div>

              {/* Photo Upload */}
              <div className="bg-stone-50/50 p-4 rounded-xl border border-stone-200 shadow-3xs">
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">
                  Photo / Render Attachment
                </label>
                <div className="flex items-center gap-4">
                  {itemPhoto ? (
                    <div className="relative shrink-0">
                      <img
                        src={itemPhoto}
                        alt="Preview"
                        className="w-16 h-16 object-cover rounded-xl border border-stone-200 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => setItemPhoto('')}
                        className="absolute -top-1.5 -right-1.5 bg-stone-800 text-white rounded-full p-1 hover:bg-rose-600 transition cursor-pointer"
                        title="Remove photo"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="text-xs text-stone-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-800 hover:file:bg-amber-100 cursor-pointer w-full"
                    />
                    <span className="text-[10px] text-stone-400 block mt-1">
                      Upload a CAD render, sketch, or photo reference.
                    </span>
                  </div>
                </div>
              </div>

              {/* Quantity and Unit Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-stone-50/50 p-4 rounded-xl border border-stone-200 shadow-3xs">
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={itemQuantity}
                    onChange={e => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-bold"
                  />
                </div>

                <div className="bg-stone-50/50 p-4 rounded-xl border border-stone-200 shadow-3xs">
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                    Unit Price (ZAR) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs">R</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={itemBasePrice}
                      onChange={e => setItemBasePrice(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCTION PROCESS */}
          {activeTab === 'stages' && (
            <div className="space-y-5">
              <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-4 shadow-3xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-stone-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <ListTodo size={14} className="text-amber-600" /> Production Tracking Mode
                    </h4>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Choose how progress for this custom item will be tracked during manufacturing.
                    </p>
                  </div>
                  <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-stone-200 shrink-0">
                    <Lock size={10} /> Internal Only
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTrackingMode('whole')}
                    className={`p-3.5 rounded-xl border-2 text-left transition cursor-pointer ${
                      trackingMode === 'whole'
                        ? 'border-amber-600 bg-amber-50/50 text-amber-950 shadow-3xs'
                        : 'border-stone-200 bg-stone-50/50 hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <span className="font-extrabold text-xs flex items-center gap-2 mb-1">
                      <Layers size={15} className={trackingMode === 'whole' ? 'text-amber-700' : 'text-stone-400'} />
                      Track as Whole Item
                    </span>
                    <p className="text-[11px] text-stone-500 font-normal">
                      Mark as completed when full custom item is done.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTrackingMode('stages')}
                    className={`p-3.5 rounded-xl border-2 text-left transition cursor-pointer ${
                      trackingMode === 'stages'
                        ? 'border-amber-600 bg-amber-50/50 text-amber-950 shadow-3xs'
                        : 'border-stone-200 bg-stone-50/50 hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <span className="font-extrabold text-xs flex items-center gap-2 mb-1">
                      <ListTodo size={15} className={trackingMode === 'stages' ? 'text-amber-700' : 'text-stone-400'} />
                      Track in Stages
                    </span>
                    <p className="text-[11px] text-stone-500 font-normal">
                      Define step-by-step production stages (e.g. Cut, Assemble, Sand, Polish).
                    </p>
                  </button>
                </div>

                {trackingMode === 'stages' && (
                  <div className="pt-3 border-t border-stone-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-stone-800 text-xs">Custom Production Stages</h5>
                      <span className="text-[11px] text-stone-400">{pDefaultStages.length} stages</span>
                    </div>

                    {pDefaultStages.length > 0 ? (
                      <div className="space-y-2">
                        {pDefaultStages.map((stg, idx) => (
                          <div key={stg.id || idx} className="flex items-center justify-between bg-stone-50 px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-800">
                            <div className="flex items-center gap-2 flex-1 mr-2 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <input
                                type="text"
                                value={stg.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPDefaultStages(prev => prev.map((s, i) => i === idx ? { ...s, name: val } : s));
                                }}
                                className="bg-transparent border-b border-transparent hover:border-stone-300 focus:border-amber-500 focus:bg-white px-1 py-0.5 rounded font-bold text-xs min-w-0 flex-1"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => setPDefaultStages(prev => {
                                  const next = [...prev];
                                  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                  return next;
                                })}
                                className="text-stone-400 hover:text-amber-700 disabled:opacity-20 p-1"
                              >
                                <ChevronUp size={13} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === pDefaultStages.length - 1}
                                onClick={() => setPDefaultStages(prev => {
                                  const next = [...prev];
                                  [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                                  return next;
                                })}
                                className="text-stone-400 hover:text-amber-700 disabled:opacity-20 p-1"
                              >
                                <ChevronDown size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPDefaultStages(prev => prev.filter((_, i) => i !== idx))}
                                className="text-stone-400 hover:text-rose-600 p-1"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400 italic bg-stone-50 p-3 rounded-lg border border-stone-200/60">
                        No custom production stages added yet. Add below:
                      </p>
                    )}

                    {/* Quick presets */}
                    {reusableStages.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Quick Add Stages:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {reusableStages.filter(s => !pDefaultStages.some(stg => stg.name.toLowerCase() === s.toLowerCase())).map(preset => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                const newStage: ProductStageConfig = {
                                  id: `stg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                                  name: preset,
                                  isConditional: false
                                };
                                setPDefaultStages(prev => [...prev, newStage]);
                                if (onAddReusableStage) onAddReusableStage(preset);
                              }}
                              className="text-[11px] bg-white hover:bg-amber-50 text-stone-700 hover:text-amber-900 border border-stone-200 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 shadow-3xs"
                            >
                              <Plus size={11} /> {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add Stage Input */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="e.g. Sourcing Timber, Fine Sanding, Oil Finish"
                        value={newDefaultStageName}
                        onChange={(e) => setNewDefaultStageName(e.target.value)}
                        className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        disabled={!newDefaultStageName.trim()}
                        onClick={() => {
                          const trimmed = newDefaultStageName.trim();
                          if (trimmed) {
                            const newStage: ProductStageConfig = {
                              id: `stg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                              name: trimmed,
                              isConditional: false
                            };
                            setPDefaultStages(prev => [...prev, newStage]);
                            if (onAddReusableStage) onAddReusableStage(trimmed);
                            setNewDefaultStageName('');
                          }
                        }}
                        className="px-4 py-2 bg-amber-600 disabled:opacity-40 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Add Stage
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: INPUTS & COSTS */}
          {activeTab === 'costs' && (
            <div className="space-y-5">
              <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-4 shadow-3xs">
                <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                  <div>
                    <h4 className="font-extrabold text-stone-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Calculator size={16} className="text-amber-700" /> Material & Labour Inputs
                    </h4>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Add raw materials and artisan hours used to make 1 unit of this custom item.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-stone-200 shrink-0">
                      <Lock size={10} /> Internal Only
                    </span>
                    <button
                      type="button"
                      onClick={openAddInputModal}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-3xs cursor-pointer"
                    >
                      <Plus size={13} /> Add Input Item
                    </button>
                  </div>
                </div>

                {/* Input List */}
                {pInputs.length > 0 ? (
                  <div className="space-y-2">
                    {pInputs.map((inp, idx) => (
                      <div key={inp.id || idx} className="bg-stone-50 p-3 rounded-xl border border-stone-200/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 font-bold">
                            {inp.type === 'material' ? <Box size={14} /> : inp.type === 'labour' ? <Clock size={14} /> : <DollarSign size={14} />}
                          </div>
                          <div>
                            <span className="font-bold text-stone-800 block">{inp.name}</span>
                            <span className="text-[11px] text-stone-500 block">
                              {inp.type === 'material' && `${inp.amount} ${inp.unit}`}
                              {inp.type === 'labour' && `${inp.amount} ${inp.unit} @ ${formatZAR(inp.hourlyRate || 0)}/hr`}
                              {inp.type === 'direct' && 'Direct Input'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-stone-900">{formatZAR(inp.cost)}</span>
                          <button type="button" onClick={() => startEditInput(idx)} className="p-1 text-stone-400 hover:text-amber-700">
                            <Edit2 size={13} />
                          </button>
                          <button type="button" onClick={() => setPInputs(prev => prev.filter((_, i) => i !== idx))} className="p-1 text-stone-400 hover:text-rose-600">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-stone-50 p-6 rounded-xl border border-dashed border-stone-200 text-center space-y-2">
                    <p className="text-xs text-stone-500 font-medium">
                      No material or labor inputs added yet. Add inputs to calculate exact direct unit cost.
                    </p>
                    <button
                      type="button"
                      onClick={openAddInputModal}
                      className="px-3.5 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} /> Add Input Item
                    </button>
                  </div>
                )}

                {/* Financial Summary Card */}
                <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/80 space-y-3">
                  <span className="text-[11px] font-bold text-amber-900 block uppercase tracking-wider">
                    Calculated Financial Summary:
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center bg-white p-3 rounded-lg border border-amber-200/60 shadow-3xs">
                    <div>
                      <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider block">Calculated Cost</span>
                      <span className="text-xs font-extrabold text-stone-800">{formatZAR(calculatedBaseCost)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider block">Unit Price</span>
                      <span className="text-xs font-extrabold text-stone-800">{formatZAR(basePriceNum)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-amber-800 font-bold uppercase tracking-wider block">Est. Profit</span>
                      <span className={`text-xs font-black ${baseProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {formatZAR(baseProfit)} ({baseMargin.toFixed(0)}%)
                      </span>
                    </div>
                  </div>

                  {calculatedBaseCost > 0 && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const suggestedPrice = Math.round(calculatedBaseCost * 1.5 * 100) / 100;
                          setItemBasePrice(suggestedPrice);
                        }}
                        className="text-[11px] bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg transition shadow-3xs cursor-pointer flex items-center gap-1"
                      >
                        <Sparkles size={12} /> Apply Cost + 50% Margin (R{Math.round(calculatedBaseCost * 1.5)})
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer Bar */}
        <div className="px-5 py-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-stone-600">
            <span className="font-medium text-stone-400">Total ({itemQuantity} {itemQuantity === 1 ? 'unit' : 'units'}): </span>
            <strong className="text-stone-900 font-extrabold text-sm">{formatZAR(parsePrice(itemBasePrice) * itemQuantity)}</strong>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!itemName.trim()}
              onClick={handleSubmit}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <PlusCircle size={15} /> Add Custom Item
            </button>
          </div>
        </div>
      </div>

      {/* SUB-MODAL FOR ADDING INPUT ITEMS */}
      {isInputModalOpen && (
        <div className="fixed inset-0 z-60 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-md p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h4 className="font-extrabold text-stone-800 text-sm flex items-center gap-1.5">
                <Box size={16} className="text-amber-600" />
                {editingInputIdx !== null ? 'Edit Input Item' : 'Add Cost Input Item'}
              </h4>
              <button type="button" onClick={() => setIsInputModalOpen(false)} className="text-stone-400 hover:text-stone-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Input Type Selector */}
            <div className="flex bg-stone-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setNewInputType('material')}
                className={`flex-1 py-1.5 rounded-lg transition ${newInputType === 'material' ? 'bg-white text-stone-900 shadow-3xs' : 'text-stone-500'}`}
              >
                Material
              </button>
              <button
                type="button"
                onClick={() => setNewInputType('labour')}
                className={`flex-1 py-1.5 rounded-lg transition ${newInputType === 'labour' ? 'bg-white text-stone-900 shadow-3xs' : 'text-stone-500'}`}
              >
                Labour
              </button>
              <button
                type="button"
                onClick={() => setNewInputType('direct')}
                className={`flex-1 py-1.5 rounded-lg transition ${newInputType === 'direct' ? 'bg-white text-stone-900 shadow-3xs' : 'text-stone-500'}`}
              >
                Direct Expense
              </button>
            </div>

            {/* Material Fields */}
            {newInputType === 'material' && (
              <div className="space-y-3">
                {materials.length > 0 ? (
                  <div>
                    <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Select Material *</label>
                    <select
                      value={selectedMaterialId}
                      onChange={e => {
                        setSelectedMaterialId(e.target.value);
                        const mat = materials.find(m => m.id === e.target.value);
                        if (mat) setInputUnit(mat.unit || 'g');
                      }}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium"
                    >
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.unit ? `cost/${m.unit}` : ''}) — R{getMaterialUnitCost(m).toFixed(2)}/{m.unit || 'unit'}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-xs text-rose-500">No materials in inventory yet. Add materials in Materials tab first.</p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Amount</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={inputAmount}
                      onChange={e => setInputAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Unit</label>
                    <select
                      value={inputUnit}
                      onChange={e => setInputUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium"
                    >
                      {COMMON_UNITS.map(u => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Labour Fields */}
            {newInputType === 'labour' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Task / Artisan Role *</label>
                  <input
                    type="text"
                    value={labourName}
                    onChange={e => setLabourName(e.target.value)}
                    placeholder="e.g. Master Carpentry, Hand Stitching"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Time</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={labourTimeAmount}
                      onChange={e => setLabourTimeAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Unit</label>
                    <select
                      value={labourTimeUnit}
                      onChange={e => setLabourTimeUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium"
                    >
                      <option value="mins">Minutes</option>
                      <option value="hrs">Hours</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Rate (R/hr)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={labourHourlyRate}
                      onChange={e => setLabourHourlyRate(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Direct Expense Fields */}
            {newInputType === 'direct' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Expense Name *</label>
                  <input
                    type="text"
                    value={directInputName}
                    onChange={e => setDirectInputName(e.target.value)}
                    placeholder="e.g. Special Courier, Hardware Fitting"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Cost Amount (R) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={directInputCost}
                    onChange={e => setDirectInputCost(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>
            )}

            {/* Sub-modal Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-stone-100 justify-end">
              <button
                type="button"
                onClick={() => setIsInputModalOpen(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveInputItem}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Save Input Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
