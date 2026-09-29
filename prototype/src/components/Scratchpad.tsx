import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Copy, Trash2, Check, Clock, X, Maximize2, Minimize2, 
  Save, Package, Wrench, User, Tag, Search, Sparkles, CheckCircle2, ArrowRight, Layers
} from 'lucide-react';
import { Product, Job, Quote, Customer, Material } from '../types';

interface ScratchpadProps {
  isOpen: boolean;
  onClose: () => void;
  jobs?: Job[];
  customers?: Customer[];
  materials?: Material[];
  onUpdateJob?: (job: Job) => void;
  onUpdateCustomer?: (customer: Customer) => void;
  onUpdateMaterial?: (material: Material) => void;
}

const STORAGE_KEY = 'makerflow_scratchpad_content';

export default function Scratchpad({ 
  isOpen, 
  onClose,
  jobs = [],
  customers = [],
  materials = [],
  onUpdateJob,
  onUpdateCustomer,
  onUpdateMaterial
}: ScratchpadProps) {
  const [content, setContent] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || '';
  });
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Text selection / Highlight state
  const [selectedHighlight, setSelectedHighlight] = useState<string>('');
  const [activeAllocationType, setActiveAllocationType] = useState<'job' | 'customer' | 'material' | null>(null);
  const [allocationSearch, setAllocationSearch] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [allocatedTextToRemove, setAllocatedTextToRemove] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, content);
    const now = new Date();
    setLastSaved(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, [content]);

  // Toast timer
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!content.trim()) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setContent('');
    setSelectedHighlight('');
    setConfirmClear(false);
  };

  const handleInsertTimestamp = () => {
    const now = new Date();
    const stamp = `\n--- [${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] ---\n`;
    setContent(prev => (prev ? prev + stamp : stamp.trimStart()));
  };

  // Monitor text selection inside textarea
  const handleTextareaSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    
    if (start !== undefined && end !== undefined && start !== end) {
      const selectedText = target.value.substring(start, end).trim();
      if (selectedText.length > 0) {
        setSelectedHighlight(selectedText);
      } else {
        setSelectedHighlight('');
      }
    }
  };

  // Format allocation note entry
  const createAllocatedNoteStamp = (text: string) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `[Note from Scratchpad - ${dateStr} ${timeStr}]\n"${text}"`;
  };

  // Remove note string from content helper
  const removeAllocatedNoteFromScratchpad = (textToRemove: string) => {
    if (!textToRemove) return;
    setContent(prev => {
      const idx = prev.indexOf(textToRemove);
      if (idx !== -1) {
        const updated = prev.slice(0, idx) + prev.slice(idx + textToRemove.length);
        return updated.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
      }
      return prev;
    });
  };

  // Allocation Handlers
  const handleAllocateToJob = (job: Job) => {
    if (!selectedHighlight || !onUpdateJob) return;
    const noteEntry = createAllocatedNoteStamp(selectedHighlight);
    const existingNotes = job.notes || '';
    const updatedNotes = existingNotes ? `${existingNotes}\n\n${noteEntry}` : noteEntry;

    onUpdateJob({
      ...job,
      notes: updatedNotes
    });

    setAllocatedTextToRemove(selectedHighlight);
    setToastMessage(`Allocated note to Job #${job.jobNumber} (${job.clientName})`);

    setActiveAllocationType(null);
    setSelectedHighlight('');
    setAllocationSearch('');
  };

  const handleAllocateToCustomer = (customer: Customer) => {
    if (!selectedHighlight || !onUpdateCustomer) return;
    const noteEntry = createAllocatedNoteStamp(selectedHighlight);
    const existingNotes = customer.notes || '';
    const updatedNotes = existingNotes ? `${existingNotes}\n\n${noteEntry}` : noteEntry;

    onUpdateCustomer({
      ...customer,
      notes: updatedNotes
    });

    setAllocatedTextToRemove(selectedHighlight);
    setToastMessage(`Allocated note to Customer: ${customer.name}`);

    setActiveAllocationType(null);
    setSelectedHighlight('');
    setAllocationSearch('');
  };

  const handleAllocateToMaterial = (material: Material) => {
    if (!selectedHighlight || !onUpdateMaterial) return;
    const noteEntry = createAllocatedNoteStamp(selectedHighlight);
    const existingNotes = material.notes || '';
    const updatedNotes = existingNotes ? `${existingNotes}\n\n${noteEntry}` : noteEntry;

    onUpdateMaterial({
      ...material,
      notes: updatedNotes
    });

    setAllocatedTextToRemove(selectedHighlight);
    setToastMessage(`Allocated note to Material: ${material.name}`);

    setActiveAllocationType(null);
    setSelectedHighlight('');
    setAllocationSearch('');
  };

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;

  return (
    <div className={`fixed z-50 transition-all duration-200 flex flex-col ${
      isMaximized 
        ? 'inset-3 sm:inset-6 md:inset-10 bg-white rounded-2xl shadow-2xl border border-stone-300' 
        : 'bottom-20 left-3 right-3 sm:left-auto sm:right-6 w-auto sm:w-[420px] max-w-full h-[520px] bg-white rounded-2xl shadow-2xl border border-stone-300/90'
    }`}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="absolute top-14 left-4 right-4 z-60 bg-emerald-900 text-emerald-100 px-3.5 py-2.5 rounded-xl shadow-xl border border-emerald-700/80 text-xs font-bold flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2 overflow-hidden">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {allocatedTextToRemove && (
              <button
                onClick={() => {
                  removeAllocatedNoteFromScratchpad(allocatedTextToRemove);
                  setAllocatedTextToRemove(null);
                  setToastMessage('Removed note from Scratchpad');
                }}
                className="px-2 py-1 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded text-[10px] uppercase tracking-wider transition cursor-pointer shadow-xs"
              >
                Remove from Scratchpad
              </button>
            )}
            <button onClick={() => setToastMessage(null)} className="text-emerald-300 hover:text-white cursor-pointer">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 bg-[#421a08] text-amber-50 rounded-t-2xl flex items-center justify-between gap-2 select-none border-b border-[#5e260c]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg">
            <FileText size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-amber-100 leading-tight">Scratchpad</h3>
            <span className="text-[10px] text-amber-200/70 flex items-center gap-1 font-mono">
              <Save size={10} className="text-emerald-400" />
              {lastSaved ? `Auto-saved at ${lastSaved}` : 'Auto-saved'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-amber-200/80">
          <button
            onClick={handleInsertTimestamp}
            className="px-2 py-1 text-[10px] font-bold bg-[#58250f] hover:bg-[#6e2f13] text-amber-100 rounded-md transition flex items-center gap-1 cursor-pointer"
            title="Insert Date & Time Stamp"
          >
            <Clock size={11} />
            <span>+ Stamp</span>
          </button>

          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 hover:bg-[#58250f] hover:text-white rounded-md transition cursor-pointer text-amber-200"
            title={isMaximized ? 'Restore size' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-amber-200 hover:bg-rose-900/60 hover:text-rose-100 rounded-md transition cursor-pointer"
            title="Close notepad"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Main Textarea Area */}
      <div className="flex-1 p-3 bg-amber-50/20 relative flex flex-col overflow-hidden">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onSelect={handleTextareaSelection}
          onKeyUp={handleTextareaSelection}
          onMouseUp={handleTextareaSelection}
          placeholder="Jot down quick client notes, measurement formulas, material calculations, supplier phone numbers, or ideas here...\n\n💡 TIP: Highlight any text in this note to assign or allocate it to a Job, Customer, or Material!"
          className="w-full flex-1 p-3 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none font-sans leading-relaxed shadow-inner"
          autoFocus
        />

        {/* Highlight Allocation Context Menu Bar */}
        {selectedHighlight && !activeAllocationType && (
          <div className="mt-2.5 p-2.5 bg-[#451a03] text-amber-50 rounded-xl border border-[#7c2d12] shadow-xl flex flex-col gap-2 animate-fadeIn shrink-0">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <Tag size={13} className="text-amber-400 shrink-0 animate-bounce" />
                <span className="font-extrabold text-amber-200 text-xs shrink-0">Allocate Highlighted Note:</span>
                <span className="truncate opacity-90 italic font-mono text-[11px] bg-[#321201] px-2 py-0.5 rounded border border-[#602308]">
                  "{selectedHighlight}"
                </span>
              </div>
              <button
                onClick={() => setSelectedHighlight('')}
                className="text-amber-400 hover:text-white p-0.5 rounded cursor-pointer"
                title="Dismiss menu"
              >
                <X size={13} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold">
              <button
                onClick={() => { setActiveAllocationType('job'); setAllocationSearch(''); }}
                className="bg-[#602308] hover:bg-[#7c2d12] text-amber-100 py-1.5 px-2 rounded-lg border border-[#8a3811] flex items-center justify-center gap-1 cursor-pointer transition shadow-xs hover:scale-102"
              >
                <Wrench size={13} className="text-amber-300" />
                <span>Job</span>
              </button>

              <button
                onClick={() => { setActiveAllocationType('customer'); setAllocationSearch(''); }}
                className="bg-[#602308] hover:bg-[#7c2d12] text-amber-100 py-1.5 px-2 rounded-lg border border-[#8a3811] flex items-center justify-center gap-1 cursor-pointer transition shadow-xs hover:scale-102"
              >
                <User size={13} className="text-amber-300" />
                <span>Customer</span>
              </button>

              <button
                onClick={() => { setActiveAllocationType('material'); setAllocationSearch(''); }}
                className="bg-[#602308] hover:bg-[#7c2d12] text-amber-100 py-1.5 px-2 rounded-lg border border-[#8a3811] flex items-center justify-center gap-1 cursor-pointer transition shadow-xs hover:scale-102"
              >
                <Layers size={13} className="text-amber-300" />
                <span>Material</span>
              </button>
            </div>
          </div>
        )}

        {/* Entity Selection Picker Popup */}
        {activeAllocationType && (
          <div className="absolute inset-2 bg-[#2c1205]/95 backdrop-blur-xs text-amber-50 rounded-xl p-3 z-30 flex flex-col border border-amber-800/80 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-[#5a250b]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg">
                  {activeAllocationType === 'job' && <Wrench size={15} />}
                  {activeAllocationType === 'customer' && <User size={15} />}
                  {activeAllocationType === 'material' && <Layers size={15} />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-100 capitalize">
                    Allocate to {activeAllocationType}
                  </h4>
                  <p className="text-[10px] text-amber-300/80 truncate max-w-[220px]">
                    "{selectedHighlight}"
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveAllocationType(null)}
                className="p-1 text-amber-200/70 hover:text-white rounded-lg hover:bg-[#58250f] cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Search filter input */}
            <div className="mt-2.5 relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-amber-300/60" />
              <input
                type="text"
                value={allocationSearch}
                onChange={(e) => setAllocationSearch(e.target.value)}
                placeholder={`Search ${activeAllocationType === 'material' ? 'materials' : activeAllocationType === 'job' ? 'jobs' : 'customers'}...`}
                className="w-full pl-8 pr-3 py-1.5 bg-[#421a08] border border-[#692c0d] rounded-lg text-xs text-amber-50 placeholder-amber-200/50 focus:outline-none focus:border-amber-500"
                autoFocus
              />
            </div>

            {/* List options */}
            <div className="mt-2 flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[220px]">
              {/* Job list */}
              {activeAllocationType === 'job' && (() => {
                const filtered = jobs.filter(j => 
                  j.jobNumber.toLowerCase().includes(allocationSearch.toLowerCase()) ||
                  j.clientName.toLowerCase().includes(allocationSearch.toLowerCase())
                );
                if (filtered.length === 0) {
                  return <p className="text-xs text-stone-400 p-4 text-center">No matching jobs found.</p>;
                }
                return filtered.map(job => (
                  <button
                    key={job.id}
                    onClick={() => handleAllocateToJob(job)}
                    className="w-full text-left p-2 bg-stone-800/80 hover:bg-amber-900/60 border border-stone-700 hover:border-amber-600 rounded-lg transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-bold text-stone-100 group-hover:text-amber-200 block">
                        #{job.jobNumber} - {job.clientName}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        Status: {job.status} ({job.items.length} items)
                      </span>
                    </div>
                    <ArrowRight size={13} className="text-stone-500 group-hover:text-amber-300" />
                  </button>
                ));
              })()}

              {/* Customer list */}
              {activeAllocationType === 'customer' && (() => {
                const filtered = customers.filter(c => 
                  c.name.toLowerCase().includes(allocationSearch.toLowerCase()) ||
                  c.email.toLowerCase().includes(allocationSearch.toLowerCase())
                );
                if (filtered.length === 0) {
                  return <p className="text-xs text-stone-400 p-4 text-center">No matching customers found.</p>;
                }
                return filtered.map(cust => (
                  <button
                    key={cust.id}
                    onClick={() => handleAllocateToCustomer(cust)}
                    className="w-full text-left p-2 bg-stone-800/80 hover:bg-amber-900/60 border border-stone-700 hover:border-amber-600 rounded-lg transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-bold text-stone-100 group-hover:text-amber-200 block">
                        {cust.name}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {cust.phone || cust.email || 'Customer record'}
                      </span>
                    </div>
                    <ArrowRight size={13} className="text-stone-500 group-hover:text-amber-300" />
                  </button>
                ));
              })()}

              {/* Material list */}
              {activeAllocationType === 'material' && (() => {
                const filtered = materials.filter(m => 
                  m.name.toLowerCase().includes(allocationSearch.toLowerCase()) ||
                  (m.category && m.category.toLowerCase().includes(allocationSearch.toLowerCase()))
                );
                if (filtered.length === 0) {
                  return <p className="text-xs text-stone-400 p-4 text-center">No matching materials found.</p>;
                }
                return filtered.map(mat => (
                  <button
                    key={mat.id}
                    onClick={() => handleAllocateToMaterial(mat)}
                    className="w-full text-left p-2 bg-stone-800/80 hover:bg-amber-900/60 border border-stone-700 hover:border-amber-600 rounded-lg transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-bold text-stone-100 group-hover:text-amber-200 block">
                        {mat.name}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {mat.category || 'Raw Material'} • Stock: {mat.stockQuantity !== undefined ? mat.stockQuantity : mat.bulkQuantity} {mat.unit}
                      </span>
                    </div>
                    <ArrowRight size={13} className="text-stone-500 group-hover:text-amber-300" />
                  </button>
                ));
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls & Stats */}
      <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-200/80 rounded-b-2xl flex items-center justify-between text-xs text-stone-500">
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span>{words} words</span>
          <span>•</span>
          <span>{chars} chars</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={!content.trim()}
            className="px-2.5 py-1 text-xs font-bold text-stone-700 hover:text-stone-900 bg-white border border-stone-200 hover:bg-stone-100 rounded-lg transition disabled:opacity-40 flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            onClick={handleClear}
            disabled={!content.trim()}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition disabled:opacity-40 flex items-center gap-1 cursor-pointer ${
              confirmClear
                ? 'bg-rose-600 text-white'
                : 'text-stone-600 hover:text-rose-700 bg-white border border-stone-200 hover:bg-rose-50'
            }`}
          >
            <Trash2 size={13} />
            <span>{confirmClear ? 'Confirm Clear?' : 'Clear'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
