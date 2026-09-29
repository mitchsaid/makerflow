import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, Tag, Layers, Check, X, ShieldAlert, 
  HelpCircle, ToggleLeft, ToggleRight, Sparkles, FolderPlus, DollarSign, Image as ImageIcon, Package,
  Search, PlusCircle, ListTodo, Clock, Calculator, TrendingUp, Box, Info, Lock,
  ChevronDown, ChevronUp, GripVertical, Sliders, Zap
} from 'lucide-react';
import { Product, ProductGroup, CustomizationOption, PriceBreak, CustomizationOptionValue, Material, ProductInput, InputType, ProductStageConfig, StageCondition } from '../types';
import { calculateMaterialInputCost, calculateLabourInputCost, calculateProductBaseUnitCost, calculateProductOptionExtraCost, isInputBase, isInputMatchingOptionValue, COMMON_UNITS, getMaterialUnitCost, getStageConditionSummary } from '../lib/costUtils';
import { getProductPhotoUrl, handleImageError } from '../lib/imageUtils';

interface ProductsProps {
  products: Product[];
  services?: Product[];
  groups: ProductGroup[];
  materials?: Material[];
  defaultTab?: 'products' | 'services' | 'groups';
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onAddService?: (service: Omit<Product, 'id'>) => void;
  onUpdateService?: (service: Product) => void;
  onDeleteService?: (id: string) => void;
  onAddGroup: (group: Omit<ProductGroup, 'id'>) => ProductGroup;
  onUpdateGroup: (group: ProductGroup) => void;
  onDeleteGroup: (id: string) => void;
  initialEditProductId?: string | null;
  onClearInitialEditProductId?: () => void;
  startInAddMode?: boolean;
  onResetStartInAddMode?: () => void;
  reusableStages?: string[];
  onAddReusableStage?: (stageName: string) => void;
}

interface VariationScopeSelectorProps {
  customizations: CustomizationOption[];
  selectedKeys: string[];
  onChange: (newKeys: string[]) => void;
  label?: string;
}

