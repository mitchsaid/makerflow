"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export type SectionLink<K extends string> = { key: K; label: string; href: string };

const COLUMNS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

/**
 * Which view is open, kept in the page so that choosing another answers at once (the data for every view is already
 * on the page). The address still changes, so back works and a view can be bookmarked or shared.
 */
export function useSectionState<K extends string>(items: readonly SectionLink<K>[], initial: K): [K, (key: K) => void] {
  const [active, setActive] = useState<K>(initial);
  // The server sent a different view (a link to another section from elsewhere on the page): follow it.
  const [seen, setSeen] = useState<K>(initial);
  if (seen !== initial) {
    setSeen(initial);
    setActive(initial);
  }

  // The back and forward buttons: read the view from the address.
  useEffect(() => {
    function onPop() {
      const here = window.location.pathname + window.location.search;
      setActive(items.find((i) => i.href === here)?.key ?? items[0].key);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [items]);

  function select(key: K) {
    setActive(key);
    const href = items.find((i) => i.key === key)?.href;
    if (href) window.history.pushState(null, "", href);
  }
  return [active, select];
}

/**
 * A switch between a few views of one area (Products, Services; a customer's Quotes, Jobs, Invoices, Details). Each
 * view is its own address, so back works and a view can be bookmarked; the active one is marked. With `onSelect` the
 * switch changes the view in the page without waiting for the server; without it, each is an ordinary link.
 */
export function SectionSwitch<K extends string>({
  label,
  items,
  active,
  onSelect,
}: {
  label: string;
  items: readonly SectionLink<K>[];
  active: K;
  onSelect?: (key: K) => void;
}) {
  return (
    <nav aria-label={label} className={`grid ${COLUMNS[items.length] ?? "grid-cols-3"} gap-1 rounded-lg bg-muted p-1`}>
      {items.map(({ key, label: text, href }) => (
        <Link
          key={key}
          href={href}
          onClick={
            onSelect
              ? (e) => {
                  // A new tab, or a modified click, still opens the address the usual way.
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  onSelect(key);
                }
              : undefined
          }
          aria-current={key === active ? "page" : undefined}
          className={`flex min-h-11 items-center justify-center rounded-md px-1 text-base font-medium ${
            key === active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {text}
        </Link>
      ))}
    </nav>
  );
}

/** A switch with its views: every view is on the page, only the open one shown, so choosing is instant. */
export function SectionTabs<K extends string>({
  label,
  items,
  initial,
  panels,
}: {
  label: string;
  items: readonly SectionLink<K>[];
  initial: K;
  panels: Record<K, ReactNode>;
}) {
  const [active, select] = useSectionState(items, initial);
  return (
    <>
      <SectionSwitch label={label} items={items} active={active} onSelect={select} />
      {items.map(({ key }) => (
        <div key={key} hidden={key !== active} className="space-y-6">
          {panels[key]}
        </div>
      ))}
    </>
  );
}
