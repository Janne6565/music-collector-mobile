import type { Artist } from "@janne6565/rekordo-shared";
/**
 * The line under an artist's name: "Group · GB · 2010–".
 *
 * Mirrors `artistSubtitle` in rekordo-frontend/src/api/releases.ts exactly, so the
 * same artist reads the same on both clients. It lives in the domain here rather than
 * beside the HTTP client because that module pulls in expo-constants and cannot be loaded
 * outside a native runtime — which would make the one piece of this worth unit-testing
 * the one piece that could not be tested.
 *
 * Anything the archive does not know is dropped rather than rendered as an empty slot: a
 * great many artists have no type, no country or no dates, and a row reading "· ·" looks
 * broken where a shorter line just looks shorter.
 */
export function artistSubtitle(artist: Artist): string {
  const years =
    artist.beganIn === null
      ? null
      : `${artist.beganIn.slice(0, 4)}–${artist.endedIn === null ? "" : artist.endedIn.slice(0, 4)}`;
  return [artist.type, artist.country, years]
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join(" · ");
}