function VariationScopeSelector({
  customizations,
  selectedKeys,
  onChange,
  label = 'Applies To'
}: VariationScopeSelectorProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [showCustomPicker, setShowCustomPicker] = useState<boolean>(selectedKeys.length > 0);

  useEffect(() => {
    if (selectedKeys.length > 0 && !showCustomPicker) {
      setShowCustomPicker(true);
    }
  }, [selectedKeys]);

  const toggleCategoryExpand = (catName: string) => {
    setExpandedCategories(prev => ({ ...prev, [catName]: !(prev[catName] ?? false) }));
  };

  const isCategoryFullySelected = (opt: CustomizationOption) => {
    const catKeys = opt.values.map(v => `${opt.name}:::${v.value}`);
    return catKeys.length > 0 && catKeys.every(k => selectedKeys.includes(k));
  };

  const isCategoryPartiallySelected = (opt: CustomizationOption) => {
    const catKeys = opt.values.map(v => `${opt.name}:::${v.value}`);
    const count = catKeys.filter(k => selectedKeys.includes(k)).length;
    return count > 0 && count < catKeys.length;
  };

  const toggleCategoryAll = (opt: CustomizationOption) => {
    const catKeys = opt.values.map(v => `${opt.name}:::${v.value}`);
    const fullySelected = isCategoryFullySelected(opt);

    let updated = [...selectedKeys];
    if (fullySelected) {
      updated = updated.filter(k => !catKeys.includes(k));
    } else {
      catKeys.forEach(k => {
        if (!updated.includes(k)) updated.push(k);
      });
    }
    onChange(updated);
  };

  const toggleSingleValue = (optName: string, valStr: string) => {
    const key = `${optName}:::${valStr}`;
    let updated = [...selectedKeys];
    if (updated.includes(key)) {
      updated = updated.filter(k => k !== key);
    } else {
      updated.push(key);
    }
    onChange(updated);
  };

  const isBase = selectedKeys.length === 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="text-xs font-bold text-stone-700">
          {label}:
        </label>

        {customizations.length > 0 ? (
          <div className="flex items-center gap-1 p-0.5 bg-stone-100 rounded-lg border border-stone-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setShowCustomPicker(false);
                onChange([]);
              }}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                isBase && !showCustomPicker
                  ? 'bg-amber-700 text-white shadow-3xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Base Product (All Variations)
            </button>
            <button
              type="button"
              onClick={() => setShowCustomPicker(true)}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                showCustomPicker || !isBase
                  ? 'bg-amber-700 text-white shadow-3xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Specific Variations {selectedKeys.length > 0 ? `(${selectedKeys.length})` : ''}
            </button>
          </div>
        ) : (
          <span className="text-xs font-semibold text-stone-500">Base Product (All Variations)</span>
        )}
      </div>

      {/* Default/Base State */}
      {(isBase && !showCustomPicker) || customizations.length === 0 ? (
        <div className="bg-stone-50/80 px-3.5 py-2.5 rounded-xl border border-stone-200/80 text-xs text-stone-600">
          {customizations.length === 0 ? (
            <p className="text-[11px] text-stone-500">
              Applies to <strong>all sales</strong> of this product (no variation options configured).
            </p>
          ) : (
            <p className="text-[11px] text-stone-500">
              Applies to <strong>all variations</strong> of this product.
            </p>
          )}
        </div>
      ) : (
        /* Accordion Category Selector */
        <div className="bg-white rounded-xl border border-stone-200/90 overflow-hidden divide-y divide-stone-100 text-xs shadow-3xs">
          {customizations.map(opt => {
            const fullySelected = isCategoryFullySelected(opt);
            const partiallySelected = isCategoryPartiallySelected(opt);
            const isExpanded = expandedCategories[opt.name] ?? false;
            const catKeys = opt.values.map(v => `${opt.name}:::${v.value}`);
            const selectedInCatCount = catKeys.filter(k => selectedKeys.includes(k)).length;

            return (
              <div key={opt.name} className="bg-stone-50/30">
                {/* Accordion Row Header */}
                <div className="p-2.5 flex items-center justify-between hover:bg-stone-100/50 transition">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCategoryAll(opt)}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition cursor-pointer shrink-0 ${
                        fullySelected
                          ? 'bg-amber-700 border-amber-800 text-white'
                          : partiallySelected
                          ? 'bg-amber-100 border-amber-600 text-amber-800'
                          : 'bg-white border-stone-300 hover:border-amber-400'
                      }`}
                      title={fullySelected ? `Deselect all in ${opt.name}` : `Select all in ${opt.name}`}
                    >
                      {fullySelected && <Check size={12} className="stroke-[3]" />}
                      {!fullySelected && partiallySelected && <span className="w-2 h-0.5 bg-amber-800 rounded"></span>}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleCategoryExpand(opt.name)}
                      className="font-bold text-stone-800 text-xs hover:text-amber-800 flex items-center gap-1.5 cursor-pointer text-left"
                    >
                      <span>{opt.name}</span>
                      <span className="text-[10px] text-stone-400 font-normal">
                        ({selectedInCatCount}/{opt.values.length} selected)
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCategoryAll(opt)}
                      className="text-[10px] font-bold text-amber-800 hover:bg-amber-50 px-2 py-0.5 rounded transition cursor-pointer"
                    >
                      {fullySelected ? 'Deselect All' : 'Select All'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCategoryExpand(opt.name)}
                      className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Choices List */}
                {isExpanded && (
                  <div className="p-2.5 bg-white border-t border-stone-100 pl-8 flex flex-wrap gap-1.5">
                    {opt.values.map(v => {
                      const key = `${opt.name}:::${v.value}`;
                      const isSelected = selectedKeys.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleSingleValue(opt.name, v.value)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border cursor-pointer ${
                            isSelected
                              ? 'bg-amber-700 text-white border-amber-800 shadow-2xs'
                              : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-amber-50 hover:border-amber-300'
                          }`}
                        >
                          <Check size={11} className={isSelected ? 'opacity-100' : 'opacity-0'} />
                          {v.value} {v.priceUplift > 0 ? `(+R${v.priceUplift})` : ''}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Footer Info */}
          <div className="px-3 py-2 bg-stone-50 text-[11px] text-stone-500 flex items-center justify-between border-t border-stone-200/60">
            <span>
              {selectedKeys.length === 0
                ? 'Applies to base product (all variations).'
                : `Applies to ${selectedKeys.length} selected variation option(s).`}
            </span>
            <button
              type="button"
              onClick={() => {
                setShowCustomPicker(false);
                onChange([]);
              }}
              className="text-stone-600 font-bold hover:text-stone-900 underline cursor-pointer"
            >
              Reset to Base
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Products({
  products,
  services = [],
  groups,
  materials = [],
  defaultTab = 'products',
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAddService,
  onUpdateService,
  onDeleteService,
  onAddGroup,
  onUpdateGroup,
  onDeleteGroup,
  initialEditProductId,
  onClearInitialEditProductId,
  startInAddMode,
  onResetStartInAddMode,
  reusableStages = [],
  onAddReusableStage
}: ProductsProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'services' | 'groups'>(defaultTab);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);
  const [editFormTab, setEditFormTab] = useState<'details' | 'stages' | 'costs'>('details');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ProductGroup | null>(null);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<ProductGroup | null>(null);

  // Auto-add product if startInAddMode is specified
  useEffect(() => {
    if (startInAddMode) {
      setActiveTab('products');
      startAddProduct();
      if (onResetStartInAddMode) {
        onResetStartInAddMode();
      }
    }
  }, [startInAddMode]);

  // Auto-edit product if initialEditProductId is specified
  useEffect(() => {
    if (initialEditProductId) {
      const prod = products.find(p => p.id === initialEditProductId);
      if (prod) {
        setActiveTab('products');
        startEditProduct(prod);
      }
      if (onClearInitialEditProductId) {
        onClearInitialEditProductId();
      }
    }
  }, [initialEditProductId, products]);

  const parsePrice = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const normalized = String(val).replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Group Form state
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupDiscount, setGroupDiscount] = useState<number | string>(0);

  // Product Form state
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pPhoto, setPPhoto] = useState('');
  const [pBasePrice, setPBasePrice] = useState<number | string>(100);
  const [pStockQuantity, setPStockQuantity] = useState<number>(0);
  const [pIsActive, setPIsActive] = useState(true);
  const [pGroupId, setPGroupId] = useState('');
  
  // Complexity toggles (Optional fields)
  const [hasPriceBreaks, setHasPriceBreaks] = useState(false);

  // Temporary schedules built during product edit/add
  const [tempPriceBreaks, setTempPriceBreaks] = useState<PriceBreak[]>([]);
  const [tempCustomizations, setTempCustomizations] = useState<CustomizationOption[]>([]);

  // Helpers for Price Breaks
  const [newBreakMin, setNewBreakMin] = useState<number>(1);
  const [newBreakMax, setNewBreakMax] = useState<string>('');
  const [newBreakPrice, setNewBreakPrice] = useState<number | string>(100);

  // Price Break Edit State
  const [editingBreakIndex, setEditingBreakIndex] = useState<number | null>(null);
  const [editBreakMin, setEditBreakMin] = useState<number>(1);
  const [editBreakMax, setEditBreakMax] = useState<string>('');
  const [editBreakPrice, setEditBreakPrice] = useState<number | string>(100);

  // Helpers for Product Variations
  const [newVarName, setNewVarName] = useState('');
  const [newVarRequired, setNewVarRequired] = useState(false);
  const [newVarValText, setNewVarValText] = useState('');
  const [newVarValUplift, setNewVarValUplift] = useState<number | string>(0);
  const [newVarValPhoto, setNewVarValPhoto] = useState('');
  const [tempVarValues, setTempVarValues] = useState<CustomizationOptionValue[]>([]);
  const [showAddVar, setShowAddVar] = useState(false);

  // Helpers for Optional Extras
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraRequired, setNewExtraRequired] = useState(false);
  const [newExtraValText, setNewExtraValText] = useState('');
  const [newExtraValUplift, setNewExtraValUplift] = useState<number | string>(0);
  const [newExtraValPhoto, setNewExtraValPhoto] = useState('');
  const [tempExtraValues, setTempExtraValues] = useState<CustomizationOptionValue[]>([]);
  const [showAddExtra, setShowAddExtra] = useState(false);

  // Customization Option Edit State (for Variations and Extras)
  const [editingOptIndex, setEditingOptIndex] = useState<number | null>(null);
  const [editOptName, setEditOptName] = useState('');
  const [editOptValues, setEditOptValues] = useState<CustomizationOptionValue[]>([]);
  const [editValText, setEditValText] = useState('');
  const [editValUplift, setEditValUplift] = useState<number | string>(0);
  const [editValPhoto, setEditValPhoto] = useState('');

  // Default Production Stages & Tracking Mode state
  const [pTrackingMode, setPTrackingMode] = useState<'whole' | 'stages'>('whole');
  const [pDefaultStages, setPDefaultStages] = useState<ProductStageConfig[]>([]);
  const [expandedStageIndex, setExpandedStageIndex] = useState<number | null>(null);
  const [newDefaultStageName, setNewDefaultStageName] = useState('');
  const [draggedStageIdx, setDraggedStageIdx] = useState<number | null>(null);

  // Product Inputs state
  const [pInputs, setPInputs] = useState<ProductInput[]>([]);
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
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [editingInputIdx, setEditingInputIdx] = useState<number | null>(null);

  const formatZAR = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
  };

  // Handle Photo Upload
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Initialize form for adding a product
  const startAddProduct = () => {
    setPName('');
    setPDesc('');
    setPPhoto(''); // Don't show a default thumbnail
    setPBasePrice(100);
    setPStockQuantity(0);
    setPIsActive(true);
    setPGroupId('');
    setHasPriceBreaks(false);
    setTempPriceBreaks([]);
    setTempCustomizations([]);

    // Reset Variation states
    setNewVarName('');
    setNewVarRequired(false);
    setNewVarValText('');
    setNewVarValUplift(0);
    setTempVarValues([]);
    setShowAddVar(false);

    // Reset Extra states
    setNewExtraName('');
    setNewExtraRequired(false);
    setNewExtraValText('');
    setNewExtraValUplift(0);
    setTempExtraValues([]);
    setShowAddExtra(false);

    // Reset Editing states
    setEditingOptIndex(null);
    setEditingBreakIndex(null);
    setEditOptName('');
    setEditOptValues([]);
    setEditValText('');
    setEditValUplift(0);

    // Default Stages & Tracking Mode
    setPTrackingMode('whole');
    setPDefaultStages([]);
    setNewDefaultStageName('');

    // Inputs
    setPInputs([]);
    setNewInputType('material');
    setNewInputTargetKeys([]);
    setTestVariationSelection({});
    if (materials.length > 0) {
      setSelectedMaterialId(materials[0].id);
      setInputUnit(materials[0].unit || 'g');
    }

    setIsAddingProduct(true);
    setEditingProduct(null);
    setEditFormTab('details');
  };

  // Initialize form for editing a product
  const startEditProduct = (p: Product) => {
    setEditingProduct(p);
    setEditFormTab('details');
    setPName(p.name);
    setPDesc(p.description);
    setPPhoto(p.photo || '');
    setPBasePrice(p.basePrice);
    setPStockQuantity(p.stockQuantity ?? 0);
    setPIsActive(p.isActive);
    setPGroupId(p.groupId || '');
    setHasPriceBreaks(p.priceBreaks.length > 1 || (p.priceBreaks.length === 1 && p.priceBreaks[0].unitPrice !== p.basePrice));
    setTempPriceBreaks(p.priceBreaks);
    setTempCustomizations(p.customizationOptions || []);

    // Reset Variation states
    setNewVarName('');
    setNewVarRequired(false);
    setNewVarValText('');
    setNewVarValUplift(0);
    setTempVarValues([]);
    setShowAddVar(false);

    // Reset Extra states
    setNewExtraName('');
    setNewExtraRequired(false);
    setNewExtraValText('');
    setNewExtraValUplift(0);
    setTempExtraValues([]);
    setShowAddExtra(false);

    // Reset Editing states
    setEditingOptIndex(null);
    setEditingBreakIndex(null);
    setEditOptName('');
    setEditOptValues([]);
    setEditValText('');
    setEditValUplift(0);

    // Default Stages & Tracking Mode
    const initialTrackingMode = p.trackingMode || (p.defaultStages && p.defaultStages.length > 0 ? 'stages' : 'whole');
    setPTrackingMode(initialTrackingMode);
    const normalizedStages: ProductStageConfig[] = (p.defaultStages || []).map((stg, idx) => {
      if (typeof stg === 'string') {
        return {
          id: `stg_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
          name: stg,
          isConditional: false,
          conditionLogic: 'AND',
          conditions: []
        };
      }
      const rawConditions: StageCondition[] = (stg.conditions && stg.conditions.length > 0)
        ? stg.conditions
        : (stg.condition ? [stg.condition] : []);
      return {
        ...stg,
        id: stg.id || `stg_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
        isConditional: !!stg.isConditional,
        conditionLogic: stg.conditionLogic || 'AND',
        conditions: rawConditions,
        condition: rawConditions[0] || stg.condition
      };
    });
    setPDefaultStages(normalizedStages);
    setExpandedStageIndex(null);
    setNewDefaultStageName('');

    // Inputs
    setPInputs(p.inputs || []);
    setNewInputType('material');
    setNewInputTargetKeys([]);
    setTestVariationSelection({});
    if (materials.length > 0) {
      setSelectedMaterialId(materials[0].id);
      setInputUnit(materials[0].unit || 'g');
    }

    setIsAddingProduct(false);
  };

  const openAddInputModal = () => {
    setEditingInputIdx(null);
    setNewInputType('material');
    setNewInputTargetKeys([]);
    setLabourName('');
    setLabourHourlyRate(120);
    setLabourTimeAmount(15);
    setLabourTimeUnit('mins');
    setDirectInputName('');
    setDirectInputCost(0);
    if (materials.length > 0) {
      setSelectedMaterialId(materials[0].id);
      setInputUnit(materials[0].unit || 'g');
    }
    setIsInputModalOpen(true);
  };

  const startEditInput = (idx: number) => {
    const inp = pInputs[idx];
    if (!inp) return;
    setEditingInputIdx(idx);
    setNewInputType(inp.type);
    const keys = inp.applicableValueKeys || (inp.optionName && inp.optionValue ? [`${inp.optionName}:::${inp.optionValue}`] : []);
    setNewInputTargetKeys(keys);

    if (inp.type === 'material') {
      if (inp.materialId) setSelectedMaterialId(inp.materialId);
      setInputAmount(inp.amount || 1);
      setInputUnit(inp.unit || 'g');
    } else if (inp.type === 'labour') {
      setLabourName(inp.name);
      setLabourHourlyRate(inp.hourlyRate || 0);
      setLabourTimeAmount(inp.amount || 0);
      setLabourTimeUnit(inp.unit || 'mins');
    } else {
      setDirectInputName(inp.name);
      setDirectInputCost(inp.cost || 0);
    }
    setIsInputModalOpen(true);
  };

  const handleAddInputToProduct = () => {
    const hasKeys = newInputTargetKeys.length > 0;
    const targetKeys = hasKeys ? [...newInputTargetKeys] : undefined;
    const firstOptName = hasKeys ? newInputTargetKeys[0].split(':::')[0] : undefined;
    const firstOptVal = hasKeys ? newInputTargetKeys[0].split(':::')[1] : undefined;

    const existingId = editingInputIdx !== null ? pInputs[editingInputIdx]?.id : undefined;
    const idToUse = existingId || ('inp_' + Date.now());

    let newInput: ProductInput;
    if (newInputType === 'material') {
      const mat = materials.find(m => m.id === selectedMaterialId) || materials[0];
      if (!mat) return;
      const amt = Math.max(0.0001, Number(inputAmount) || 1);
      const calculatedCost = calculateMaterialInputCost(mat, amt, inputUnit);
      newInput = {
        id: idToUse,
        type: 'material',
        name: mat.name,
        materialId: mat.id,
        amount: amt,
        unit: inputUnit || mat.unit,
        cost: Number(calculatedCost.toFixed(2)),
        applicableValueKeys: targetKeys,
        optionName: firstOptName,
        optionValue: firstOptVal
      };
    } else if (newInputType === 'labour') {
      const nameTxt = labourName.trim() || 'Labour';
      const timeAmt = Math.max(0, Number(labourTimeAmount) || 0);
      const hRate = Math.max(0, Number(labourHourlyRate) || 0);
      const calculatedCost = calculateLabourInputCost(timeAmt, labourTimeUnit, hRate);
      newInput = {
        id: idToUse,
        type: 'labour',
        name: nameTxt,
        amount: timeAmt,
        unit: labourTimeUnit,
        hourlyRate: hRate,
        cost: Number(calculatedCost.toFixed(2)),
        applicableValueKeys: targetKeys,
        optionName: firstOptName,
        optionValue: firstOptVal
      };
    } else {
      if (!directInputName.trim()) return;
      const costVal = Math.max(0, Number(directInputCost) || 0);
      newInput = {
        id: idToUse,
        type: 'direct',
        name: directInputName.trim(),
        amount: 1,
        cost: costVal,
        applicableValueKeys: targetKeys,
        optionName: firstOptName,
        optionValue: firstOptVal
      };
    }

    if (editingInputIdx !== null) {
      setPInputs(prev => prev.map((item, idx) => idx === editingInputIdx ? newInput : item));
    } else {
      setPInputs(prev => [...prev, newInput]);
    }

    setIsInputModalOpen(false);
    setEditingInputIdx(null);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName) return;

    const numBasePrice = parsePrice(pBasePrice);

    // Build the price breaks
    let finalBreaks = tempPriceBreaks;
    if (!hasPriceBreaks || finalBreaks.length === 0) {
      finalBreaks = [{ minQty: 1, maxQty: undefined, unitPrice: numBasePrice }];
    }

    const productPayload = {
      name: pName,
      description: pDesc,
      photo: pPhoto,
      basePrice: numBasePrice,
      stockQuantity: pStockQuantity,
      isActive: pIsActive,
      groupId: pGroupId || undefined,
      priceBreaks: finalBreaks,
      customizationOptions: tempCustomizations,
      trackingMode: pTrackingMode,
      defaultStages: (pTrackingMode === 'stages' && pDefaultStages.length > 0) ? pDefaultStages : undefined,
      inputs: pInputs.length > 0 ? pInputs : undefined
    };

    if (activeTab === 'services') {
      if (editingProduct) {
        if (onUpdateService) {
          onUpdateService({ ...editingProduct, ...productPayload });
        } else {
          onUpdateProduct({ ...editingProduct, ...productPayload });
        }
      } else {
        if (onAddService) {
          onAddService(productPayload);
        } else {
          onAddProduct(productPayload);
        }
      }
    } else {
      if (editingProduct) {
        onUpdateProduct({
          ...editingProduct,
          ...productPayload
        });
      } else {
        onAddProduct(productPayload);
      }
    }

    setIsAddingProduct(false);
    setEditingProduct(null);
  };

  // Price Break Temp Helpers
  const addPriceBreakToTemp = () => {
    const maxVal = newBreakMax.trim() === '' ? undefined : parseInt(newBreakMax);
    const newBreak: PriceBreak = {
      minQty: newBreakMin,
      maxQty: maxVal,
      unitPrice: parsePrice(newBreakPrice)
    };
    // Keep sorted by minQty
    setTempPriceBreaks(prev => [...prev, newBreak].sort((a, b) => a.minQty - b.minQty));
    setNewBreakMin(newBreakMin + 1);
    setNewBreakMax('');
  };

  const removePriceBreakFromTemp = (index: number) => {
    if (editingBreakIndex === index) cancelEditBreak();
    setTempPriceBreaks(prev => prev.filter((_, idx) => idx !== index));
  };

  const startEditBreak = (idx: number) => {
    const pb = tempPriceBreaks[idx];
    if (!pb) return;
    setEditingBreakIndex(idx);
    setEditBreakMin(pb.minQty);
    setEditBreakMax(pb.maxQty !== undefined ? String(pb.maxQty) : '');
    setEditBreakPrice(pb.unitPrice);
  };

  const cancelEditBreak = () => {
    setEditingBreakIndex(null);
    setEditBreakMin(1);
    setEditBreakMax('');
    setEditBreakPrice(100);
  };

  const saveEditBreak = (idx: number) => {
    const maxVal = editBreakMax.trim() === '' ? undefined : parseInt(editBreakMax);
    setTempPriceBreaks(prev => {
      const updated = [...prev];
      updated[idx] = {
        minQty: editBreakMin,
        maxQty: maxVal,
        unitPrice: parsePrice(editBreakPrice)
      };
      return updated.sort((a, b) => a.minQty - b.minQty);
    });
    cancelEditBreak();
  };

  // Customization Option Temp Helpers (Product Variations)
  const addVarValue = () => {
    if (!newVarValText.trim()) return;
    setTempVarValues(prev => [...prev, { value: newVarValText.trim(), priceUplift: parsePrice(newVarValUplift), photo: newVarValPhoto || undefined }]);
    setNewVarValText('');
    setNewVarValUplift(0);
    setNewVarValPhoto('');
  };

  const removeVarValue = (index: number) => {
    setTempVarValues(prev => prev.filter((_, idx) => idx !== index));
  };

  const saveVariationOption = () => {
    if (!newVarName.trim() || tempVarValues.length === 0) return;
    const newOpt: CustomizationOption = {
      name: newVarName,
      isRequired: false,
      values: tempVarValues,
      type: 'variation'
    };
    setTempCustomizations(prev => [...prev, newOpt]);
    setNewVarName('');
    setNewVarRequired(false);
    setTempVarValues([]);
    setNewVarValPhoto('');
    setShowAddVar(false);
  };

  // Customization Option Temp Helpers (Optional Extras)
  const addExtraValue = () => {
    if (!newExtraValText.trim()) return;
    setTempExtraValues(prev => [...prev, { value: newExtraValText.trim(), priceUplift: parsePrice(newExtraValUplift), photo: newExtraValPhoto || undefined }]);
    setNewExtraValText('');
    setNewExtraValUplift(0);
    setNewExtraValPhoto('');
  };

  const removeExtraValue = (index: number) => {
    setTempExtraValues(prev => prev.filter((_, idx) => idx !== index));
  };

  const saveExtraOption = () => {
    if (!newExtraName.trim() || tempExtraValues.length === 0) return;
    const newOpt: CustomizationOption = {
      name: newExtraName,
      isRequired: false,
      values: tempExtraValues,
      type: 'extra'
    };
    setTempCustomizations(prev => [...prev, newOpt]);
    setNewExtraName('');
    setNewExtraRequired(false);
    setTempExtraValues([]);
    setNewExtraValPhoto('');
    setShowAddExtra(false);
  };

  const removeCustomOption = (index: number) => {
    if (editingOptIndex === index) cancelEditOpt();
    setTempCustomizations(prev => prev.filter((_, idx) => idx !== index));
  };

  // Customization Option Edit Helpers (Variations and Extras)
  const startEditOpt = (optIdx: number) => {
    const opt = tempCustomizations[optIdx];
    if (!opt) return;
    setEditingOptIndex(optIdx);
    setEditOptName(opt.name);
    setEditOptValues(opt.values.map(v => ({ ...v })));
    setEditValText('');
    setEditValUplift(0);
    setEditValPhoto('');
  };

  const cancelEditOpt = () => {
    setEditingOptIndex(null);
    setEditOptName('');
    setEditOptValues([]);
    setEditValText('');
    setEditValUplift(0);
    setEditValPhoto('');
  };

  const saveEditOpt = (optIdx: number) => {
    if (!editOptName.trim() || editOptValues.length === 0) return;
    setTempCustomizations(prev => {
      const updated = [...prev];
      updated[optIdx] = {
        ...updated[optIdx],
        name: editOptName.trim(),
        values: editOptValues
      };
      return updated;
    });
    cancelEditOpt();
  };

  // Groups actions
  const startAddGroup = () => {
    setGroupName('');
    setGroupDesc('');
    setGroupDiscount(0);
    setIsAddingGroup(true);
    setEditingGroup(null);
  };

  const startEditGroup = (g: ProductGroup) => {
    setEditingGroup(g);
    setGroupName(g.name);
    setGroupDesc(g.description);
    setGroupDiscount(g.bulkDiscountPercentage || 0);
    setIsAddingGroup(false);
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName) return;

    const numericDiscount = parsePrice(groupDiscount);
    if (editingGroup) {
      onUpdateGroup({
        id: editingGroup.id,
        name: groupName,
        description: groupDesc,
        bulkDiscountPercentage: numericDiscount > 0 ? numericDiscount : undefined
      });
    } else {
      onAddGroup({
        name: groupName,
        description: groupDesc,
        bulkDiscountPercentage: numericDiscount > 0 ? numericDiscount : undefined
      });
    }
    setIsAddingGroup(false);
    setEditingGroup(null);
  };

  const currentList = activeTab === 'services' ? services : products;
  const filteredProducts = currentList.filter(p => {
    if (!productSearchTerm.trim()) return true;
    const q = productSearchTerm.toLowerCase();
    const group = groups.find(g => g.id === p.groupId);
    return p.name.toLowerCase().includes(q) ||
           p.description.toLowerCase().includes(q) ||
           (group && group.name.toLowerCase().includes(q));
  });

  const filteredGroups = groups.filter(g => {
    if (!productSearchTerm.trim()) return true;
    const q = productSearchTerm.toLowerCase();
    return g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 pb-12" id="products-tab-container">
      {/* Top Bar / Header */}
      {!isAddingProduct && !editingProduct && !isAddingGroup && !editingGroup && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
          <h2 className="text-lg font-bold text-stone-800">
            {defaultTab === 'services' ? 'Services' : 'Products'}
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-stone-400" size={14} />
              <input
                type="text"
                placeholder={defaultTab === 'services' ? 'Search services...' : 'Search products or groups...'}
                value={productSearchTerm}
                onChange={e => setProductSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
              />
              {productSearchTerm && (
                <button
                  onClick={() => setProductSearchTerm('')}
                  className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {activeTab === 'products' && (
              <button
                onClick={startAddProduct}
                className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition shrink-0"
              >
                <PlusCircle size={14} /> Add Product
              </button>
            )}
            {activeTab === 'services' && (
              <button
                onClick={startAddProduct}
                className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition shrink-0"
              >
                <PlusCircle size={14} /> Add Service
              </button>
            )}
            {activeTab === 'groups' && (
              <button
                onClick={startAddGroup}
                className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition shrink-0"
              >
                <PlusCircle size={14} /> Create Group
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab Navigation - Only shown for Products section */}
      {defaultTab !== 'services' && (
        <div className="flex items-center justify-between border-b border-stone-200">
          <div className="flex gap-4">
            <button
              onClick={() => { setActiveTab('products'); setIsAddingProduct(false); setEditingProduct(null); }}
              className={`pb-2.5 -mb-px font-bold text-sm border-b-2 transition cursor-pointer ${
                activeTab === 'products' ? 'border-amber-600 text-amber-800 font-extrabold' : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              Products ({products.length})
            </button>
            <button
              onClick={() => { setActiveTab('groups'); setIsAddingGroup(false); setEditingGroup(null); }}
              className={`pb-2.5 -mb-px font-bold text-sm border-b-2 transition cursor-pointer ${
                activeTab === 'groups' ? 'border-amber-600 text-amber-800 font-extrabold' : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              Product Groups ({groups.length})
            </button>
          </div>
        </div>
      )}

      {/* PRODUCTS OR SERVICES TAB */}
      {(activeTab === 'products' || activeTab === 'services') && (
        <>
          {/* Add / Edit Form */}
          {(isAddingProduct || editingProduct) && (
            <form onSubmit={handleSaveProduct} className="bg-stone-50/50 rounded-2xl border border-stone-200 shadow-sm overflow-hidden space-y-0">
              <div className="bg-white border-b border-stone-200">
                <div className="flex items-center justify-between p-5 sm:p-6 pb-2">
                  <h3 className="font-bold text-stone-800 text-lg">
                    {editingProduct 
                      ? `Edit ${editingProduct.name}` 
                      : (activeTab === 'services' ? 'Add New Service' : 'Add New Craft Product')}
                  </h3>
                  <button
                    type="button"
                    onClick={() => { setIsAddingProduct(false); setEditingProduct(null); }}
                    className="text-stone-400 hover:text-stone-600 cursor-pointer p-1 hover:bg-stone-100 rounded-lg transition"
                    title="Close form"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Edit Product Tabs */}
                <div className="flex items-center gap-6 text-sm font-bold px-5 sm:px-6">
                  <button
                    type="button"
                    onClick={() => setEditFormTab('details')}
                    className={`pb-2.5 -mb-px border-b-2 transition cursor-pointer ${
                      editFormTab === 'details'
                        ? 'border-amber-600 text-amber-800 font-extrabold'
                        : 'border-transparent text-stone-500 hover:text-stone-800 font-semibold'
                    }`}
                  >
                    Core Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditFormTab('stages')}
                    className={`pb-2.5 -mb-px border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                      editFormTab === 'stages'
                        ? 'border-amber-600 text-amber-800 font-extrabold'
                        : 'border-transparent text-stone-500 hover:text-stone-800 font-semibold'
                    }`}
                  >
                    Production Process
                    {pTrackingMode === 'stages' && pDefaultStages.length > 0 && (
                      <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">
                        {pDefaultStages.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditFormTab('costs')}
                    className={`pb-2.5 -mb-px border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                      editFormTab === 'costs'
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

              {/* Form Content Body */}
              <div className="p-5 sm:p-6 space-y-6">

              {/* Form Tab Content - Edge to Edge */}
              {editFormTab === 'details' && (
                <div className="space-y-6 w-full">
                {/* Product Name */}
                <div>
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={pName}
                    onChange={e => setPName(e.target.value)}
                    placeholder="e.g. Kalahari Leather Satchel"
                    className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-normal"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Description</label>
                  <textarea
                    value={pDesc}
                    onChange={e => setPDesc(e.target.value)}
                    rows={3}
                    placeholder="Describe the materials, handcrafting story, care instructions..."
                    className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-normal"
                  />
                </div>

                {/* Photo upload / preview */}
                <div className="bg-white p-4 rounded-xl border border-stone-200/60 shadow-xs">
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Photo</label>
                  <div className="flex items-center gap-4">
                    {pPhoto && (
                      <img 
                        src={pPhoto} 
                        alt="Preview" 
                        className="w-16 h-16 object-cover rounded-xl border border-stone-200 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="text-xs text-stone-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-normal file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 cursor-pointer w-full"
                      />
                      <span className="text-[10px] text-stone-400 block mt-1 leading-relaxed">Upload a photo. Appears beautifully in quotes and tax invoices.</span>
                    </div>
                  </div>
                </div>

                {/* Product Group */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Product Group</label>
                  <select
                    value={pGroupId}
                    onChange={e => setPGroupId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-normal"
                  >
                    <option value="">None (Standalone)</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-stone-500 font-medium leading-relaxed">
                    ℹ️ Products in the same group can share bulk pricing and extras.
                  </p>
                </div>

                {/* Base Retail Price */}
                <div className="bg-white p-4 rounded-xl border border-stone-200/60 shadow-xs">
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Base Retail Price (ZAR) *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs">R</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={pBasePrice}
                      onChange={e => setPBasePrice(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-normal"
                    />
                  </div>
                </div>

                {/* Add bulk pricing - Placed under the base price */}
                <div className="border border-stone-200 rounded-xl p-4 bg-white shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs font-bold text-stone-700 block">Add bulk pricing</span>
                      <span className="text-[10px] text-stone-400 block">Offer bulk discounts per tier</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHasPriceBreaks(!hasPriceBreaks)}
                      className="text-amber-600 hover:text-amber-700 text-xs font-bold cursor-pointer"
                    >
                      {hasPriceBreaks ? 'Disable Breaks' : 'Enable Breaks'}
                    </button>
                  </div>

                  {hasPriceBreaks && (
                    <div className="space-y-3 pt-2">
                      {/* List of current breaks */}
                      {tempPriceBreaks.length > 0 ? (
                        <div className="text-xs space-y-1.5 max-h-52 overflow-y-auto bg-stone-50 p-2 rounded-lg border border-stone-150">
                          {tempPriceBreaks.map((pb, idx) => {
                            if (editingBreakIndex === idx) {
                              return (
                                <div key={idx} className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-300 space-y-2">
                                  <div className="flex items-center justify-between text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                                    <span>Edit Price Break Tier</span>
                                    <button type="button" onClick={cancelEditBreak} className="text-stone-400 hover:text-stone-600 cursor-pointer"><X size={12} /></button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <span className="text-[9px] text-stone-500 font-semibold block">Min Qty</span>
                                      <input
                                        type="number"
                                        min={1}
                                        value={editBreakMin}
                                        onChange={e => setEditBreakMin(parseInt(e.target.value) || 1)}
                                        className="w-full bg-white px-2 py-1 border border-stone-200 rounded text-xs font-normal focus:outline-none focus:ring-1 focus:ring-amber-500"
                                      />
                                    </div>
                                    <div>
                                      <span className="text-[9px] text-stone-500 font-semibold block">Max Qty (Opt)</span>
                                      <input
                                        type="number"
                                        placeholder="+"
                                        value={editBreakMax}
                                        onChange={e => setEditBreakMax(e.target.value)}
                                        className="w-full bg-white px-2 py-1 border border-stone-200 rounded text-xs font-normal focus:outline-none focus:ring-1 focus:ring-amber-500"
                                      />
                                    </div>
                                    <div>
                                      <span className="text-[9px] text-stone-500 font-semibold block">Unit Price (R)</span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={editBreakPrice}
                                        onChange={e => setEditBreakPrice(e.target.value)}
                                        className="w-full bg-white px-2 py-1 border border-stone-200 rounded text-xs font-normal focus:outline-none focus:ring-1 focus:ring-amber-500"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex gap-2 justify-end pt-1">
                                    <button
                                      type="button"
                                      onClick={cancelEditBreak}
                                      className="text-[11px] bg-stone-100 hover:bg-stone-200 text-stone-600 px-2.5 py-1 rounded font-semibold cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => saveEditBreak(idx)}
                                      className="text-[11px] bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded font-semibold cursor-pointer shadow-2xs"
                                    >
                                      Save Tier
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={idx} className="flex justify-between items-center text-stone-600 font-medium py-1 px-1.5 hover:bg-white rounded transition">
                                <span>Q: {pb.minQty} {pb.maxQty ? `– ${pb.maxQty}` : '+'}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-stone-900">{formatZAR(pb.unitPrice)}</span>
                                  <button
                                    type="button"
                                    onClick={() => startEditBreak(idx)}
                                    className="text-stone-400 hover:text-amber-600 cursor-pointer p-1 transition"
                                    title="Edit price break"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removePriceBreakFromTemp(idx)}
                                    className="text-stone-400 hover:text-rose-500 cursor-pointer p-1 transition"
                                    title="Delete price break"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] text-stone-400 italic">No wholesale price breaks added yet. Add below:</p>
                      )}

                      {/* Add Break inputs */}
                      <div className="grid grid-cols-3 gap-2 bg-stone-50 p-2.5 rounded-lg border border-stone-150">
                        <div>
                          <span className="text-[9px] text-stone-400 font-semibold block">Min Qty</span>
                          <input
                            type="number"
                            min={1}
                            value={newBreakMin}
                            onChange={e => setNewBreakMin(parseInt(e.target.value) || 1)}
                            className="w-full bg-white px-2 py-1 border border-stone-200 rounded text-xs font-normal"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-stone-400 font-semibold block">Max Qty (Opt)</span>
                          <input
                            type="number"
                            placeholder="+"
                            value={newBreakMax}
                            onChange={e => setNewBreakMax(e.target.value)}
                            className="w-full bg-white px-2 py-1 border border-stone-200 rounded text-xs font-normal"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-stone-400 font-semibold block">Unit Price</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={newBreakPrice}
                            onChange={e => setNewBreakPrice(e.target.value)}
                            className="w-full bg-white px-2 py-1 border border-stone-200 rounded text-xs font-normal"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addPriceBreakToTemp}
                        className="text-xs bg-stone-800 hover:bg-stone-900 text-white w-full py-1.5 rounded-lg transition font-medium cursor-pointer"
                      >
                        + Add Price Break Row
                      </button>
                    </div>
                  )}
                </div>

                {/* Number in Stock - Only for tangible craft products */}
                {activeTab !== 'services' && (
                  <div className="bg-white p-4 rounded-xl border border-stone-200/60 shadow-xs">
                    <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Number in Stock</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        value={pStockQuantity}
                        onChange={e => setPStockQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-normal"
                        placeholder="0"
                      />
                    </div>
                    <span className="text-[10px] text-stone-400 block mt-1">Available inventory units</span>
                  </div>
                )}

                {/* Product Variations */}
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Product Variations</label>
                    <span className="text-[10px] text-stone-400 block mt-0.5">These are variations of your core product, e.g. size, material</span>
                  </div>

                  {/* Already added variations */}
                  {tempCustomizations.filter(o => o.type !== 'extra').length > 0 && (
                    <div className="space-y-2">
                      {tempCustomizations.map((opt, optIdx) => {
                        if (opt.type === 'extra') return null;

                        if (editingOptIndex === optIdx) {
                          return (
                            <div key={optIdx} className="bg-amber-50/40 p-3.5 rounded-xl border border-amber-300 space-y-3 relative shadow-xs">
                              <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wider">
                                  <Edit2 size={13} className="text-amber-600" /> Edit Variation
                                </span>
                                <button
                                  type="button"
                                  onClick={cancelEditOpt}
                                  className="text-stone-400 hover:text-stone-600 cursor-pointer p-1"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              <div>
                                <span className="text-[10px] text-stone-600 font-bold block mb-1">Variation Name</span>
                                <input
                                  type="text"
                                  value={editOptName}
                                  onChange={e => setEditOptName(e.target.value)}
                                  placeholder="e.g. Size, Flavour"
                                  className="w-full bg-white px-3 py-1.5 border border-stone-200 rounded-lg text-xs font-normal focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>

                              <div className="space-y-2">
                                <span className="text-[10px] text-stone-600 font-bold block">Choices & Price Uplifts</span>
                                {editOptValues.length > 0 && (
                                  <div className="space-y-2 bg-white p-2 rounded-lg border border-stone-200 max-h-52 overflow-y-auto">
                                    {editOptValues.map((v, valIdx) => (
                                      <div key={valIdx} className="flex items-center gap-2">
                                        {v.photo ? (
                                          <div className="relative shrink-0">
                                            <img src={v.photo} alt={v.value} className="w-7 h-7 rounded-md object-cover border border-stone-200" referrerPolicy="no-referrer" />
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newVals = [...editOptValues];
                                                newVals[valIdx].photo = undefined;
                                                setEditOptValues(newVals);
                                              }}
                                              className="absolute -top-1 -right-1 bg-stone-800 text-white rounded-full p-0.5 hover:bg-rose-600 transition cursor-pointer"
                                              title="Remove image"
                                            >
                                              <X size={10} />
                                            </button>
                                          </div>
                                        ) : (
                                          <label className="shrink-0 text-stone-400 hover:text-amber-600 cursor-pointer p-1.5 bg-stone-50 hover:bg-amber-50 rounded-md border border-stone-200 transition" title="Attach image">
                                            <ImageIcon size={14} />
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                  const reader = new FileReader();
                                                  reader.onloadend = () => {
                                                    const newVals = [...editOptValues];
                                                    newVals[valIdx].photo = reader.result as string;
                                                    setEditOptValues(newVals);
                                                  };
                                                  reader.readAsDataURL(file);
                                                }
                                              }}
                                            />
                                          </label>
                                        )}
                                        <input
                                          type="text"
                                          value={v.value}
                                          onChange={e => {
                                            const newVals = [...editOptValues];
                                            newVals[valIdx].value = e.target.value;
                                            setEditOptValues(newVals);
                                          }}
                                          placeholder="Choice text"
                                          className="flex-1 bg-stone-50 px-2.5 py-1 border border-stone-200 rounded text-xs font-normal focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                        />
                                        <div className="relative w-24">
                                          <span className="absolute left-1.5 top-1 text-stone-400 text-[10px]">+R</span>
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={v.priceUplift || ''}
                                            onChange={e => {
                                              const newVals = [...editOptValues];
                                              newVals[valIdx].priceUplift = parsePrice(e.target.value);
                                              setEditOptValues(newVals);
                                            }}
                                            placeholder="Uplift"
                                            className="w-full pl-6 pr-2 bg-stone-50 py-1 border border-stone-200 rounded text-xs font-normal focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setEditOptValues(prev => prev.filter((_, idx) => idx !== valIdx))}
                                          className="text-stone-400 hover:text-rose-500 p-1 cursor-pointer transition shrink-0"
                                          title="Remove choice"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className="flex items-center gap-2 pt-1">
                                  {editValPhoto ? (
                                    <div className="relative shrink-0">
                                      <img src={editValPhoto} alt="Choice preview" className="w-7 h-7 rounded-md object-cover border border-stone-200" referrerPolicy="no-referrer" />
                                      <button
                                        type="button"
                                        onClick={() => setEditValPhoto('')}
                                        className="absolute -top-1 -right-1 bg-stone-800 text-white rounded-full p-0.5 hover:bg-rose-600 transition cursor-pointer"
                                      >
                                        <X size={10} />
                                      </button>
                                    </div>
                                  ) : (
                                    <label className="shrink-0 text-stone-400 hover:text-amber-600 cursor-pointer p-1.5 bg-white hover:bg-amber-50 rounded-md border border-stone-200 transition" title="Upload choice image">
                                      <ImageIcon size={14} />
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={e => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                              setEditValPhoto(reader.result as string);
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                      />
                                    </label>
                                  )}
                                  <input
                                    type="text"
                                    placeholder="Add choice (e.g. Medium)"
                                    value={editValText}
                                    onChange={e => setEditValText(e.target.value)}
                                    className="flex-1 bg-white px-2.5 py-1 border border-stone-200 rounded text-xs font-normal focus:outline-none focus:ring-1 focus:ring-amber-500"
                                  />
                                  <div className="relative w-24">
                                    <span className="absolute left-1.5 top-1 text-stone-400 text-[10px]">+R</span>
                                    <input
                                      type="number"
                                      placeholder="Uplift"
                                      value={editValUplift || ''}
                                      onChange={e => setEditValUplift(parseFloat(e.target.value) || 0)}
                                      className="w-full pl-6 pr-2 bg-white py-1 border border-stone-200 rounded text-xs font-normal focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!editValText.trim()) return;
                                      setEditOptValues(prev => [...prev, { value: editValText.trim(), priceUplift: Number(editValUplift) || 0, photo: editValPhoto || undefined }]);
                                      setEditValText('');
                                      setEditValUplift(0);
                                      setEditValPhoto('');
                                    }}
                                    className="bg-stone-700 hover:bg-stone-800 text-white text-xs px-3 py-1 rounded-md font-semibold cursor-pointer transition shrink-0"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>

                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={cancelEditOpt}
                                  className="flex-1 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg font-bold cursor-pointer transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={!editOptName.trim() || editOptValues.length === 0}
                                  onClick={() => saveEditOpt(optIdx)}
                                  className="flex-1 text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-bold cursor-pointer transition shadow-xs"
                                >
                                  Save Changes
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={optIdx} className="bg-white p-3 rounded-xl border border-stone-200 flex justify-between items-start shadow-xs">
                            <div>
                              <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                                {opt.name}
                                {opt.isRequired && <span className="text-rose-500 text-[10px] font-semibold">(Required)</span>}
                              </span>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {opt.values.map((v, vIdx) => (
                                  <span key={vIdx} className="inline-flex items-center gap-1.5 text-[9px] bg-stone-50 border border-stone-200 px-2 py-0.5 rounded text-stone-700 font-semibold">
                                    {v.photo && (
                                      <img src={v.photo} alt={v.value} className="w-3.5 h-3.5 rounded object-cover border border-stone-200 shrink-0" referrerPolicy="no-referrer" />
                                    )}
                                    {v.value} {v.priceUplift > 0 ? `(+R${v.priceUplift})` : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEditOpt(optIdx)}
                                className="text-stone-400 hover:text-amber-600 cursor-pointer p-1 transition"
                                title="Edit variation"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeCustomOption(optIdx)}
                                className="text-stone-400 hover:text-rose-500 cursor-pointer p-1 transition"
                                title="Delete variation"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add variation panel */}
                  {!showAddVar ? (
                    <button
                      type="button"
                      onClick={() => {
                        setNewVarName('');
                        setTempVarValues([]);
                        setShowAddVar(true);
                      }}
                      className="w-full py-2.5 px-3 bg-stone-50 hover:bg-stone-100 border border-stone-200 hover:border-stone-300 rounded-xl text-xs font-bold text-stone-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus size={14} className="text-amber-600" /> Add a variation
                    </button>
                  ) : (
                    <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3.5 relative">
                      <button
                        type="button"
                        onClick={() => setShowAddVar(false)}
                        className="absolute top-3 right-3 text-stone-400 hover:text-stone-600 cursor-pointer p-1"
                      >
                        <X size={14} />
                      </button>
                      <span className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">Add a product variation</span>
                      
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <span className="text-[10px] text-stone-500 font-bold block mb-1">Variation Name</span>
                          <input
                            type="text"
                            placeholder="e.g. Size, Material"
                            value={newVarName}
                            onChange={e => setNewVarName(e.target.value)}
                            className="w-full bg-white px-3 py-1.5 border border-stone-200 rounded-lg text-xs font-normal focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      {/* Choice values list */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-stone-500 font-bold block">Variation Choices & Price Uplifts</span>
                        {tempVarValues.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 bg-white p-2 rounded-lg border border-stone-200">
                            {tempVarValues.map((v, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1.5 text-[10px] bg-amber-50 text-amber-900 border border-amber-200/60 px-2.5 py-0.5 rounded-full font-semibold">
                                {v.photo && (
                                  <img src={v.photo} alt={v.value} className="w-4 h-4 rounded-full object-cover border border-amber-200 shrink-0" referrerPolicy="no-referrer" />
                                )}
                                {v.value} {v.priceUplift > 0 ? `(+R${v.priceUplift})` : ''}
                                <button type="button" onClick={() => removeVarValue(idx)} className="hover:text-red-600 cursor-pointer ml-0.5"><X size={10} /></button>
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {newVarValPhoto ? (
                            <div className="relative shrink-0">
                              <img src={newVarValPhoto} alt="Preview" className="w-7 h-7 rounded-md object-cover border border-stone-200" referrerPolicy="no-referrer" />
                              <button
                                type="button"
                                onClick={() => setNewVarValPhoto('')}
                                className="absolute -top-1 -right-1 bg-stone-800 text-white rounded-full p-0.5 hover:bg-rose-600 transition cursor-pointer"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <label className="shrink-0 text-stone-400 hover:text-amber-600 cursor-pointer p-1.5 bg-white hover:bg-amber-50 rounded-md border border-stone-200 transition" title="Attach choice image">
                              <ImageIcon size={14} />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setNewVarValPhoto(reader.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          )}
                          <input
                            type="text"
                            placeholder="e.g. Small, Mahogany"
                            value={newVarValText}
                            onChange={e => setNewVarValText(e.target.value)}
                            className="flex-1 bg-white px-2.5 py-1 border border-stone-200 rounded text-xs font-normal focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                          <div className="relative w-24">
                            <span className="absolute left-1.5 top-1 text-stone-400 text-[10px]">+R</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="Uplift"
                              value={newVarValUplift || ''}
                              onChange={e => setNewVarValUplift(e.target.value)}
                              className="w-full pl-6 pr-2 bg-white py-1 border border-stone-200 rounded text-xs font-normal focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={addVarValue}
                            className="bg-stone-700 hover:bg-stone-800 text-white text-xs px-3 rounded-md font-semibold cursor-pointer transition active:scale-95"
                          >
                            Add Choice
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddVar(false)}
                          className="flex-1 text-xs bg-stone-200 hover:bg-stone-300 text-stone-700 px-4 py-2 rounded-lg transition font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!newVarName.trim() || tempVarValues.length === 0}
                          onClick={saveVariationOption}
                          className="flex-1 text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:hover:bg-amber-600 text-white px-4 py-2 rounded-lg transition font-bold cursor-pointer shadow-xs"
                        >
                          Save Variation
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional Extras */}
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Optional Extras</label>
                    <span className="text-[10px] text-stone-400 block mt-0.5">These are optional extras or customisations, e.g. Gift wrap, engraving</span>
                  </div>

                  {/* Already added extras */}
                  {tempCustomizations.filter(o => o.type === 'extra').length > 0 && (
                    <div className="space-y-2">
                      {tempCustomizations.map((opt, optIdx) => {
                        if (opt.type !== 'extra') return null;

                        if (editingOptIndex === optIdx) {
                          return (
                            <div key={optIdx} className="bg-amber-50/40 p-3.5 rounded-xl border border-amber-300 space-y-3 relative shadow-xs">
                              <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wider">
                                  <Edit2 size={13} className="text-amber-600" /> Edit Extra Option
                                </span>
                                <button
                                  type="button"
                                  onClick={cancelEditOpt}
                                  className="text-stone-400 hover:text-stone-600 cursor-pointer p-1"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              <div>
                                <span className="text-[10px] text-stone-600 font-bold block mb-1">Extra Option Name</span>
                                <input
                                  type="text"
                                  value={editOptName}
                                  onChange={e => setEditOptName(e.target.value)}
                                  placeholder="e.g. Gift Wrap, Ribbon"
                                  className="w-full bg-white px-3 py-1.5 border border-stone-200 rounded-lg text-xs font-normal focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>

                              <div className="space-y-2">
                                <span className="text-[10px] text-stone-600 font-bold block">Choices & Price Uplifts</span>
                                {editOptValues.length > 0 && (
                                  <div className="space-y-2 bg-white p-2 rounded-lg border border-stone-200 max-h-52 overflow-y-auto">
                                    {editOptValues.map((v, valIdx) => (
                                      <div key={valIdx} className="flex items-center gap-2">
                                        {v.photo ? (
                                          <div className="relative shrink-0">
                                            <img src={v.photo} alt={v.value} className="w-7 h-7 rounded-md object-cover border border-stone-200" referrerPolicy="no-referrer" />
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newVals = [...editOptValues];
                                                newVals[valIdx].photo = undefined;
                                                setEditOptValues(newVals);
                                              }}
                                              className="absolute -top-1 -right-1 bg-stone-800 text-white rounded-full p-0.5 hover:bg-rose-600 transition cursor-pointer"
                                              title="Remove image"
                                            >
                                              <X size={10} />
                                            </button>
                                          </div>
                                        ) : (
                                          <label className="shrink-0 text-stone-400 hover:text-amber-600 cursor-pointer p-1.5 bg-stone-50 hover:bg-amber-50 rounded-md border border-stone-200 transition" title="Attach image">
                                            <ImageIcon size={14} />
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                  const reader = new FileReader();
                                                  reader.onloadend = () => {
                                                    const newVals = [...editOptValues];
                                                    newVals[valIdx].photo = reader.result as string;
                                                    setEditOptValues(newVals);
                                                  };
                                                  reader.readAsDataURL(file);
                                                }
                                              }}
                                            />
                                          </label>
                                        )}
                                        <input
                                          type="text"
                                          value={v.value}
                                          onChange={e => {
                                            const newVals = [...editOptValues];
                                            newVals[valIdx].value = e.target.value;
                                            setEditOptValues(newVals);
                                          }}
                                          placeholder="Choice text"
                                          className="flex-1 bg-stone-50 px-2.5 py-1 border border-stone-200 rounded text-xs font-normal focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                        />
                                        <div className="relative w-24">
                                          <span className="absolute left-1.5 top-1 text-stone-400 text-[10px]">+R</span>
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={v.priceUplift || ''}
                                            onChange={e => {
                                              const newVals = [...editOptValues];
                                              newVals[valIdx].priceUplift = parsePrice(e.target.value);
                                              setEditOptValues(newVals);
                                            }}
                                            placeholder="Uplift"
                                            className="w-full pl-6 pr-2 bg-stone-50 py-1 border border-stone-200 rounded text-xs font-normal focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setEditOptValues(prev => prev.filter((_, idx) => idx !== valIdx))}
                                          className="text-stone-400 hover:text-rose-500 p-1 cursor-pointer transition shrink-0"
                                          title="Remove choice"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className="flex items-center gap-2 pt-1">
                                  {editValPhoto ? (
                                    <div className="relative shrink-0">
                                      <img src={editValPhoto} alt="Choice preview" className="w-7 h-7 rounded-md object-cover border border-stone-200" referrerPolicy="no-referrer" />
                                      <button
                                        type="button"
                                        onClick={() => setEditValPhoto('')}
                                        className="absolute -top-1 -right-1 bg-stone-800 text-white rounded-full p-0.5 hover:bg-rose-600 transition cursor-pointer"
                                      >
                                        <X size={10} />
                                      </button>
                                    </div>
                                  ) : (
                                    <label className="shrink-0 text-stone-400 hover:text-amber-600 cursor-pointer p-1.5 bg-white hover:bg-amber-50 rounded-md border border-stone-200 transition" title="Upload choice image">
                                      <ImageIcon size={14} />
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={e => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                              setEditValPhoto(reader.result as string);
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                      />
                                    </label>
                                  )}
                                  <input
                                    type="text"
                                    placeholder="Add choice (e.g. Satin Ribbon)"
                                    value={editValText}
                                    onChange={e => setEditValText(e.target.value)}
                                    className="flex-1 bg-white px-2.5 py-1 border border-stone-200 rounded text-xs font-normal focus:outline-none focus:ring-1 focus:ring-amber-500"
                                  />
                                  <div className="relative w-24">
                                    <span className="absolute left-1.5 top-1 text-stone-400 text-[10px]">+R</span>
                                    <input
                                      type="number"
                                      placeholder="Uplift"
                                      value={editValUplift || ''}
                                      onChange={e => setEditValUplift(parseFloat(e.target.value) || 0)}
                                      className="w-full pl-6 pr-2 bg-white py-1 border border-stone-200 rounded text-xs font-normal focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!editValText.trim()) return;
                                      setEditOptValues(prev => [...prev, { value: editValText.trim(), priceUplift: Number(editValUplift) || 0, photo: editValPhoto || undefined }]);
                                      setEditValText('');
                                      setEditValUplift(0);
                                      setEditValPhoto('');
                                    }}
                                    className="bg-stone-700 hover:bg-stone-800 text-white text-xs px-3 py-1 rounded-md font-semibold cursor-pointer transition shrink-0"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>

                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={cancelEditOpt}
                                  className="flex-1 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg font-bold cursor-pointer transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={!editOptName.trim() || editOptValues.length === 0}
                                  onClick={() => saveEditOpt(optIdx)}
                                  className="flex-1 text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-bold cursor-pointer transition shadow-xs"
                                >
                                  Save Changes
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={optIdx} className="bg-white p-3 rounded-xl border border-stone-200 flex justify-between items-start shadow-xs">
                            <div>
                              <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                                {opt.name}
                                {opt.isRequired && <span className="text-rose-500 text-[10px] font-semibold">(Required)</span>}
                              </span>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {opt.values.map((v, vIdx) => (
                                  <span key={vIdx} className="inline-flex items-center gap-1.5 text-[9px] bg-amber-50/50 border border-amber-200/50 px-2 py-0.5 rounded text-amber-900 font-semibold">
                                    {v.photo && (
                                      <img src={v.photo} alt={v.value} className="w-3.5 h-3.5 rounded object-cover border border-amber-200 shrink-0" referrerPolicy="no-referrer" />
                                    )}
                                    {v.value} {v.priceUplift > 0 ? `(+R${v.priceUplift})` : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEditOpt(optIdx)}
                                className="text-stone-400 hover:text-amber-600 cursor-pointer p-1 transition"
                                title="Edit extra"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeCustomOption(optIdx)}
                                className="text-stone-400 hover:text-rose-500 cursor-pointer p-1 transition"
                                title="Delete extra"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add extra panel */}
                  {!showAddExtra ? (
                    <button
                      type="button"
                      onClick={() => {
                        setNewExtraName('');
                        setTempExtraValues([]);
                        setShowAddExtra(true);
                      }}
                      className="w-full py-2.5 px-3 bg-stone-50 hover:bg-stone-100 border border-stone-200 hover:border-stone-300 rounded-xl text-xs font-bold text-stone-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus size={14} className="text-amber-600" /> Add an extra
                    </button>
                  ) : (
                    <div className="bg-amber-50/10 p-4 rounded-xl border border-amber-200/25 space-y-3.5 relative">
                      <button
                        type="button"
                        onClick={() => setShowAddExtra(false)}
                        className="absolute top-3 right-3 text-stone-400 hover:text-stone-600 cursor-pointer p-1"
                      >
                        <X size={14} />
                      </button>
                      <span className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider">Add an extra</span>
                      
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <span className="text-[10px] text-amber-900 font-bold block mb-1">Extra Option Name</span>
                          <input
                            type="text"
                            placeholder="e.g. Gift wrap, Engraving"
                            value={newExtraName}
                            onChange={e => setNewExtraName(e.target.value)}
                            className="w-full bg-white px-3 py-1.5 border border-stone-200 rounded-lg text-xs font-normal focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      {/* Choice values list */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-amber-900 font-bold block">Extra Choices & Price Uplifts</span>
                        {tempExtraValues.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 bg-white p-2 rounded-lg border border-stone-200">
                            {tempExtraValues.map((v, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1.5 text-[10px] bg-amber-50 text-amber-900 border border-amber-200/60 px-2.5 py-0.5 rounded-full font-semibold">
                                {v.photo && (
                                  <img src={v.photo} alt={v.value} className="w-4 h-4 rounded-full object-cover border border-amber-200 shrink-0" referrerPolicy="no-referrer" />
                                )}
                                {v.value} {v.priceUplift > 0 ? `(+R${v.priceUplift})` : ''}
                                <button type="button" onClick={() => removeExtraValue(idx)} className="hover:text-red-600 cursor-pointer ml-0.5"><X size={10} /></button>
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {newExtraValPhoto ? (
                            <div className="relative shrink-0">
                              <img src={newExtraValPhoto} alt="Preview" className="w-7 h-7 rounded-md object-cover border border-stone-200" referrerPolicy="no-referrer" />
                              <button
                                type="button"
                                onClick={() => setNewExtraValPhoto('')}
                                className="absolute -top-1 -right-1 bg-stone-800 text-white rounded-full p-0.5 hover:bg-rose-600 transition cursor-pointer"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <label className="shrink-0 text-stone-400 hover:text-amber-600 cursor-pointer p-1.5 bg-white hover:bg-amber-50 rounded-md border border-stone-200 transition" title="Attach choice image">
                              <ImageIcon size={14} />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setNewExtraValPhoto(reader.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          )}
                          <input
                            type="text"
                            placeholder="e.g. Silk Ribbon, Engraving Name"
                            value={newExtraValText}
                            onChange={e => setNewExtraValText(e.target.value)}
                            className="flex-1 bg-white px-2.5 py-1 border border-stone-200 rounded text-xs font-normal focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                          <div className="relative w-24">
                            <span className="absolute left-1.5 top-1 text-stone-400 text-[10px]">+R</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="Uplift"
                              value={newExtraValUplift || ''}
                              onChange={e => setNewExtraValUplift(e.target.value)}
                              className="w-full pl-6 pr-2 bg-white py-1 border border-stone-200 rounded text-xs font-normal focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={addExtraValue}
                            className="bg-stone-700 hover:bg-stone-800 text-white text-xs px-3 rounded-md font-semibold cursor-pointer transition active:scale-95"
                          >
                            Add Choice
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddExtra(false)}
                          className="flex-1 text-xs bg-stone-200 hover:bg-stone-300 text-stone-700 px-4 py-2 rounded-lg transition font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!newExtraName.trim() || tempExtraValues.length === 0}
                          onClick={saveExtraOption}
                          className="flex-1 text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:hover:bg-amber-600 text-white px-4 py-2 rounded-lg transition font-bold w-full cursor-pointer shadow-xs"
                        >
                          Save Extra
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Active in Catalogue checkbox */}
                <div className="flex items-center gap-6 pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="pIsActive"
                      checked={pIsActive}
                      onChange={e => setPIsActive(e.target.checked)}
                      className="h-4.5 w-4.5 text-amber-600 border-stone-300 rounded-sm focus:ring-amber-500 cursor-pointer"
                    />
                    <label htmlFor="pIsActive" className="text-sm text-stone-700 font-semibold cursor-pointer">Active in Catalogue</label>
                  </div>
                </div>
              </div>
              )}

              {/* TAB 2: Production Process */}
              {editFormTab === 'stages' && (
                <div className="space-y-6 w-full">
                  <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200/80 space-y-5 shadow-xs">
                    <div className="pb-3 border-b border-stone-100">
                      <h4 className="font-extrabold text-stone-800 text-sm flex items-center gap-1.5">
                        <ListTodo size={16} className="text-amber-600" /> Production Tracking Mode
                      </h4>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Specify how this product is tracked during manufacturing and fulfillment in active Jobs.
                      </p>
                    </div>

                    {/* Mode Selector Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPTrackingMode('whole')}
                        className={`p-4 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                          pTrackingMode === 'whole'
                            ? 'border-amber-600 bg-amber-50/50 text-amber-950 shadow-2xs'
                            : 'border-stone-200 bg-stone-50/50 hover:bg-stone-50 text-stone-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-extrabold text-xs flex items-center gap-2">
                            <Layers size={16} className={pTrackingMode === 'whole' ? 'text-amber-700' : 'text-stone-400'} />
                            Track as Whole Product
                          </span>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            pTrackingMode === 'whole' ? 'border-amber-600 bg-amber-600 text-white' : 'border-stone-300'
                          }`}>
                            {pTrackingMode === 'whole' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                        </div>
                        <p className="text-[11px] text-stone-500 leading-relaxed font-normal">
                          Track progress as completed quantities of the full item or batch, without multi-step stage breakdowns.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPTrackingMode('stages')}
                        className={`p-4 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                          pTrackingMode === 'stages'
                            ? 'border-amber-600 bg-amber-50/50 text-amber-950 shadow-2xs'
                            : 'border-stone-200 bg-stone-50/50 hover:bg-stone-50 text-stone-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-extrabold text-xs flex items-center gap-2">
                            <ListTodo size={16} className={pTrackingMode === 'stages' ? 'text-amber-700' : 'text-stone-400'} />
                            Track in Stages
                          </span>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            pTrackingMode === 'stages' ? 'border-amber-600 bg-amber-600 text-white' : 'border-stone-300'
                          }`}>
                            {pTrackingMode === 'stages' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                        </div>
                        <p className="text-[11px] text-stone-500 leading-relaxed font-normal">
                          Define custom production stages (e.g. Printing, Assembly, Quality Control) to track step-by-step progress.
                        </p>
                      </button>
                    </div>

                    {/* Stage Configuration - Only shown if "in stages" is selected */}
                    {pTrackingMode === 'stages' ? (
                      <div className="pt-4 border-t border-stone-200/80 space-y-4">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
                            <ListTodo size={14} className="text-amber-600" /> Default Production Stages
                          </h5>
                          <span className="text-[11px] text-stone-400 font-medium">
                            {pDefaultStages.length} stage{pDefaultStages.length === 1 ? '' : 's'} configured
                          </span>
                        </div>

                        {/* List of current default stages for this product */}
                        {pDefaultStages.length > 0 ? (
                          <div className="space-y-2">
                            {pDefaultStages.map((stg, idx) => {
                              const isExpanded = expandedStageIndex === idx;
                              const isConditional = !!stg.isConditional;

                              return (
                                <div key={stg.id || idx} className="space-y-1.5">
                                  <div 
                                    draggable
                                    onDragStart={(e) => {
                                      setDraggedStageIdx(idx);
                                      e.dataTransfer.effectAllowed = 'move';
                                      e.dataTransfer.setData('text/plain', idx.toString());
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      e.dataTransfer.dropEffect = 'move';
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      const fromIdx = draggedStageIdx ?? parseInt(e.dataTransfer.getData('text/plain'), 10);
                                      if (fromIdx !== null && !isNaN(fromIdx) && fromIdx !== idx) {
                                        setPDefaultStages(prev => {
                                          const next = [...prev];
                                          const [removed] = next.splice(fromIdx, 1);
                                          next.splice(idx, 0, removed);
                                          return next;
                                        });
                                        if (expandedStageIndex === fromIdx) setExpandedStageIndex(idx);
                                      }
                                      setDraggedStageIdx(null);
                                    }}
                                    onDragEnd={() => setDraggedStageIdx(null)}
                                    className={`flex items-center justify-between bg-stone-50 px-3 py-2 rounded-xl border text-xs font-bold text-stone-800 shadow-2xs transition group cursor-grab active:cursor-grabbing hover:bg-stone-100/90 ${
                                      isConditional ? 'border-purple-200 bg-purple-50/20' : 'border-stone-200'
                                    } ${draggedStageIdx === idx ? 'opacity-30 border-dashed border-amber-400' : ''}`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                                      <GripVertical size={14} className="text-stone-400 group-hover:text-stone-600 shrink-0 cursor-grab" />
                                      <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                                        isConditional ? 'bg-purple-200 text-purple-900' : 'bg-amber-100 text-amber-900'
                                      }`}>
                                        {idx + 1}
                                      </span>
                                      <input
                                        type="text"
                                        value={stg.name}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setPDefaultStages(prev => prev.map((s, i) => i === idx ? { ...s, name: val } : s));
                                        }}
                                        className="bg-transparent border-b border-transparent hover:border-stone-300 focus:border-amber-500 focus:bg-white focus:outline-none px-1 py-0.5 rounded font-bold text-stone-800 text-xs min-w-0 flex-1 truncate"
                                        placeholder="Stage name..."
                                      />

                                      {/* Active condition badge preview */}
                                      {isConditional && (
                                        <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                                          <Zap size={10} className="text-purple-600 fill-purple-600 shrink-0" />
                                          <span className="truncate max-w-[200px]">{getStageConditionSummary(stg)}</span>
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      {/* Settings / Condition button */}
                                      <button
                                        type="button"
                                        onClick={() => setExpandedStageIndex(isExpanded ? null : idx)}
                                        className={`px-2 py-1 rounded-lg border text-[11px] font-extrabold flex items-center gap-1 transition cursor-pointer shadow-3xs ${
                                          isConditional 
                                            ? 'bg-purple-600 text-white border-purple-700 hover:bg-purple-700' 
                                            : isExpanded 
                                            ? 'bg-amber-100 text-amber-900 border-amber-300' 
                                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                                        }`}
                                        title="Configure conditional logic settings for this step"
                                      >
                                        <Sliders size={12} />
                                        {isConditional ? 'Rule Active' : 'Conditions'}
                                      </button>

                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => {
                                          setPDefaultStages(prev => {
                                            const next = [...prev];
                                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                            return next;
                                          });
                                          if (expandedStageIndex === idx) setExpandedStageIndex(idx - 1);
                                        }}
                                        className="text-stone-400 hover:text-amber-700 disabled:opacity-20 p-1 cursor-pointer"
                                        title="Move stage up"
                                      >
                                        <ChevronUp size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={idx === pDefaultStages.length - 1}
                                        onClick={() => {
                                          setPDefaultStages(prev => {
                                            const next = [...prev];
                                            [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                                            return next;
                                          });
                                          if (expandedStageIndex === idx) setExpandedStageIndex(idx + 1);
                                        }}
                                        className="text-stone-400 hover:text-amber-700 disabled:opacity-20 p-1 cursor-pointer"
                                        title="Move stage down"
                                      >
                                        <ChevronDown size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPDefaultStages(prev => prev.filter((_, i) => i !== idx));
                                          if (expandedStageIndex === idx) setExpandedStageIndex(null);
                                        }}
                                        className="text-stone-400 hover:text-rose-600 cursor-pointer p-1 ml-0.5"
                                        title="Remove stage"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Inline Stage Condition Settings Panel */}
                                  {isExpanded && (() => {
                                    const stageConditions: StageCondition[] = (stg.conditions && stg.conditions.length > 0)
                                      ? stg.conditions
                                      : (stg.condition ? [stg.condition] : [{
                                          id: `c_${Date.now()}`,
                                          type: tempCustomizations[0] ? 'option_match' : 'quantity_threshold',
                                          optionName: tempCustomizations[0]?.name || '',
                                          optionValue: tempCustomizations[0]?.values[0]?.value || '',
                                          quantityOperator: 'gte',
                                          quantityThreshold: 50
                                        }]);
                                    const currentLogic: 'AND' | 'OR' = stg.conditionLogic || 'AND';

                                    return (
                                      <div className="bg-stone-900 text-stone-100 p-3.5 rounded-xl space-y-3 shadow-md border border-stone-800 text-xs animate-in fade-in duration-150">
                                        <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                                          <div className="flex items-center gap-1.5">
                                            <Sliders size={13} className="text-amber-400" />
                                            <span className="font-bold text-stone-100">Conditional Step Logic — Stage {idx + 1}: "{stg.name}"</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => setExpandedStageIndex(null)}
                                            className="text-stone-400 hover:text-stone-200 cursor-pointer p-0.5"
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>

                                        {/* Mode Selection */}
                                        <div className="space-y-1.5">
                                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Stage Inclusion Rule:</span>
                                          <div className="grid grid-cols-2 gap-2">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setPDefaultStages(prev => prev.map((s, i) => i === idx ? { ...s, isConditional: false } : s));
                                              }}
                                              className={`px-3 py-2 rounded-lg border text-left font-bold transition cursor-pointer flex items-center justify-between ${
                                                !stg.isConditional 
                                                  ? 'bg-amber-500/20 text-amber-200 border-amber-500/60' 
                                                  : 'bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-750'
                                              }`}
                                            >
                                              <span>Always Included</span>
                                              {!stg.isConditional && <Check size={13} className="text-amber-400" />}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setPDefaultStages(prev => prev.map((s, i) => {
                                                  if (i === idx) {
                                                    const firstOpt = tempCustomizations[0];
                                                    const defaultCond: StageCondition = {
                                                      id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                                                      type: firstOpt ? 'option_match' : 'quantity_threshold',
                                                      optionName: firstOpt ? firstOpt.name : '',
                                                      optionValue: firstOpt && firstOpt.values[0] ? firstOpt.values[0].value : '',
                                                      quantityOperator: 'gte',
                                                      quantityThreshold: 50
                                                    };
                                                    const conds = (s.conditions && s.conditions.length > 0) ? s.conditions : (s.condition ? [s.condition] : [defaultCond]);
                                                    return {
                                                      ...s,
                                                      isConditional: true,
                                                      conditionLogic: s.conditionLogic || 'AND',
                                                      conditions: conds,
                                                      condition: conds[0]
                                                    };
                                                  }
                                                  return s;
                                                }));
                                              }}
                                              className={`px-3 py-2 rounded-lg border text-left font-bold transition cursor-pointer flex items-center justify-between ${
                                                stg.isConditional 
                                                  ? 'bg-purple-500/20 text-purple-200 border-purple-500/60' 
                                                  : 'bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-750'
                                              }`}
                                            >
                                              <span className="flex items-center gap-1.5">
                                                <Zap size={12} className="text-purple-400" />
                                                Conditional Step
                                              </span>
                                              {stg.isConditional && <Check size={13} className="text-purple-400" />}
                                            </button>
                                          </div>
                                        </div>

                                        {/* Multi-Condition & AND/OR Logic Settings */}
                                        {stg.isConditional && (
                                          <div className="p-3 bg-stone-950/80 rounded-lg border border-stone-800/80 space-y-3">
                                            {/* AND / OR Match Mode Toggle */}
                                            <div className="space-y-1.5 pb-2.5 border-b border-stone-800/80">
                                              <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                                                  Match Criteria (AND / OR):
                                                </span>
                                                <span className="text-[10px] text-stone-400 font-medium">
                                                  {stageConditions.length} {stageConditions.length === 1 ? 'rule configured' : 'rules connected'}
                                                </span>
                                              </div>

                                              <div className="grid grid-cols-2 gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setPDefaultStages(prev => prev.map((s, i) => i === idx ? { ...s, conditionLogic: 'AND' } : s));
                                                  }}
                                                  className={`px-3 py-2 rounded-lg border text-left font-bold transition cursor-pointer flex items-center justify-between ${
                                                    currentLogic === 'AND'
                                                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/60 shadow-xs'
                                                      : 'bg-stone-850 text-stone-400 border-stone-800 hover:bg-stone-800'
                                                  }`}
                                                >
                                                  <div>
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="px-1.5 py-0.2 rounded bg-cyan-900/80 text-cyan-300 font-black text-[9px] tracking-wide">AND</span>
                                                      <span className="text-xs">Match ALL Rules</span>
                                                    </div>
                                                    <span className="text-[10px] text-stone-400 font-normal block mt-0.5">Every condition must be true</span>
                                                  </div>
                                                  {currentLogic === 'AND' && <Check size={13} className="text-cyan-400 shrink-0" />}
                                                </button>

                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setPDefaultStages(prev => prev.map((s, i) => i === idx ? { ...s, conditionLogic: 'OR' } : s));
                                                  }}
                                                  className={`px-3 py-2 rounded-lg border text-left font-bold transition cursor-pointer flex items-center justify-between ${
                                                    currentLogic === 'OR'
                                                      ? 'bg-purple-500/20 text-purple-200 border-purple-500/60 shadow-xs'
                                                      : 'bg-stone-850 text-stone-400 border-stone-800 hover:bg-stone-800'
                                                  }`}
                                                >
                                                  <div>
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="px-1.5 py-0.2 rounded bg-purple-900/80 text-purple-300 font-black text-[9px] tracking-wide">OR</span>
                                                      <span className="text-xs">Match ANY Rule</span>
                                                    </div>
                                                    <span className="text-[10px] text-stone-400 font-normal block mt-0.5">At least one condition must match</span>
                                                  </div>
                                                  {currentLogic === 'OR' && <Check size={13} className="text-purple-400 shrink-0" />}
                                                </button>
                                              </div>
                                            </div>

                                            {/* List of Condition Clauses */}
                                            <div className="space-y-2.5">
                                              {stageConditions.map((cond, cIdx) => (
                                                <React.Fragment key={cond.id || `cond_${cIdx}`}>
                                                  {/* Inter-rule connector */}
                                                  {cIdx > 0 && (
                                                    <div className="flex items-center justify-center my-1">
                                                      <div className="h-px bg-stone-800 flex-1" />
                                                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mx-2 border ${
                                                        currentLogic === 'AND'
                                                          ? 'bg-cyan-950 text-cyan-300 border-cyan-800/80'
                                                          : 'bg-purple-950 text-purple-300 border-purple-800/80'
                                                      }`}>
                                                        {currentLogic}
                                                      </span>
                                                      <div className="h-px bg-stone-800 flex-1" />
                                                    </div>
                                                  )}

                                                  <div className="p-3 bg-stone-900/90 rounded-lg border border-stone-800 space-y-2.5 shadow-2xs">
                                                    <div className="flex items-center justify-between">
                                                      <span className="text-[10px] font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                                                        <span className="w-4 h-4 rounded-full bg-stone-800 text-stone-300 flex items-center justify-center text-[10px] font-black">
                                                          {cIdx + 1}
                                                        </span>
                                                        Condition Rule #{cIdx + 1}
                                                      </span>
                                                      {stageConditions.length > 1 && (
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            const nextList = stageConditions.filter((_, ci) => ci !== cIdx);
                                                            setPDefaultStages(prev => prev.map((s, i) => i === idx ? {
                                                              ...s,
                                                              conditions: nextList,
                                                              condition: nextList[0]
                                                            } : s));
                                                          }}
                                                          className="text-stone-400 hover:text-rose-400 p-1 rounded hover:bg-stone-800 transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                                                          title="Remove this condition rule"
                                                        >
                                                          <Trash2 size={11} /> Remove
                                                        </button>
                                                      )}
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                      {/* Trigger Type */}
                                                      <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                                                          Condition Trigger
                                                        </label>
                                                        <select
                                                          value={cond.type || 'quantity_threshold'}
                                                          onChange={(e) => {
                                                            const type = e.target.value as StageCondition['type'];
                                                            const firstOpt = tempCustomizations[0];
                                                            const nextList = stageConditions.map((c, ci) => ci === cIdx ? {
                                                              ...c,
                                                              type,
                                                              optionName: firstOpt ? firstOpt.name : (c.optionName || ''),
                                                              optionValue: firstOpt && firstOpt.values[0] ? firstOpt.values[0].value : (c.optionValue || ''),
                                                              quantityOperator: c.quantityOperator || 'gte',
                                                              quantityThreshold: c.quantityThreshold ?? 50
                                                            } : c);
                                                            setPDefaultStages(prev => prev.map((s, i) => i === idx ? {
                                                              ...s,
                                                              conditions: nextList,
                                                              condition: nextList[0]
                                                            } : s));
                                                          }}
                                                          className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                        >
                                                          <option value="option_match">Specific Variation / Extra Choice Selected</option>
                                                          <option value="option_selected">Variation / Extra Chosen (Any Choice)</option>
                                                          <option value="quantity_threshold">Order / Batch Quantity Threshold</option>
                                                        </select>
                                                      </div>

                                                      {/* Fields based on type */}
                                                      {cond.type === 'quantity_threshold' ? (
                                                        <div className="grid grid-cols-2 gap-1.5">
                                                          <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                                                              Operator
                                                            </label>
                                                            <select
                                                              value={cond.quantityOperator || 'gte'}
                                                              onChange={(e) => {
                                                                const op = e.target.value as StageCondition['quantityOperator'];
                                                                const nextList = stageConditions.map((c, ci) => ci === cIdx ? { ...c, quantityOperator: op } : c);
                                                                setPDefaultStages(prev => prev.map((s, i) => i === idx ? {
                                                                  ...s,
                                                                  conditions: nextList,
                                                                  condition: nextList[0]
                                                                } : s));
                                                              }}
                                                              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                            >
                                                              <option value="gte">≥ (At least)</option>
                                                              <option value="gt">&gt; (More than)</option>
                                                              <option value="lte">≤ (At most)</option>
                                                              <option value="lt">&lt; (Fewer than)</option>
                                                              <option value="eq">== (Exactly)</option>
                                                            </select>
                                                          </div>
                                                          <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                                                              Qty Threshold
                                                            </label>
                                                            <input
                                                              type="number"
                                                              min="1"
                                                              value={cond.quantityThreshold ?? 50}
                                                              onChange={(e) => {
                                                                const val = Math.max(1, parseInt(e.target.value, 10) || 0);
                                                                const nextList = stageConditions.map((c, ci) => ci === cIdx ? { ...c, quantityThreshold: val } : c);
                                                                setPDefaultStages(prev => prev.map((s, i) => i === idx ? {
                                                                  ...s,
                                                                  conditions: nextList,
                                                                  condition: nextList[0]
                                                                } : s));
                                                              }}
                                                              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                            />
                                                          </div>
                                                        </div>
                                                      ) : (
                                                        <div className="space-y-1">
                                                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                                                            Variation / Extra Option
                                                          </label>
                                                          {tempCustomizations.length > 0 ? (
                                                            <select
                                                              value={cond.optionName || tempCustomizations[0]?.name || ''}
                                                              onChange={(e) => {
                                                                const optName = e.target.value;
                                                                const optObj = tempCustomizations.find(o => o.name === optName);
                                                                const defaultVal = optObj && optObj.values[0] ? optObj.values[0].value : '';
                                                                const nextList = stageConditions.map((c, ci) => ci === cIdx ? {
                                                                  ...c,
                                                                  optionName: optName,
                                                                  optionValue: defaultVal
                                                                } : c);
                                                                setPDefaultStages(prev => prev.map((s, i) => i === idx ? {
                                                                  ...s,
                                                                  conditions: nextList,
                                                                  condition: nextList[0]
                                                                } : s));
                                                              }}
                                                              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                            >
                                                              {tempCustomizations.map(opt => (
                                                                <option key={opt.name} value={opt.name}>
                                                                  {opt.name} ({opt.type || 'variation'})
                                                                </option>
                                                              ))}
                                                            </select>
                                                          ) : (
                                                            <input
                                                              type="text"
                                                              placeholder="e.g. Size, Packaging, Embroidery"
                                                              value={cond.optionName || ''}
                                                              onChange={(e) => {
                                                                const optName = e.target.value;
                                                                const nextList = stageConditions.map((c, ci) => ci === cIdx ? {
                                                                  ...c,
                                                                  optionName: optName
                                                                } : c);
                                                                setPDefaultStages(prev => prev.map((s, i) => i === idx ? {
                                                                  ...s,
                                                                  conditions: nextList,
                                                                  condition: nextList[0]
                                                                } : s));
                                                              }}
                                                              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                            />
                                                          )}
                                                        </div>
                                                      )}
                                                    </div>

                                                    {/* Option Choice Value if option_match */}
                                                    {cond.type === 'option_match' && (
                                                      <div className="space-y-1 pt-1 border-t border-stone-800/60">
                                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                                                          Required Choice / Value
                                                        </label>
                                                        {(() => {
                                                          const matchedOpt = tempCustomizations.find(o => o.name.toLowerCase() === (cond.optionName || '').toLowerCase());
                                                          if (matchedOpt && matchedOpt.values.length > 0) {
                                                            return (
                                                              <select
                                                                value={cond.optionValue || matchedOpt.values[0].value}
                                                                onChange={(e) => {
                                                                  const val = e.target.value;
                                                                  const nextList = stageConditions.map((c, ci) => ci === cIdx ? {
                                                                    ...c,
                                                                    optionValue: val
                                                                  } : c);
                                                                  setPDefaultStages(prev => prev.map((s, i) => i === idx ? {
                                                                    ...s,
                                                                    conditions: nextList,
                                                                    condition: nextList[0]
                                                                  } : s));
                                                                }}
                                                                className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                              >
                                                                {matchedOpt.values.map(v => (
                                                                  <option key={v.value} value={v.value}>
                                                                    {v.value} {v.priceUplift ? `(+R${v.priceUplift})` : ''}
                                                                  </option>
                                                                ))}
                                                              </select>
                                                            );
                                                          }
                                                          return (
                                                            <input
                                                              type="text"
                                                              placeholder="e.g. Gift Box, Large, Custom Logo"
                                                              value={cond.optionValue || ''}
                                                              onChange={(e) => {
                                                                const val = e.target.value;
                                                                const nextList = stageConditions.map((c, ci) => ci === cIdx ? {
                                                                  ...c,
                                                                  optionValue: val
                                                                } : c);
                                                                setPDefaultStages(prev => prev.map((s, i) => i === idx ? {
                                                                  ...s,
                                                                  conditions: nextList,
                                                                  condition: nextList[0]
                                                                } : s));
                                                              }}
                                                              className="w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                            />
                                                          );
                                                        })()}
                                                      </div>
                                                    )}
                                                  </div>
                                                </React.Fragment>
                                              ))}
                                            </div>

                                            {/* Button to add another condition clause */}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const firstOpt = tempCustomizations[0];
                                                const newCond: StageCondition = {
                                                  id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                                                  type: firstOpt ? 'option_match' : 'quantity_threshold',
                                                  optionName: firstOpt ? firstOpt.name : '',
                                                  optionValue: firstOpt && firstOpt.values[0] ? firstOpt.values[0].value : '',
                                                  quantityOperator: 'gte',
                                                  quantityThreshold: 50
                                                };
                                                const nextList = [...stageConditions, newCond];
                                                setPDefaultStages(prev => prev.map((s, i) => i === idx ? {
                                                  ...s,
                                                  conditions: nextList,
                                                  condition: nextList[0]
                                                } : s));
                                              }}
                                              className="w-full py-2 bg-stone-850 hover:bg-stone-800 text-stone-200 border border-stone-700 hover:border-stone-600 rounded-lg font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                                            >
                                              <Plus size={13} className="text-amber-400" />
                                              Add Another Condition Rule ({currentLogic})
                                            </button>

                                            {/* Summary Box */}
                                            <div className="p-2.5 bg-purple-950/40 border border-purple-800/40 rounded-lg text-[11px] text-purple-200 flex items-start gap-2">
                                              <Sparkles size={13} className="text-purple-400 shrink-0 mt-0.5" />
                                              <div>
                                                <strong className="text-purple-300">Automation Rule ({currentLogic}): </strong>
                                                This stage will be added automatically to job tasks <strong>{getStageConditionSummary(stg).toLowerCase()}</strong>.
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-stone-400 italic bg-stone-50 p-3 rounded-lg border border-stone-200/60">
                            No stages set yet. Add stages below to define the sequence for producing this item.
                          </p>
                        )}

                        {/* Add stage input & reusable presets */}
                        <div className="pt-2 border-t border-stone-200/60 space-y-2">
                          {reusableStages.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Quick Add Existing Stages:</span>
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

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="e.g. Print Images, Quality Check, Custom Packaging..."
                              value={newDefaultStageName}
                              onChange={(e) => setNewDefaultStageName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
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
                                }
                              }}
                              className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-normal text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                              className="px-4 py-2 rounded-lg text-xs font-extrabold bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white cursor-pointer transition shadow-3xs"
                            >
                              Add Stage
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* TAB 3: Inputs & Costs */}
              {editFormTab === 'costs' && (
                <div className="space-y-6 w-full">
                  <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-100 flex-wrap gap-2">
                      <div>
                        <h4 className="font-extrabold text-stone-800 text-sm flex items-center gap-2">
                          <Calculator size={18} className="text-amber-700" /> Inputs & Cost Breakdown
                        </h4>
                        <p className="text-xs text-stone-500 mt-0.5">
                          List materials and labour for 1 unit of this item. Base inputs apply to all variations automatically.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-stone-200">
                          <Lock size={10} /> Internal Only
                        </span>
                        {pInputs.length > 0 && (
                          <button
                            type="button"
                            onClick={openAddInputModal}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer transition flex items-center gap-1 shadow-3xs"
                          >
                            <Plus size={13} /> Add Input Item
                          </button>
                        )}
                      </div>
                    </div>

                    {/* List of Current Inputs */}
                    {pInputs.length > 0 ? (
                      <div className="space-y-2">
                        {pInputs.map((inp, idx) => {
                          const isMat = inp.type === 'material';
                          const isLab = inp.type === 'labour';
                          const isBase = isInputBase(inp);
                          const keys = inp.applicableValueKeys || (inp.optionName && inp.optionValue ? [`${inp.optionName}:::${inp.optionValue}`] : []);
                          
                          return (
                            <div key={inp.id || idx} className="bg-stone-50 p-3 rounded-xl border border-stone-200/80 space-y-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-amber-100/80 text-amber-900 flex items-center justify-center shrink-0">
                                    {isMat && <Box size={14} />}
                                    {isLab && <Clock size={14} />}
                                    {!isMat && !isLab && <DollarSign size={14} />}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-stone-800 text-xs truncate">{inp.name}</span>
                                      {isBase ? (
                                        <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md font-normal border border-stone-200 shrink-0">
                                          Base (All Variations)
                                        </span>
                                      ) : (
                                        <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-normal border border-amber-200 shrink-0">
                                          {keys.length === 1 
                                            ? `For ${keys[0].replace(':::', ': ')}`
                                            : `For ${keys.length} Variations`}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-stone-500 block mt-0.5">
                                      {isMat && `${inp.amount} ${inp.unit}`}
                                      {isLab && `${inp.amount} ${inp.unit} @ ${formatZAR(inp.hourlyRate || 0)}/hr`}
                                      {!isMat && !isLab && 'Direct Input'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-extrabold text-stone-900 text-xs">
                                    {formatZAR(inp.cost)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => startEditInput(idx)}
                                    className="text-stone-400 hover:text-amber-700 p-1.5 cursor-pointer transition rounded-lg hover:bg-stone-200/60"
                                    title="Edit input item"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPInputs(prev => prev.filter((_, i) => i !== idx))}
                                    className="text-stone-400 hover:text-rose-600 p-1.5 cursor-pointer transition rounded-lg hover:bg-stone-200/60"
                                    title="Remove input"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-stone-50/80 p-8 rounded-2xl border border-dashed border-stone-300 text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                          <Calculator size={22} />
                        </div>
                        <div className="max-w-md mx-auto space-y-1">
                          <h5 className="font-extrabold text-stone-800 text-sm">No input items added yet</h5>
                          <p className="text-xs text-stone-500">
                            Add materials, labour, or direct cost items for 1 unit of this product to calculate unit costs and profit margins.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={openAddInputModal}
                          className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer transition inline-flex items-center gap-1.5 shadow-xs"
                        >
                          <Plus size={14} /> Add Input Item
                        </button>
                      </div>
                    )}

                    {/* Summary Footer Box */}
                  {(() => {
                    const dummyProduct: Product = {
                      id: editingProduct?.id || 'temp',
                      name: pName || 'Temp',
                      description: '',
                      photo: '',
                      isActive: true,
                      basePrice: parsePrice(pBasePrice),
                      priceBreaks: [],
                      inputs: pInputs,
                      customizationOptions: tempCustomizations
                    };

                    const baseCost = calculateProductBaseUnitCost(dummyProduct, materials);
                    const basePriceNum = parsePrice(pBasePrice);
                    const baseProfit = basePriceNum - baseCost;
                    const baseMargin = basePriceNum > 0 ? (baseProfit / basePriceNum) * 100 : 0;

                    let testExtraInputsCost = 0;
                    let testPriceUplifts = 0;

                    tempCustomizations.forEach(opt => {
                      const selectedValStr = testVariationSelection[opt.name];
                      if (selectedValStr) {
                        testExtraInputsCost += calculateProductOptionExtraCost(opt.name, selectedValStr, dummyProduct, materials);
                        const valObj = opt.values.find(v => v.value === selectedValStr);
                        if (valObj) {
                          testPriceUplifts += valObj.priceUplift || 0;
                        }
                      }
                    });

                    const testTotalCost = baseCost + testExtraInputsCost;
                    const testTotalPrice = basePriceNum + testPriceUplifts;
                    const testProfit = testTotalPrice - testTotalCost;
                    const testMargin = testTotalPrice > 0 ? (testProfit / testTotalPrice) * 100 : 0;

                    const hasVariationInputs = pInputs.some(i => !!i.optionName);

                    return (
                      <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/80 space-y-3">
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-amber-900 block">Base Product Cost & Profit:</span>
                          <div className="grid grid-cols-3 gap-2 text-center bg-white p-2.5 rounded-lg border border-amber-200/60 shadow-2xs">
                            <div>
                              <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider block">Base Cost</span>
                              <span className="text-xs font-extrabold text-stone-800">{formatZAR(baseCost)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider block">Base Price</span>
                              <span className="text-xs font-extrabold text-stone-800">{formatZAR(basePriceNum)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-amber-800 font-bold uppercase tracking-wider block">Base Profit</span>
                              <span className={`text-xs font-black ${baseProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                {formatZAR(baseProfit)} ({baseMargin.toFixed(0)}%)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Variation Cost Previewer */}
                        {tempCustomizations.length > 0 && (
                          <div className="pt-2 border-t border-amber-200/60 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-extrabold text-stone-800 flex items-center gap-1">
                                <Calculator size={12} className="text-amber-700" /> Test Variation & Extra Cost:
                              </span>
                              {hasVariationInputs && (
                                <span className="text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                                  Variation Inputs Active
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {tempCustomizations.map(opt => (
                                <div key={opt.name} className="space-y-0.5">
                                  <label className="text-[10px] font-bold text-stone-600 block">{opt.name}:</label>
                                  <select
                                    value={testVariationSelection[opt.name] || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setTestVariationSelection(prev => ({
                                        ...prev,
                                        [opt.name]: val
                                      }));
                                    }}
                                    className="w-full px-2 py-1 bg-white border border-stone-200 rounded text-xs font-normal text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                  >
                                    <option value="">Default / Base Choice</option>
                                    {opt.values.map(v => (
                                      <option key={v.value} value={v.value}>
                                        {v.value} {v.priceUplift > 0 ? `(+R${v.priceUplift})` : ''}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                            </div>

                            {/* Combination Result Card */}
                            {Object.values(testVariationSelection).some(Boolean) && (
                              <div className="bg-stone-900 text-white p-3 rounded-lg space-y-1.5 shadow-xs">
                                <div className="flex justify-between items-center text-[10px] text-stone-300 font-bold uppercase tracking-wider border-b border-stone-800 pb-1">
                                  <span>Selected Combination Breakdown</span>
                                  <span>Final Unit Numbers</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                  <div>
                                    <span className="text-[9px] text-stone-400 block">Unit Cost</span>
                                    <span className="font-extrabold text-stone-100">{formatZAR(testTotalCost)}</span>
                                    {testExtraInputsCost > 0 && (
                                      <span className="text-[9px] text-amber-400 block">+{formatZAR(testExtraInputsCost)} extra</span>
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-stone-400 block">Final Price</span>
                                    <span className="font-extrabold text-stone-100">{formatZAR(testTotalPrice)}</span>
                                    {testPriceUplifts > 0 && (
                                      <span className="text-[9px] text-amber-400 block">+{formatZAR(testPriceUplifts)} uplift</span>
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-stone-400 block">Unit Profit</span>
                                    <span className={`font-black ${testProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {formatZAR(testProfit)} ({testMargin.toFixed(0)}%)
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <p className="text-[11px] text-amber-800/80 text-center font-medium pt-1 border-t border-amber-200/50">
                          🔒 Internal cost & profit estimates are hidden from customer views.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 justify-end pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => { setIsAddingProduct(false); setEditingProduct(null); }}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-600 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition cursor-pointer shadow-xs"
                >
                  {editingProduct 
                    ? (activeTab === 'services' ? 'Update Service' : 'Update Product') 
                    : (activeTab === 'services' ? 'Add Service' : 'Add Craft Product')}
                </button>
              </div>
            </div>
          </form>
          )}

          {/* List Products */}
          {!isAddingProduct && !editingProduct && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="product-cards-grid">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-stone-200" id="empty-products-msg">
                  <p className="text-stone-400">
                    {productSearchTerm 
                      ? `No ${activeTab === 'services' ? 'services' : 'products'} match "${productSearchTerm}".` 
                      : `Your ${activeTab === 'services' ? 'service' : 'product'} catalogue is empty.`}
                  </p>
                  {!productSearchTerm && (
                    <button
                      onClick={startAddProduct}
                      className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                    >
                      {activeTab === 'services' ? 'Add Your First Service' : 'Add Your First Craft Item'}
                    </button>
                  )}
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const group = groups.find(g => g.id === p.groupId);
                  return (
                    <div 
                      key={p.id}
                      onClick={() => startEditProduct(p)}
                      className={`bg-white rounded-2xl border border-stone-200 overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-amber-400/80 transition-all cursor-pointer group ${
                        !p.isActive ? 'opacity-65' : ''
                      }`}
                    >
                      <div>
                        {/* Image banner */}
                        <div className="relative h-44 bg-stone-100">
                          <img 
                            src={getProductPhotoUrl(p.photo, p.id || p.name)} 
                            alt={p.name} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => handleImageError(e, p.id || p.name)}
                          />
                          {!p.isActive && (
                            <span className="absolute top-3 left-3 bg-stone-800 text-white text-[10px] font-bold px-2 py-1 rounded-md">
                              Inactive
                            </span>
                          )}
                        </div>

                        {/* Details */}
                        <div className="p-4 space-y-2">
                          <div>
                            <h4 className="font-bold text-stone-800 text-base leading-snug">{p.name}</h4>
                          </div>
                          {p.description && (
                            <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">{p.description}</p>
                          )}
                          <div className="pt-0.5">
                            <span className="font-extrabold text-stone-900 text-base">{formatZAR(p.basePrice)}</span>
                          </div>

                          {/* Stock Indicator for Physical Products vs Service Badge */}
                          {activeTab !== 'services' ? (
                            <div className="pt-2.5 flex items-center justify-between border-t border-stone-100">
                              <div className="flex items-center gap-1.5">
                                <Package size={13} className={(p.stockQuantity || 0) > 0 ? "text-emerald-600" : "text-amber-600"} />
                                <span className="text-[10px] text-stone-500 font-extrabold uppercase tracking-wider">In Stock</span>
                              </div>

                              <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-lg border ${
                                (p.stockQuantity || 0) > 0
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200/80"
                                  : "bg-amber-50 text-amber-800 border-amber-200/80"
                              }`}>
                                {p.stockQuantity ?? 0} {(p.stockQuantity === 1) ? 'unit' : 'units'}
                              </span>
                            </div>
                          ) : (
                            <div className="pt-2.5 flex items-center justify-between border-t border-stone-100">
                              <span className="text-[10px] text-amber-800 font-extrabold bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-lg">
                                🛠️ Service Item
                              </span>
                              <span className="text-[10px] text-stone-400 font-medium italic">No physical stock</span>
                            </div>
                          )}

                          {/* Displays price breaks tags */}
                          {p.priceBreaks.length > 1 && (
                            <div className="pt-2">
                              <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wider block mb-1">Wholesale Tiers:</span>
                              <div className="flex flex-wrap gap-1">
                                {p.priceBreaks.map((pb, idx) => (
                                  <span key={idx} className="text-[10px] bg-stone-50 border border-stone-100 px-1.5 py-0.5 rounded text-stone-600 font-semibold">
                                    {pb.minQty}{pb.maxQty ? `-${pb.maxQty}` : '+'} @ {formatZAR(pb.unitPrice)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Customisations counts */}
                          {p.customizationOptions.length > 0 && (
                            <div className="pt-1 flex items-center gap-1.5 text-[10px] text-amber-700 font-semibold bg-amber-50/50 p-1.5 rounded-lg border border-amber-100/50 w-fit">
                              <Sparkles size={11} />
                              {p.customizationOptions.length} customization spec options
                            </div>
                          )}

                          {/* Default Production Stages */}
                          {p.trackingMode !== 'whole' && p.defaultStages && p.defaultStages.length > 0 && (
                            <div className="pt-2 border-t border-stone-100">
                              <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wider block mb-1">Production Process ({p.defaultStages.length} Stages):</span>
                              <div className="flex flex-wrap gap-1">
                                {p.defaultStages.map((stg, sIdx) => {
                                  const stageName = typeof stg === 'string' ? stg : stg.name;
                                  const isCond = typeof stg === 'object' && !!stg.isConditional;
                                  return (
                                    <span 
                                      key={sIdx} 
                                      className={`text-[10px] border px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                                        isCond 
                                          ? 'bg-purple-50 border-purple-200 text-purple-900' 
                                          : 'bg-amber-50/80 border-amber-200/60 text-amber-900'
                                      }`}
                                    >
                                      <ListTodo size={9} className={isCond ? "text-purple-600" : "text-amber-600"} /> 
                                      {stageName}
                                      {isCond && (
                                        <span className="text-[8px] bg-purple-200/80 text-purple-900 px-1 py-0.2 rounded font-extrabold uppercase">
                                          Rule
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}


                        </div>
                      </div>

                      {/* Actions footer */}
                      <div className="p-4 pt-3 border-t border-stone-100 flex gap-2 justify-end bg-stone-50/50">
                        <button
                          onClick={() => startEditProduct(p)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-extrabold bg-white hover:bg-stone-100 text-stone-700 hover:text-stone-900 border border-stone-200 rounded-xl transition shadow-3xs cursor-pointer"
                        >
                          <Edit2 size={11} /> {activeTab === 'services' ? 'Edit Service' : 'Edit Product'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setProductToDelete(p);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold bg-white hover:bg-rose-50 text-stone-500 hover:text-rose-600 border border-stone-200 hover:border-rose-100 rounded-xl transition cursor-pointer"
                          title="Delete product"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* GROUPS TAB */}
      {activeTab === 'groups' && (
        <>
          {/* Add / Edit Group Form */}
          {(isAddingGroup || editingGroup) && (
            <form onSubmit={handleSaveGroup} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4 max-w-xl mx-auto">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <h3 className="font-bold text-stone-800 text-lg">
                  {editingGroup ? `Edit ${editingGroup.name}` : 'Create Product Group'}
                </h3>
                <button
                  type="button"
                  onClick={() => { setIsAddingGroup(false); setEditingGroup(null); }}
                  className="text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="e.g. Handmade Pottery, Natural Skincare"
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Group Description</label>
                <textarea
                  value={groupDesc}
                  onChange={e => setGroupDesc(e.target.value)}
                  rows={2}
                  placeholder="Explain what products are in this category..."
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider">Default Bulk Discount % (Optional)</label>
                  <span className="text-[10px] text-stone-400 italic">Complexity Deferment helper</span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={groupDiscount || ''}
                  onChange={e => setGroupDiscount(e.target.value)}
                  placeholder="e.g. 5% extra discount for items in this group"
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setIsAddingGroup(false); setEditingGroup(null); }}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-600 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                >
                  {editingGroup ? 'Update Group' : 'Create Group'}
                </button>
              </div>
            </form>
          )}

          {/* List Product Groups */}
          {!isAddingGroup && !editingGroup && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="groups-grid">
              {filteredGroups.length === 0 ? (
                <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-stone-200">
                  <p className="text-stone-400">
                    {productSearchTerm ? `No groups match "${productSearchTerm}".` : 'No product groups found.'}
                  </p>
                </div>
              ) : (
                filteredGroups.map((g) => {
                  const groupProductCount = products.filter(p => p.groupId === g.id).length;
                  return (
                    <div key={g.id} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-3xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-amber-700 mb-2">
                          <Layers size={18} />
                          <h4 className="font-bold text-stone-800 text-base">{g.name}</h4>
                        </div>
                        <p className="text-xs text-stone-500 min-h-[32px]">{g.description}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="text-[10px] bg-stone-50 border border-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-bold">
                            {groupProductCount} Products Linked
                          </span>
                          {g.bulkDiscountPercentage && (
                            <span className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                              {g.bulkDiscountPercentage}% Group Discount
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-stone-50 flex gap-2 justify-end">
                        <button
                          onClick={() => startEditGroup(g)}
                          className="p-1.5 hover:bg-stone-50 text-stone-500 hover:text-stone-800 rounded-lg transition cursor-pointer"
                          title="Edit Group"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setGroupToDelete(g)}
                          className="p-1.5 hover:bg-rose-50 text-stone-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                          title="Delete Group"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* Product Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-stone-200 shadow-2xl space-y-4 animate-scaleIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-stone-900 text-base">Delete Product</h3>
                <p className="text-xs text-stone-500 font-medium">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-100">
              Are you sure you want to delete <span className="font-bold text-stone-800">{productToDelete.name}</span> from your catalog?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'services') {
                    if (onDeleteService) onDeleteService(productToDelete.id);
                    else onDeleteProduct(productToDelete.id);
                  } else {
                    onDeleteProduct(productToDelete.id);
                  }
                  setProductToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Delete {activeTab === 'services' ? 'Service' : 'Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Delete Confirmation Modal */}
      {/* Add / Edit Input Item Modal */}
      {isInputModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-stone-200 shadow-2xl space-y-4 animate-scaleIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center">
                  <Calculator size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-base">
                    {editingInputIdx !== null ? 'Edit Input Item' : 'Add Input Item'}
                  </h3>
                  <p className="text-xs text-stone-500 font-normal">
                    {editingInputIdx !== null ? 'Modify existing input details or variation scope.' : 'Add a material, labour, or direct cost item for this product.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsInputModalOpen(false);
                  setEditingInputIdx(null);
                }}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer rounded-lg hover:bg-stone-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scope selection inside modal */}
            <VariationScopeSelector
              customizations={tempCustomizations}
              selectedKeys={newInputTargetKeys}
              onChange={(newKeys) => setNewInputTargetKeys(newKeys)}
            />

            {/* Input type selection tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-100 rounded-lg border border-stone-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setNewInputType('material')}
                className={`py-1.5 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                  newInputType === 'material' ? 'bg-amber-700 text-white shadow-3xs' : 'text-stone-600 hover:text-stone-800'
                }`}
              >
                <Box size={13} /> Material
              </button>
              <button
                type="button"
                onClick={() => setNewInputType('labour')}
                className={`py-1.5 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                  newInputType === 'labour' ? 'bg-amber-700 text-white shadow-3xs' : 'text-stone-600 hover:text-stone-800'
                }`}
              >
                <Clock size={13} /> Labour
              </button>
              <button
                type="button"
                onClick={() => setNewInputType('direct')}
                className={`py-1.5 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                  newInputType === 'direct' ? 'bg-amber-700 text-white shadow-3xs' : 'text-stone-600 hover:text-stone-800'
                }`}
              >
                <DollarSign size={13} /> Direct
              </button>
            </div>

            {/* Subform: Material */}
            {newInputType === 'material' && (
              <div className="space-y-3 pt-1">
                {materials.length === 0 ? (
                  <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200">
                    No bulk materials found. You can register materials in the <strong>Materials</strong> tab, or add Direct/Labour inputs.
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-stone-600">Select Material</label>
                      <select
                        value={selectedMaterialId}
                        onChange={(e) => {
                          setSelectedMaterialId(e.target.value);
                          const m = materials.find(mat => mat.id === e.target.value);
                          if (m) setInputUnit(m.unit);
                        }}
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-normal text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({formatZAR(getMaterialUnitCost(m))}/{m.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-stone-600">Amount Used</label>
                        <input
                          type="number"
                          step="any"
                          min="0.0001"
                          value={inputAmount}
                          onChange={(e) => setInputAmount(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-normal text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-stone-600">Unit</label>
                        <select
                          value={inputUnit}
                          onChange={(e) => setInputUnit(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-normal text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          {COMMON_UNITS.map(u => (
                            <option key={u.value} value={u.value}>{u.value}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Subform: Labour */}
            {newInputType === 'labour' && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-stone-600">Labour / Task Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Hand Assembly & Polishing..."
                    value={labourName}
                    onChange={(e) => setLabourName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-normal text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-stone-600">Hourly Rate (R)</label>
                    <input
                      type="number"
                      step="any"
                      value={labourHourlyRate}
                      onChange={(e) => setLabourHourlyRate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-normal text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-stone-600">Time Taken</label>
                    <input
                      type="number"
                      step="any"
                      value={labourTimeAmount}
                      onChange={(e) => setLabourTimeAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-normal text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-stone-600">Time Unit</label>
                    <select
                      value={labourTimeUnit}
                      onChange={(e) => setLabourTimeUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-normal text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="mins">Minutes</option>
                      <option value="hrs">Hours</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Subform: Direct */}
            {newInputType === 'direct' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-stone-600">Direct Cost Item</label>
                  <input
                    type="text"
                    placeholder="e.g. Courier Box, Laser Fee..."
                    value={directInputName}
                    onChange={(e) => setDirectInputName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-normal text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-stone-600">Cost (ZAR)</label>
                  <input
                    type="number"
                    step="any"
                    value={directInputCost}
                    onChange={(e) => setDirectInputCost(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-normal text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setIsInputModalOpen(false);
                  setEditingInputIdx(null);
                }}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddInputToProduct}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                {editingInputIdx !== null ? 'Save Changes' : 'Add Input'}
              </button>
            </div>
          </div>
        </div>
      )}

      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-stone-200 shadow-2xl space-y-4 animate-scaleIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-stone-900 text-base">Delete Product Group</h3>
                <p className="text-xs text-stone-500 font-medium">Group organization will be removed.</p>
              </div>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-100">
              Are you sure you want to delete the group <span className="font-bold text-stone-800">"{groupToDelete.name}"</span>? Products inside will remain in your catalog.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteGroup(groupToDelete.id);
                  setGroupToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Delete Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
