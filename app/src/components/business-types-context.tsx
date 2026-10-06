"use client";

import { createContext, useContext } from "react";
import type { BusinessType } from "@/lib/business-types";

/**
 * What the business makes or sells, available to any screen that orders its examples and
 * suggestions (units, terms starters, policy examples) without passing it down through every form.
 * Null: never asked (or no answer), which orders everything as it always was.
 */
const BusinessTypesContext = createContext<readonly BusinessType[] | null>(null);

export function BusinessTypesProvider({ types, children }: { types: readonly BusinessType[] | null; children: React.ReactNode }) {
  return <BusinessTypesContext.Provider value={types}>{children}</BusinessTypesContext.Provider>;
}

export function useBusinessTypes(): readonly BusinessType[] | null {
  return useContext(BusinessTypesContext);
}
