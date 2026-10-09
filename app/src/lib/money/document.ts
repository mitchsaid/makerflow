import {
  allocateProportionally,
  assertSafeInteger,
  BASIS_POINTS_100_PERCENT,
  MAX_CENTS,
  mulDivRound,
  QUANTITY_SCALE,
  type BasisPoints,
  type Cents,
  type QuantityMilli,
} from "./primitives";

/**
 * Totals for a quote (and later an invoice). The order of operations is fixed and documented
 * in docs/plans/quotes.md and docs/locales/za/vat-and-documents.md:
 *
 *  1. line amount = quantity x unit price, rounded to the cent (halves up), plus the extras for a fixed
 *     count (a gift box: 1 x R30). Choices and extras for each item are already in the unit price
 *     (docs/plans/product-extras.md);
 *  2. line discount (percentage or fixed) comes off that line;
 *  3. the quote-level discount is worked out on the sum of the lines and shared across
 *     the lines in proportion, with exact cents (so VAT is charged on discounted amounts);
 *  4. VAT is worked out ONCE PER VAT STATUS on the total of its lines (SARS's own mixed
 *     invoice example does "VAT @ 15% on R16 000"), rounded to the cent (halves up).
 *     In inclusive mode the VAT is amount x rate / (100% + rate); in exclusive mode it is
 *     amount x rate.
 *
 * Amounts on a line are in the business's price-entry mode (including or excluding VAT).
 * Non-negative inputs only; credit notes get their own handling when they are built.
 */

export type VatStatus = "standard" | "zero" | "exempt";
export type PriceEntry = "inclusive" | "exclusive";

export type Discount =
  | { kind: "percent"; basisPoints: BasisPoints }
  | { kind: "fixed"; cents: Cents };

export type VatSettings =
  | { registered: false }
  | { registered: true; entry: PriceEntry; standardRateBp: BasisPoints };

export type LineInput = {
  id: string;
  quantityMilli: QuantityMilli;
  unitPriceCents: Cents;
  /** Added to the line, whatever the quantity: extras for a fixed count. Zero when absent. */
  extraCents?: Cents;
  discount?: Discount;
  vatStatus: VatStatus;
};

export type LineResult = {
  id: string;
  vatStatus: VatStatus;
  /** quantity x unit price, before any discount */
  amountBeforeDiscountCents: Cents;
  lineDiscountCents: Cents;
  /** this line's share of the quote-level discount */
  quoteDiscountShareCents: Cents;
  /** what the line is worth after both discounts, in the price-entry mode */
  amountCents: Cents;
};

export type VatGroup = {
  vatStatus: VatStatus;
  rateBp: BasisPoints;
  /** sum of the lines' amounts, in the price-entry mode */
  amountCents: Cents;
  netCents: Cents;
  vatCents: Cents;
  grossCents: Cents;
};

export type DocumentTotals = {
  lines: LineResult[];
  groups: VatGroup[];
  /** sum of the lines' amounts after all discounts, in the price-entry mode */
  subtotalCents: Cents;
  lineDiscountsCents: Cents;
  quoteDiscountCents: Cents;
  netCents: Cents;
  vatCents: Cents;
  grossCents: Cents;
};

export type DepositTerms =
  | { kind: "percent"; basisPoints: BasisPoints }
  | { kind: "fixed"; cents: Cents };

function discountOn(amount: Cents, discount: Discount | undefined): Cents {
  if (!discount) return 0;
  if (discount.kind === "percent") {
    assertSafeInteger(discount.basisPoints, "discount percentage");
    if (discount.basisPoints < 0 || discount.basisPoints > BASIS_POINTS_100_PERCENT) {
      throw new RangeError("a percentage discount must be between 0% and 100%");
    }
    return mulDivRound(amount, discount.basisPoints, BASIS_POINTS_100_PERCENT);
  }
  assertSafeInteger(discount.cents, "discount amount");
  if (discount.cents < 0) throw new RangeError("a discount can't be negative");
  return Math.min(discount.cents, amount);
}

function groupFor(status: VatStatus, amount: Cents, vat: VatSettings): VatGroup {
  if (!vat.registered || status !== "standard") {
    return {
      vatStatus: status,
      rateBp: 0,
      amountCents: amount,
      netCents: amount,
      vatCents: 0,
      grossCents: amount,
    };
  }
  const rate = vat.standardRateBp;
  if (vat.entry === "inclusive") {
    const vatCents = mulDivRound(amount, rate, BASIS_POINTS_100_PERCENT + rate);
    return {
      vatStatus: status,
      rateBp: rate,
      amountCents: amount,
      netCents: amount - vatCents,
      vatCents,
      grossCents: amount,
    };
  }
  const vatCents = mulDivRound(amount, rate, BASIS_POINTS_100_PERCENT);
  return {
    vatStatus: status,
    rateBp: rate,
    amountCents: amount,
    netCents: amount,
    vatCents,
    grossCents: amount + vatCents,
  };
}

