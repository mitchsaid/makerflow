import { Material, ProductInput, Product, QuoteLineItem, JobTaskItem, CustomizationOptionValue, ProductStageConfig, StageCondition, ItemStageProgress, LineItemCustomizations } from '../types';

export const COMMON_UNITS = [
  { label: 'Grams (g)', value: 'g', type: 'weight' },
  { label: 'Kilograms (kg)', value: 'kg', type: 'weight' },
  { label: 'Millilitres (ml)', value: 'ml', type: 'volume' },
  { label: 'Litres (L)', value: 'l', type: 'volume' },
  { label: 'Millimetres (mm)', value: 'mm', type: 'length' },
  { label: 'Centimetres (cm)', value: 'cm', type: 'length' },
  { label: 'Metres (m)', value: 'm', type: 'length' },
  { label: 'Pieces / Units (pcs)', value: 'pcs', type: 'count' },
  { label: 'Sheets', value: 'sheet', type: 'count' },
  { label: 'Rolls', value: 'roll', type: 'count' },
  { label: 'Boxes', value: 'box', type: 'count' },
  { label: 'Packs', value: 'pack', type: 'count' }
];

export function getMaterialUnitCost(material: Material): number {
  if (!material.bulkQuantity || material.bulkQuantity <= 0) return 0;
  return material.bulkCost / material.bulkQuantity;
}

/**
  Calculates the cost of using a specific amount of a Material, taking unit conversions into account.
 */
export function calculateMaterialInputCost(
  material: Material,
  amount: number,
  inputUnit?: string
): number {
  if (!material || !amount || amount <= 0) return 0;

  const baseUnitCost = getMaterialUnitCost(material);
  const matUnit = (material.unit || '').toLowerCase().trim();
  const inpUnit = (inputUnit || material.unit || '').toLowerCase().trim();

  // If units match exactly or no input unit specified
  if (matUnit === inpUnit || !inpUnit) {
    return amount * baseUnitCost;
  }

  // Weight conversion (kg <-> g)
  if (matUnit === 'kg' && inpUnit === 'g') {
    // Material cost per kg => cost per gram is baseUnitCost / 1000
    return amount * (baseUnitCost / 1000);
  }
  if (matUnit === 'g' && inpUnit === 'kg') {
    return amount * (baseUnitCost * 1000);
  }

  // Volume conversion (L <-> ml)
  if ((matUnit === 'l' || matUnit === 'litre' || matUnit === 'litres') && inpUnit === 'ml') {
    return amount * (baseUnitCost / 1000);
  }
  if (inpUnit === 'ml' && (matUnit === 'l' || matUnit === 'litre' || matUnit === 'litres')) {
    return amount * (baseUnitCost * 1000);
  }

  // Length conversions (m <-> cm <-> mm)
  if (matUnit === 'm' && inpUnit === 'cm') {
    return amount * (baseUnitCost / 100);
  }
  if (matUnit === 'm' && inpUnit === 'mm') {
    return amount * (baseUnitCost / 1000);
  }
  if (matUnit === 'cm' && inpUnit === 'm') {
    return amount * (baseUnitCost * 100);
  }
  if (matUnit === 'cm' && inpUnit === 'mm') {
    return amount * (baseUnitCost / 10);
  }
  if (matUnit === 'mm' && inpUnit === 'm') {
    return amount * (baseUnitCost * 1000);
  }
  if (matUnit === 'mm' && inpUnit === 'cm') {
    return amount * (baseUnitCost * 10);
  }

  // Default fallback if unrecognised conversion
  return amount * baseUnitCost;
}

export function calculateLabourInputCost(
  amount: number,
  unit: string | undefined,
  hourlyRate: number
): number {
  if (!amount || amount <= 0 || !hourlyRate || hourlyRate <= 0) return 0;
  const u = (unit || 'hrs').toLowerCase().trim();
  const hours = (u === 'min' || u === 'mins' || u === 'minutes') ? amount / 60 : amount;
  return hours * hourlyRate;
}

export function isInputBase(inp: ProductInput): boolean {
  const hasKeys = inp.applicableValueKeys && inp.applicableValueKeys.length > 0;
  const hasLegacySingle = Boolean(inp.optionName && inp.optionValue);
  return !hasKeys && !hasLegacySingle;
}

