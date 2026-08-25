import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { type Discography, lookupDiscography, lookupPressings } from "@/api/releases";
import type { Album } from "@janne6565/music-collector-shared";
/**
 * The primary types the artist screen offers, in the order the deck lists them.
 *
 * MusicBrainz's own vocabulary, not ours — the value is sent straight to the query, so
 * renaming one here would silently return nothing.
 */
export const PRIMARY_TYPES = ["Album", "EP", "Single", "Broadcast", "Other"] as const;
export type PrimaryType = (typeof PRIMARY_TYPES)[number];

/** What screen 10c has open when it opens: the records, then the short-form records. */
const DEFAULT_SECTIONS: readonly PrimaryType[] = ["Album", "EP"];

/** What the "Singles, sessions & broadcasts" card is holding, fetched when it is opened. */
const REST_SECTIONS: readonly PrimaryType[] = ["Single", "Broadcast", "Other"];

/**
 * One artist's discography, as screen 10c arranges it.
 *
 * The phone screen differs from the web pane (10d) in what it shows at rest, and the
 * difference is the whole point of the design: an artist like Daughter has 330 release
 * groups of which four are albums, so the deck opens on Albums *and* EPs together and
 * folds the remaining 312 sessions, broadcasts and remixes behind one disclosure. A single
 * chip-selected list would make the four records anyone came for something you have to go
 * looking for.
 *
 * Everything here is paced around one upstream rule: MusicBrainz allows one request per
 * second. So each section is fetched separately and drawn the moment it lands, the three
 * behind the disclosure are not requested until it is opened, and the untyped
 * "everything" query runs behind all of it purely to learn two totals nobody is waiting on.
 */
export function useDiscographyLogic(artistMbid: string) {
  /** Null while the screen is at rest, showing the sections the deck opens with. */
  const [type, setType] = useState<PrimaryType | null>(null);
  const [filter, setFilter] = useState("");
  const [expandedAlbum, setExpandedAlbum] = useState<string | null>(null);
  const [restExpanded, setRestExpanded] = useState(false);

  /** The sections actually being fetched: one chosen type, or the deck's default pair. */
  const active = useMemo(() => {
    if (type !== null) return [type];
    return restExpanded ? [...DEFAULT_SECTIONS, ...REST_SECTIONS] : [...DEFAULT_SECTIONS];
  }, [type, restExpanded]);

  const results = useQueries({
    queries: active.map((sectionType) => ({
      queryKey: ["discography", artistMbid, sectionType],
      queryFn: () => lookupDiscography(artistMbid, sectionType, 100),
      // A discography does not change while you are reading it, and each fetch costs a
      // second of somebody's patience.
      staleTime: 5 * 60_000,
    })),
  });

  /**
   * Everything, of every type — asked for alongside the rest and never blocking a paint.
   *
   * It exists for two numbers the deck puts on screen and nothing else: the artist's
   * release count in the header, and how many release groups are hiding behind the
   * "Singles, sessions & broadcasts" card. Neither is knowable from the typed queries, and
   * neither is worth delaying the albums for — so until it lands, both simply say less.
   */
  const everything = useQuery({
    queryKey: ["discography", artistMbid, "All"],
    queryFn: () => lookupDiscography(artistMbid, null, 100),
    staleTime: 5 * 60_000,
  });

  const term = filter.trim().toLowerCase();

  /**
   * The sections on screen, filtered.
   *
   * A section the filter empties disappears with it, rather than leaving a heading over
   * nothing — but only while filtering, so a type that genuinely has no releases still
   * gets to say so.
   */
  const sections = active
    .map((sectionType, index) => {
      const data = results[index]?.data as Discography | undefined;
      const albums = data?.albums ?? [];
      return {
        type: sectionType,
        albums:
          term === ""
            ? albums
            : albums.filter((album) => album.title.toLowerCase().includes(term)),
        total: data?.total ?? null,
        loading: results[index]?.isFetching === true,
        failed: results[index]?.isError === true,
      };
    })
    .filter((section) => term === "" || section.albums.length > 0);

  const pressings = useQuery({
    queryKey: ["pressings", expandedAlbum],
    enabled: expandedAlbum !== null,
    queryFn: () => lookupPressings(expandedAlbum as string, 100),
    staleTime: 5 * 60_000,
  });

  /** Counts for every type already fetched, read out of this render's own results. */
  const totals = Object.fromEntries(
    PRIMARY_TYPES.map((primaryType) => {
      const index = active.indexOf(primaryType);
      const data = index === -1 ? undefined : (results[index]?.data as Discography | undefined);
      return [primaryType, data?.total ?? null];
    }),
  ) as Record<PrimaryType, number | null>;

  const releaseCount = everything.data?.total ?? null;
  const shown = DEFAULT_SECTIONS.reduce((sum, section) => sum + (totals[section] ?? 0), 0);

  return {
    type,
    setType: (next: PrimaryType | null) => {
      setType(next);
      setExpandedAlbum(null);
    },
    filter,
    setFilter,
    filtering: term !== "",
    sections,
    totals,
    /** What MusicBrainz says the artist has in total, once that answer has arrived. */
    releaseCount,
    /**
     * How many release groups the disclosure is holding — everything that is not an album
     * or an EP. Null until both the totals and the untyped query have landed, because
     * guessing it would put a number on screen that is wrong by exactly what is not known
     * yet.
     */
    restCount:
      releaseCount === null || totals.Album === null || totals.EP === null
        ? null
        : Math.max(0, releaseCount - shown),
    restExpanded,
    toggleRest: () => setRestExpanded((open) => !open),

    /**
     * Nothing to show yet at all, as opposed to one section still filling in.
     *
     * Guarded on there being sections: a filter that matches nothing leaves the list
     * empty, and an unguarded `every` on an empty list is true — which would answer "no
     * matches" with a skeleton that never resolves.
     */
    loading: sections.length > 0 && sections.every((section) => section.loading),
    failed: sections.length > 0 && sections.every((section) => section.failed),
    /**
     * True while any part of the artist is still arriving, including the background
     * totals — what the deck's "Cover art loading · 1 request / second" line reports.
     */
    settling: results.some((result) => result.isFetching) || everything.isFetching,

    expandedAlbum,
    toggleAlbum: (album: Album) =>
      setExpandedAlbum((current) => (current === album.albumId ? null : album.albumId)),
    pressings: pressings.data ?? [],
    pressingsLoading: pressings.isFetching,
    pressingsFailed: pressings.isError,
  };
}
