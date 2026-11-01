"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          // On a phone (under 768 px): a sheet from its edge, as before. On a bigger screen: a dialog in the middle of
          // the page, whichever edge the sheet was written for (the work happens where the maker is looking, not at
          // the edge of the screen).
          "fixed z-50 flex flex-col max-md:pb-[env(safe-area-inset-bottom)] bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0",
          "max-md:data-[side=bottom]:inset-x-0 max-md:data-[side=bottom]:bottom-0 max-md:data-[side=bottom]:h-auto max-md:data-[side=bottom]:border-t max-md:data-[side=bottom]:data-ending-style:translate-y-[2.5rem] max-md:data-[side=bottom]:data-starting-style:translate-y-[2.5rem]",
          "max-md:data-[side=left]:inset-y-0 max-md:data-[side=left]:left-0 max-md:data-[side=left]:h-full max-md:data-[side=left]:w-full max-md:data-[side=left]:border-r max-md:data-[side=left]:data-ending-style:translate-x-[-2.5rem] max-md:data-[side=left]:data-starting-style:translate-x-[-2.5rem] max-md:data-[side=left]:sm:max-w-lg",
          "max-md:data-[side=right]:inset-y-0 max-md:data-[side=right]:right-0 max-md:data-[side=right]:h-full max-md:data-[side=right]:w-full max-md:data-[side=right]:border-l max-md:data-[side=right]:data-ending-style:translate-x-[2.5rem] max-md:data-[side=right]:data-starting-style:translate-x-[2.5rem] max-md:data-[side=right]:sm:max-w-lg",
          "max-md:data-[side=top]:inset-x-0 max-md:data-[side=top]:top-0 max-md:data-[side=top]:h-auto max-md:data-[side=top]:border-b max-md:data-[side=top]:data-ending-style:translate-y-[-2.5rem] max-md:data-[side=top]:data-starting-style:translate-y-[-2.5rem]",
          "md:top-1/2 md:left-1/2 md:h-auto md:max-h-[85dvh] md:w-[calc(100%-3rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:overflow-y-auto md:rounded-2xl md:border md:border-border md:data-ending-style:scale-95 md:data-starting-style:scale-95 md:data-[side=bottom]:max-w-lg md:data-[side=top]:max-w-lg md:data-[side=left]:max-w-2xl md:data-[side=right]:max-w-2xl",
          className
        )}
        {...props}
      >
        {children}
        {/* Sticky and laid out first (order-first), so it stays in the top corner while the sheet scrolls and sits above a
            sticky header; last in the page order, so opening a sheet still focuses its first field and Tab reaches it last. */}
        {showCloseButton && (
          <div className="pointer-events-none order-first sticky top-0 z-20 h-0 w-full shrink-0">
            <SheetPrimitive.Close
              data-slot="sheet-close"
              render={
                <Button
                  variant="outline"
                  className="pointer-events-auto absolute top-2 right-2 shadow-sm"
                  size="icon"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          </div>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
