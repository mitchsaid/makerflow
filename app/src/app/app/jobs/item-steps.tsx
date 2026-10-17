import { ItemProgress } from "./item-progress";
import { quantityText } from "@/lib/quotes/units";
import type { NumberStyle } from "@/lib/money";

/**
 * An item made in steps (a frozen copy of its product's steps, docs/plans/quantity-prices-and-steps.md): each step has its
 * own count of how many have been through it, and the item is made up to the fewest any step has reached.
 */
export function ItemSteps({
  jobId,
  item,
  numberStyle,
}: {
  jobId: string;
  item: {
    id: string;
    name: string;
    quantityMilli: number;
    madeMilli: number;
    unit: string | null;
    steps: { id: string; name: string; doneMilli: number }[];
  };
  numberStyle: NumberStyle;
}) {
  const done = item.madeMilli >= item.quantityMilli;
  return (
    <div className="space-y-2 border-t border-border pt-3" data-testid="item-steps">
      <p className="text-sm font-medium" role="status" data-testid="item-made">
        {done
          ? "All made"
          : `Made ${quantityText(item.madeMilli, null, numberStyle)} of ${quantityText(item.quantityMilli, item.unit, numberStyle)}`}
      </p>
      <ol className="space-y-3" aria-label={`Steps for ${item.name}`}>
        {item.steps.map((step) => (
          <li key={step.id}>
            <ItemProgress
              jobId={jobId}
              itemId={item.id}
              name={item.name}
              quantityMilli={item.quantityMilli}
              madeMilli={step.doneMilli}
              unit={item.unit}
              numberStyle={numberStyle}
              step={{ id: step.id, name: step.name }}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
