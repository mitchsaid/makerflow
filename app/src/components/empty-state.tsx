"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Nothing here yet: a title, one line that says what goes here or how to get it, and at most one action. A filter or
 * a search that hides everything is a different message ("Nothing matches", with a way to clear it) from a business
 * that has nothing at all, so lists show this component for the second case and a short line for the first.
 */
export function EmptyState({ title, line, children }: { title: string; line?: string; children?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <p className="text-base font-medium">{title}</p>
        {line && <p className="text-muted-foreground">{line}</p>}
        {children && <div className="flex flex-col gap-3 sm:flex-row">{children}</div>}
      </CardContent>
    </Card>
  );
}

/** A filter or search hid everything on a list that is not empty: say so in one line, with the way back. */
export function NoMatches({ message, clearLabel, onClear }: { message: string; clearLabel?: string; onClear?: () => void }) {
  return (
    <div className="space-y-3" data-testid="no-matches">
      <p className="text-muted-foreground">{message}</p>
      {onClear && clearLabel && (
        <Button type="button" variant="outline" onClick={onClear}>
          {clearLabel}
        </Button>
      )}
    </div>
  );
}
