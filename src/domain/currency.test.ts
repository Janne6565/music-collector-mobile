import { describe, expect, it } from "bun:test";
import { currencyChipLabel, formatMoney, spendByCurrency } from "@/domain/currency";
import type { Copy } from "@janne6565/rekordo-shared";

function copy(pricePaidCents: number | null, currency: string): Copy {
  return { id: "c", pricePaidCents, currency } as unknown as Copy;
}

describe("spendByCurrency", () => {
  it("keeps each currency to itself rather than adding them up", () => {
    const spend = spendByCurrency([copy(2000, "EUR"), copy(1500, "USD"), copy(1000, "EUR")]);

    expect(spend).toEqual([
      { currency: "EUR", totalCents: 3000, copies: 2 },
      { currency: "USD", totalCents: 1500, copies: 1 },
    ]);
  });

  it("leads with the currency the collection is mostly in", () => {
    const spend = spendByCurrency([copy(100, "EUR"), copy(9000, "USD")]);

    expect(spend.map((entry) => entry.currency)).toEqual(["USD", "EUR"]);
  });

  /**
   * A copy with no price is not a purchase in any currency. Counting it would drag the
   * average towards zero for a record somebody simply never entered a price for.
   */
  it("ignores copies with no price at all", () => {
    const spend = spendByCurrency([copy(null, "EUR"), copy(2000, "EUR")]);

    expect(spend).toEqual([{ currency: "EUR", totalCents: 2000, copies: 1 }]);
  });

  it("treats an empty currency as the default rather than its own bucket", () => {
    const spend = spendByCurrency([copy(1000, ""), copy(1000, "EUR")]);

    expect(spend).toEqual([{ currency: "EUR", totalCents: 2000, copies: 2 }]);
  });

  it("says nothing about an empty collection", () => {
    expect(spendByCurrency([])).toEqual([]);
  });
});

describe("the currency label", () => {
  it("leads with the code, because the symbol alone is ambiguous", () => {
    expect(currencyChipLabel("USD")).toBe("USD $");
  });

  it("does not repeat itself where the code is the symbol", () => {
    expect(currencyChipLabel("CHF")).toBe("CHF");
  });

  it("formats in whole units, as the tiles do", () => {
    expect(formatMoney(312_000, "EUR", "en")).toBe("€3,120");
  });
});