export function isInputMatchingOptionValue(inp: ProductInput, optionName: string, optionValue: string): boolean {
  if (inp.applicableValueKeys && inp.applicableValueKeys.length > 0) {
    const key = `${optionName}:::${optionValue}`;
    return inp.applicableValueKeys.includes(key);
  }
  if (inp.optionName && inp.optionValue) {
    return inp.optionName === optionName && inp.optionValue === optionValue;
  }
  return false;
}

export function calculateSingleInputCost(inp: ProductInput, materials?: Material[]): number {
  if (inp.type === 'material' && inp.materialId && materials && materials.length > 0) {
    const mat = materials.find(m => m.id === inp.materialId);
    if (mat) {
      return calculateMaterialInputCost(mat, inp.amount, inp.unit);
    }
  }
  if (inp.type === 'labour' && inp.hourlyRate && inp.hourlyRate > 0) {
    return calculateLabourInputCost(inp.amount, inp.unit, inp.hourlyRate);
  }
  return inp.cost || 0;
}

export function calculateProductInputsTotalCost(inputs?: ProductInput[], materials?: Material[]): number {
  if (!inputs || inputs.length === 0) return 0;
  return inputs.reduce((sum, inp) => sum + calculateSingleInputCost(inp, materials), 0);
}

export function calculateProductBaseUnitCost(product: Product, materials?: Material[]): number {
  if (!product.inputs || product.inputs.length === 0) return 0;
  // Filter base inputs (not allocated to specific variation/extra choices)
  const baseInputs = product.inputs.filter(isInputBase);
  return calculateProductInputsTotalCost(baseInputs, materials);
}

export function calculateProductOptionExtraCost(
  optionName: string,
  optionValue: string,
  product: Product,
  materials?: Material[]
): number {
  let totalExtra = 0;

  // 1. Inputs attached to product.inputs matching optionName & optionValue
  if (product.inputs) {
    const matchingInputs = product.inputs.filter(inp =>
      isInputMatchingOptionValue(inp, optionName, optionValue)
    );
    totalExtra += calculateProductInputsTotalCost(matchingInputs, materials);
  }

  // 2. Direct inputs stored inside option.values[].inputs
  if (product.customizationOptions) {
    const opt = product.customizationOptions.find(o => o.name === optionName);
    if (opt) {
      const valObj = opt.values.find(v => v.value === optionValue);
      if (valObj && valObj.inputs) {
        totalExtra += calculateProductInputsTotalCost(valObj.inputs, materials);
      }
    }
  }

  return totalExtra;
}

/**
  Calculates the unit cost of a product considering selected variations/extras if they have inputs
 */
export function calculateLineItemUnitCost(
  item: QuoteLineItem | JobTaskItem,
  product?: Product,
  materials?: Material[]
): number {
  if (item.unitCost !== undefined && item.unitCost !== null && item.unitCost > 0) {
    return item.unitCost;
  }

  let totalUnitCost = 0;

  if (product) {
    totalUnitCost += calculateProductBaseUnitCost(product, materials);

    // Check selected customizations for variation/extra inputs
    if (item.selectedCustomizations && product.customizationOptions) {
      Object.entries(item.selectedCustomizations).forEach(([optName, selectedVal]) => {
        totalUnitCost += calculateProductOptionExtraCost(optName, selectedVal.value, product, materials);
      });
    }
  }

  return totalUnitCost;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMarginPercent: number;
  hasAnyInputs: boolean;
  itemBreakdown: Array<{
    title: string;
    quantity: number;
    unitPrice: number;
    unitCost: number;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    profitMarginPercent: number;
    hasInputs: boolean;
  }>;
}

