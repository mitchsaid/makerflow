import { ComingSoonSection } from "@/components/coming-soon";
import { Card, CardContent } from "@/components/ui/card";
import { DESIGNS, DEFAULT_DESIGN, type DesignKey } from "@/lib/quotes/designs";

/**
 * How the quote is dressed. Today there is one design; the rest of what a maker will want
 * (more designs, their logo, their colours) is shown where it will live, inactive.
 */
export function DesignSection({ design = DEFAULT_DESIGN, sent = false }: { design?: DesignKey; sent?: boolean }) {
  const current = DESIGNS.find((d) => d.key === design) ?? DESIGNS[0];
  return (
    <section className="space-y-3" aria-labelledby="design-heading">
      <h2 id="design-heading" className="text-base font-semibold">
        Design
      </h2>
      <Card>
        <CardContent className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-base font-medium" data-testid="current-design">
              {current.name}
            </p>
            <p className="text-sm text-muted-foreground">{current.description}</p>
          </div>
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {sent ? "Used for this version" : "Selected"}
          </span>
        </CardContent>
      </Card>
      <ComingSoonSection
        title="More designs"
        description="Choose a different look for your quotes and see it here before you send."
      />
      <ComingSoonSection
        title="Your logo and colours"
        description="Put your logo and your brand colour on every quote."
      />
    </section>
  );
}
