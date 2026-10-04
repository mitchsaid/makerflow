import * as React from "react"
import { cn } from "cn"

/**
 * An input with fixed text beside it, such as a currency symbol before a price. The group
 * carries the border and the focus ring; the input inside it is bare.
 */
function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "flex h-11 w-full min-w-0 items-center rounded-lg border border-input bg-card transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-3 has-[[aria-invalid=true]]:ring-destructive/20 dark:bg-input/30 dark:has-[[aria-invalid=true]]:border-destructive/50 dark:has-[[aria-invalid=true]]:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

/** The fixed text. Decorative: the field's label says what to enter. */
function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="input-group-text"
      aria-hidden="true"
      className={cn("pointer-events-none shrink-0 pl-3 text-base text-muted-foreground select-none", className)}
      {...props}
    />
  )
}

export { InputGroup, InputGroupText }
