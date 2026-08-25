import i18n from "i18next";

/**
 * "4 minutes ago", in whichever language the app is running in.
 *
 * Deliberately *not* `Intl.RelativeTimeFormat`, which is what the web half of this uses:
 * Hermes ships only Collator, DateTimeFormat, NumberFormat and getCanonicalLocales, so the
 * constructor is `undefined` on a device and `new`ing it throws — during render, from three
 * screens, with nothing above them to catch it. That crashed 1.0.0 (3) on the You tab as
 * soon as a first sync had written a timestamp for this line to draw.
 *
 * The polyfill route needs five formatjs packages with locale data (RelativeTimeFormat
 * leans on PluralRules and Intl.Locale, neither of which Hermes has either), so the wording
 * lives in the translations instead — i18next already does plural rules, including the
 * three German has.
 *
 * The unit is chosen by size rather than fixed, because "7200 minutes ago" is technically
 * correct and useless.
 */
const UNITS: readonly [RelativeUnit, number][] = [
  ["minute", 60_000],
  ["hour", 3_600_000],
  ["day", 86_400_000],
  ["month", 2_592_000_000],
  ["year", 31_536_000_000],
];

type RelativeUnit = "minute" | "hour" | "day" | "month" | "year";

export function formatRelativeTime(at: number, language: string, now = Date.now()): string {
  const elapsed = now - at;

  // Anything under a minute, and anything the device's clock puts in the future, is "just
  // now". A record created three seconds from now is skew, not a fact worth reporting.
  if (elapsed < 60_000) return i18n.t("time.now", { lng: language });

  // Walk from the largest unit down and take the first one the gap fills at least once.
  for (let index = UNITS.length - 1; index >= 0; index -= 1) {
    const [unit, ms] = UNITS[index];
    if (elapsed >= ms || index === 0) {
      return i18n.t(`time.${unit}`, { count: Math.round(elapsed / ms), lng: language });
    }
  }
  return i18n.t("time.now", { lng: language });
}
