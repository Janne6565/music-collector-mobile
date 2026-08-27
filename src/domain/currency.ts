import type { Copy } from "@janne6565/rekordo-shared";

/**
 * Currency, which the app has always had and never let anybody choose.
 *
 * `currency` is a field on every `Copy` and always has been — a synced, mergeable one — but
 * every path that created a copy hardcoded "EUR". Turn 20 puts a picker in Settings, and
 * the thing that picker has to be honest about is its own scope: it seeds *new* copies and
 * cannot touch a saved one, because a saved copy's currency is a fact about that purchase.
 *
 * Mirrored verbatim in rekordo-frontend/src/domain/currency.ts; keep the two in
 * step, for the same reason csv.ts is mirrored — this is rendering and per-app plumbing
 * rather than something the two clients have to agree on to converge.
 */

/** The five the picker offers (20h). Deliberately short: this is a shelf, not a bureau. */
export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY"] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = "EUR";

export const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF",
  JPY: "¥",
};

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCIES as readonly string[]).includes(value);
}

/**
 * "EUR €" — the code first, because the code is the unambiguous half.
 *
 * CHF has no distinct symbol and $ belongs to a dozen currencies, so a control showing only
 * the symbol would be guessing on the reader's behalf.
 */
export function currencyChipLabel(code: string): string {
  const symbol = CURRENCY_SYMBOLS[code];
  return symbol === undefined || symbol === code ? code : `${code} ${symbol}`;
}

export interface CurrencySpend {
  readonly currency: string;
  readonly totalCents: number;
  readonly copies: number;
}

/**
 * What was spent, split by the currency it was actually spent in (20d).
 *
 * Nothing here converts. Converting would need a rate, a rate needs a date and a source,
 * and a total that silently depends on today's exchange rate is a worse answer than two
 * totals side by side. Copies with no price are counted nowhere: a record with no price
 * paid is not a purchase in any currency.
 */
export function spendByCurrency(copies: readonly Copy[]): CurrencySpend[] {
  const totals = new Map<string, { totalCents: number; copies: number }>();
  for (const copy of copies) {
    if (copy.pricePaidCents === null) continue;
    const code = copy.currency === "" ? DEFAULT_CURRENCY : copy.currency;
    const entry = totals.get(code) ?? { totalCents: 0, copies: 0 };
    entry.totalCents += copy.pricePaidCents;
    entry.copies += 1;
    totals.set(code, entry);
  }
  return [...totals.entries()]
    .map(([currency, entry]) => ({ currency, ...entry }))
    .sort((a, b) => b.totalCents - a.totalCents || a.currency.localeCompare(b.currency));
}

/** Whole units, matching the deck: "€3,120" — the cents are noise at tile size. */
export function formatMoney(cents: number, currency: string, language: string): string {
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
