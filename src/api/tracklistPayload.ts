/**
 * The tracklist half of the catalogue (design 26).
 *
 * Mirrors rekordo-frontend/src/api/tracklist.ts. Fetched when a detail screen opens and
 * never stored: sync carries no catalogue at all, and the server already holds the cache —
 * it reads MusicBrainz once per release and answers from its own table afterwards.
 *
 * Hand-written like the rest of this client, so every field is treated as optional and a
 * row that cannot be drawn is dropped rather than rendered as `undefined`.
 *
 * The shapes and the mapper live apart from the request on purpose: `@/api/config` reaches
 * into Expo, which the test runner cannot load, and a hand-written mapper is exactly the
 * thing that has to stay testable.
 */

interface TrackPayload {
  number?: string;
  title?: string;
  lengthMs?: number;
  artistName?: string;
}

interface MediumPayload {
  position?: number;
  format?: string;
  title?: string;
  tracks?: TrackPayload[];
}

export interface TracklistPayload {
  trackCount?: number;
  discCount?: number;
  media?: MediumPayload[];
  unavailableReason?: string;
}

export interface Track {
  /** The catalogue's own label: "1" on a CD, "A1" on vinyl, "C1" on the second LP. */
  readonly number: string;
  readonly title: string;
  /** Milliseconds, or null. Null is routine and leaves the cell empty rather than a dash. */
  readonly lengthMs: number | null;
  /** Only set where it differs from the release credit — a compilation, and nothing else. */
  readonly artistName: string | null;
}

export interface TrackMedium {
  readonly position: number;
  readonly format: string | null;
  readonly title: string | null;
  readonly tracks: readonly Track[];
}

export type TracklistAbsence = "HAND_ENTERED" | "DISCOGS" | "NOT_IN_CATALOGUE";

export interface Tracklist {
  readonly trackCount: number | null;
  readonly discCount: number | null;
  readonly media: readonly TrackMedium[];
  readonly absence: TracklistAbsence | null;
}

const ABSENCES: readonly string[] = ["HAND_ENTERED", "DISCOGS", "NOT_IN_CATALOGUE"];

export function toTracklist(payload: TracklistPayload): Tracklist {
  const media = (payload.media ?? [])
    .map((medium) => ({
      position: medium.position ?? 1,
      format: medium.format ?? null,
      title: medium.title ?? null,
      tracks: (medium.tracks ?? [])
        .filter(
          (track): track is TrackPayload & { number: string; title: string } =>
            track.number !== undefined && track.title !== undefined,
        )
        .map((track) => ({
          number: track.number,
          title: track.title,
          // `?? null` and never `|| null`: a track can legitimately be 0 ms in the
          // catalogue, and coercing that to "unknown" would be a different claim.
          lengthMs: track.lengthMs ?? null,
          artistName: track.artistName ?? null,
        })),
    }))
    .filter((medium) => medium.tracks.length > 0);

  return {
    trackCount: payload.trackCount ?? null,
    discCount: payload.discCount ?? null,
    media,
    absence:
      payload.unavailableReason !== undefined && ABSENCES.includes(payload.unavailableReason)
        ? (payload.unavailableReason as TracklistAbsence)
        : null,
  };
}

