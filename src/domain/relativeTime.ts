/**
 * "4 minutes ago", in whichever language the app is running in.
 *
 * Intl does the wording, so nothing here has to know about plural rules or that Polish has
 * three of them. The unit is chosen by size rather than fixed, because "7200 minutes ago"
 * is technically correct and useless.
 */
const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 1000],
  ["minute", 60_000],
  ["hour", 3_600_000],
  ["day", 86_400_000],
  ["month", 2_592_000_000],
  ["year", 31_536_000_000],
];

export function formatRelativeTime(at: number, language: string, now = Date.now()): string {
  const elapsed = now - at;
  const format = new Intl.RelativeTimeFormat(language, { numeric: "auto" });

  // Walk from the largest unit down and take the first one the gap fills at least once.
  for (let index = UNITS.length - 1; index >= 0; index -= 1) {
    const [unit, ms] = UNITS[index];
    if (Math.abs(elapsed) >= ms || index === 0) {
      return format.format(-Math.round(elapsed / ms), unit);
    }
  }
  return format.format(0, "second");
}
