import React, { useState } from 'react';
import { 
  Lock, TrendingUp, ExternalLink, ChevronDown, ChevronUp, Calculator
} from 'lucide-react';
import { QuoteLineItem, Product, Material } from '../types';
import { calculateLineItemUnitCost } from '../lib/costUtils';

interface InternalQuoteFinancialsProps {
  items: QuoteLineItem[];
  products: Product[];
  materials?: Material[];
  onEditProductInCatalogue?: (productId: string) => void;
  onAddNewProductInCatalogue?: () => void;
  quoteTotalAmount?: number;
}

export const InternalQuoteFinancials: React.FC<InternalQuoteFinancialsProps> = ({
  items,
  products,
  materials = [],
  onEditProductInCatalogue,
  quoteTotalAmount
}) => {
  const [showItemDetails, setShowItemDetails] = useState(false);

  const formatZAR = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
  };

  // Analyze each line item for costs & inputs
  const itemFinancials = items.map(item => {
    const matchedProduct = 
      (item.productId ? products.find(p => p.id === item.productId) : undefined) ||
      products.find(p => p.name.toLowerCase().trim() === item.productName.toLowerCase().trim()) ||
      products.find(p => item.productName.toLowerCase().includes(p.name.toLowerCase().trim()) || p.name.toLowerCase().includes(item.productName.toLowerCase().trim()));

    const hasProductInCatalogue = !!matchedProduct;
    const hasInputsEntered = !!(matchedProduct?.inputs && matchedProduct.inputs.length > 0);

    const unitRevenue = item.quantity > 0 ? (item.total / item.quantity) : item.appliedUnitPrice;
    const totalRevenue = item.total;

    const unitCost = (hasProductInCatalogue || (item.unitCost && item.unitCost > 0)) ? calculateLineItemUnitCost(item, matchedProduct, materials) : 0;
    const totalCost = unitCost * item.quantity;
    const totalProfit = totalRevenue - totalCost;
    const marginPercent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const isCostCalculable = (hasProductInCatalogue && hasInputsEntered) || (item.unitCost !== undefined && item.unitCost > 0);

    return {
      item,
      matchedProduct,
      hasProductInCatalogue,
      hasInputsEntered,
      isCostCalculable,
      unitRevenue,
      totalRevenue,
      unitCost,
      totalCost,
      totalProfit,
      marginPercent
    };
  });

  const uncostedItems = itemFinancials.filter(i => !i.isCostCalculable);
  const costedItems = itemFinancials.filter(i => i.isCostCalculable);

  const isFullyCalculable = uncostedItems.length === 0 && items.length > 0;
  const isAnyCalculable = costedItems.length > 0;

  const totalRevenue = quoteTotalAmount !== undefined 
    ? quoteTotalAmount 
    : itemFinancials.reduce((sum, i) => sum + i.totalRevenue, 0);

  const totalCalculatedCost = itemFinancials.reduce((sum, i) => sum + i.totalCost, 0);
  const totalCalculatedProfit = totalRevenue - totalCalculatedCost;
  const overallMarginPercent = totalRevenue > 0 ? (totalCalculatedProfit / totalRevenue) * 100 : 0;

  // IF NO ITEMS HAVE INPUT COSTS ENTERED:
  if (!isAnyCalculable) {
    return (
      <div 
        data-print-hide="true" 
        data-internal-financials="true"
        className="my-5 p-4 md:p-5 bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-stone-50 rounded-2xl border border-amber-200/90 text-stone-800 shadow-3xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden"
      >
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-amber-100/80 text-amber-800 rounded-xl shrink-0 mt-0.5">
            <Calculator size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md">
                Internal Note
              </span>
              <span className="text-xs font-semibold text-stone-500 flex items-center gap-1">
                <Lock size={11} /> Only visible to you
              </span>
            </div>
            <h4 className="text-sm font-bold text-stone-900">
              Track your internal costs & profit margin
            </h4>
            <p className="text-xs text-stone-600 mt-0.5">
              Add material and labour costs to your products to calculate private profit estimates for your business (kept private from customer quotes).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onEditProductInCatalogue?.('')}
          className="w-full sm:w-auto px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-3xs cursor-pointer shrink-0"
        >
          <span>Go to Products Page</span>
          <ExternalLink size={13} />
        </button>
      </div>
    );
  }

  // IF AT LEAST SOME OR ALL ITEMS HAVE COST DATA:
  return (
    <div 
      data-print-hide="true" 
      data-internal-financials="true"
      className="my-5 bg-stone-50/90 rounded-2xl border border-stone-200/90 shadow-3xs overflow-hidden print:hidden"
    >
      {/* Friendly Header Bar */}
      <div className="px-5 py-3 bg-stone-100/80 border-b border-stone-200/70 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="bg-amber-100 text-amber-800 p-1 rounded-md">
            <Lock size={13} />
          </span>
          <span className="text-xs font-bold text-stone-800">
            Internal Cost & Profit Summary
          </span>
          <span className="text-[10px] text-stone-500 font-medium">
            (Only visible to you)
          </span>
        </div>

        {!isFullyCalculable && (
          <button
            type="button"
            onClick={() => onEditProductInCatalogue?.('')}
            className="text-[11px] font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1 underline cursor-pointer"
          >
            <span>Add costs for remaining products</span>
            <ExternalLink size={11} />
          </button>
        )}
      </div>

      {/* Simplified Numbers Grid */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white">
        <div className="p-3 bg-stone-50/80 rounded-xl border border-stone-200/60">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
            Quote Revenue
          </span>
          <span className="text-base font-extrabold text-stone-900 mt-0.5 block">
            {formatZAR(totalRevenue)}
          </span>
        </div>

        <div className="p-3 bg-stone-50/80 rounded-xl border border-stone-200/60">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
            Est. Cost
          </span>
          <span className="text-base font-extrabold text-stone-800 mt-0.5 block">
            {formatZAR(totalCalculatedCost)}
          </span>
        </div>

        <div className="p-3 bg-stone-50/80 rounded-xl border border-stone-200/60">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
            Est. Profit
          </span>
          <span className={`text-base font-extrabold mt-0.5 block ${totalCalculatedProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            {formatZAR(totalCalculatedProfit)}
          </span>
        </div>

        <div className="p-3 bg-stone-50/80 rounded-xl border border-stone-200/60">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
            Profit Margin
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
              overallMarginPercent >= 20 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {overallMarginPercent.toFixed(1)}%
            </span>
            <TrendingUp size={14} className={overallMarginPercent >= 20 ? 'text-emerald-600' : 'text-amber-600'} />
          </div>
        </div>
      </div>

      {/* Optional breakdown toggle */}
      <div className="border-t border-stone-200/60 bg-stone-50/60">
        <button
          type="button"
          onClick={() => setShowItemDetails(!showItemDetails)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-stone-600 hover:text-stone-900 transition cursor-pointer"
        >
          <span>View item breakdown ({items.length} item{items.length !== 1 ? 's' : ''})</span>
          <div className="flex items-center gap-1 text-[11px] text-stone-500">
            {showItemDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {showItemDetails && (
          <div className="px-4 pb-4 pt-1 overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead>
                <tr className="border-b border-stone-200 text-[10px] font-bold uppercase text-stone-500">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 px-2 text-center">Qty</th>
                  <th className="py-2 px-2 text-right">Revenue</th>
                  <th className="py-2 px-2 text-right">Cost</th>
                  <th className="py-2 px-2 text-right">Profit</th>
                  <th className="py-2 pl-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {itemFinancials.map(({ item, isCostCalculable, totalRevenue, totalCost, totalProfit, marginPercent }) => (
                  <tr key={item.productName + (item.productId || '')}>
                    <td className="py-2 pr-3 font-medium text-stone-800">{item.productName}</td>
                    <td className="py-2 px-2 text-center font-bold text-stone-600">{item.quantity}</td>
                    <td className="py-2 px-2 text-right font-medium">{formatZAR(totalRevenue)}</td>
                    <td className="py-2 px-2 text-right font-medium text-stone-600">{isCostCalculable ? formatZAR(totalCost) : '—'}</td>
                    <td className={`py-2 px-2 text-right font-bold ${isCostCalculable ? (totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-600') : 'text-stone-400'}`}>
                      {isCostCalculable ? formatZAR(totalProfit) : '—'}
                    </td>
                    <td className="py-2 pl-2 text-right font-semibold text-stone-600">
                      {isCostCalculable ? `${marginPercent.toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
