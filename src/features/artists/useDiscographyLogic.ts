import { type Discography, lookupDiscography } from "@/api/releases";
import { useStore } from "@/local/StoreProvider";
import type { Album, Condition } from "@janne6565/rekordo-shared";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

/**
 * What you have already said about an album, drawn on its row.
 *
 * Three states rather than two booleans: a record is on the shelf, or being hunted, or
 * neither, and the pair could otherwise hold "owned and wished" — which the wishlist
 * empties itself precisely to prevent.
 */
export type AlbumMark = "OWNED" | "WISHED" | "NEITHER";

/** The chips over the discography: what is yours, what you are hunting, what is left. */
export const OWNERSHIP_FILTERS = ["ALL", "OWNED", "WISHED", "NEITHER"] as const;
export type OwnershipFilter = (typeof OWNERSHIP_FILTERS)[number];
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
  const { store } = useStore();
  /** Null while the screen is at rest, showing the sections the deck opens with. */
  const [type, setType] = useState<PrimaryType | null>(null);
  const [filter, setFilter] = useState("");
  const [restExpanded, setRestExpanded] = useState(false);
  const [ownership, setOwnership] = useState<OwnershipFilter>("ALL");

  /**
   * Your marks on this artist's records, keyed by album.
   *
   * Read from the local store rather than asked of the server: this is the app's own data,
   * it is the whole reason the discography is worth opening rather than browsing Discogs,
   * and it has to be right with no connection at all.
   */
  const marks = useQuery({
    queryKey: ["albumMarks"],
    queryFn: async () => {
      const copies = await store.listCopies();
      const releases = await store.getReleases(copies.map((copy) => copy.releaseId));
      const owned = new Map<string, Condition | null>();
      for (const copy of copies) {
        const album = releases.get(copy.releaseId)?.albumId;
        if (album === undefined) continue;
        // The first grade found stands for the album: the row is saying "you have this
        // record", and picking between two copies' grades is the copy screen's job.
        if (!owned.has(album)) owned.set(album, copy.condition);
      }
      const wished = new Set((await store.listWishlist()).map((wish) => wish.albumId));
      return { owned, wished };
    },
  });

  const markOf = (album: Album): AlbumMark =>
    marks.data?.owned.has(album.albumId) === true
      ? "OWNED"
      : marks.data?.wished.has(album.albumId) === true
        ? "WISHED"
        : "NEITHER";

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
  /**
   * The sections with the typed filter applied, before the chips narrow them further.
   *
   * Kept separate because the chips have to count what they are about to hide: counts
   * taken after the chip was applied would read "Yours · 4" only while Yours was selected,
   * and 0 the rest of the time.
   */
  const matching = active.map((sectionType, index) => {
    const data = results[index]?.data as Discography | undefined;
    const albums = data?.albums ?? [];
    return {
      type: sectionType,
      albums:
        term === "" ? albums : albums.filter((album) => album.title.toLowerCase().includes(term)),
      total: data?.total ?? null,
      loading: results[index]?.isFetching === true,
      failed: results[index]?.isError === true,
    };
  });

  const sections = matching
    .map((section) => ({
      ...section,
      albums:
        ownership === "ALL"
          ? section.albums
          : section.albums.filter((album) => markOf(album) === ownership),
    }))
    // A section the filters empty disappears with them, rather than leaving a heading over
    // nothing — but only while filtering, so a type that genuinely has none still says so.
    .filter((section) => (term === "" && ownership === "ALL") || section.albums.length > 0);

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
    setType,
    filter,
    setFilter,
    filtering: term !== "",
    ownership,
    setOwnership,
    markOf,
    /** The grade of the copy standing for an owned album, when it has one. */
    gradeOf: (album: Album) => marks.data?.owned.get(album.albumId) ?? null,
    /**
     * The chip counts, over what has actually been fetched.
     *
     * Deliberately not over `releaseCount`: that number counts release groups the typed
     * queries have never asked for, and a "Not yours · 312" that included 300 broadcasts
     * nobody will ever scroll to would be a true number saying something false.
     */
    ownershipCounts: countMarks(matching, markOf),
    /** How many rows are on screen, for 6d's "2 of 61 releases". */
    shownCount: sections.reduce((sum, section) => sum + section.albums.length, 0),
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
     * Ask again for whatever came back empty-handed.
     *
     * Only the failed sections: the ones that arrived are already on screen, and asking
     * for them a second time would spend the archive's one-request-a-second budget
     * refetching answers we are holding.
     */
    retry: () => {
      for (const result of results) {
        if (result.isError) void result.refetch();
      }
      if (everything.isError) void everything.refetch();
    },
    /**
     * True while any part of the artist is still arriving, including the background
     * totals — what the deck's "Cover art loading · 1 request / second" line reports.
     */
    settling: results.some((result) => result.isFetching) || everything.isFetching,
  };
}

function countMarks(
  sections: readonly { readonly albums: readonly Album[] }[],
  markOf: (album: Album) => AlbumMark,
): Record<OwnershipFilter, number> {
  const counts: Record<OwnershipFilter, number> = { ALL: 0, OWNED: 0, WISHED: 0, NEITHER: 0 };
  for (const section of sections) {
    for (const album of section.albums) {
      counts.ALL += 1;
      counts[markOf(album)] += 1;
    }
  }
  return counts;
}
