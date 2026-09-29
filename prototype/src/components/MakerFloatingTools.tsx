import React, { useState, useEffect } from 'react';
import { FileText, Clock } from 'lucide-react';
import Scratchpad from './Scratchpad';
import TimeTracker from './TimeTracker';
import { Product, Job, Quote, Customer, Material, TimeLogEntry } from '../types';

interface MakerFloatingToolsProps {
  jobs: Job[];
  materials?: Material[];
  products?: Product[];
  quotes?: Quote[];
  customers?: Customer[];
  onUpdateMaterial?: (material: Material) => void;
  onUpdateProduct?: (product: Product) => void;
  onUpdateJob?: (job: Job) => void;
  onUpdateQuote?: (quote: Quote) => void;
  onUpdateCustomer?: (customer: Customer) => void;
  onTimeLogged?: (entry: TimeLogEntry) => void;
}

const TIMER_STORAGE_KEY = 'makerflow_timer_state';
const SCRATCHPAD_STORAGE_KEY = 'makerflow_scratchpad_content';

export default function MakerFloatingTools({ 
  jobs, 
  materials = [],
  products = [],
  quotes = [],
  customers = [],
  onUpdateMaterial,
  onUpdateProduct,
  onUpdateJob,
  onUpdateQuote,
  onUpdateCustomer,
  onTimeLogged 
}: MakerFloatingToolsProps) {
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);

  // Active status ticker for dock icons
  const [hasScratchpadText, setHasScratchpadText] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    // Check if scratchpad has text
    const checkScratchpad = () => {
      const text = localStorage.getItem(SCRATCHPAD_STORAGE_KEY) || '';
      setHasScratchpadText(text.trim().length > 0);
    };

    // Check timer state
    const checkTimer = () => {
      const saved = localStorage.getItem(TIMER_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setTimerSeconds(parsed.seconds || 0);
          setIsTimerRunning(Boolean(parsed.isRunning));
        } catch (e) {
          // Ignore
        }
      }
    };

    checkScratchpad();
    checkTimer();

    const interval = setInterval(() => {
      checkScratchpad();
      checkTimer();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatSecs = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${h}h ${m}m`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <>
      {/* Floating Tool Panels */}
      <Scratchpad 
        isOpen={scratchpadOpen} 
        onClose={() => setScratchpadOpen(false)} 
        jobs={jobs}
        customers={customers}
        materials={materials}
        onUpdateJob={onUpdateJob}
        onUpdateCustomer={onUpdateCustomer}
        onUpdateMaterial={onUpdateMaterial}
      />
      
      <TimeTracker 
        isOpen={timerOpen} 
        onClose={() => setTimerOpen(false)} 
        jobs={jobs}
        onTimeLogged={onTimeLogged}
      />

      {/* Floating Launcher Dock - Stacked Icon-Only Buttons Bottom Right */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 print:hidden">
        {/* Time Tracker Button */}
        <div className="relative flex items-center group">
          {/* Tooltip on Hover */}
          <div className="absolute right-full mr-3 px-3 py-1.5 bg-stone-900/90 backdrop-blur-xs text-amber-100 text-xs font-bold rounded-xl shadow-lg border border-stone-700/80 whitespace-nowrap opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-150 pointer-events-none flex items-center gap-1.5">
            <span>Time Tracker</span>
            {timerSeconds > 0 && (
              <span className="font-mono text-[11px] text-amber-400 font-black bg-stone-800 px-1.5 py-0.5 rounded-md">
                {formatSecs(timerSeconds)}
              </span>
            )}
          </div>

          <button
            onClick={() => {
              setTimerOpen(!timerOpen);
              if (!timerOpen) setScratchpadOpen(false);
            }}
            className={`relative p-3.5 rounded-2xl shadow-xl transition-all duration-200 cursor-pointer select-none border ${
              timerOpen
                ? 'bg-[#4a1f06] text-amber-200 border-[#92400e] ring-2 ring-amber-500/60 scale-105 shadow-[#4a1f06]/50'
                : isTimerRunning
                  ? 'bg-[#622a08] hover:bg-[#4d2005] text-white border-emerald-400/80 ring-2 ring-emerald-500/40 shadow-[#4a1f06]/40'
                  : 'bg-[#622a08] hover:bg-[#4d2005] text-amber-50 border-[#8a3f12] hover:scale-105 shadow-[#4a1f06]/40'
            }`}
            aria-label="Time Tracker"
          >
            <Clock size={20} className={isTimerRunning ? 'animate-pulse text-emerald-300' : ''} />
            
            {/* Active timer badge */}
            {isTimerRunning && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#4a1f06] animate-ping" />
            )}
            {isTimerRunning && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#4a1f06]" />
            )}
          </button>
        </div>

        {/* Scratchpad Button */}
        <div className="relative flex items-center group">
          {/* Tooltip on Hover */}
          <div className="absolute right-full mr-3 px-3 py-1.5 bg-stone-900/90 backdrop-blur-xs text-amber-100 text-xs font-bold rounded-xl shadow-lg border border-stone-700/80 whitespace-nowrap opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-150 pointer-events-none flex items-center gap-1.5">
            <span>Scratchpad</span>
            {hasScratchpadText && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded-md">
                Saved Notes
              </span>
            )}
          </div>

          <button
            onClick={() => {
              setScratchpadOpen(!scratchpadOpen);
              if (!scratchpadOpen) setTimerOpen(false);
            }}
            className={`relative p-3.5 rounded-2xl shadow-xl transition-all duration-200 cursor-pointer select-none border ${
              scratchpadOpen
                ? 'bg-[#4a1f06] text-amber-200 border-[#92400e] ring-2 ring-amber-500/60 scale-105 shadow-[#4a1f06]/50'
                : 'bg-[#622a08] hover:bg-[#4d2005] text-amber-50 border-[#8a3f12] hover:scale-105 shadow-[#4a1f06]/40'
            }`}
            aria-label="Scratchpad"
          >
            <FileText size={20} />

            {/* Has notes badge */}
            {hasScratchpadText && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-[#4a1f06]" />
            )}
          </button>
        </div>
      </div>
    </>
  );
}
