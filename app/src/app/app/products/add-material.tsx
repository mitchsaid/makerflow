"use client";

import { useState } from "react";
import { AddButton } from "@/components/add-button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { NumberStyle } from "@/lib/money";
import { createMaterialHere } from "./materials/actions";
import { EMPTY_MATERIAL, MaterialForm } from "./materials/material-form";
import type { MaterialOption } from "./costs-section";

/** What the add-a-material dialog needs to know, and who to tell. Absent where materials can't be added from here. */
export type AddMaterialConfig = {
  /** The standard VAT rate when the business is VAT-registered, else null. */
  vatRateBp: number | null;
  taxName: string;
  currencyCode: string;
  numberStyle: NumberStyle;
  currencySymbol: string;
  /** Called with the material once it is saved, so the list on this screen has it. */
  onAdded: (material: MaterialOption) => void;
};

/**
 * "Add a new material" next to the choice of material on a cost line: the same material form as the Materials page, in a
 * dialog, so the maker never leaves the product (what they typed stays). The new material is chosen for the line.
 * `id` is the button's id; `onChosen` is called with the saved material.
 */
export function AddMaterial({
  config,
  id,
  onChosen,
  variant = "outline",
}: {
  config: AddMaterialConfig;
  id: string;
  onChosen: (material: MaterialOption) => void;
  variant?: "outline" | "default";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AddButton id={id} variant={variant} onClick={() => setOpen(true)}>
        Add a new material
      </AddButton>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="h-dvh gap-0 overflow-y-auto" finalFocus={() => document.getElementById(id) ?? true}>
          {/* Mounted only while open, so every opening starts with an empty form. */}
          {open && (
            <>
              <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
                <SheetTitle className="text-lg">Add a material</SheetTitle>
                <SheetDescription className="text-base">What you buy and what you paid.</SheetDescription>
              </SheetHeader>
              <div className="px-4 py-4">
                <MaterialForm
                  mode="add"
                  action={createMaterialHere}
                  initial={EMPTY_MATERIAL}
                  vatRateBp={config.vatRateBp}
                  taxName={config.taxName}
                  currencyCode={config.currencyCode}
                  numberStyle={config.numberStyle}
                  currencySymbol={config.currencySymbol}
                  idPrefix="new-material-"
                  onSaved={(material) => {
                    config.onAdded(material);
                    onChosen(material);
                    setOpen(false);
                  }}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
