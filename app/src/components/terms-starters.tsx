"use client";

import { Button } from "@/components/ui/button";
import { addStarter, TERMS_STARTERS } from "@/lib/quotes/terms-starters";

/** "Add a line:" chips under a terms box. They only add text the person can then change. */
export function TermsStarters({ terms, onChange }: { terms: string; onChange: (terms: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Add a starting line, then change it to suit you:</p>
      <div className="flex flex-wrap gap-2">
        {TERMS_STARTERS.map((s) => (
          <Button
            key={s.key}
            type="button"
            variant="outline"
            disabled={terms.includes(s.text)}
            onClick={() => onChange(addStarter(terms, s.text))}
          >
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
