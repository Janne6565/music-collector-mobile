import { findArtists } from "@/api/releases";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

/**
 * How many artist rows show before the disclosure.
 *
 * Three, matching the web (screen 10b). The deck asked for two on a phone, on the grounds
 * that a third row pushes the first record off the screen -- which it does. Janne asked
 * for three anyway: the block is now the first thing on the results list, so the rows it
 * costs are rows somebody scrolls past rather than rows they never see.
 */
export const ARTISTS_SHOWN = 3;

/**
 * The artists half of a search (screen 10a).
 *
 * A separate query from the releases one, deliberately. They are two upstream requests and
 * MusicBrainz allows us one per second, so they cannot be parallel — and a list that shows
 * artists the moment they land reads as faster than one that waits to render both at once.
 *
 * A barcode never runs this: a number identifies a pressing, and no artist is named 602537.
 *
 * The disclosure state is keyed on the query rather than kept as a bare flag, so a new
 * search opens collapsed again — a flag left standing would have the next search start
 * expanded, which is the one state the screen is never drawn in.
 */
export function useArtistSearchLogic(query: string, enabled: boolean) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const artists = useQuery({
    queryKey: ["artistSearch", query],
    enabled: enabled && query !== "",
    queryFn: () => findArtists(query, 8),
  });

  const all = artists.data ?? [];
  const isExpanded = expanded === query;
  return {
    /** Everything matched, so the count on the section header is honest. */
    total: all.length,
    shown: isExpanded ? all : all.slice(0, ARTISTS_SHOWN),
    hidden: Math.max(0, all.length - ARTISTS_SHOWN),
    expanded: isExpanded,
    expand: () => setExpanded(query),
    /**
     * True only while artists are still coming. The releases query has its own wait, and
     * conflating the two would hold back whichever landed first.
     */
    loading: artists.isFetching,
    /**
     * A failed artist lookup is not a failed search. MusicBrainz times out under load
     * often enough that letting it take the releases down with it would be the wrong
     * trade — the section simply does not appear.
     */
    failed: artists.isError,
  };
}