export function calculateOrderFinancialSummary(
  items: Array<QuoteLineItem | JobTaskItem>,
  products: Product[],
  totalOrderRevenue?: number
): FinancialSummary {
  let grandTotalCost = 0;
  let calculatedGrandRevenue = 0;
  let hasAnyInputs = false;

  const itemBreakdown = items.map(item => {
    const isQuoteItem = 'productName' in item;
    const title = isQuoteItem ? (item as QuoteLineItem).productName : (item as JobTaskItem).title;
    const quantity = item.quantity || 1;

    // Unit revenue
    const unitPrice = isQuoteItem ? ((item as QuoteLineItem).total / quantity) : 0;
    const totalItemRevenue = isQuoteItem ? (item as QuoteLineItem).total : 0;
    calculatedGrandRevenue += totalItemRevenue;

    // Find product definition
    const prodId = isQuoteItem ? (item as QuoteLineItem).productId : (item as JobTaskItem).productId;
    const prod = products.find(p => p.id === prodId) ||
                 products.find(p => p.name.toLowerCase().trim() === title.toLowerCase().trim()) ||
                 products.find(p => title.toLowerCase().includes(p.name.toLowerCase().trim()) || p.name.toLowerCase().includes(title.toLowerCase().trim()));

    const unitCost = calculateLineItemUnitCost(item, prod);
    const totalItemCost = unitCost * quantity;
    const itemProfit = totalItemRevenue - totalItemCost;
    const itemMargin = totalItemRevenue > 0 ? (itemProfit / totalItemRevenue) * 100 : 0;

    const itemHasInputs = !!(prod?.inputs && prod.inputs.length > 0);
    if (itemHasInputs) hasAnyInputs = true;

    grandTotalCost += totalItemCost;

    return {
      title,
      quantity,
      unitPrice,
      unitCost,
      totalRevenue: totalItemRevenue,
      totalCost: totalItemCost,
      totalProfit: itemProfit,
      profitMarginPercent: itemMargin,
      hasInputs: itemHasInputs
    };
  });

  const finalRevenue = totalOrderRevenue !== undefined ? totalOrderRevenue : calculatedGrandRevenue;
  const grandProfit = finalRevenue - grandTotalCost;
  const grandMargin = finalRevenue > 0 ? (grandProfit / finalRevenue) * 100 : 0;

  return {
    totalRevenue: finalRevenue,
    totalCost: grandTotalCost,
    totalProfit: grandProfit,
    profitMarginPercent: grandMargin,
    hasAnyInputs,
    itemBreakdown
  };
}

/**
 * Converts an input amount in inputUnit to the material's bulk unit.
 */
export function convertMaterialAmount(
  amount: number,
  inputUnit: string | undefined,
  materialUnit: string
): number {
  if (!amount || amount <= 0) return 0;
  const matUnit = (materialUnit || '').toLowerCase().trim();
  const inpUnit = (inputUnit || materialUnit || '').toLowerCase().trim();

  if (matUnit === inpUnit || !inpUnit) return amount;

  // Weight conversion (kg <-> g)
  if (matUnit === 'kg' && inpUnit === 'g') return amount / 1000;
  if (matUnit === 'g' && inpUnit === 'kg') return amount * 1000;

  // Volume conversion (l <-> ml)
  if ((matUnit === 'l' || matUnit === 'litre' || matUnit === 'litres') && inpUnit === 'ml') return amount / 1000;
  if (inpUnit === 'ml' && (matUnit === 'l' || matUnit === 'litre' || matUnit === 'litres')) return amount * 1000;

  // Length conversions (m <-> cm <-> mm)
  if (matUnit === 'm' && inpUnit === 'cm') return amount / 100;
  if (matUnit === 'm' && inpUnit === 'mm') return amount / 1000;
  if (matUnit === 'cm' && inpUnit === 'm') return amount * 100;
  if (matUnit === 'cm' && inpUnit === 'mm') return amount / 10;
  if (matUnit === 'mm' && inpUnit === 'm') return amount * 1000;
  if (matUnit === 'mm' && inpUnit === 'cm') return amount * 10;

  return amount;
}

/**
 * Resolves all raw material requirements needed to produce 1 unit of a job task item or line item.
 */
