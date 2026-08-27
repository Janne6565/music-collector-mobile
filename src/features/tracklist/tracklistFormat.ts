import type { TrackMedium } from "@/api/tracklist";

/**
 * The arithmetic behind the tracklist section (design 26). Pure, so the component is only
 * ever markup and the awkward cases — a box set, a disc nobody timed — are testable.
 */

/**
 * How many rows are drawn before the rest is offered as one line (26c).
 *
 * Thirty, not "the first medium". Ending at the disc break is the more meaningful cut, but
 * a single-disc 40-track CD would then never cap at all, and it is exactly the release that
 * needs to. An inner scroll area was the other option and is worse: it traps the wheel and
 * hides the fact that the sheet has a bottom.
 */
export const TRACK_ROW_CAP = 30;

/** "6:59". Empty for an unknown length — the column stays blank rather than showing a dash. */
export function trackDuration(lengthMs: number | null): string {
  if (lengthMs === null || lengthMs < 0) return "";
  const total = Math.round(lengthMs / 1000);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * The sum of what is known, or null when nothing is.
 *
 * Deliberately not an estimate: durations go missing one track at a time, and a total that
 * silently under-reports by the length of two songs is worse than no total.
 */
export function knownDurationMs(media: readonly TrackMedium[]): number | null {
  let total = 0;
  let any = false;
  for (const medium of media) {
    for (const track of medium.tracks) {
      if (track.lengthMs !== null) {
        total += track.lengthMs;
        any = true;
      }
    }
  }
  return any ? total : null;
}

/** Split for the header, which reads "81 min" under an hour and "9 h 12 min" over it. */
export function durationParts(totalMs: number): { hours: number; minutes: number } {
  const minutes = Math.round(totalMs / 60000);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

export function trackTotal(media: readonly TrackMedium[]): number {
  return media.reduce((count, medium) => count + medium.tracks.length, 0);
}

/**
 * The first {@link TRACK_ROW_CAP} rows, and how many were left behind.
 *
 * Cut across the whole release rather than per medium, so a box set stops after thirty rows
 * wherever that falls, and the disc headings of the media that survive come with them.
 */
export function capMedia(
  media: readonly TrackMedium[],
  limit: number = TRACK_ROW_CAP,
): { shown: TrackMedium[]; hidden: number } {
  const total = trackTotal(media);
  if (total <= limit) return { shown: [...media], hidden: 0 };

  const shown: TrackMedium[] = [];
  let budget = limit;
  for (const medium of media) {
    if (budget <= 0) break;
    shown.push({ ...medium, tracks: medium.tracks.slice(0, budget) });
    budget -= medium.tracks.length;
  }
  return { shown, hidden: total - limit };
}
