import { Card, CardContent } from "@/components/ui/card";
import { formatMoney, formatPercent } from "@/lib/money";
import { quantityText } from "@/lib/quotes/units";
import { formatDay } from "@/lib/quotes/dates";
import type { QuoteSnapshot, SnapshotParty } from "@/lib/quotes/snapshot";
import { vatView } from "@/lib/quotes/vat-view";
import { itemName, optionsText } from "@/lib/quotes/line-text";

/**
 * A sent quote on screen, drawn from its frozen snapshot only (the same data the PDF uses), so
 * it never changes when the business, the customer or the products do. Read-only.
 */
export function QuoteDocumentView({ snapshot: s }: { snapshot: QuoteSnapshot }) {
  const money = (cents: number) => formatMoney(cents, s.currencyCode, s.numberStyle);
  const day = (iso: string) => formatDay(iso, s.dateLocale);
  const lineTotal = s.lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const exclusive = s.vat.registered && s.vat.entry === "exclusive";
  const vat = vatView(s);
  const rate = s.vat.rateBp !== null ? ` (${formatPercent(s.vat.rateBp, s.numberStyle)})` : "";

  return (
    <Card data-testid="quote-document">
      <CardContent className="space-y-5">
        <div className="space-y-1">
          <p className="text-lg font-semibold">{s.business.name}</p>
          <PartyLines party={s.business} />
          {s.business.vatNumber && (
            <p className="text-sm text-muted-foreground">
              {s.vat.registrationNumberLabel}: {s.business.vatNumber}
            </p>
          )}
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
          <dt className="text-muted-foreground">Quote</dt>
          <dd className="font-medium">{s.version > 1 ? `${s.number} · version ${s.version}` : s.number}</dd>
          <dt className="text-muted-foreground">Date</dt>
          <dd>{day(s.issueDate)}</dd>
          <dt className="text-muted-foreground">Valid until</dt>
          <dd>{day(s.validUntil)}</dd>
          {s.neededBy && (
            <>
              <dt className="text-muted-foreground">Needed by</dt>
              <dd>{day(s.neededBy)}</dd>
            </>
          )}
        </dl>

        {s.customer && (
          <div className="space-y-0.5">
            <p className="text-xs font-medium uppercase text-muted-foreground">Prepared for</p>
            <p className="text-base font-medium">{s.customer.name}</p>
            <PartyLines party={s.customer} />
            {s.customer.vatNumber && (
              <p className="text-sm text-muted-foreground">
                {s.vat.registrationNumberLabel}: {s.customer.vatNumber}
              </p>
            )}
          </div>
        )}

        {s.deliveryAddress && (
          <div className="space-y-0.5">
            <p className="text-xs font-medium uppercase text-muted-foreground">Deliver to</p>
            <p className="whitespace-pre-line text-base">{s.deliveryAddress}</p>
          </div>
        )}

        {(s.title || s.description) && (
          <div className="space-y-1">
            {s.title && <h3 className="text-base font-semibold">{s.title}</h3>}
            {s.description && <p className="whitespace-pre-line text-base">{s.description}</p>}
          </div>
        )}

        <ul className="divide-y divide-border border-y border-border" aria-label="Items">
          {s.lines.map((l, i) => (
            <li key={i} className="space-y-0.5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-base font-medium">{itemName(l)}</p>
                <p className="shrink-0 text-base font-medium">{money(l.lineTotalCents)}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {quantityText(l.quantityMilli, l.unit, s.numberStyle)} × {money(l.unitPriceCents)}
                {l.discount &&
                  ` · discount ${
                    l.discount.kind === "percent"
                      ? formatPercent(l.discount.basisPoints, s.numberStyle)
                      : money(l.discount.cents)
                  }`}
              </p>
              {l.description && <p className="whitespace-pre-line text-sm text-muted-foreground">{l.description}</p>}
              {optionsText(l.options, money) && <p className="text-sm text-muted-foreground">{optionsText(l.options, money)}</p>}
              {vat.lineLabel(l) && <p className="text-sm text-muted-foreground">{vat.lineLabel(l)}</p>}
            </li>
          ))}
        </ul>

        <dl className="space-y-1">
          {(s.quoteDiscount || s.vat.registered) && (
            <Row
              label={
                exclusive
                  ? `Subtotal (excluding ${s.vat.taxName})`
                  : s.vat.registered
                    ? `Subtotal (including ${s.vat.taxName})`
                    : "Subtotal"
              }
              value={money(lineTotal)}
            />
          )}
          {s.quoteDiscount && (
            <Row
              label={
                s.quoteDiscount.kind === "percent"
                  ? `Discount (${formatPercent(s.quoteDiscount.basisPoints, s.numberStyle)})`
                  : "Discount"
              }
              value={`-${money(s.quoteDiscount.amountCents)}`}
            />
          )}
          {exclusive && s.quoteDiscount && (
            <Row label={`Total excluding ${s.vat.taxName}`} value={money(s.totals.netCents)} />
          )}
          {exclusive && <Row label={`${s.vat.taxName}${vat.showRate ? rate : ""}`} value={money(s.totals.vatCents)} />}
          <Row
            label={s.vat.registered ? `Total including ${s.vat.taxName}` : "Total"}
            value={money(s.totals.grossCents)}
            strong
          />
          {s.vat.registered && !exclusive && (
            <Row label={`Includes ${s.vat.taxName}${vat.showRate ? rate : ""}`} value={money(s.totals.vatCents)} muted />
          )}
          {vat.breakdown.map((b) => (
            <Row
              key={b.label}
              label={`${b.label}${b.vatCents > 0 ? `, ${s.vat.taxName} ${money(b.vatCents)}` : `, no ${s.vat.taxName}`}`}
              value={money(b.amountCents)}
              muted
            />
          ))}
        </dl>

        {s.deposit && (
          <dl className="space-y-1 text-base" data-testid="deposit-lines">
            <Row
              label={`${s.deposit.label}${s.deposit.percentText ? ` (${s.deposit.percentText})` : ""}`}
              value={money(s.deposit.depositCents)}
            />
            {s.deposit.balanceCents > 0 && (
              <Row label={`${s.deposit.balanceLabel}, ${s.deposit.dueText}`} value={money(s.deposit.balanceCents)} />
            )}
          </dl>
        )}

        {s.notes && (
          <div className="space-y-0.5">
            <p className="text-xs font-medium uppercase text-muted-foreground">Notes</p>
            <p className="whitespace-pre-line text-base">{s.notes}</p>
          </div>
        )}

        {((s.bankDetails && s.bankDetails.length > 0) || s.paymentInstructions) && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase text-muted-foreground">How to pay</p>
            {s.bankDetails && s.bankDetails.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-base">
                {s.bankDetails.map((line, i) => (
                  <div key={i} className="contents">
                    <dt className="text-muted-foreground">{line.label}</dt>
                    <dd className="font-medium">{line.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {s.paymentInstructions && <p className="whitespace-pre-line text-base">{s.paymentInstructions}</p>}
          </div>
        )}

        {s.signOff && (
          <div>
            <p className="text-base">{s.signOff}</p>
            <p className="text-base font-semibold">{s.business.name}</p>
          </div>
        )}

        {s.policies && s.policies.length > 0 && (
          <section className="space-y-3 border-t border-border pt-4" aria-label="Terms and policies">
            <h3 className="text-base font-semibold">Terms and policies</h3>
            {s.policies.map((p, i) => (
              <div key={i} className="space-y-0.5">
                <h4 className="text-base font-medium">{p.title}</h4>
                <p className="whitespace-pre-line text-base">{p.body}</p>
              </div>
            ))}
          </section>
        )}

        {s.terms && (
          <div className="space-y-0.5 text-sm text-muted-foreground">
            <p className="text-xs font-medium uppercase">{s.policies && s.policies.length > 0 ? "Other terms" : "Terms"}</p>
            <p className="whitespace-pre-line">{s.terms}</p>
          </div>
        )}

        <div className="space-y-0.5 text-sm text-muted-foreground">
          {s.wording.inclusiveStatement && <p>{s.wording.inclusiveStatement}</p>}
          <p>{s.wording.notATaxInvoice}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PartyLines({ party }: { party: SnapshotParty }) {
  return (
    <div className="text-sm text-muted-foreground">
      {party.contactPerson && <p>{party.contactPerson}</p>}
      {party.addressLines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
      {party.phone && <p>{party.phone}</p>}
      {party.email && <p>{party.email}</p>}
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 ${strong ? "border-t border-border pt-2 text-lg font-semibold" : ""} ${muted ? "text-sm text-muted-foreground" : ""}`}
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
