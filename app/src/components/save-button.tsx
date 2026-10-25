import { Button } from "@/components/ui/button";

/**
 * The one Save for a settings form (docs/ux-review-2026-10-25.md, T5): it says "Save" on the screen, full width on a
 * phone, and a screen reader hears what is saved ("Save hourly rate"), so several on one page stay distinct.
 */
export function SaveButton({ what, pending, id }: { what: string; pending: boolean; id?: string }) {
  return (
    <Button id={id} type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
      {pending ? (
        "Saving…"
      ) : (
        <>
          Save<span className="sr-only"> {what}</span>
        </>
      )}
    </Button>
  );
}
