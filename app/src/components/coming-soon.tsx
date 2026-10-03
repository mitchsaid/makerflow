import { Card, CardContent } from "@/components/ui/card";

/**
 * A part of a feature that is not built yet, shown where it will live (docs/product-brief.md,
 * principle 9: thin slices keep the real interaction and show the rest as visible but inactive
 * placeholders). It has no inputs and does nothing.
 */
export function ComingSoonSection({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border border-dashed border-border bg-transparent ring-0" data-testid="coming-soon">
      <CardContent className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-medium">{title}</h3>
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            Coming soon
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