const STATUS_ORDER: VatStatus[] = ["standard", "zero", "exempt"];

export function calculateDocument(input: {
  lines: readonly LineInput[];
  quoteDiscount?: Discount;
  vat: VatSettings;
}): DocumentTotals {
  const { vat } = input;
  if (vat.registered) {
    assertSafeInteger(vat.standardRateBp, "VAT rate");
    if (vat.standardRateBp < 0 || vat.standardRateBp > BASIS_POINTS_100_PERCENT) {
      throw new RangeError("the VAT rate must be between 0% and 100%");
    }
  }

  // 1 and 2: line amounts and line discounts
  const stage = input.lines.map((line) => {
    assertSafeInteger(line.quantityMilli, "quantity");
    assertSafeInteger(line.unitPriceCents, "unit price");
    if (line.quantityMilli < 0 || line.unitPriceCents < 0) {
      throw new RangeError("quantities and prices can't be negative");
    }
    const extra = line.extraCents ?? 0;
    assertSafeInteger(extra, "extras for a fixed count");
    if (extra < 0) throw new RangeError("quantities and prices can't be negative");
    const amountBeforeDiscountCents = mulDivRound(line.quantityMilli, line.unitPriceCents, QUANTITY_SCALE) + extra;
    if (amountBeforeDiscountCents > MAX_CENTS) throw new RangeError("a line amount is too large");
    const lineDiscountCents = discountOn(amountBeforeDiscountCents, line.discount);
    return {
      line,
      amountBeforeDiscountCents,
      lineDiscountCents,
      afterLineDiscount: amountBeforeDiscountCents - lineDiscountCents,
    };
  });

  // 3: quote-level discount, shared in proportion with exact cents
  const sumAfterLine = stage.reduce((acc, s) => acc + s.afterLineDiscount, 0);
  const quoteDiscountCents = discountOn(sumAfterLine, input.quoteDiscount);
  const shares = allocateProportionally(
    quoteDiscountCents,
    stage.map((s) => s.afterLineDiscount),
  );

  const lines: LineResult[] = stage.map((s, i) => ({
    id: s.line.id,
    vatStatus: s.line.vatStatus,
    amountBeforeDiscountCents: s.amountBeforeDiscountCents,
    lineDiscountCents: s.lineDiscountCents,
    quoteDiscountShareCents: shares[i],
    amountCents: s.afterLineDiscount - shares[i],
  }));

  // 4: VAT once per status
  const groups: VatGroup[] = [];
  for (const status of STATUS_ORDER) {
    const members = lines.filter((l) => l.vatStatus === status);
    if (members.length === 0) continue;
    const amount = members.reduce((acc, l) => acc + l.amountCents, 0);
    groups.push(groupFor(status, amount, vat));
  }

  return {
    lines,
    groups,
    subtotalCents: lines.reduce((acc, l) => acc + l.amountCents, 0),
    lineDiscountsCents: stage.reduce((acc, s) => acc + s.lineDiscountCents, 0),
    quoteDiscountCents,
    netCents: groups.reduce((acc, g) => acc + g.netCents, 0),
    vatCents: groups.reduce((acc, g) => acc + g.vatCents, 0),
    grossCents: groups.reduce((acc, g) => acc + g.grossCents, 0),
  };
}

/**
 * The deposit on a quote and the balance. The deposit is rounded to the cent and never more
 * than the total; the balance is the total minus the deposit, so the two always add up.
 */
export function calculateDeposit(
  grossCents: Cents,
  terms: DepositTerms,
): { depositCents: Cents; balanceCents: Cents } {
  assertSafeInteger(grossCents, "total");
  if (grossCents < 0) throw new RangeError("the total can't be negative");
  let depositCents: Cents;
  if (terms.kind === "percent") {
    assertSafeInteger(terms.basisPoints, "deposit percentage");
    if (terms.basisPoints < 0 || terms.basisPoints > BASIS_POINTS_100_PERCENT) {
      throw new RangeError("a deposit percentage must be between 0% and 100%");
    }
    depositCents = mulDivRound(grossCents, terms.basisPoints, BASIS_POINTS_100_PERCENT);
  } else {
    assertSafeInteger(terms.cents, "deposit amount");
    if (terms.cents < 0) throw new RangeError("a deposit can't be negative");
    depositCents = Math.min(terms.cents, grossCents);
  }
  return { depositCents, balanceCents: grossCents - depositCents };
}
