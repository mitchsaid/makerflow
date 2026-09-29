import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Clock, CheckCircle, AlertTriangle, Play, ChevronDown, ChevronUp,
  Calendar, User, Package, Sparkles, AlertCircle, ArrowLeft, Lock, ChevronLeft, 
  ChevronRight, Check, Search, ArrowRight, ClipboardList, ShoppingBag, Truck,
  Square, CheckSquare, ListTodo, Sliders, Info, ThumbsUp, Mail, Phone, MapPin,
  Plus, Trash2, X, Layers, PlusCircle, Edit2, RotateCcw, FileText, BookOpen
} from 'lucide-react';
import { Job, JobTaskItem, JobStatus, JobTaskStatus, TrackingType, Customer, Product, FulfillmentPreset, ItemStageProgress, Material } from '../types';
import { getProductPhotoUrl, handleImageError } from '../lib/imageUtils';
import { getTaskMaterialBreakdown, TaskMaterialRequirement } from '../lib/costUtils';
import { motion, AnimatePresence } from 'motion/react';
import { AdvancedCustomItemModal, CustomItemResult } from './AdvancedCustomItemModal';

interface JobsProps {
  jobs: Job[];
  customers: Customer[];
  products: Product[];
  services?: Product[];
  materials?: Material[];
  onUpdateMaterial?: (mat: Material) => void;
  onUpdateMaterialStock?: (id: string, newStock: number) => void;
  jobsStartInCreationMode?: boolean;
  onResetJobsStartInCreationMode?: () => void;
  onUpdateJob?: (job: Job) => void;
  onUpdateJobStatus: (jobId: string, status: JobStatus) => void;
  onUpdateJobTaskStatus: (jobId: string, taskId: string, status: JobTaskStatus) => void;
  onUpdateJobTaskTrackingType: (jobId: string, taskId: string, trackingType: TrackingType, batchSize?: number) => void;
  onUpdateJobTaskUnitStatus: (jobId: string, taskId: string, unitIndex: number, status: JobTaskStatus) => void;
  onUpdateJobTaskCounts: (jobId: string, taskId: string, completedCount: number, stockCount: number) => void;
  onCreateJobDirect?: (jobData: {
    jobType?: 'customer_order' | 'stock_creation';
    customerId?: string;
    clientName?: string;
    fulfillmentType?: 'collection' | 'delivery';
    items: {
      productId?: string;
      title: string;
      quantity: number;
      customizationSummary: string;
    }[];
  }) => Job;
  onApplyStockToJobTask?: (jobId: string, taskId: string, quantityToUse: number, chosenProductId?: string) => void;
  onRemoveStockFromJobTask?: (jobId: string, taskId: string, quantityToRemove: number) => void;
  reusableStages?: string[];
  onAddReusableStage?: (stageName: string) => void;
  onUpdateJobTaskTrackingMode?: (jobId: string, taskId: string, mode: 'whole' | 'stages') => void;
  onUpdateJobTaskStages?: (jobId: string, taskId: string, stages: ItemStageProgress[]) => void;
  onDeleteJob?: (jobId: string) => void;
}

