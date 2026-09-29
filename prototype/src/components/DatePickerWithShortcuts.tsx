import React from 'react';
import { Calendar } from 'lucide-react';

export interface DateShortcut {
  label: string;
  getDate: (baseDate?: string) => string;
}

interface DatePickerWithShortcutsProps {
  id?: string;
  label?: string;
  value: string; // Format: YYYY-MM-DD
  onChange: (value: string) => void;
  baseDateForShortcuts?: string; // Optional reference date (e.g. quote issued date)
  type?: 'expiry' | 'due' | 'issue' | 'custom';
  customShortcuts?: DateShortcut[];
  min?: string;
  max?: string;
  required?: boolean;
  className?: string;
  helperText?: string;
}

export const formatDateToISO = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addDays = (days: number, baseStr?: string): string => {
  let base: Date;
  if (baseStr && !isNaN(Date.parse(baseStr))) {
    const [y, m, d] = baseStr.split('-').map(Number);
    base = new Date(y, m - 1, d);
  } else {
    base = new Date();
  }
  base.setDate(base.getDate() + days);
  return formatDateToISO(base);
};

export const getEndOfCurrentOrNextMonth = (baseStr?: string): string => {
  let base: Date;
  if (baseStr && !isNaN(Date.parse(baseStr))) {
    const [y, m, d] = baseStr.split('-').map(Number);
    base = new Date(y, m - 1, d);
  } else {
    base = new Date();
  }
  // End of current month
  const endOfThisMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  const endOfThisMonthStr = formatDateToISO(endOfThisMonth);
  if (baseStr && baseStr >= endOfThisMonthStr) {
    // If today/base is already end of month, go to end of next month
    const endOfNextMonth = new Date(base.getFullYear(), base.getMonth() + 2, 0);
    return formatDateToISO(endOfNextMonth);
  }
  return endOfThisMonthStr;
};

export const DEFAULT_EXPIRY_SHORTCUTS: DateShortcut[] = [
  { label: '+7 Days', getDate: (base) => addDays(7, base) },
  { label: '+14 Days', getDate: (base) => addDays(14, base) },
  { label: '+30 Days', getDate: (base) => addDays(30, base) },
  { label: '+60 Days', getDate: (base) => addDays(60, base) },
  { label: 'End of Month', getDate: (base) => getEndOfCurrentOrNextMonth(base) },
  { label: '+90 Days', getDate: (base) => addDays(90, base) },
];

export const DEFAULT_DUE_SHORTCUTS: DateShortcut[] = [
  { label: 'COD (Today)', getDate: (base) => addDays(0, base) },
  { label: '+7 Days', getDate: (base) => addDays(7, base) },
  { label: '+14 Days', getDate: (base) => addDays(14, base) },
  { label: '+30 Days', getDate: (base) => addDays(30, base) },
  { label: '+60 Days', getDate: (base) => addDays(60, base) },
  { label: 'End of Month', getDate: (base) => getEndOfCurrentOrNextMonth(base) },
];

export const DEFAULT_ISSUE_SHORTCUTS: DateShortcut[] = [];

export const DatePickerWithShortcuts: React.FC<DatePickerWithShortcutsProps> = ({
  id,
  label,
  value,
  onChange,
  baseDateForShortcuts,
  type = 'expiry',
  customShortcuts,
  min,
  max,
  required = false,
  className = '',
  helperText
}) => {
  let shortcuts: DateShortcut[] = [];
  if (customShortcuts) {
    shortcuts = customShortcuts;
  } else if (type === 'expiry') {
    shortcuts = DEFAULT_EXPIRY_SHORTCUTS;
  } else if (type === 'due') {
    shortcuts = DEFAULT_DUE_SHORTCUTS;
  } else if (type === 'issue') {
    shortcuts = DEFAULT_ISSUE_SHORTCUTS;
  }

  const effectiveValue = value || formatDateToISO(new Date());

  return (
    <div className={`space-y-1.5 ${className}`} id={id ? `${id}-container` : undefined}>
      {label && (
        <div className="flex items-center justify-between">
          <label 
            htmlFor={id} 
            className="block text-xs font-bold text-stone-600 uppercase tracking-wider"
          >
            {label} {required && <span className="text-amber-700">*</span>}
          </label>
        </div>
      )}

      {/* Date Picker Input */}
      <div className="relative flex items-center">
        <input
          type="date"
          id={id}
          required={required}
          value={effectiveValue}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs sm:text-sm font-medium transition cursor-pointer"
        />
      </div>

      {/* Shortcut Selection Chips */}
      {shortcuts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {shortcuts.map((sc, idx) => {
            const targetDateStr = sc.getDate(baseDateForShortcuts);
            const isSelected = effectiveValue === targetDateStr;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onChange(targetDateStr)}
                className={`text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-lg transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-white hover:bg-stone-100 text-stone-600 hover:text-stone-900 border-stone-200'
                }`}
                title={`Set date to ${targetDateStr}`}
              >
                {sc.label}
              </button>
            );
          })}
        </div>
      )}

      {helperText && (
        <p className="text-[10px] text-stone-400 font-normal">{helperText}</p>
      )}
    </div>
  );
};
