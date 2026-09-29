/**
 * South African date formatting utilities
 * Standard South African formatting conventions: DD/MM/YYYY or DD MMM YYYY
 */

export function formatSADate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    // If it's an ISO format string like "YYYY-MM-DD"
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const [y, m, d] = parts.map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          const dateObj = new Date(y, m - 1, d);
          return dateObj.toLocaleDateString('en-ZA', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }); // e.g. "24 Aug 2026"
        }
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-ZA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
  } catch {
    // fallback to original string
  }
  return String(dateStr);
}

export function formatNumericSADate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const [y, m, d] = parts.map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          const day = String(d).padStart(2, '0');
          const month = String(m).padStart(2, '0');
          return `${day}/${month}/${y}`;
        }
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {}
  return String(dateStr);
}