function ItemStageTracker({
  jobId,
  item,
  reusableStages = [],
  onAddReusableStage,
  onUpdateJobTaskStages,
  isJobLocked
}: {
  jobId: string;
  item: JobTaskItem;
  reusableStages: string[];
  onAddReusableStage?: (name: string) => void;
  onUpdateJobTaskStages?: (jobId: string, taskId: string, stages: ItemStageProgress[]) => void;
  isJobLocked: boolean;
}) {
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [tempStageQty, setTempStageQty] = useState('');

  const currentStock = item.stockCount || 0;
  const qtyToMake = Math.max(0, item.quantity - currentStock);
  const stages = item.stages || [
    { id: `stg-1`, name: 'Base Product Made', completedQty: item.completedCount || 0 },
    { id: `stg-2`, name: 'Packaging & Ready', completedQty: item.completedCount || 0 }
  ];

  const handleUpdateQty = (stageId: string, nextQty: number) => {
    const clamped = Math.max(0, Math.min(qtyToMake, nextQty));
    const updated = stages.map(s => s.id === stageId ? { ...s, completedQty: clamped } : s);
    onUpdateJobTaskStages?.(jobId, item.id, updated);
  };

  const handleToggleStageDone = (stageId: string) => {
    if (isJobLocked) return;
    const target = stages.find(s => s.id === stageId);
    if (!target) return;
    const isDone = target.completedQty >= qtyToMake && qtyToMake > 0;
    const nextQty = isDone ? 0 : qtyToMake;
    handleUpdateQty(stageId, nextQty);
  };

  const handleAddStage = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (onAddReusableStage) onAddReusableStage(trimmed);
    const newStage: ItemStageProgress = {
      id: `stg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      completedQty: 0
    };
    const updated = [...stages, newStage];
    onUpdateJobTaskStages?.(jobId, item.id, updated);
    setNewStageName('');
    setAddingStage(false);
  };

  const handleRemoveStage = (stageId: string) => {
    if (stages.length <= 1) return;
    const updated = stages.filter(s => s.id !== stageId);
    onUpdateJobTaskStages?.(jobId, item.id, updated);
  };

  const availablePresets = reusableStages.filter(rs => !stages.some(s => s.name.toLowerCase() === rs.toLowerCase()));

  return (
    <div className="mt-3.5 bg-stone-50/90 p-3.5 rounded-2xl border border-stone-200/80 space-y-3">
      <div className="flex items-center justify-between border-b border-stone-200/60 pb-2">
        <div className="flex items-center gap-1.5">
          <ListTodo size={14} className="text-amber-600" />
          <span className="text-[11px] font-black text-stone-700 uppercase tracking-wider">
            Production Stages ({qtyToMake} to make)
          </span>
        </div>
        <button
          type="button"
          disabled={isJobLocked}
          onClick={() => setAddingStage(!addingStage)}
          className="text-[11px] font-extrabold text-amber-800 hover:text-amber-900 bg-amber-100/70 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
        >
          <Plus size={12} /> Add Stage
        </button>
      </div>

      {/* STAGE LIST */}
      <div className="space-y-2">
        {stages.map((stg) => {
          const isDone = stg.completedQty >= qtyToMake && qtyToMake > 0;

          return (
            <div 
              key={stg.id} 
              className={`border rounded-xl p-2.5 flex items-center justify-between gap-3 shadow-2xs transition-all ${
                isDone 
                  ? 'bg-emerald-50/30 border-emerald-200/80' 
                  : 'bg-white border-stone-200/90'
              }`}
            >
              <div className="min-w-0 flex-1 flex items-center gap-2">
                {/* Same CheckSquare / Square Component As Overall Item */}
                <button
                  type="button"
                  disabled={isJobLocked || qtyToMake === 0}
                  onClick={() => handleToggleStageDone(stg.id)}
                  className={`p-0.5 rounded-lg transition-all shrink-0 ${
                    isJobLocked || qtyToMake === 0
                      ? 'opacity-30 cursor-not-allowed'
                      : 'cursor-pointer hover:scale-105'
                  }`}
                  title={isDone ? "Mark stage as unfinished" : "Mark stage as completed"}
                >
                  {isDone ? (
                    <CheckSquare size={20} className="text-emerald-600 fill-emerald-50" />
                  ) : (
                    <Square size={20} className="text-stone-300 hover:text-amber-600 bg-stone-50" />
                  )}
                </button>

                <span className={`text-xs font-bold truncate ${
                  isDone ? 'text-stone-400 line-through' : 'text-stone-800'
                }`}>
                  {stg.name}
                </span>
              </div>

              {/* Right Side: Stepper Counter */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center gap-1 bg-stone-50/80 border border-stone-200/80 rounded-lg p-0.5">
                  <button
                    type="button"
                    disabled={isJobLocked || stg.completedQty <= 0}
                    onClick={() => handleUpdateQty(stg.id, stg.completedQty - 1)}
                    className="w-6 h-6 rounded-md bg-white hover:bg-stone-100 border border-stone-200/60 flex items-center justify-center text-xs font-black text-stone-700 hover:text-stone-900 disabled:opacity-30 cursor-pointer active:scale-95 transition"
                    title="Decrease 1 unit"
                  >
                    -
                  </button>

                  <div className="min-w-[50px] text-center px-0.5">
                    {editingStageId === stg.id ? (
                      <input
                        type="number"
                        min={0}
                        max={qtyToMake}
                        value={tempStageQty}
                        autoFocus
                        onChange={(e) => setTempStageQty(e.target.value)}
                        onBlur={() => {
                          let val = parseInt(tempStageQty, 10);
                          if (isNaN(val)) val = stg.completedQty;
                          handleUpdateQty(stg.id, val);
                          setEditingStageId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            let val = parseInt(tempStageQty, 10);
                            if (isNaN(val)) val = stg.completedQty;
                            handleUpdateQty(stg.id, val);
                            setEditingStageId(null);
                          } else if (e.key === 'Escape') {
                            setEditingStageId(null);
                          }
                        }}
                        className="w-12 text-center font-black text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded py-0.5"
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={isJobLocked}
                        onClick={() => {
                          setEditingStageId(stg.id);
                          setTempStageQty(String(stg.completedQty));
                        }}
                        className="text-[11px] font-black text-stone-800 hover:text-amber-700 hover:bg-stone-100/60 rounded px-1 py-0.5 transition cursor-pointer"
                        title="Tap to type value manually"
                      >
                        {stg.completedQty}/{qtyToMake}
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isJobLocked || stg.completedQty >= qtyToMake}
                    onClick={() => handleUpdateQty(stg.id, stg.completedQty + 1)}
                    className="w-6 h-6 rounded-md bg-white hover:bg-stone-100 border border-stone-200/60 flex items-center justify-center text-xs font-black text-stone-700 hover:text-stone-900 disabled:opacity-30 cursor-pointer active:scale-95 transition"
                    title="Complete +1 unit in this stage"
                  >
                    +
                  </button>
                </div>

                {stages.length > 1 && !isJobLocked && (
                  <button
                    type="button"
                    onClick={() => handleRemoveStage(stg.id)}
                    className="text-stone-300 hover:text-rose-600 p-1 cursor-pointer transition ml-0.5"
                    title="Remove stage"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD STAGE FORM / QUICK SELECT */}
      {addingStage && (
        <div className="bg-white p-3 rounded-xl border border-amber-200/80 space-y-2.5 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">Add Production Stage</span>
          
          {availablePresets.length > 0 && (
            <div className="space-y-1">
              <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Quick Select Reusable Stages:</span>
              <div className="flex flex-wrap gap-1.5">
                {availablePresets.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleAddStage(preset)}
                    className="text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 shadow-3xs"
                  >
                    <Plus size={11} /> {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              placeholder="Or enter new stage name (e.g. Quality Review, Extras)..."
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newStageName.trim()) {
                  handleAddStage(newStageName);
                }
              }}
              className="flex-1 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-normal text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="button"
              disabled={!newStageName.trim()}
              onClick={() => handleAddStage(newStageName)}
              className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white cursor-pointer transition shadow-3xs"
            >
              Add Stage
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingStage(false);
                setNewStageName('');
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-stone-500 hover:text-stone-800 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskMaterialStatusBreakdown({
  item,
  products,
  materials = [],
  jobId,
  jobTaskStatus,
  onUpdateJobTaskStatus,
  onUpdateMaterialStock,
  onUpdateMaterial
}: {
  item: JobTaskItem;
  products: Product[];
  materials?: Material[];
  jobId: string;
  jobTaskStatus: JobTaskStatus;
  onUpdateJobTaskStatus: (jobId: string, taskId: string, status: JobTaskStatus) => void;
  onUpdateMaterialStock?: (id: string, newStock: number) => void;
  onUpdateMaterial?: (mat: Material) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const breakdown = getTaskMaterialBreakdown(item, products, materials);

  if (!breakdown || breakdown.length === 0) return null;

  const unitsToMake = Math.max(0, item.quantity - (item.stockCount || 0));
  const isFulfilledFromStock = unitsToMake === 0;

  if (isFulfilledFromStock) {
    return (
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 text-xs text-emerald-900 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <CheckCircle size={14} className="text-emerald-600 shrink-0" />
          <span className="font-bold">Fulfilled from Finished Stock</span>
          <span className="text-[11px] text-emerald-700 font-medium">(No raw material manufacturing required)</span>
        </div>
      </div>
    );
  }

  const allSufficient = breakdown.every(b => b.isSufficient);
  const shortages = breakdown.filter(b => !b.isSufficient);

  return (
    <div className={`rounded-2xl border p-3 text-xs transition-all ${
      allSufficient ? 'bg-emerald-50/50 border-emerald-200/80' : 'bg-amber-50/60 border-amber-300'
    }`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {allSufficient ? (
            <span className="inline-flex items-center gap-1 text-emerald-800 font-black bg-emerald-100/90 px-2.5 py-1 rounded-lg border border-emerald-200/80">
              <CheckCircle size={13} className="text-emerald-600" />
              <span>Raw Materials Ready</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-900 font-black bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300">
              <AlertTriangle size={13} className="text-amber-700" />
              <span>Material Shortage ({shortages.length} item{shortages.length > 1 ? 's' : ''})</span>
            </span>
          )}

          <span className="text-stone-500 font-medium text-[11px]">
            {breakdown.length} material type{breakdown.length > 1 ? 's' : ''} mapped
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {!allSufficient && jobTaskStatus === 'Pending' && (
            <button
              type="button"
              onClick={() => onUpdateJobTaskStatus(jobId, item.id, 'Sourcing Materials')}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] transition cursor-pointer shadow-3xs"
            >
              Set Status: Sourcing Materials →
            </button>
          )}

          {allSufficient && jobTaskStatus === 'Sourcing Materials' && (
            <button
              type="button"
              onClick={() => onUpdateJobTaskStatus(jobId, item.id, 'In Production')}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] transition cursor-pointer shadow-3xs"
            >
              ✓ Restocked! Set Status: In Production →
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-stone-600 hover:text-stone-900 font-bold text-xs flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-stone-100 cursor-pointer"
          >
            <span>{showDetails ? 'Hide' : 'View Materials'}</span>
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="mt-3 pt-2.5 border-t border-stone-200/60 space-y-2">
          {breakdown.map((req, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between gap-3 p-2 rounded-xl border text-xs ${
                req.isSufficient ? 'bg-white/80 border-stone-200/80' : 'bg-amber-100/40 border-amber-200'
              }`}
            >
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-stone-900 truncate">{req.materialName}</span>
                  {req.category && (
                    <span className="text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.2 rounded font-medium">
                      {req.category}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-stone-600 flex items-center gap-3">
                  <span>Req: <strong className="text-stone-800">{req.totalRequired} {req.unit}</strong> ({req.totalRequiredInBulkUnit} {req.bulkUnit})</span>
                  <span>In Stock: <strong className={req.isSufficient ? "text-emerald-700" : "text-amber-800"}>{req.currentStock} {req.bulkUnit}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {req.isSufficient ? (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    ✓ In Stock
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-extrabold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      Need +{req.shortageInBulkUnit} {req.bulkUnit}
                    </span>
                    {onUpdateMaterialStock && (
                      <button
                        type="button"
                        onClick={() => {
                          const newStock = Math.round((req.currentStock + req.shortageInBulkUnit) * 1000) / 1000;
                          onUpdateMaterialStock(req.materialId, newStock);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] transition cursor-pointer shadow-2xs"
                        title="Click to instantly restock the missing material amount in inventory"
                      >
                        + Restock {req.shortageInBulkUnit} {req.bulkUnit}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Jobs({
  jobs,
  customers,
  products = [],
  services = [],
  materials = [],
  onUpdateMaterial,
  onUpdateMaterialStock,
  jobsStartInCreationMode,
  onResetJobsStartInCreationMode,
  onUpdateJob,
  onUpdateJobStatus,
  onUpdateJobTaskStatus,
  onUpdateJobTaskTrackingType,
  onUpdateJobTaskUnitStatus,
  onUpdateJobTaskCounts,
  onCreateJobDirect,
  onApplyStockToJobTask,
  onRemoveStockFromJobTask,
  reusableStages = [],
  onAddReusableStage,
  onUpdateJobTaskTrackingMode,
  onUpdateJobTaskStages,
  onDeleteJob
}: JobsProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | JobStatus>('All');
  const [expandedTrackingItemId, setExpandedTrackingItemId] = useState<string | null>(null);
  const [editingLeftToMakeId, setEditingLeftToMakeId] = useState<string | null>(null);
  const [tempLeftToMake, setTempLeftToMake] = useState<string>('');
  
  // Choose how to view items: 'checklist' (simple done/not-done toggle) or 'stages' (step-by-step progress stepper)
  const [trackingMode, setTrackingMode] = useState<'checklist' | 'stages'>('stages');

  // Create Job Modal state
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [newJobType, setNewJobType] = useState<'customer_order' | 'stock_creation'>('customer_order');
  const [newJobCustomerId, setNewJobCustomerId] = useState('');
  const [newJobClientName, setNewJobClientName] = useState('');
  const [newJobFulfillmentType, setNewJobFulfillmentType] = useState<'collection' | 'delivery'>('collection');
  const [newJobDeliveryAddress, setNewJobDeliveryAddress] = useState('');
  
  // Fulfillment Presets and Address Options (mirroring Quotes)
  const [fulfillmentPresets] = useState<FulfillmentPreset[]>(() => {
    const saved = localStorage.getItem('maker_fulfillment_presets');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'fp_1', type: 'collection', label: 'Business Pickup', price: 0 },
      { id: 'fp_2', type: 'delivery', label: 'Standard Local Delivery', price: 120 },
      { id: 'fp_3', type: 'delivery', label: 'National Courier Delivery', price: 180 },
      { id: 'fp_4', type: 'delivery', label: 'Distance-Based Delivery', price: 0, isVariable: true },
    ];
  });
  const [selectedFulfillmentPresetId, setSelectedFulfillmentPresetId] = useState<string>('');
  const [useCustomerAddress, setUseCustomerAddress] = useState<boolean>(true);

  // Address parts for custom delivery address
  const [addrLine, setAddrLine] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrProvince, setAddrProvince] = useState('');
  const [addrPostalCode, setAddrPostalCode] = useState('');
  const [addrCountry, setAddrCountry] = useState('South Africa');

  const selectedCustomer = customers.find(c => c.id === newJobCustomerId || c.name === newJobClientName);

  useEffect(() => {
    if (newJobFulfillmentType === 'delivery') {
      if (useCustomerAddress) {
        setNewJobDeliveryAddress(selectedCustomer?.address || '');
      } else {
        const parts = [addrLine, addrCity, addrProvince, addrPostalCode, addrCountry]
          .map(p => p.trim())
          .filter(Boolean);
        setNewJobDeliveryAddress(parts.join(', '));
      }
    }
  }, [useCustomerAddress, addrLine, addrCity, addrProvince, addrPostalCode, addrCountry, selectedCustomer, newJobFulfillmentType]);
  
  interface JobCreationItem {
    productId?: string;
    title: string;
    quantity: number;
    customizationSummary: string;
    productPhoto?: string;
    selectedCustomizations?: Record<string, { value: string; priceUplift?: number }>;
  }

  const [newJobItems, setNewJobItems] = useState<JobCreationItem[]>([]);

  // Catalog Item Selection & Product Customization Modals state
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogModalTab, setCatalogModalTab] = useState<'products' | 'services' | 'custom'>('products');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [editingJobItemIndex, setEditingJobItemIndex] = useState<number | null>(null);

  // Custom Item Form State for Jobs
  const [jobCustomTitle, setJobCustomTitle] = useState('');
  const [jobCustomSpecs, setJobCustomSpecs] = useState('');
  const [jobCustomQty, setJobCustomQty] = useState(1);
  const [jobCustomCost, setJobCustomCost] = useState<number | ''>('');
  const [isAdvancedCustomItemOpen, setIsAdvancedCustomItemOpen] = useState(false);

  // Customer dropdown search state
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Product Customization Configurator Modal state
  const [selectedProdToConfigure, setSelectedProdToConfigure] = useState<Product | null>(null);
  const [configQuantity, setConfigQuantity] = useState<number>(1);
  const [configCustoms, setConfigCustoms] = useState<Record<string, { value: string; priceUplift?: number }>>({});
  const [configNotes, setConfigNotes] = useState<string>('');

  // Stock Allocation Modal state
  const [stockModalTask, setStockModalTask] = useState<JobTaskItem | null>(null);
  const [stockModalQuantity, setStockModalQuantity] = useState<number>(1);
  const [selectedStockProductId, setSelectedStockProductId] = useState<string>('');

  // Stock Removal Modal state
  const [removeStockModalTask, setRemoveStockModalTask] = useState<JobTaskItem | null>(null);
  const [removeStockQuantity, setRemoveStockQuantity] = useState<number>(1);

  const getMatchingProduct = (item: JobTaskItem): Product | undefined => {
    if (item.productId) {
      const pById = products.find(p => p.id === item.productId);
      if (pById) return pById;
    }
    const titleLower = item.title.toLowerCase().trim();
    const pByExact = products.find(p => p.name.toLowerCase().trim() === titleLower);
    if (pByExact) return pByExact;

    const pByPartial = products.find(p => 
      titleLower.includes(p.name.toLowerCase().trim()) || 
      p.name.toLowerCase().trim().includes(titleLower)
    );
    return pByPartial;
  };

  const categorizeJobItemSpecs = (item: JobTaskItem) => {
    const prod = getMatchingProduct(item);

    const variations: { label: string; value: string; priceUplift?: number }[] = [];
    const extras: { label: string; value: string; priceUplift?: number }[] = [];

    const extraKeywords = ['extra', 'addon', 'add-on', 'gift', 'wrap', 'engrav', 'stamp', 'backstamp', 'packaging', 'sleeve', 'bag', 'monogram', 'ribbon', 'custom logo', 'emboss', 'box', 'finishing'];

    if (item.selectedCustomizations && Object.keys(item.selectedCustomizations).length > 0) {
      for (const [optName, cVal] of Object.entries(item.selectedCustomizations)) {
        const valStr = typeof cVal === 'object' && cVal !== null ? (cVal as { value: string; priceUplift?: number }).value : String(cVal);
        const priceUplift = typeof cVal === 'object' && cVal !== null ? (cVal as { value: string; priceUplift?: number }).priceUplift : undefined;

        const prodOpt = prod?.customizationOptions?.find(o => o.name.toLowerCase().trim() === optName.toLowerCase().trim());

        let isExtra = false;
        if (prodOpt?.type === 'extra') {
          isExtra = true;
        } else if (prodOpt?.type === 'variation') {
          isExtra = false;
        } else {
          const nameLower = optName.toLowerCase();
          if (extraKeywords.some(kw => nameLower.includes(kw))) {
            isExtra = true;
          } else if ((priceUplift || 0) > 0 && prodOpt?.isRequired === false) {
            isExtra = true;
          }
        }

        if (isExtra) {
          extras.push({ label: optName, value: valStr, priceUplift });
        } else {
          variations.push({ label: optName, value: valStr, priceUplift });
        }
      }
    } else if (item.customizationSummary && item.customizationSummary !== 'Standard') {
      const parts = item.customizationSummary.split(/[,|]/).map(s => s.trim()).filter(Boolean);
      for (const part of parts) {
        const colonIndex = part.indexOf(':');
        let label = '';
        let value = part;
        if (colonIndex !== -1) {
          label = part.substring(0, colonIndex).trim();
          value = part.substring(colonIndex + 1).trim();
        }

        const prodOpt = label ? prod?.customizationOptions?.find(o => o.name.toLowerCase().trim() === label.toLowerCase().trim()) : undefined;

        let isExtra = false;
        if (prodOpt?.type === 'extra') {
          isExtra = true;
        } else if (prodOpt?.type === 'variation') {
          isExtra = false;
        } else {
          const checkText = (label || value).toLowerCase();
          if (extraKeywords.some(kw => checkText.includes(kw))) {
            isExtra = true;
          }
        }

        if (isExtra) {
          extras.push({ label: label || 'Extra', value });
        } else {
          variations.push({ label: label || 'Variation', value });
        }
      }
    }

    return { variations, extras, hasSpecs: variations.length > 0 || extras.length > 0 };
  };

  // Trigger starting creation mode when requested from Dashboard or elsewhere
  React.useEffect(() => {
    if (jobsStartInCreationMode) {
      startCreateJob();
      onResetJobsStartInCreationMode?.();
    }
  }, [jobsStartInCreationMode]);

  const startCreateJob = () => {
    setNewJobType('customer_order');
    setNewJobCustomerId('');
    setNewJobClientName('');
    setCustomerSearchQuery('');
    setIsCustomerDropdownOpen(false);
    setNewJobFulfillmentType('collection');
    setNewJobDeliveryAddress('');

    // Pre-populate with first product from catalog if available
    if (products.length > 0) {
      const firstProd = products[0];
      const initialCustoms: Record<string, { value: string; priceUplift?: number }> = {};
      firstProd.customizationOptions?.forEach(opt => {
        if (opt.values && opt.values.length > 0) {
          initialCustoms[opt.name] = { value: opt.values[0].value, priceUplift: opt.values[0].priceUplift || 0 };
        }
      });
      const initialSummary = Object.entries(initialCustoms).map(([k, v]) => `${k}: ${v.value}`).join(', ') || 'Standard';
      setNewJobItems([
        {
          productId: firstProd.id,
          title: firstProd.name,
          quantity: 1,
          customizationSummary: initialSummary,
          productPhoto: firstProd.photo,
          selectedCustomizations: initialCustoms
        }
      ]);
    } else {
      setNewJobItems([
        {
          title: '',
          quantity: 1,
          customizationSummary: 'Standard'
        }
      ]);
    }
    setIsCreatingJob(true);
  };

  const handleSelectProductFromCatalog = (product: Product) => {
    const initialCustoms: Record<string, { value: string; priceUplift?: number }> = {};
    product.customizationOptions?.forEach(opt => {
      if (opt.values && opt.values.length > 0) {
        initialCustoms[opt.name] = { value: opt.values[0].value, priceUplift: opt.values[0].priceUplift || 0 };
      }
    });
    setSelectedProdToConfigure(product);
    setConfigQuantity(1);
    setConfigCustoms(initialCustoms);
    setConfigNotes('');
  };

  const handleConfirmConfiguredItem = () => {
    if (!selectedProdToConfigure) return;

    const summaryParts: string[] = [];
    Object.entries(configCustoms).forEach(([optName, selectVal]: [string, { value: string; priceUplift?: number }]) => {
      if (selectVal && selectVal.value) {
        summaryParts.push(`${optName}: ${selectVal.value}`);
      }
    });
    if (configNotes.trim()) {
      summaryParts.push(`Notes: ${configNotes.trim()}`);
    }
    const finalSummary = summaryParts.join(', ') || 'Standard';

    const newItem: JobCreationItem = {
      productId: selectedProdToConfigure.id,
      title: selectedProdToConfigure.name,
      productPhoto: selectedProdToConfigure.photo,
      quantity: configQuantity,
      customizationSummary: finalSummary,
      selectedCustomizations: configCustoms
    };

    if (isCreatingJob) {
      if (editingJobItemIndex !== null) {
        setNewJobItems(prev => prev.map((item, idx) => idx === editingJobItemIndex ? newItem : item));
        setEditingJobItemIndex(null);
      } else {
        setNewJobItems(prev => [...prev, newItem]);
      }
    } else if (selectedJob && onUpdateJob) {
      const newTask: JobTaskItem = {
        id: 'task_' + Date.now(),
        productId: selectedProdToConfigure.id,
        title: selectedProdToConfigure.name,
        quantity: configQuantity,
        status: 'Pending',
        customizationSummary: finalSummary,
        trackingType: 'consolidated',
        trackingMode: 'whole',
        selectedCustomizations: configCustoms
      };
      onUpdateJob({
        ...selectedJob,
        items: [...selectedJob.items, newTask]
      });
    }

    setSelectedProdToConfigure(null);
    setIsCatalogModalOpen(false);
  };

  const handleAddCustomJobItem = () => {
    if (!jobCustomTitle.trim()) return;
    const costNum = typeof jobCustomCost === 'number' ? jobCustomCost : parseFloat(String(jobCustomCost).replace(',', '.')) || 0;
    const qtyNum = Math.max(1, jobCustomQty || 1);

    if (isCreatingJob) {
      const newItem: JobCreationItem = {
        productId: 'custom_' + Date.now(),
        title: jobCustomTitle.trim(),
        quantity: qtyNum,
        customizationSummary: jobCustomSpecs.trim() || 'Custom Specification',
        selectedCustomizations: {}
      };
      if (editingJobItemIndex !== null) {
        setNewJobItems(prev => prev.map((item, idx) => idx === editingJobItemIndex ? newItem : item));
        setEditingJobItemIndex(null);
      } else {
        setNewJobItems(prev => [...prev, newItem]);
      }
    } else if (selectedJob && onUpdateJob) {
      const newTask: JobTaskItem = {
        id: 'task_' + Date.now(),
        productId: 'custom_' + Date.now(),
        title: jobCustomTitle.trim(),
        quantity: qtyNum,
        status: 'Pending',
        customizationSummary: jobCustomSpecs.trim() || 'Custom Specification',
        trackingType: 'consolidated',
        trackingMode: 'whole',
        unitCost: costNum > 0 ? costNum : undefined
      };
      onUpdateJob({
        ...selectedJob,
        items: [...selectedJob.items, newTask]
      });
    }

    setJobCustomTitle('');
    setJobCustomSpecs('');
    setJobCustomQty(1);
    setJobCustomCost('');
    setIsCatalogModalOpen(false);
  };

  const handleOpenEditItemSpecs = (index: number) => {
    const item = newJobItems[index];
    if (!item) return;

    const matchingProd = products.find(p => p.id === item.productId || p.name === item.title);
    if (matchingProd) {
      setEditingJobItemIndex(index);
      setSelectedProdToConfigure(matchingProd);
      setConfigQuantity(item.quantity);
      setConfigCustoms(item.selectedCustomizations || {});
      setConfigNotes('');
      setIsCatalogModalOpen(false);
    }
  };

  const addManualJobItemRow = () => {
    setNewJobItems(prev => [
      ...prev,
      {
        title: '',
        quantity: 1,
        customizationSummary: 'Standard'
      }
    ]);
  };

  const removeJobItemRow = (idx: number) => {
    setNewJobItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreateJobSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateJobDirect) return;
    if (newJobItems.length === 0 || !newJobItems[0].title) return;

    const created = onCreateJobDirect({
      jobType: newJobType,
      customerId: newJobCustomerId || undefined,
      clientName: newJobType === 'stock_creation' ? 'Internal Stock Creation' : (newJobClientName || 'Direct Order'),
      fulfillmentType: newJobFulfillmentType,
      items: newJobItems.map(item => ({
        productId: item.productId,
        title: item.title,
        quantity: item.quantity,
        customizationSummary: item.customizationSummary || 'Standard'
      }))
    });

    setIsCreatingJob(false);
    if (created && created.id) {
      setSelectedJobId(created.id);
    }
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  // Status mapping details
  const getStatusConfig = (status: JobStatus) => {
    switch (status) {
      case 'Awaiting quote acceptance': 
        return { label: 'Awaiting Quote Acceptance', icon: Clock, color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'Not Started': 
        return { label: 'Not Started', icon: AlertCircle, color: 'bg-stone-50 text-stone-500 border-stone-200' };
      case 'In Progress': 
        return { label: 'In Progress', icon: Play, color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'Ready for Collection': 
        return { label: 'Ready for Collection', icon: ShoppingBag, color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'Ready for Delivery': 
        return { label: 'Ready for Delivery', icon: Truck, color: 'bg-[#FDFBF7] text-amber-905 border-amber-300' };
      case 'Being Delivered': 
        return { label: 'Being Delivered', icon: Truck, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'Done': 
        return { label: 'Done', icon: CheckCircle, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
  };

  const getTaskStatusColor = (status: JobTaskStatus) => {
    switch (status) {
      case 'Pending': return 'bg-stone-100 text-stone-600 border-stone-200';
      case 'Sourcing Materials': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'In Production': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Quality Check': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'Done': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    }
  };

  const parseCustomizations = (summary: string) => {
    if (!summary || summary === 'Standard') return null;
    const parts = summary.split(',').map(p => p.trim()).filter(Boolean);
    
    const variations: string[] = [];
    const extras: string[] = [];
    
    parts.forEach(part => {
      const lower = part.toLowerCase();
      const isExtra = lower.includes('extra') || 
                      lower.includes('engrav') || 
                      lower.includes('gift') || 
                      lower.includes('package') || 
                      lower.includes('add-on') || 
                      lower.includes('personaliz') || 
                      lower.includes('custom text') ||
                      lower.includes('logo') ||
                      lower.includes('priority') ||
                      lower.includes('rush') ||
                      lower.includes('care kit');
                      
      if (isExtra) {
        extras.push(part);
      } else {
        variations.push(part);
      }
    });
    
    return { variations, extras };
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.jobNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          job.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const totalJobsCount = jobs.length;
  const inProductionCount = jobs.filter(j => j.status === 'In Progress').length;
  const readyForCollectionCount = jobs.filter(j => j.status === 'Ready for Collection').length;
  const readyForDeliveryCount = jobs.filter(j => j.status === 'Ready for Delivery').length;
  const beingDeliveredCount = jobs.filter(j => j.status === 'Being Delivered').length;
  const completedCount = jobs.filter(j => j.status === 'Done').length;

  const taskStatuses: JobTaskStatus[] = ['Pending', 'Sourcing Materials', 'In Production', 'Quality Check', 'Done'];

  if (isCreatingJob) {
    return (
      <>
        <form onSubmit={handleCreateJobSubmit} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-6 max-w-4xl mx-auto mb-12 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <h3 className="font-extrabold text-stone-800 text-lg">Create new job</h3>
          </div>
          <button
            type="button"
            onClick={() => setIsCreatingJob(false)}
            className="text-stone-400 hover:text-stone-600 cursor-pointer p-1 rounded-lg hover:bg-stone-100 transition"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 animate-fadeIn">
          {/* Top Row: Job Type & Customer (Stacked) */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Job Type</label>
              <select
                value={newJobType}
                onChange={e => {
                  const val = e.target.value as 'customer_order' | 'stock_creation';
                  setNewJobType(val);
                  if (val === 'stock_creation') {
                    setNewJobClientName('Internal Stock Creation');
                    setNewJobCustomerId('');
                  } else {
                    setNewJobClientName('');
                  }
                }}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-sm font-normal cursor-pointer"
              >
                <option value="customer_order">Customer</option>
                <option value="stock_creation">Internal Stock Creation</option>
              </select>
            </div>

            {newJobType === 'customer_order' ? (
              <div className="relative">
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Customer</label>
                <div className="relative">
                  <div className="relative flex items-center">
                    <Search className="absolute left-3 text-stone-400" size={14} />
                    <input
                      type="text"
                      placeholder="Search or select customer..."
                      value={isCustomerDropdownOpen ? customerSearchQuery : newJobClientName}
                      onFocus={() => {
                        setIsCustomerDropdownOpen(true);
                        setCustomerSearchQuery('');
                      }}
                      onChange={e => {
                        setCustomerSearchQuery(e.target.value);
                        setNewJobClientName(e.target.value);
                        setIsCustomerDropdownOpen(true);
                      }}
                      className="w-full pl-9 pr-10 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                    />
                    <div className="absolute right-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                        className="text-stone-400 hover:text-stone-600 p-0.5"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Dropdown Menu */}
                  {isCustomerDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsCustomerDropdownOpen(false)}></div>
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-20 max-h-60 overflow-y-auto divide-y divide-stone-100 p-1">
                        {(() => {
                          const filtered = customers.filter(c =>
                            c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                            (c.email && c.email.toLowerCase().includes(customerSearchQuery.toLowerCase())) ||
                            (c.phone && c.phone.includes(customerSearchQuery))
                          );

                          if (filtered.length === 0) {
                            return (
                              <div className="p-4 text-center text-xs text-stone-400 italic">
                                No customer found for "{customerSearchQuery}"
                              </div>
                            );
                          }

                          return filtered.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setNewJobCustomerId(c.id);
                                setNewJobClientName(c.name);
                                if (c.address && useCustomerAddress) {
                                  setNewJobDeliveryAddress(c.address);
                                }
                                setIsCustomerDropdownOpen(false);
                              }}
                              className={`w-full text-left p-2 rounded-lg text-xs transition flex justify-between items-center cursor-pointer ${
                                c.id === newJobCustomerId ? 'bg-amber-50/50 text-amber-950 font-bold' : 'hover:bg-stone-50 text-stone-700'
                              }`}
                            >
                              <div className="min-w-0">
                                <span className="block truncate font-semibold text-left">{c.name}</span>
                                <span className="block text-[10px] text-stone-400 font-normal truncate text-left">{c.email || c.phone || 'No contact details'}</span>
                              </div>
                            </button>
                          ));
                        })()}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Customer / Assignee</label>
                <input
                  type="text"
                  disabled
                  value="Internal Stock Creation"
                  className="w-full px-3 py-2 bg-stone-100 border border-stone-200 rounded-xl text-stone-600 text-xs font-normal cursor-not-allowed"
                />
              </div>
            )}
          </div>

          {/* Unified Products and Line Items Section */}
          <div className="space-y-6">
            <div className="space-y-3">
              {newJobItems.length > 0 && (
                <div className="flex justify-end animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => setNewJobItems([])}
                    className="text-[10px] text-rose-600 hover:underline font-bold"
                  >
                    Clear All
                  </button>
                </div>
              )}

              {newJobItems.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-stone-200 bg-stone-50/20 rounded-2xl text-xs text-stone-400 italic flex flex-col items-center justify-center gap-3">
                  <div className="p-3 bg-stone-100 rounded-full text-stone-400">
                    <Layers size={22} />
                  </div>
                  <div className="space-y-0.5">
                    <span className="font-bold text-stone-700 block">No items added to job yet</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCatalogModalOpen(true);
                      setCatalogSearchQuery('');
                    }}
                    className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all duration-150 active:scale-95"
                  >
                    <PlusCircle size={14} /> Add items
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border border-stone-200 rounded-2xl bg-white overflow-hidden shadow-sm">
                    {/* Table Headers */}
                    <div className="hidden md:grid grid-cols-12 gap-4 bg-stone-50/70 border-b border-stone-200 px-4 py-3 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                      <div className="col-span-7">Item</div>
                      <div className="col-span-4 text-center">Quantity to Make</div>
                      <div className="col-span-1 text-right">Actions</div>
                    </div>

                    {/* Table Rows */}
                    <div className="divide-y divide-stone-100">
                      {newJobItems.map((item, idx) => {
                        const matchingProd = products.find(p => p.id === item.productId || p.name === item.title);

                        return (
                          <div key={idx} className="p-4 hover:bg-stone-50/40 transition duration-150 animate-fadeIn">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start md:items-center">
                              
                              {/* 1. Item Details (col-span-7) */}
                              <div className="col-span-1 md:col-span-7 space-y-2">
                                <div className="flex items-center gap-3">
                                  {item.productPhoto ? (
                                    <img 
                                      src={getProductPhotoUrl(item.productPhoto, item.title)} 
                                      alt={item.title} 
                                      className="w-10 h-10 object-cover rounded-xl border border-stone-100 shrink-0" 
                                      referrerPolicy="no-referrer"
                                      onError={(e) => handleImageError(e, item.title)}
                                    />
                                  ) : (
                                    <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center font-bold text-stone-500 text-[10px] shrink-0">
                                      Craft
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-stone-800 text-xs block truncate" title={item.title}>
                                        {item.title || 'Untitled Line Item'}
                                      </span>
                                      {matchingProd && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditItemSpecs(idx)}
                                          className="text-[9px] text-amber-700 hover:text-amber-800 hover:bg-amber-100/50 font-bold flex items-center gap-0.5 bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded-md shrink-0 cursor-pointer transition-colors"
                                          title="Edit specifications"
                                        >
                                          <Edit2 size={9} /> Edit
                                        </button>
                                      )}
                                    </div>
                                    {item.customizationSummary && (
                                      <span className="text-[10px] text-stone-400 font-semibold block truncate">
                                        {item.customizationSummary}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* 2. Quantity (col-span-4) */}
                              <div className="col-span-1 md:col-span-4 flex md:justify-center items-center">
                                <div className="w-full flex md:flex-col justify-between md:justify-center items-center gap-1.5">
                                  <span className="text-[9px] md:hidden font-bold text-stone-400 uppercase tracking-wider">Quantity to Make</span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={e => {
                                      const newItems = [...newJobItems];
                                      newItems[idx].quantity = Math.max(1, parseInt(e.target.value) || 1);
                                      setNewJobItems(newItems);
                                    }}
                                    className="w-20 md:w-20 bg-stone-50 px-2 py-1 border border-stone-200 rounded-lg text-xs font-normal text-stone-800 text-center focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                  />
                                </div>
                              </div>

                              {/* 3. Actions (col-span-1) */}
                              <div className="col-span-1 md:col-span-1 flex md:justify-end items-center">
                                <button
                                  type="button"
                                  onClick={() => removeJobItemRow(idx)}
                                  className="text-stone-400 hover:text-rose-600 transition p-1 hover:bg-stone-100 rounded-lg cursor-pointer"
                                  title="Remove item"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add Items Buttons */}
                    <div className="px-5 py-3 border-t border-stone-100 flex items-center justify-between bg-white">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCatalogModalOpen(true);
                            setCatalogSearchQuery('');
                          }}
                          className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all duration-150 active:scale-95 animate-fadeIn"
                        >
                          <PlusCircle size={14} /> Add items
                        </button>
                        <button
                          type="button"
                          onClick={addManualJobItemRow}
                          className="flex items-center justify-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          <Plus size={14} /> Custom Item
                        </button>
                      </div>
                    </div>

                    {/* Fulfilment Options section */}
                    {newJobType === 'customer_order' && (
                      <div className="px-5 py-4 border-t border-stone-100 bg-stone-50/50 space-y-4 font-sans text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-200/40">
                          <div className="space-y-0.5 text-left">
                            <span className="text-xs font-black text-stone-800 uppercase tracking-wider block">Fulfilment</span>
                            <p className="text-[10px] text-stone-500 font-medium">Select existing fulfilment option configured for your business</p>
                          </div>
                        </div>

                        <div className="space-y-4 text-left">
                          <div className="w-full">
                            <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-1">Fulfilment Option</label>
                            <select
                              value={selectedFulfillmentPresetId}
                              onChange={e => {
                                const targetId = e.target.value;
                                setSelectedFulfillmentPresetId(targetId);
                                const preset = fulfillmentPresets.find(p => p.id === targetId);
                                if (preset) {
                                  setNewJobFulfillmentType(preset.type);
                                } else {
                                  setNewJobFulfillmentType('collection');
                                }
                              }}
                              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal cursor-pointer"
                            >
                              <option value="">Select Fulfilment Option...</option>
                              {fulfillmentPresets.map(preset => {
                                const methodStr = preset.type === 'collection' ? 'Collection' : 'Delivery';
                                const labelStr = preset.label ? `: ${preset.label}` : '';
                                const priceStr = preset.isVariable ? '' : ` — ${preset.price === 0 ? 'Free' : `R${preset.price}`}`;
                                return (
                                  <option key={preset.id} value={preset.id}>
                                    {methodStr}{labelStr}{priceStr}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* Address Options (if delivery) */}
                          {newJobFulfillmentType === 'delivery' && (
                            <div className="space-y-3 animate-fadeIn border-t border-stone-200/50 pt-3 text-left">
                              <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider">Delivery Address Option</label>
                              <div className="flex gap-4">
                                <label className="flex items-center gap-1.5 text-xs text-stone-750 font-bold cursor-pointer">
                                  <input
                                    type="radio"
                                    name="jobAddressOption"
                                    checked={useCustomerAddress}
                                    onChange={() => setUseCustomerAddress(true)}
                                    className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                                  />
                                  <span>Use customer address</span>
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-stone-750 font-bold cursor-pointer">
                                  <input
                                    type="radio"
                                    name="jobAddressOption"
                                    checked={!useCustomerAddress}
                                    onChange={() => setUseCustomerAddress(false)}
                                    className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                                  />
                                  <span>Specify different address</span>
                                </label>
                              </div>

                              {useCustomerAddress && (
                                <div className="bg-white p-3 rounded-xl border border-stone-200 text-xs text-stone-700 animate-fadeIn max-w-xl text-left">
                                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block mb-0.5">Customer Address:</span>
                                  <span className="font-semibold">{selectedCustomer?.address || 'No physical address stored for this customer.'}</span>
                                </div>
                              )}

                              {!useCustomerAddress && (
                                <div className="bg-white p-3 rounded-xl border border-stone-200 space-y-2.5 animate-fadeIn max-w-xl text-left">
                                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block">Specify Different Address</span>
                                  <div className="space-y-2">
                                    <div>
                                      <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">Street Address</label>
                                      <input
                                        type="text"
                                        required={!useCustomerAddress}
                                        placeholder="e.g. 123 Maker Street"
                                        value={addrLine}
                                        onChange={e => setAddrLine(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">City</label>
                                        <input
                                          type="text"
                                          required={!useCustomerAddress}
                                          placeholder="e.g. Cape Town"
                                          value={addrCity}
                                          onChange={e => setAddrCity(e.target.value)}
                                          className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">Province</label>
                                        <input
                                          type="text"
                                          placeholder="e.g. Western Cape"
                                          value={addrProvince}
                                          onChange={e => setAddrProvince(e.target.value)}
                                          className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                                        />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">Postal Code</label>
                                        <input
                                          type="text"
                                          placeholder="e.g. 8001"
                                          value={addrPostalCode}
                                          onChange={e => setAddrPostalCode(e.target.value)}
                                          className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">Country</label>
                                        <input
                                          type="text"
                                          value={addrCountry}
                                          onChange={e => setAddrCountry(e.target.value)}
                                          className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreatingJob(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all duration-150 active:scale-95"
              >
                <Check size={14} /> Create Job
              </button>
            </div>
          </div>
        </div>
      </form>

        {/* Catalog Selection Modal */}
        <AnimatePresence>
          {isCatalogModalOpen && (
            <div className="fixed inset-0 bg-stone-950/50 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl max-w-md w-full border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
              >
                <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
                  <div>
                    <h3 className="font-extrabold text-stone-900 text-sm">Select Product from Catalog</h3>
                    <p className="text-[10px] text-stone-400 font-medium">Choose a product to configure specifications and quantity</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCatalogModalOpen(false)}
                    className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer transition"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-3 border-b border-stone-100 bg-white">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search catalog products..."
                      value={catalogSearchQuery}
                      onChange={(e) => setCatalogSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-normal focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-stone-800"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 divide-y divide-stone-100">
                  {products
                    .filter(p => p.isActive && (p.name.toLowerCase().includes(catalogSearchQuery.toLowerCase()) || p.description?.toLowerCase().includes(catalogSearchQuery.toLowerCase())))
                    .map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProductFromCatalog(p)}
                        className="p-3 rounded-xl hover:bg-amber-50/60 cursor-pointer flex items-center justify-between transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {p.photo ? (
                            <img src={getProductPhotoUrl(p.photo, p.id)} alt={p.name} className="w-10 h-10 object-cover rounded-lg border border-stone-200 shrink-0" referrerPolicy="no-referrer" onError={(e) => handleImageError(e, p.id)} />
                          ) : (
                            <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center font-bold text-stone-500 text-xs shrink-0">
                              Craft
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-stone-800 block truncate group-hover:text-amber-800 transition-colors">{p.name}</span>
                            <span className="text-[10px] text-stone-400 font-medium block truncate max-w-[200px]">{p.description}</span>
                            <span className="text-[10px] text-stone-600 font-extrabold block mt-0.5">{p.stockQuantity || 0} units in catalog</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200/50 px-2.5 py-1 rounded-lg shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                          Configure &rarr;
                        </span>
                      </div>
                    ))}

                  {products.filter(p => p.isActive && (p.name.toLowerCase().includes(catalogSearchQuery.toLowerCase()) || p.description?.toLowerCase().includes(catalogSearchQuery.toLowerCase()))).length === 0 && (
                    <div className="p-8 text-center text-xs text-stone-400 italic">
                      No matching products found in catalog.
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Product Specification Configurator Modal */}
        <AnimatePresence>
          {selectedProdToConfigure && (
            <div className="fixed inset-0 bg-stone-950/50 backdrop-blur-xs z-[70] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl max-w-lg w-full border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
                  <div className="flex items-center gap-3">
                    {selectedProdToConfigure.photo ? (
                      <img src={getProductPhotoUrl(selectedProdToConfigure.photo, selectedProdToConfigure.id)} alt={selectedProdToConfigure.name} className="w-10 h-10 object-cover rounded-xl border border-stone-200" referrerPolicy="no-referrer" onError={(e) => handleImageError(e, selectedProdToConfigure.id)} />
                    ) : (
                      <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center font-bold text-xs">
                        Craft
                      </div>
                    )}
                    <div>
                      <h3 className="font-extrabold text-stone-900 text-sm">{selectedProdToConfigure.name}</h3>
                      <p className="text-[10px] text-stone-400 font-medium">Configure specifications and quantity to make</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProdToConfigure(null)}
                    className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer transition"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-5 overflow-y-auto space-y-4">
                  <div className="bg-stone-50/80 p-3.5 rounded-xl border border-stone-200/60 flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-extrabold text-stone-800 uppercase tracking-wider">Quantity to Produce</label>
                      <span className="text-[10px] text-stone-400 font-medium">Number of units for this job</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfigQuantity(q => Math.max(1, q - 1))}
                        className="w-8 h-8 rounded-lg bg-white border border-stone-200 text-stone-700 font-bold text-sm hover:bg-stone-100 cursor-pointer flex items-center justify-center transition"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={configQuantity}
                        onChange={(e) => setConfigQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-14 h-8 bg-white border border-stone-200 rounded-lg text-center font-black text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setConfigQuantity(q => q + 1)}
                        className="w-8 h-8 rounded-lg bg-white border border-stone-200 text-stone-700 font-bold text-sm hover:bg-stone-100 cursor-pointer flex items-center justify-center transition"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {selectedProdToConfigure.customizationOptions && selectedProdToConfigure.customizationOptions.length > 0 && (() => {
                    const varOptions = selectedProdToConfigure.customizationOptions.filter(o => o.type !== 'extra');
                    const extraOptions = selectedProdToConfigure.customizationOptions.filter(o => o.type === 'extra');

                    const renderOptionGroup = (opts: typeof selectedProdToConfigure.customizationOptions, title: string, isExtraGroup: boolean) => (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 border-b border-stone-200/60 pb-1">
                          {isExtraGroup ? <Sparkles size={12} className="text-amber-600" /> : <Sliders size={12} className="text-stone-500" />}
                          <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isExtraGroup ? 'text-amber-800' : 'text-stone-600'}`}>
                            {title}
                          </span>
                        </div>
                        {opts.map(opt => (
                          <div key={opt.id || opt.name} className="space-y-1.5 pl-1">
                            <span className="block text-xs font-bold text-stone-800">{opt.name}</span>
                            <div className="flex flex-wrap gap-2">
                              {opt.values.map(val => {
                                const isSelected = configCustoms[opt.name]?.value === val.value;
                                return (
                                  <button
                                    key={val.value}
                                    type="button"
                                    onClick={() => {
                                      setConfigCustoms(prev => ({
                                        ...prev,
                                        [opt.name]: { value: val.value, priceUplift: val.priceUplift || 0 }
                                      }));
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                      isSelected 
                                        ? isExtraGroup 
                                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs' 
                                          : 'bg-stone-800 text-white border-stone-800 shadow-2xs'
                                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                                    }`}
                                  >
                                    {val.value}
                                    {val.priceUplift ? ` (+R${val.priceUplift})` : ''}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );

                    return (
                      <div className="space-y-4 pt-1">
                        {varOptions.length > 0 && renderOptionGroup(varOptions, "Product Variations", false)}
                        {extraOptions.length > 0 && renderOptionGroup(extraOptions, "Extras", true)}
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-[10px] font-extrabold text-stone-500 uppercase tracking-wider mb-1">Craftsman Instructions / Special Request</label>
                    <textarea
                      rows={2}
                      value={configNotes}
                      onChange={(e) => setConfigNotes(e.target.value)}
                      placeholder="e.g. Laser engrave customer logo on base"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs text-stone-800 font-normal focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>

                <div className="p-4 border-t border-stone-100 bg-stone-50/70 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedProdToConfigure(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmConfiguredItem}
                    className="px-5 py-2 rounded-xl text-xs font-extrabold bg-amber-600 hover:bg-amber-700 text-white shadow-sm cursor-pointer transition flex items-center gap-1 active:scale-95"
                  >
                    <Check size={14} /> Confirm & Add Item
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="space-y-6 pb-12" id="jobs-root-container">
      <AnimatePresence mode="wait">
        {!selectedJobId ? (
          /* ================= VIEW A: JOBS LIST VIEW ================= */
          <motion.div
            key="list-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.18 }}
            className="space-y-6"
            id="jobs-list-view"
          >
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
              <h2 className="text-lg font-bold text-stone-800">Jobs</h2>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 text-stone-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search jobs..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 bg-white border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Status Filter Dropdown */}
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full sm:w-auto bg-white border border-stone-200 rounded-xl pl-3 pr-8 py-1.5 text-xs font-normal text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer appearance-none shadow-2xs"
                  >
                    <option value="All">All Statuses ({jobs.length})</option>
                    <option value="Awaiting quote acceptance">Awaiting Acceptance</option>
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Ready for Collection">Ready for Collection</option>
                    <option value="Ready for Delivery">Ready for Delivery</option>
                    <option value="Being Delivered">Being Delivered</option>
                    <option value="Done">Done</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-stone-400 pointer-events-none" />
                </div>

                <button
                  type="button"
                  onClick={startCreateJob}
                  className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition shrink-0"
                >
                  <PlusCircle size={14} /> Create Job
                </button>
              </div>
            </div>

            {/* Production Stats Summary Cards */}
            {jobs.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200/60 shadow-3xs flex flex-col justify-between">
                  <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">In Progress</span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-2xl font-black text-blue-600">{inProductionCount}</span>
                    <span className="text-[10px] text-stone-400 font-bold">active bench</span>
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200/60 shadow-3xs flex flex-col justify-between">
                  <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">Ready (Collection)</span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-2xl font-black text-amber-600">{readyForCollectionCount}</span>
                    <span className="text-[10px] text-stone-400 font-bold">on shelf</span>
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200/60 shadow-3xs flex flex-col justify-between">
                  <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">Ready (Delivery)</span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-2xl font-black text-amber-700">{readyForDeliveryCount}</span>
                    <span className="text-[10px] text-stone-400 font-bold">courier wait</span>
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200/60 shadow-3xs flex flex-col justify-between">
                  <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">Being Delivered</span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-2xl font-black text-indigo-600">{beingDeliveredCount}</span>
                    <span className="text-[10px] text-stone-400 font-bold">transit</span>
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200/60 shadow-3xs flex flex-col justify-between col-span-2 lg:col-span-1">
                  <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">Done</span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-2xl font-black text-emerald-600">{completedCount}</span>
                    <span className="text-[10px] text-stone-400 font-bold">dispatched</span>
                  </div>
                </div>
              </div>
            )}

            {/* Jobs List */}
            {jobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-sm text-stone-400">
                <TrendingUp size={32} className="text-stone-200 mx-auto mb-2" />
                <p>No jobs in queue. Create and send quotes to automatically populate production rows here!</p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="bg-stone-50 rounded-2xl border border-stone-200 p-12 text-center text-sm text-stone-400">
                <Search size={28} className="text-stone-200 mx-auto mb-2" />
                <p className="font-bold text-stone-500">No jobs match your search parameters.</p>
                <button
                  onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}
                  className="mt-3 text-xs text-amber-700 font-extrabold hover:underline cursor-pointer"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5" id="jobs-list">
                {filteredJobs.map((job) => {
                  const completedTasks = job.items.filter(i => i.status === 'Done' || Math.max(0, i.quantity - (i.completedCount || 0) - (i.stockCount || 0)) === 0).length;
                  const totalTasks = job.items.length;
                  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                  return (
                    <div 
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      className="bg-white rounded-2xl border border-stone-200 p-4 hover:border-amber-400 hover:shadow-xs transition-all duration-200 cursor-pointer flex flex-col gap-3 relative group"
                    >
                      {/* Top Row: Customer Name, Job #, Date Created on left. Status Dropdown Button & Manage Button on right */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
                        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                          <h3 className="font-extrabold text-stone-900 text-base tracking-tight group-hover:text-amber-900 transition">
                            {job.clientName}
                          </h3>
                          <span className="font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md text-xs border border-stone-200/60 shrink-0">
                            {job.jobNumber}
                          </span>
                          <span className="text-xs text-stone-400 font-medium flex items-center gap-1">
                            <Calendar size={12} className="text-stone-400" /> {job.dateCreated}
                          </span>
                        </div>

                        {/* Status button (Dropdown) & Manage button */}
                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={job.status}
                            onChange={(e) => onUpdateJobStatus(job.id, e.target.value as JobStatus)}
                            className="bg-stone-50 hover:bg-stone-100 border border-stone-200/80 rounded-xl px-3 py-1.5 text-xs font-normal text-stone-800 focus:outline-none transition cursor-pointer"
                          >
                            {job.status === 'Awaiting quote acceptance' && (
                              <option value="Awaiting quote acceptance">Awaiting acceptance</option>
                            )}
                            <option value="Not Started">Not Started</option>
                            <option value="In Progress">In Progress</option>
                            {job.fulfillmentType === 'delivery' ? (
                              <>
                                <option value="Ready for Delivery">Ready for Delivery</option>
                                <option value="Being Delivered">Being Delivered</option>
                              </>
                            ) : (
                              <>
                                <option value="Ready for Collection">Ready for Collection</option>
                              </>
                            )}
                            <option value="Done">Done</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => setSelectedJobId(job.id)}
                            className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-xl transition shadow-2xs cursor-pointer flex items-center justify-center text-xs font-bold gap-1 shrink-0"
                          >
                            <span>Manage</span>
                            <ArrowRight size={14} />
                          </button>

                          {onDeleteJob && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingJobId(job.id);
                              }}
                              className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-stone-200/60 hover:border-rose-200 transition cursor-pointer shrink-0"
                              title="Delete Job"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Items Summary Row */}
                      {job.items && job.items.length > 0 && (
                        <div className="bg-stone-50/50 rounded-xl p-3 border border-stone-100 space-y-2">
                          <div className="flex justify-between items-center text-xs text-stone-500 font-bold">
                            <span className="flex items-center gap-1.5">
                              <Package size={13} className="text-amber-600" />
                              <span>{job.items.length} {job.items.length === 1 ? 'item' : 'items'} ordered</span>
                            </span>
                            {job.status !== 'Awaiting quote acceptance' && (
                              <span className="text-stone-500 text-xs font-semibold">
                                {completedTasks}/{totalTasks} completed ({progressPercentage}%)
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {job.items.map((item, idx) => {
                              const itemCompleted = Math.max(0, item.quantity - (item.completedCount || 0) - (item.stockCount || 0)) === 0;
                              const { variations, extras, hasSpecs } = categorizeJobItemSpecs(item);
                              return (
                                <div 
                                  key={item.id || idx}
                                  className={`bg-white border rounded-xl p-2.5 text-xs flex items-start gap-2.5 ${
                                    itemCompleted ? 'border-emerald-200 bg-emerald-50/20' : 'border-stone-200/80'
                                  }`}
                                >
                                  <span className={`font-black px-1.5 py-0.5 rounded text-[11px] shrink-0 ${
                                    itemCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100/80 text-amber-900'
                                  }`}>
                                    {item.quantity}×
                                  </span>
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="font-bold text-stone-800 truncate">{item.title}</div>
                                    {hasSpecs && (
                                      <div className="flex flex-wrap gap-1">
                                        {variations.map((v, i) => (
                                          <span key={`v_${i}`} className="inline-flex items-center text-[10px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md font-medium">
                                            {v.value}
                                          </span>
                                        ))}
                                        {extras.map((e, i) => (
                                          <span key={`e_${i}`} className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-900 border border-amber-200/60 px-2 py-0.5 rounded-md font-semibold">
                                            <Sparkles size={9} className="text-amber-600 shrink-0" />
                                            {e.value}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          /* ================= VIEW B: MOBLE-FRIENDLY DETAIL & CHECKLIST VIEW ================= */
          <motion.div
            key="checklist-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="space-y-6"
            id="jobs-checklist-view"
          >
            {/* Top Navigation Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-5">
              <div className="space-y-1.5">
                <button
                  onClick={() => setSelectedJobId(null)}
                  className="inline-flex items-center gap-1.5 text-xs text-stone-500 font-extrabold hover:text-stone-800 transition cursor-pointer bg-stone-50 hover:bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200/50"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Jobs List</span>
                </button>
                
                <div className="flex flex-wrap items-center gap-2.5 pt-1.5">
                  <h2 className="text-xl font-black text-stone-900 tracking-tight flex items-center gap-1.5">
                    <User size={18} className="text-amber-600 shrink-0" />
                    <span>{selectedJob?.clientName}</span>
                  </h2>
                  <span className="text-stone-300 font-normal text-sm">/</span>
                  <span className="text-xs font-extrabold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200/60">
                    {selectedJob?.jobNumber}
                  </span>
                </div>
              </div>

              {onDeleteJob && selectedJob && (
                <button
                  type="button"
                  onClick={() => setDeletingJobId(selectedJob.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 active:scale-95"
                >
                  <Trash2 size={13} />
                  <span>Delete Job</span>
                </button>
              )}
            </div>

            {/* Main Page Layout: Two columns on desktop, stacked on mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* LEFT/MAIN COLUMN: Items list */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Items ({selectedJob?.items.length})</span>
                  </h3>
                  {selectedJob && selectedJob.status !== 'Awaiting quote acceptance' && (
                    <button
                      type="button"
                      onClick={() => {
                        setCatalogModalTab('products');
                        setIsCatalogModalOpen(true);
                      }}
                      className="text-amber-800 hover:text-amber-900 text-xs font-extrabold flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2.5 py-1 rounded-xl transition cursor-pointer shadow-3xs"
                    >
                      <PlusCircle size={13} /> Add Item to Job
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {selectedJob?.items.map((item) => {
                    const amountLeftToMake = Math.max(0, item.quantity - (item.completedCount || 0) - (item.stockCount || 0));
                    const isItemDone = amountLeftToMake === 0;
                    const isEditing = editingLeftToMakeId === item.id;

                    return (
                      <div 
                        key={item.id}
                        className={`bg-white rounded-2xl border transition-all duration-200 p-5 space-y-4 ${
                          isItemDone 
                            ? 'border-emerald-250 bg-emerald-50/5 shadow-3xs' 
                            : 'border-stone-200 shadow-3xs hover:border-stone-250'
                        }`}
                      >
                        {/* SECTION 1: TOP ROW - Checkbox + Title + Quantity Badges + Left-to-make Stepper */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-stone-100 pb-3.5">
                          {/* Left: Checkbox + Info */}
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <button
                              type="button"
                              disabled={selectedJob.status === 'Awaiting quote acceptance'}
                              onClick={() => {
                                const currentStock = item.stockCount || 0;
                                if (isItemDone) {
                                  onUpdateJobTaskCounts(selectedJob.id, item.id, 0, currentStock);
                                } else {
                                  const unfulfilled = Math.max(0, item.quantity - currentStock);
                                  onUpdateJobTaskCounts(selectedJob.id, item.id, unfulfilled, currentStock);
                                }
                              }}
                              className={`p-1 rounded-xl transition-all shrink-0 mt-0.5 ${
                                selectedJob.status === 'Awaiting quote acceptance'
                                  ? 'opacity-30 cursor-not-allowed'
                                  : 'cursor-pointer hover:scale-105 hover:bg-stone-50'
                              }`}
                              title={isItemDone ? "Mark as unfinished" : "Mark entire item as completed"}
                            >
                              {isItemDone ? (
                                <CheckSquare size={22} className="text-emerald-600 fill-emerald-50" />
                              ) : (
                                <Square size={22} className="text-stone-300 hover:text-amber-600 bg-stone-50" />
                              )}
                            </button>

                            <div className="space-y-1.5 min-w-0 flex-1">
                              <h4 className={`text-base font-black tracking-tight leading-snug ${
                                isItemDone ? 'text-stone-400 line-through' : 'text-stone-900'
                              }`}>
                                {item.title}
                              </h4>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-stone-100 text-stone-700 text-xs font-bold px-2.5 py-0.5 rounded-md border border-stone-200/50">
                                  Ordered: {item.quantity} {item.quantity > 1 ? 'units' : 'unit'}
                                </span>
                                {isItemDone ? (
                                  <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-0.5 rounded-md border border-emerald-200">
                                    ✓ All Done
                                  </span>
                                ) : (
                                  <span className="bg-amber-50 text-amber-800 text-xs font-extrabold px-2.5 py-0.5 rounded-md border border-amber-200">
                                    {amountLeftToMake} Left
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Inline Counter / Left to Make controls (Only shown when tracking as whole) */}
                          {(item.trackingMode || 'whole') === 'whole' && (
                            <div className="flex flex-col items-end gap-1 shrink-0 self-start sm:self-start">
                              <div className="flex items-center gap-1 bg-stone-50 border border-stone-200/80 rounded-xl p-1 shadow-3xs">
                                {/* Minus Button */}
                                <button
                                  type="button"
                                  disabled={selectedJob.status === 'Awaiting quote acceptance' || amountLeftToMake === 0}
                                  onClick={() => {
                                    const currentCompleted = item.completedCount || 0;
                                    const currentStock = item.stockCount || 0;
                                    const maxCanMake = Math.max(0, item.quantity - currentStock);
                                    const nextCompleted = Math.min(maxCanMake, currentCompleted + 1);
                                    onUpdateJobTaskCounts(selectedJob.id, item.id, nextCompleted, currentStock);
                                  }}
                                  className="w-8 h-8 rounded-lg bg-white hover:bg-stone-100 border border-stone-200/60 flex items-center justify-center text-sm font-black text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none transition active:scale-95 cursor-pointer"
                                  title="Decrease left-to-make / increase completed"
                                >
                                  -
                                </button>

                                {/* Tappable numeric display / Input */}
                                <div className="min-w-[48px] text-center">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      min={0}
                                      max={item.quantity}
                                      value={tempLeftToMake}
                                      autoFocus
                                      onChange={(e) => setTempLeftToMake(e.target.value)}
                                      onBlur={() => {
                                        let val = parseInt(tempLeftToMake, 10);
                                        if (isNaN(val)) val = amountLeftToMake;
                                        const currentStock = item.stockCount || 0;
                                        const maxCanMake = Math.max(0, item.quantity - currentStock);
                                        val = Math.max(0, Math.min(maxCanMake, val));
                                        const nextCompleted = maxCanMake - val;
                                        onUpdateJobTaskCounts(selectedJob.id, item.id, nextCompleted, currentStock);
                                        setEditingLeftToMakeId(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          let val = parseInt(tempLeftToMake, 10);
                                          if (isNaN(val)) val = amountLeftToMake;
                                          const currentStock = item.stockCount || 0;
                                          const maxCanMake = Math.max(0, item.quantity - currentStock);
                                          val = Math.max(0, Math.min(maxCanMake, val));
                                          const nextCompleted = maxCanMake - val;
                                          onUpdateJobTaskCounts(selectedJob.id, item.id, nextCompleted, currentStock);
                                          setEditingLeftToMakeId(null);
                                        } else if (e.key === 'Escape') {
                                          setEditingLeftToMakeId(null);
                                        }
                                      }}
                                      className="w-12 text-center font-black text-sm text-amber-700 bg-amber-50 border border-amber-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 py-0.5"
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={selectedJob.status === 'Awaiting quote acceptance'}
                                      onClick={() => {
                                        setEditingLeftToMakeId(item.id);
                                        setTempLeftToMake(String(amountLeftToMake));
                                      }}
                                      className="w-full text-sm font-black text-stone-800 hover:text-amber-700 hover:bg-stone-100/50 rounded-md py-1 transition cursor-pointer"
                                      title="Tap to type value manually"
                                    >
                                      {amountLeftToMake}
                                    </button>
                                  )}
                                </div>

                                {/* Plus Button */}
                                <button
                                  type="button"
                                  disabled={selectedJob.status === 'Awaiting quote acceptance' || amountLeftToMake === item.quantity}
                                  onClick={() => {
                                    const currentCompleted = item.completedCount || 0;
                                    const currentStock = item.stockCount || 0;
                                    const nextCompleted = Math.max(0, currentCompleted - 1);
                                    onUpdateJobTaskCounts(selectedJob.id, item.id, nextCompleted, currentStock);
                                  }}
                                  className="w-8 h-8 rounded-lg bg-white hover:bg-stone-100 border border-stone-200/60 flex items-center justify-center text-sm font-black text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none transition active:scale-95 cursor-pointer"
                                  title="Increase left-to-make / decrease completed"
                                >
                                  +
                                </button>
                              </div>
                              <span className="text-[9px] text-stone-400 font-medium">of {item.quantity} total</span>
                            </div>
                          )}
                        </div>

                        {/* SECTION 2: CORE DETAILS (Stock Allocation & Specifications) */}
                        <div className="space-y-3">
                          {/* Stock Allocation Row & Button */}
                          {(() => {
                            const matchingProd = getMatchingProduct(item);
                            const availStock = matchingProd?.stockQuantity || 0;
                            const fulfilledFromStock = item.stockCount || 0;

                            return (
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStockModalTask(item);
                                    const match = getMatchingProduct(item);
                                    const initialProdId = match ? match.id : (products[0]?.id || '');
                                    setSelectedStockProductId(initialProdId);
                                    const initialAvail = match ? (match.stockQuantity || 0) : (products[0]?.stockQuantity || 0);
                                    setStockModalQuantity(Math.max(1, Math.min(initialAvail > 0 ? initialAvail : 1, amountLeftToMake)));
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl transition cursor-pointer shadow-2xs"
                                  title="Add or allocate units from available finished stock"
                                >
                                  <Package size={13} className="text-amber-700 shrink-0" />
                                  <span>Add from stock</span>
                                  <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded-md">
                                    {availStock} avail
                                  </span>
                                </button>

                                {fulfilledFromStock > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRemoveStockModalTask(item);
                                      setRemoveStockQuantity(fulfilledFromStock);
                                    }}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-amber-50 hover:text-amber-900 border border-emerald-200 hover:border-amber-300 px-3 py-1.5 rounded-xl transition cursor-pointer group shadow-2xs"
                                    title="Click to return allocated stock back to catalog"
                                  >
                                    <Check size={12} className="text-emerald-600 group-hover:hidden shrink-0" />
                                    <RotateCcw size={12} className="hidden group-hover:block text-amber-700 shrink-0" />
                                    <span>{fulfilledFromStock} from stock</span>
                                    <span className="text-[10px] text-amber-800 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                      (return)
                                    </span>
                                  </button>
                                )}
                              </div>
                            );
                          })()}

                          {/* Customizations & Product Specifications */}
                          {(() => {
                            const { variations, extras, hasSpecs } = categorizeJobItemSpecs(item);
                            if (!hasSpecs) return null;

                            return (
                              <div className="pt-1 space-y-2">
                                {/* VARIATIONS SECTION */}
                                {variations.length > 0 && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">
                                      Product Variations
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {variations.map((v, i) => (
                                        <span
                                          key={i}
                                          className="inline-flex items-center gap-1 text-xs bg-stone-100 text-stone-800 border border-stone-200/70 px-2.5 py-1 rounded-lg font-medium"
                                        >
                                          {v.label && v.label !== 'Variation' && (
                                            <span className="text-stone-500 font-normal">{v.label}:</span>
                                          )}
                                          <span className="text-stone-900 font-bold">{v.value}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* EXTRAS SECTION */}
                                {extras.length > 0 && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-extrabold text-amber-800/80 uppercase tracking-wider flex items-center gap-1">
                                      <Sparkles size={11} className="text-amber-600" />
                                      Extras
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {extras.map((e, i) => (
                                        <span
                                          key={i}
                                          className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-950 border border-amber-200/80 px-2.5 py-1 rounded-lg font-bold"
                                        >
                                          {e.label && e.label !== 'Extra' && (
                                            <span className="text-amber-800 font-medium">{e.label}:</span>
                                          )}
                                          <span>{e.value}</span>
                                          {e.priceUplift !== undefined && e.priceUplift > 0 && (
                                            <span className="text-[10px] text-amber-700 bg-amber-100/80 px-1.5 py-0.2 rounded ml-0.5 font-bold">
                                              +R{e.priceUplift}
                                            </span>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Material Inventory Requirements & Status Breakdown */}
                          <TaskMaterialStatusBreakdown
                            item={item}
                            products={products}
                            materials={materials}
                            jobId={selectedJob.id}
                            jobTaskStatus={item.status}
                            onUpdateJobTaskStatus={onUpdateJobTaskStatus}
                            onUpdateMaterialStock={onUpdateMaterialStock}
                            onUpdateMaterial={onUpdateMaterial}
                          />
                        </div>

                        {/* SECTION 3: TRACKING OPTIONS (PLACED BELOW CORE DETAILS & SPECS) */}
                        <div className="pt-3 border-t border-stone-100 space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-wider block">
                              Tracking Method
                            </span>
                            <div className="flex items-center gap-1 bg-stone-100/90 p-1 rounded-xl border border-stone-200/70 w-fit">
                              <button
                                type="button"
                                disabled={selectedJob.status === 'Awaiting quote acceptance'}
                                onClick={() => onUpdateJobTaskTrackingMode?.(selectedJob.id, item.id, 'whole')}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                  (item.trackingMode || 'whole') === 'whole'
                                    ? 'bg-white text-stone-900 shadow-2xs border border-stone-200/80'
                                    : 'text-stone-500 hover:text-stone-800'
                                }`}
                              >
                                <Layers size={12} />
                                <span>Track as Whole</span>
                              </button>
                              <button
                                type="button"
                                disabled={selectedJob.status === 'Awaiting quote acceptance'}
                                onClick={() => onUpdateJobTaskTrackingMode?.(selectedJob.id, item.id, 'stages')}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                  item.trackingMode === 'stages'
                                    ? 'bg-amber-600 text-white shadow-2xs'
                                    : 'text-stone-500 hover:text-stone-800'
                                }`}
                              >
                                <Sliders size={12} />
                                <span>Track in Stages</span>
                              </button>
                            </div>
                          </div>

                          {/* STAGE TRACKER (Rendered if trackingMode === 'stages') */}
                          {item.trackingMode === 'stages' && (
                            <ItemStageTracker
                              jobId={selectedJob.id}
                              item={item}
                              reusableStages={reusableStages}
                              onAddReusableStage={onAddReusableStage}
                              onUpdateJobTaskStages={onUpdateJobTaskStages}
                              isJobLocked={selectedJob.status === 'Awaiting quote acceptance'}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT COLUMN: Standardised Order & Customer Details */}
              <div className="space-y-5">
                {/* Order Summary & Status Card */}
                {selectedJob && (() => {
                  const customerInfo = customers.find(c => c.id === selectedJob.customerId);
                  const completedTasks = selectedJob.items.filter(i => Math.max(0, i.quantity - (i.completedCount || 0) - (i.stockCount || 0)) === 0).length;
                  const totalTasks = selectedJob.items.length;
                  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                  return (
                    <>
                      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-3xs">
                        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                          <span className="text-xs font-extrabold text-stone-500 uppercase tracking-wider">Order Status</span>
                          <span className="text-xs text-stone-400 font-bold">Created {selectedJob.dateCreated}</span>
                        </div>

                        <div className="space-y-3">
                          {/* Status Dropdown */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Job Progress Stage</label>
                            <select
                              value={selectedJob.status}
                              onChange={(e) => onUpdateJobStatus(selectedJob.id, e.target.value as JobStatus)}
                              className="w-full bg-stone-50 hover:bg-stone-100 border border-stone-200/85 rounded-xl px-3 py-2 text-xs font-normal text-stone-800 focus:outline-none transition cursor-pointer"
                            >
                              {selectedJob.status === 'Awaiting quote acceptance' && (
                                <option value="Awaiting quote acceptance">Awaiting acceptance</option>
                              )}
                              <option value="Not Started">Not Started</option>
                              <option value="In Progress">In Progress</option>
                              {selectedJob.fulfillmentType === 'delivery' ? (
                                <>
                                  <option value="Ready for Delivery">Ready for Delivery</option>
                                  <option value="Being Delivered">Being Delivered</option>
                                </>
                              ) : (
                                <>
                                  <option value="Ready for Collection">Ready for Collection</option>
                                </>
                              )}
                              <option value="Done">Done</option>
                            </select>
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-stone-400">
                              <span>Craft Progress</span>
                              <span className="text-stone-800 font-black">{progressPercentage}%</span>
                            </div>
                            <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-300" 
                                style={{ width: `${progressPercentage}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-stone-400 font-bold block">
                              {completedTasks} of {totalTasks} items fully crafted
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Customer Contact Card */}
                      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-3xs">
                        <div className="border-b border-stone-100 pb-3">
                          <span className="text-xs font-extrabold text-stone-500 uppercase tracking-wider">Customer Details</span>
                        </div>

                        <div className="space-y-3.5">
                          {/* Customer Name */}
                          <div className="flex items-start gap-2.5">
                            <User size={16} className="text-stone-400 mt-0.5 shrink-0" />
                            <div className="space-y-0.5">
                              <span className="text-[9px] font-extrabold text-stone-400 uppercase tracking-widest block">Customer Name</span>
                              <span className="text-xs font-extrabold text-stone-800 block">{customerInfo?.name || selectedJob.clientName}</span>
                            </div>
                          </div>

                          {/* Client Email */}
                          <div className="flex items-start gap-2.5">
                            <Mail size={16} className="text-stone-400 mt-0.5 shrink-0" />
                            <div className="space-y-0.5">
                              <span className="text-[9px] font-extrabold text-stone-400 uppercase tracking-widest block">Email Address</span>
                              {customerInfo?.email ? (
                                <span className="text-xs font-semibold text-stone-700 block break-all">{customerInfo.email}</span>
                              ) : (
                                <span className="text-xs italic text-stone-400 block">No email provided</span>
                              )}
                            </div>
                          </div>

                          {/* Client Phone */}
                          <div className="flex items-start gap-2.5">
                            <Phone size={16} className="text-stone-400 mt-0.5 shrink-0" />
                            <div className="space-y-0.5">
                              <span className="text-[9px] font-extrabold text-stone-400 uppercase tracking-widest block">Phone Number</span>
                              {customerInfo?.phone ? (
                                <span className="text-xs font-semibold text-stone-700 block">{customerInfo.phone}</span>
                              ) : (
                                <span className="text-xs italic text-stone-400 block">No phone provided</span>
                              )}
                            </div>
                          </div>

                          {/* Delivery / Billing Address */}
                          <div className="flex items-start gap-2.5">
                            <MapPin size={16} className="text-stone-400 mt-0.5 shrink-0" />
                            <div className="space-y-0.5">
                              <span className="text-[9px] font-extrabold text-stone-400 uppercase tracking-widest block">Address</span>
                              {customerInfo?.address ? (
                                <span className="text-xs font-semibold text-stone-700 block leading-relaxed">{customerInfo.address}</span>
                              ) : (
                                <span className="text-xs italic text-stone-400 block">No address provided</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Job Notes Card (identical style and behavior to Customers page) */}
                      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3 shadow-3xs">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
                            <BookOpen size={15} className="text-amber-600" />
                            Notes
                          </h4>
                          <span className="text-[10px] text-stone-400 font-mono">Auto-saved</span>
                        </div>

                        <textarea
                          value={selectedJob.notes || ''}
                          onChange={e => {
                            if (onUpdateJob) {
                              onUpdateJob({ ...selectedJob, notes: e.target.value });
                            }
                          }}
                          placeholder="Add custom notes, job updates, or instructions here..."
                          rows={4}
                          className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-xs focus:ring-amber-500/25 focus:ring-2 focus:outline-none resize-y leading-relaxed font-sans"
                        />
                      </div>
                    </>
                  );
                })()}

                {/* Smart Completion Banner */}
                {(() => {
                  const allItemsDone = selectedJob?.items.every(i => Math.max(0, i.quantity - (i.completedCount || 0)) === 0);
                  const needsFulfillmentShift = selectedJob && allItemsDone && ['Not Started', 'In Progress'].includes(selectedJob.status);

                  if (needsFulfillmentShift) {
                    const isDelivery = selectedJob.fulfillmentType === 'delivery';
                    return (
                      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-xs text-emerald-800 space-y-3 shadow-3xs animate-fadeIn">
                        <div className="flex gap-2.5 items-start">
                          <Sparkles size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block font-black text-emerald-950 mb-0.5">All Items Handcrafted!</strong>
                            All production items are complete for <span className="font-bold">`{selectedJob.jobNumber}`</span>. Move the macro state to dispatch now:
                          </div>
                        </div>
                        
                        <div className="pt-1">
                          {isDelivery ? (
                            <button
                              type="button"
                              onClick={() => onUpdateJobStatus(selectedJob.id, 'Ready for Delivery')}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-xl font-bold text-[10px] transition cursor-pointer flex items-center justify-center gap-1 shadow-3xs"
                            >
                              <Truck size={11} />
                              <span>Mark Ready for Delivery</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onUpdateJobStatus(selectedJob.id, 'Ready for Collection')}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-xl font-bold text-[10px] transition cursor-pointer flex items-center justify-center gap-1 shadow-3xs"
                            >
                              <ShoppingBag size={11} />
                              <span>Mark Ready for Collection</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  
                  return null;
                })()}

              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= CATALOG ITEM SELECTION MODAL ================= */}
      <AnimatePresence>
        {isCatalogModalOpen && (
          <div className="fixed inset-0 bg-stone-950/50 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
                <div>
                  <h3 className="font-extrabold text-stone-900 text-sm">Add Item to Job</h3>
                  <p className="text-[10px] text-stone-400 font-medium">Select catalog products, services, or add a custom once-off item</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCatalogModalOpen(false)}
                  className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer transition"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-stone-100 px-3 bg-stone-50/40">
                <button
                  type="button"
                  onClick={() => { setCatalogModalTab('products'); setCatalogSearchQuery(''); }}
                  className={`flex-1 py-2.5 text-center text-xs font-bold transition-all border-b-2 -mb-[1px] cursor-pointer ${
                    catalogModalTab === 'products'
                      ? 'border-amber-600 text-amber-800'
                      : 'border-transparent text-stone-500 hover:text-stone-700'
                  }`}
                >
                  Products
                </button>
                <button
                  type="button"
                  onClick={() => { setCatalogModalTab('services'); setCatalogSearchQuery(''); }}
                  className={`flex-1 py-2.5 text-center text-xs font-bold transition-all border-b-2 -mb-[1px] cursor-pointer ${
                    catalogModalTab === 'services'
                      ? 'border-amber-600 text-amber-800'
                      : 'border-transparent text-stone-500 hover:text-stone-700'
                  }`}
                >
                  Services
                </button>
                <button
                  type="button"
                  onClick={() => { setCatalogModalTab('custom'); setCatalogSearchQuery(''); }}
                  className={`flex-1 py-2.5 text-center text-xs font-bold transition-all border-b-2 -mb-[1px] cursor-pointer ${
                    catalogModalTab === 'custom'
                      ? 'border-amber-600 text-amber-800'
                      : 'border-transparent text-stone-500 hover:text-stone-700'
                  }`}
                >
                  Custom Item
                </button>
              </div>

              {catalogModalTab === 'custom' ? (
                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-white">
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 text-xs text-amber-900 leading-relaxed font-medium">
                    <strong>Once-Off Custom Job Item:</strong> Track unique, non-catalog tasks or bespoke maker commissions.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Item Title / Task Name *</label>
                    <input
                      type="text"
                      required
                      value={jobCustomTitle}
                      onChange={e => setJobCustomTitle(e.target.value)}
                      placeholder="e.g. Custom Reclaimed Wood Cabinet"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Specifications & Production Notes</label>
                    <textarea
                      rows={2}
                      value={jobCustomSpecs}
                      onChange={e => setJobCustomSpecs(e.target.value)}
                      placeholder="Materials needed, specific dimensions, finish..."
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-normal"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Quantity to Make</label>
                    <input
                      type="number"
                      min={1}
                      value={jobCustomQty}
                      onChange={e => setJobCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-bold text-center"
                    />
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 font-medium">
                    <span>Want to calculate input costs or specify a production process?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCatalogModalOpen(false);
                        setIsAdvancedCustomItemOpen(true);
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shrink-0 shadow-3xs"
                    >
                      Configure advanced options
                    </button>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCatalogModalOpen(false)}
                      className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!jobCustomTitle.trim()}
                      onClick={handleAddCustomJobItem}
                      className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      <PlusCircle size={14} /> Add Custom Item
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-3 border-b border-stone-100 bg-white">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type="text"
                        placeholder={`Search ${catalogModalTab}...`}
                        value={catalogSearchQuery}
                        onChange={(e) => setCatalogSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-normal focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-stone-800"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 divide-y divide-stone-100">
                    {(catalogModalTab === 'products' ? products : services)
                      .filter(p => p.isActive && (p.name.toLowerCase().includes(catalogSearchQuery.toLowerCase()) || p.description?.toLowerCase().includes(catalogSearchQuery.toLowerCase())))
                      .map(p => (
                        <div
                          key={p.id}
                          onClick={() => handleSelectProductFromCatalog(p)}
                          className="p-3 rounded-xl hover:bg-amber-50/60 cursor-pointer flex items-center justify-between transition-colors group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {p.photo ? (
                              <img src={p.photo} alt={p.name} className="w-10 h-10 object-cover rounded-lg border border-stone-200 shrink-0" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center font-bold text-stone-500 text-xs shrink-0">
                                {catalogModalTab === 'products' ? 'Craft' : 'Service'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-stone-800 block truncate group-hover:text-amber-800 transition-colors">{p.name}</span>
                              <span className="text-[10px] text-stone-400 font-medium block truncate max-w-[200px]">{p.description}</span>
                              {catalogModalTab === 'products' && (
                                <span className="text-[10px] text-stone-600 font-extrabold block mt-0.5">{p.stockQuantity || 0} units in catalog</span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200/50 px-2.5 py-1 rounded-lg shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                            Configure &rarr;
                          </span>
                        </div>
                      ))}

                    {(catalogModalTab === 'products' ? products : services).filter(p => p.isActive && (p.name.toLowerCase().includes(catalogSearchQuery.toLowerCase()) || p.description?.toLowerCase().includes(catalogSearchQuery.toLowerCase()))).length === 0 && (
                      <div className="p-8 text-center text-xs text-stone-400 italic">
                        No matching {catalogModalTab} found.
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= PRODUCT SPECIFICATION CONFIGURATOR MODAL ================= */}
      <AnimatePresence>
        {selectedProdToConfigure && (
          <div className="fixed inset-0 bg-stone-950/50 backdrop-blur-xs z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-lg w-full border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
                <div className="flex items-center gap-3">
                  {selectedProdToConfigure.photo ? (
                    <img src={selectedProdToConfigure.photo} alt={selectedProdToConfigure.name} className="w-10 h-10 object-cover rounded-xl border border-stone-200" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center font-bold text-xs">
                      Craft
                    </div>
                  )}
                  <div>
                    <h3 className="font-extrabold text-stone-900 text-sm">{selectedProdToConfigure.name}</h3>
                    <p className="text-[10px] text-stone-400 font-medium">Configure specifications and quantity to make</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProdToConfigure(null)}
                  className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer transition"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <div className="p-5 overflow-y-auto space-y-4">
                {/* Quantity Input */}
                <div className="bg-stone-50/80 p-3.5 rounded-xl border border-stone-200/60 flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-extrabold text-stone-800 uppercase tracking-wider">Quantity to Produce</label>
                    <span className="text-[10px] text-stone-400 font-medium">Number of units for this job</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfigQuantity(q => Math.max(1, q - 1))}
                      className="w-8 h-8 rounded-lg bg-white border border-stone-200 text-stone-700 font-bold text-sm hover:bg-stone-100 cursor-pointer flex items-center justify-center transition"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={configQuantity}
                      onChange={(e) => setConfigQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 h-8 bg-white border border-stone-200 rounded-lg text-center font-black text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setConfigQuantity(q => q + 1)}
                      className="w-8 h-8 rounded-lg bg-white border border-stone-200 text-stone-700 font-bold text-sm hover:bg-stone-100 cursor-pointer flex items-center justify-center transition"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Customization Options (Variations / Extras) */}
                {selectedProdToConfigure.customizationOptions && selectedProdToConfigure.customizationOptions.length > 0 && (() => {
                  const varOptions = selectedProdToConfigure.customizationOptions.filter(o => o.type !== 'extra');
                  const extraOptions = selectedProdToConfigure.customizationOptions.filter(o => o.type === 'extra');

                  const renderOptionGroup = (opts: typeof selectedProdToConfigure.customizationOptions, title: string, isExtraGroup: boolean) => (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-1.5 border-b border-stone-200/60 pb-1">
                        {isExtraGroup ? <Sparkles size={12} className="text-amber-600" /> : <Sliders size={12} className="text-stone-500" />}
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isExtraGroup ? 'text-amber-800' : 'text-stone-600'}`}>
                          {title}
                        </span>
                      </div>
                      {opts.map(opt => (
                        <div key={opt.id || opt.name} className="space-y-1.5 pl-1">
                          <span className="block text-xs font-bold text-stone-800">{opt.name}</span>
                          <div className="flex flex-wrap gap-2">
                            {opt.values.map(val => {
                              const isSelected = configCustoms[opt.name]?.value === val.value;
                              return (
                                <button
                                  key={val.value}
                                  type="button"
                                  onClick={() => {
                                    setConfigCustoms(prev => ({
                                      ...prev,
                                      [opt.name]: { value: val.value, priceUplift: val.priceUplift || 0 }
                                    }));
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                    isSelected 
                                      ? isExtraGroup 
                                        ? 'bg-amber-600 text-white border-amber-600 shadow-2xs' 
                                        : 'bg-stone-800 text-white border-stone-800 shadow-2xs'
                                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                                  }`}
                                >
                                  {val.value}
                                  {val.priceUplift ? ` (+R${val.priceUplift})` : ''}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );

                  return (
                    <div className="space-y-4 pt-1">
                      {varOptions.length > 0 && renderOptionGroup(varOptions, "Product Variations", false)}
                      {extraOptions.length > 0 && renderOptionGroup(extraOptions, "Extras", true)}
                    </div>
                  );
                })()}

                {/* Custom Notes */}
                <div>
                  <label className="block text-[10px] font-extrabold text-stone-500 uppercase tracking-wider mb-1">Craftsman Instructions / Special Request</label>
                  <textarea
                    rows={2}
                    value={configNotes}
                    onChange={(e) => setConfigNotes(e.target.value)}
                    placeholder="e.g. Laser engrave customer logo on base"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs text-stone-800 font-normal focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-stone-100 bg-stone-50/70 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedProdToConfigure(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmConfiguredItem}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-amber-600 hover:bg-amber-700 text-white shadow-sm cursor-pointer transition flex items-center gap-1 active:scale-95"
                >
                  <Check size={14} /> Confirm & Add Item
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL 2: ALLOCATE FROM STOCK ================= */}
      <AnimatePresence>
        {stockModalTask && selectedJob && (() => {
          const matchingProd = products.find(p => p.id === (selectedStockProductId || stockModalTask.productId)) || getMatchingProduct(stockModalTask);
          const currentProd = matchingProd || products[0];
          const availableInStock = currentProd?.stockQuantity || 0;
          const leftToMake = Math.max(0, stockModalTask.quantity - (stockModalTask.completedCount || 0) - (stockModalTask.stockCount || 0));

          return (
            <div className="fixed inset-0 bg-stone-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl max-w-md w-full border border-stone-200 shadow-xl overflow-hidden p-6 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2 text-stone-900 font-extrabold text-base">
                    <Package className="text-amber-600" size={18} />
                    <span>Add from Inventory Stock</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStockModalTask(null);
                      setSelectedStockProductId('');
                    }}
                    className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">Job Item</span>
                    <h4 className="font-extrabold text-stone-800 text-sm">{stockModalTask.title}</h4>
                  </div>

                  {products.length > 0 && (
                    <div>
                      <label className="block text-xs font-extrabold text-stone-700 uppercase tracking-wider mb-1">
                        Catalog Product to Allocate From
                      </label>
                      <select
                        value={currentProd?.id || ''}
                        onChange={(e) => {
                          const pId = e.target.value;
                          setSelectedStockProductId(pId);
                          const chosen = products.find(p => p.id === pId);
                          const avail = chosen?.stockQuantity || 0;
                          setStockModalQuantity(Math.max(1, Math.min(avail > 0 ? avail : 1, leftToMake)));
                        }}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-normal text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.stockQuantity || 0} in stock)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 bg-stone-50 p-3 rounded-xl border border-stone-200/80">
                    <div>
                      <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">Available Stock</span>
                      <span className={`text-sm font-black ${availableInStock > 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {availableInStock} units
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">Needed to Fulfill</span>
                      <span className="text-sm font-black text-amber-800">
                        {leftToMake} units
                      </span>
                    </div>
                  </div>

                  {availableInStock === 0 ? (
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                      <span>No finished stock units currently available in catalog for this item. Update product stock in Products tab or select another catalog product above.</span>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-extrabold text-stone-700 uppercase tracking-wider mb-1">
                        Amount to Use from Stock
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={availableInStock}
                        value={stockModalQuantity}
                        onChange={(e) => setStockModalQuantity(Math.max(1, Math.min(availableInStock, parseInt(e.target.value) || 1)))}
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                      <span className="text-[10px] text-stone-400 block mt-1">
                        Allocating will deduct {stockModalQuantity} unit(s) from catalog stock and fulfill them on this job.
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => {
                      setStockModalTask(null);
                      setSelectedStockProductId('');
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={availableInStock === 0 || stockModalQuantity <= 0}
                    onClick={() => {
                      if (onApplyStockToJobTask && selectedJob && currentProd) {
                        onApplyStockToJobTask(selectedJob.id, stockModalTask.id, stockModalQuantity, currentProd.id);
                        setStockModalTask(null);
                        setSelectedStockProductId('');
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white shadow-xs cursor-pointer transition flex items-center gap-1.5"
                  >
                    <Check size={14} /> Allocate {stockModalQuantity} from Stock
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ================= MODAL 3: REMOVE / RETURN STOCK ================= */}
      <AnimatePresence>
        {removeStockModalTask && selectedJob && (() => {
          const currentStockAllocated = removeStockModalTask.stockCount || 0;

          return (
            <div className="fixed inset-0 bg-stone-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl max-w-md w-full border border-stone-200 shadow-xl overflow-hidden p-6 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2 text-stone-900 font-extrabold text-base">
                    <RotateCcw className="text-amber-600" size={18} />
                    <span>Return Stock to Inventory</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemoveStockModalTask(null)}
                    className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">Job Item</span>
                    <h4 className="font-extrabold text-stone-800 text-sm">{removeStockModalTask.title}</h4>
                  </div>

                  <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/60 text-xs text-stone-700 space-y-1">
                    <div className="font-bold text-amber-900 flex items-center justify-between">
                      <span>Currently allocated from stock:</span>
                      <span className="bg-amber-100 px-2 py-0.5 rounded text-amber-950 font-black">{currentStockAllocated} units</span>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      Returning stock will un-assign these units from this job and add them back into your available catalog stock.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-stone-700 uppercase tracking-wider mb-1">
                      Units to Return to Stock
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={currentStockAllocated}
                      value={removeStockQuantity}
                      onChange={(e) => setRemoveStockQuantity(Math.max(1, Math.min(currentStockAllocated, parseInt(e.target.value) || 1)))}
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setRemoveStockModalTask(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={removeStockQuantity <= 0}
                    onClick={() => {
                      if (onRemoveStockFromJobTask && selectedJob) {
                        onRemoveStockFromJobTask(selectedJob.id, removeStockModalTask.id, removeStockQuantity);
                        setRemoveStockModalTask(null);
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white shadow-xs cursor-pointer transition flex items-center gap-1.5"
                  >
                    <RotateCcw size={14} /> Return {removeStockQuantity} to Stock
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ================= MODAL 4: DELETE JOB CONFIRMATION ================= */}
      <AnimatePresence>
        {deletingJobId && (
          <div className="fixed inset-0 bg-stone-950/50 backdrop-blur-xs z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full border border-stone-200 shadow-2xl p-6 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-1">
                <Trash2 size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-stone-900 text-base">Delete Job?</h3>
                <p className="text-xs text-stone-500 leading-relaxed font-normal">
                  Are you sure you want to delete <strong className="text-stone-800">{jobs.find(j => j.id === deletingJobId)?.jobNumber || 'this job'}</strong>? This action will permanently remove the production job and cannot be undone.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingJobId(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteJob && deletingJobId) {
                      onDeleteJob(deletingJobId);
                      if (selectedJobId === deletingJobId) {
                        setSelectedJobId(null);
                      }
                    }
                    setDeletingJobId(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <Trash2 size={13} /> Delete Job
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Advanced Custom Item Modal */}
      <AdvancedCustomItemModal
        isOpen={isAdvancedCustomItemOpen}
        onClose={() => setIsAdvancedCustomItemOpen(false)}
        materials={materials}
        reusableStages={reusableStages}
        initialData={{
          name: jobCustomTitle,
          description: jobCustomSpecs,
          quantity: jobCustomQty,
          unitCost: typeof jobCustomCost === 'number' ? jobCustomCost : parseFloat(String(jobCustomCost).replace(',', '.')) || 0
        }}
        onAddCustomItem={(item: CustomItemResult) => {
          const qtyNum = item.quantity;

          if (isCreatingJob) {
            const newItem: JobCreationItem = {
              productId: 'custom_' + Date.now(),
              title: item.name,
              quantity: qtyNum,
              customizationSummary: item.description || 'Custom Specification',
              selectedCustomizations: {}
            };
            if (editingJobItemIndex !== null) {
              setNewJobItems(prev => prev.map((it, idx) => idx === editingJobItemIndex ? newItem : it));
              setEditingJobItemIndex(null);
            } else {
              setNewJobItems(prev => [...prev, newItem]);
            }
          } else if (selectedJob && onUpdateJob) {
            const newTask: JobTaskItem = {
              id: 'task_' + Date.now(),
              productId: 'custom_' + Date.now(),
              title: item.name,
              quantity: qtyNum,
              status: 'Pending',
              customizationSummary: item.description || 'Custom Specification',
              selectedCustomizations: {},
              trackingMode: item.trackingMode || 'whole',
              stages: (item.stages || []).map(s => ({ id: s.id, name: s.name, completedQty: 0, totalQty: qtyNum })),
              inputs: item.inputs || []
            };
            onUpdateJob({
              ...selectedJob,
              items: [...selectedJob.items, newTask]
            });
          }

          setIsCatalogModalOpen(false);
          setIsAdvancedCustomItemOpen(false);
        }}
      />
    </div>
  );
}
