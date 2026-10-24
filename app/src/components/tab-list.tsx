"use client";

import { Button } from "@/components/ui/button";

export type TabItem<K extends string> = {
  key: K;
  label: string;
  /** A small count after the label ("3" steps), shown when there is something in the tab. */
  count?: number;
  /** Visible words under the label, in the warning colour: "2 to fix". Colour alone never marks a problem. */
  note?: string;
};

/**
 * A tab list: the buttons only. The panels are the caller's own (see `TabPanel`). Arrow keys move between the tabs
 * and Home and End jump to the ends, as a tab list should; only the open tab is in the tab order.
 *
 * `layout="scroll"` is a row of pills that scrolls sideways (the theme studio's part tabs); `layout="equal"` is a
 * segmented bar of equal tabs (the product form's), the look of the section switches.
 */
export function TabList<K extends string>({
  label,
  tabs,
  active,
  onChange,
  tabId = (key) => `tab-${key}`,
  panelId = (key) => `panel-${key}`,
  layout = "scroll",
}: {
  label: string;
  tabs: readonly TabItem<K>[];
  active: K;
  onChange: (key: K) => void;
  tabId?: (key: K) => string;
  panelId?: (key: K) => string;
  layout?: "scroll" | "equal";
}) {
  const keys = tabs.map((t) => t.key);
  return (
    <div
      role="tablist"
      aria-label={label}
      className={layout === "equal" ? "grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" : "-mx-4 flex gap-1 overflow-x-auto px-4 py-2"}
      onKeyDown={(event) => {
        const at = keys.indexOf(active);
        const next = event.key === "ArrowRight" ? at + 1 : event.key === "ArrowLeft" ? at - 1 : event.key === "Home" ? 0 : event.key === "End" ? keys.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        const target = keys[(next + keys.length) % keys.length];
        onChange(target);
        document.getElementById(tabId(target))?.focus();
      }}
    >
      {tabs.map((t) => {
        const open = t.key === active;
        return (
          <Button
            key={t.key}
            type="button"
            role="tab"
            id={tabId(t.key)}
            aria-selected={open}
            aria-controls={panelId(t.key)}
            tabIndex={open ? 0 : -1}
            variant={layout === "equal" ? "ghost" : open ? "default" : "ghost"}
            onClick={() => onChange(t.key)}
            className={
              layout === "equal"
                ? `h-auto min-h-11 flex-col gap-0 px-1 py-1 leading-tight ${open ? "bg-card text-foreground shadow-sm hover:bg-card" : "text-muted-foreground hover:text-foreground"}`
                : "shrink-0"
            }
          >
            <span className="flex items-center gap-1.5">
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="rounded-full bg-primary/15 px-1.5 text-xs font-semibold text-foreground">{t.count}</span>
              )}
            </span>
            {t.note && <span className="text-xs font-medium text-destructive">{t.note}</span>}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * One tab's contents. A closed tab is hidden but stays in the page, so what was typed in it is never lost, every field
 * in it is still sent with the form, and a problem in it can be found (the summary opens the tab first).
 */
export function TabPanel({ id, tabId, open, children }: { id: string; tabId: string; open: boolean; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={id} aria-labelledby={tabId} hidden={!open} className="space-y-6">
      {children}
    </div>
  );
}
