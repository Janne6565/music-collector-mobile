import type { Format } from "@janne6565/rekordo-shared";

/**
 * The formats a person can actually pick.
 *
 * `FORMATS` in the shared package has a fifth member, `OTHER`, and it is not a format. It
 * is what {@link copyFormat} answers when neither the copy nor the catalogue has said —
 * a sentinel that has to exist, because every screen draws, filters and counts a format
 * and a nullable one would put the same guard in a dozen places.
 *
 * Offered as a chip, though, it asked somebody to choose "I don't know" from a row of
 * things you can hold, about a record in their own hands. Every filter rail in both apps
 * already listed exactly these four; the two editors were the last place the sentinel
 * reached the interface.
 *
 * A copy still set to `OTHER` simply lights no chip, which is the honest reading: nothing
 * has said what it is yet, and any tap fixes that. Mirrors `FORMAT_CHIPS` in
 * rekordo-frontend/src/domain/formats.ts.
 */
export const CHOOSABLE_FORMATS: readonly Format[] = ["VINYL", "CD", "CASSETTE", "DIGITAL"];
