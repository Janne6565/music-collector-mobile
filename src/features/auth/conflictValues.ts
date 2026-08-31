import type { Condition, Format, ReviewableField } from "@janne6565/rekordo-shared";
import { CONDITION_LABELS, FORMAT_LABELS } from "@janne6565/rekordo-shared";

/**
 * One disputed value, as a line somebody can compare against the other one.
 *
 * Mirrors `conflictValues.ts` in rekordo-frontend. Both sides of a comparison go through
 * the same function, so a formatted value is never being weighed against a raw one — and
 * the two apps have to render the same value identically, because a rating that reads as
 * stars on the phone and as `4` in the browser is two different questions.
 */
export function conflictValueText(
  field: ReviewableField,
  value: unknown,
  currency: string,
  language: string,
  empty: string,
): string {
  if (value === null || value === undefined || value === "") return empty;
  switch (field) {
    case "rating":
      return "★".repeat(Number(value)).padEnd(5, "☆");
    case "condition":
    case "sleeveCondition":
      return CONDITION_LABELS[value as Condition] ?? String(value);
    case "desiredFormat":
      return FORMAT_LABELS[value as Format] ?? String(value);
    case "pricePaidCents":
      return new Intl.NumberFormat(language, { style: "currency", currency }).format(
        Number(value) / 100,
      );
    case "purchasedOn":
      return new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(
        new Date(String(value)),
      );
    default:
      return String(value);
  }
}

/** A date on one of the two sides, short enough to sit beside a value. */
export function conflictDate(at: number, language: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(at);
}
