import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import "@/i18n/config";
import { formatRelativeTime } from "@/domain/relativeTime";

const NOW = Date.UTC(2026, 7, 25, 12, 0, 0);
const ago = (ms: number) => formatRelativeTime(NOW - ms, "en", NOW);

describe("formatRelativeTime", () => {
  it("takes the largest unit the gap fills at least once", () => {
    // Rounded, as it always was: 90 seconds is nearer two minutes than one.
    expect(ago(61_000)).toBe("1 minute ago");
    expect(ago(90_000)).toBe("2 minutes ago");
    expect(ago(45 * 60_000)).toBe("45 minutes ago");
    expect(ago(3 * 3_600_000)).toBe("3 hours ago");
    expect(ago(5 * 86_400_000)).toBe("5 days ago");
    expect(ago(2 * 2_592_000_000)).toBe("2 months ago");
    expect(ago(3 * 31_536_000_000)).toBe("3 years ago");
  });

  it("says just now for anything under a minute", () => {
    expect(ago(0)).toBe("just now");
    expect(ago(59_000)).toBe("just now");
  });

  it("does not report a clock-skewed future as a countdown", () => {
    expect(formatRelativeTime(NOW + 3_000, "en", NOW)).toBe("just now");
  });

  it("speaks whichever language it is handed", () => {
    expect(formatRelativeTime(NOW - 5 * 60_000, "de", NOW)).toBe("vor 5 Minuten");
  });
});

/**
 * The reason this module exists. Hermes ships no `Intl.RelativeTimeFormat`, so `new`ing it
 * throws mid-render on a device while working perfectly in every test and simulator run —
 * which is exactly how it reached TestFlight and crashed 1.0.0 (3) on the You tab.
 */
describe("Hermes", () => {
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return sources(path);
      return /\.tsx?$/.test(entry) ? [path] : [];
    });
  }

  const unsupported = ["Intl.RelativeTimeFormat", "Intl.PluralRules", "Intl.ListFormat"];

  for (const api of unsupported) {
    it(`has no ${api}, so nothing may reference it`, () => {
      const offenders = sources("src").filter((path) => readFileSync(path, "utf8").includes(`new ${api}`));
      expect(offenders).toEqual([]);
    });
  }
});