export function getItemMaterialRequirements(
  item: JobTaskItem | QuoteLineItem,
  products: Product[]
): { materialId: string; amountPerUnit: number; unit?: string }[] {
  const title = (item as JobTaskItem).title || (item as QuoteLineItem).productName || '';
  const prod = products.find(p => p.id === item.productId) ||
               products.find(p => p.name.toLowerCase().trim() === title.toLowerCase().trim()) ||
               products.find(p => title.toLowerCase().includes(p.name.toLowerCase().trim()) || p.name.toLowerCase().includes(title.toLowerCase().trim()));
  if (!prod) return [];

  const matMap: { [materialId: string]: { amount: number; unit?: string } } = {};

  const processInput = (inp: ProductInput) => {
    if (inp.type === 'material' && inp.materialId && inp.amount > 0) {
      if (!matMap[inp.materialId]) {
        matMap[inp.materialId] = { amount: 0, unit: inp.unit };
      }
      matMap[inp.materialId].amount += inp.amount;
    }
  };

  // 1. Base inputs
  if (prod.inputs) {
    prod.inputs.filter(isInputBase).forEach(processInput);
  }

  // 2. Selected Customization inputs
  if (item.selectedCustomizations && Object.keys(item.selectedCustomizations).length > 0) {
    Object.entries(item.selectedCustomizations).forEach(([optName, selectVal]) => {
      const valStr = selectVal.value;
      if (prod.inputs) {
        prod.inputs.filter(inp => isInputMatchingOptionValue(inp, optName, valStr)).forEach(processInput);
      }
      if (prod.customizationOptions) {
        const opt = prod.customizationOptions.find(o => o.name === optName);
        if (opt) {
          const valObj = opt.values.find(v => v.value === valStr);
          if (valObj && valObj.inputs) {
            valObj.inputs.forEach(processInput);
          }
        }
      }
    });
  }

  return Object.entries(matMap).map(([materialId, data]) => ({
    materialId,
    amountPerUnit: data.amount,
    unit: data.unit,
  }));
}

export interface TaskMaterialRequirement {
  materialId: string;
  materialName: string;
  category?: string;
  unit: string;
  amountPerUnit: number;
  totalRequired: number;
  bulkUnit: string;
  totalRequiredInBulkUnit: number;
  currentStock: number;
  isSufficient: boolean;
  shortageInBulkUnit: number;
}

export function getTaskMaterialBreakdown(
  item: JobTaskItem,
  products: Product[],
  materials: Material[]
): TaskMaterialRequirement[] {
  const reqs = getItemMaterialRequirements(item, products);
  if (!reqs || reqs.length === 0) return [];

  const unitsToMake = Math.max(0, item.quantity - (item.stockCount || 0));

  return reqs.map(req => {
    const mat = materials.find(m => m.id === req.materialId);
    const materialName = mat ? mat.name : 'Unknown Material';
    const category = mat ? mat.category : undefined;
    const bulkUnit = mat ? mat.unit : (req.unit || 'pcs');

    const totalRequired = req.amountPerUnit * unitsToMake;
    const totalRequiredInBulkUnit = mat 
      ? convertMaterialAmount(totalRequired, req.unit, mat.unit)
      : totalRequired;

    const currentStock = mat 
      ? (mat.stockQuantity !== undefined ? mat.stockQuantity : mat.bulkQuantity)
      : 0;

    const isSufficient = currentStock >= totalRequiredInBulkUnit;
    const shortageInBulkUnit = isSufficient ? 0 : Math.round((totalRequiredInBulkUnit - currentStock) * 1000) / 1000;

    return {
      materialId: req.materialId,
      materialName,
      category,
      unit: req.unit || bulkUnit,
      amountPerUnit: req.amountPerUnit,
      totalRequired,
      bulkUnit,
      totalRequiredInBulkUnit: Math.round(totalRequiredInBulkUnit * 1000) / 1000,
      currentStock,
      isSufficient,
      shortageInBulkUnit
    };
  });
}

export function getSingleConditionClauseSummary(condition?: StageCondition): string {
  if (!condition) return 'Rule set';
  if (condition.type === 'quantity_threshold') {
    const opMap: Record<string, string> = {
      gte: '≥',
      gt: '>',
      lte: '≤',
      lt: '<',
      eq: '='
    };
    const symbol = opMap[condition.quantityOperator || 'gte'] || '≥';
    return `Order quantity ${symbol} ${condition.quantityThreshold ?? 0}`;
  }
  if (condition.type === 'option_match') {
    return `'${condition.optionName || 'Option'}' = '${condition.optionValue || 'Value'}'`;
  }
  if (condition.type === 'option_selected') {
    return `'${condition.optionName || 'Option'}' is selected`;
  }
  return 'Rule set';
}

