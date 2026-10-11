import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { CalendarIcon, ClockIcon } from "lucide-react"
import { cn } from "cn"

// Date and time fields in Safari on an iPhone keep a width of their own and stick out of their card unless the native
// look is turned off (the picker still opens when the field is pressed). Turning it off also takes away the browser's
// own calendar icon on a phone, so the icon is drawn here, the same everywhere; the browser's own indicator is
// stretched over the whole field and made invisible, so pressing anywhere on it opens the picker on a computer too.
const NATIVE_TEMPORAL = new Set(["date", "time", "datetime-local", "month", "week"]);

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const temporal = !!type && NATIVE_TEMPORAL.has(type)
  const input = (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        temporal &&
          "block max-w-full appearance-none pr-10 text-left [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left",
        "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
  if (!temporal) return input
  const Icon = type === "time" ? ClockIcon : CalendarIcon
  return (
    <div className="relative w-full">
      {input}
      <Icon aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export { Input }
