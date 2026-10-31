"use client";

import Link from "@/components/app-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "cn";

/** One choice in an {@link ActionSheet}: a link that goes somewhere, or an action that runs. */
export type SheetAction = {
  label: string;
  /** One short line under the label. */
  hint?: string;
  href?: string;
  onSelect?: () => void;
  icon?: React.ReactNode;
  /** Something that cannot be undone. */
  danger?: boolean;
};

const ROW = "h-auto w-full justify-start gap-3 whitespace-normal py-3 text-left";

/**
 * A titled list of big choices in a sheet (docs/plans/ux-pass-3.md): "Create new" on Home, and the ⋯ menu on a card. A
 * sheet, not a floating menu: on a phone it comes up from the bottom and every choice is a full-size tap target; on a
 * bigger screen the Sheet is a dialog in the middle, as every other sheet in the app.
 */
export function ActionSheet({
  open,
  onOpenChange,
  title,
  description,
  actions,
  finalFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  actions: SheetAction[];
  finalFocus?: () => HTMLElement | null | true;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-y-auto" finalFocus={finalFocus}>
        <SheetHeader className="border-b border-border pr-14">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          {description && <SheetDescription className="text-base">{description}</SheetDescription>}
        </SheetHeader>
        <ul className="space-y-2 px-4 py-4" aria-label={title}>
          {actions.map((action) => {
            const body = (
              <>
                {action.icon && <span aria-hidden="true" className="shrink-0">{action.icon}</span>}
                <span className="flex min-w-0 flex-col items-start">
                  <span className="text-base font-medium">{action.label}</span>
                  {action.hint && <span className="text-sm font-normal text-muted-foreground">{action.hint}</span>}
                </span>
              </>
            );
            return (
              <li key={action.label}>
                {action.href ? (
                  <Link
                    href={action.href}
                    className={cn(buttonVariants({ variant: "outline" }), ROW, action.danger && "text-destructive")}
                    onClick={() => onOpenChange(false)}
                  >
                    {body}
                  </Link>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(ROW, action.danger && "text-destructive")}
                    onClick={() => {
                      onOpenChange(false);
                      action.onSelect?.();
                    }}
                  >
                    {body}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