export function getStageConditionSummary(
  stageOrCondition?: ProductStageConfig | StageCondition | null
): string {
  if (!stageOrCondition) return 'Always included';

  // Check if it's a ProductStageConfig or a StageCondition
  const isStageConfig = typeof stageOrCondition === 'object' && ('name' in stageOrCondition || 'conditions' in stageOrCondition || 'conditionLogic' in stageOrCondition || 'isConditional' in stageOrCondition);
  
  if (isStageConfig) {
    const stage = stageOrCondition as ProductStageConfig;
    if (!stage.isConditional) return 'Always included';

    const conditionsList = (stage.conditions && stage.conditions.length > 0)
      ? stage.conditions
      : (stage.condition ? [stage.condition] : []);

    if (conditionsList.length === 0) return 'Always included';

    const logic = stage.conditionLogic || 'AND';
    if (conditionsList.length === 1) {
      return `When ${getSingleConditionClauseSummary(conditionsList[0])}`;
    }

    const summaries = conditionsList.map(c => getSingleConditionClauseSummary(c));
    return `When ${summaries.join(` ${logic} `)}`;
  }

  // It's a single StageCondition
  return `When ${getSingleConditionClauseSummary(stageOrCondition as StageCondition)}`;
}

export function evaluateSingleConditionClause(
  condition: StageCondition,
  quantity: number,
  selectedCustomizations?: LineItemCustomizations | Record<string, { value: string; priceUplift?: number }>
): boolean {
  if (condition.type === 'quantity_threshold') {
    const thresh = condition.quantityThreshold ?? 0;
    const op = condition.quantityOperator || 'gte';
    if (op === 'gte') return quantity >= thresh;
    if (op === 'gt') return quantity > thresh;
    if (op === 'lte') return quantity <= thresh;
    if (op === 'lt') return quantity < thresh;
    if (op === 'eq') return quantity === thresh;
    return false;
  }

  if (condition.type === 'option_match') {
    if (!selectedCustomizations || !condition.optionName) return false;
    const targetOptKey = Object.keys(selectedCustomizations).find(
      k => k.trim().toLowerCase() === condition.optionName!.trim().toLowerCase()
    );
    if (!targetOptKey) return false;
    const selectedVal = selectedCustomizations[targetOptKey]?.value || '';
    const targetVal = condition.optionValue || '';
    return selectedVal.trim().toLowerCase() === targetVal.trim().toLowerCase();
  }

  if (condition.type === 'option_selected') {
    if (!selectedCustomizations || !condition.optionName) return false;
    const targetOptKey = Object.keys(selectedCustomizations).find(
      k => k.trim().toLowerCase() === condition.optionName!.trim().toLowerCase()
    );
    return !!(targetOptKey && selectedCustomizations[targetOptKey]?.value);
  }

  return true;
}

export function evaluateProductStagesForTask(
  defaultStages: (string | ProductStageConfig)[] | undefined,
  quantity: number,
  selectedCustomizations?: LineItemCustomizations | Record<string, { value: string; priceUplift?: number }>,
  completedQty: number = 0
): ItemStageProgress[] {
  if (!defaultStages || defaultStages.length === 0) return [];

  const result: ItemStageProgress[] = [];

  defaultStages.forEach((stg, idx) => {
    let name: string;
    let isConditional = false;
    let conditionsList: StageCondition[] = [];
    let conditionLogic: 'AND' | 'OR' = 'AND';

    if (typeof stg === 'string') {
      name = stg;
    } else {
      name = stg.name;
      isConditional = !!stg.isConditional;
      conditionLogic = stg.conditionLogic || 'AND';
      if (stg.conditions && stg.conditions.length > 0) {
        conditionsList = stg.conditions;
      } else if (stg.condition) {
        conditionsList = [stg.condition];
      }
    }

    if (!isConditional || conditionsList.length === 0) {
      result.push({
        id: `stg-${Date.now()}-${idx + 1}-${Math.random().toString(36).substr(2, 4)}`,
        name,
        completedQty
      });
      return;
    }

    let shouldInclude: boolean;
    if (conditionLogic === 'OR') {
      shouldInclude = conditionsList.some(cond => 
        evaluateSingleConditionClause(cond, quantity, selectedCustomizations)
      );
    } else {
      // 'AND' logic: all conditions must evaluate to true
      shouldInclude = conditionsList.every(cond => 
        evaluateSingleConditionClause(cond, quantity, selectedCustomizations)
      );
    }

    if (shouldInclude) {
      result.push({
        id: `stg-${Date.now()}-${idx + 1}-${Math.random().toString(36).substr(2, 4)}`,
        name,
        completedQty
      });
    }
  });

  return result;
}


