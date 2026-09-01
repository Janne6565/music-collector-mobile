import {
  lookupAlbumCovers,
  lookupByBarcode,
  lookupPressingCovers,
  lookupPressings,
  searchReleases,
} from "@/api/releases";
import { EXAMPLE_ALBUM_IDS } from "@/features/add/exampleReleases";
import { useAddCopy } from "@/features/add/useAddCopy";
import { useArtistSearchLogic } from "@/features/add/useArtistSearchLogic";
import { useWishPhotos } from "@/features/wishlist/useWishPhotos";
import { useStore } from "@/local/StoreProvider";
import { clearRecentSearches, readRecentSearches, rememberSearch } from "@/local/settings";
import type { Copy, Format, Release, WishlistItem } from "@janne6565/rekordo-shared";
import { isManualReleaseId } from "@janne6565/rekordo-shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * The format filter above the results (screens 2a and 10a).
 *
 * A filter over what came back rather than a narrower query: MusicBrainz is asked once
 * and returns one row per release *and* format, so the four chips are already in hand and
 * switching between them costs nothing. Never shown for a barcode — a barcode identifies
 * one pressing, and a chip that could only ever hide it is not a choice.
 */
export type AddFormatFilter = Format | "ALL";

export const FORMAT_FILTERS: readonly AddFormatFilter[] = [
  "ALL",
  "VINYL",
  "CD",
  "CASSETTE",
  "DIGITAL",
];

const BARCODE = /^\d{8,14}$/;

/**
 * How long the field has to stand still before the search runs itself.
 *
 * Long enough that typing an artist's name is one request rather than eleven, short
 * enough that it still feels like the list is following along. Kept in step with the web
 * dialog, which does the same thing with the same numbers.
 */
const DEBOUNCE_MS = 350;

/** Below this, a title search matches most of the archive and tells you nothing. */
const MIN_TERM_LENGTH = 2;

export function useAddLogic(seedTerm = "") {
  const { store } = useStore();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState(seedTerm);
  const [submitted, setSubmitted] = useState(seedTerm);
  const [format, setFormat] = useState<AddFormatFilter>("ALL");
  /** The example whose pressings are on their way, so its tile can say so. */
  const [openingExample, setOpeningExample] = useState<string | null>(null);

  const resultsQuery = useQuery({
    queryKey: ["releaseSearch", submitted],
    enabled: submitted.trim() !== "",
    queryFn: () => {
      const query = submitted.trim();
      return BARCODE.test(query) ? lookupByBarcode(query) : searchReleases(query);
    },
  });

  const { add, addingMbid } = useAddCopy();

  /** The empty state of screen 5a: what you looked for last. */
  const recent = useQuery({
    queryKey: ["recentSearches"],
    queryFn: () => readRecentSearches(store),
  });

  const forgetSearches = useMutation({
    mutationFn: () => clearRecentSearches(store),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["recentSearches"] });
    },
  });

  const wishlist = useQuery({ queryKey: ["wishlist"], queryFn: () => store.listWishlist() });

  /**
   * The four entries this screen shows, and their artwork.
   *
   * `WishlistItem` carries no cover of its own, only the ids to resolve one with -- so a
   * screen that does not run these lookups draws four empty frames, which is what this
   * block used to do. The keys match the wishlist tab's exactly, so opening this screen
   * after that one costs nothing; the id sets differ (four entries, not the whole list),
   * and React Query keeps them as separate entries rather than one answering for the other.
   */
  const wishes = useMemo(() => (wishlist.data ?? []).slice(0, 4), [wishlist.data]);

  const wishAlbumIds = useMemo(
    () => [...new Set(wishes.map((wish) => wish.albumId))].sort(),
    [wishes],
  );

  const wishReleaseIds = useMemo(
    () =>
      [
        ...new Set(
          wishes
            .map((wish) => wish.releaseId)
            .filter((releaseId): releaseId is string => releaseId !== null),
        ),
      ]
        // A hand-typed entry's release id is local and names nothing the mirror holds.
        .filter((releaseId) => !isManualReleaseId(releaseId))
        .sort(),
    [wishes],
  );

  const wishPressingCovers = useQuery({
    queryKey: ["pressingCovers", wishReleaseIds],
    enabled: wishReleaseIds.length > 0,
    staleTime: 60 * 60 * 1000,
    queryFn: () => lookupPressingCovers(wishReleaseIds),
  });

  const wishCovers = useQuery({
    queryKey: ["albumCovers", wishAlbumIds],
    enabled: wishAlbumIds.length > 0,
    staleTime: 60 * 60 * 1000,
    queryFn: () => lookupAlbumCovers(wishAlbumIds, store),
  });

  /**
   * The artwork for the examples plate (screen 1a).
   *
   * Only while nothing has been searched, which is the only time the plate is on screen:
   * opening this screen from a wish or a scan goes straight to results, and a request for
   * covers nobody will see would spend the archive's one-per-second budget on nothing.
   *
   * The ids are a constant, so this is one request per install in practice -- the key
   * never changes and the answer is the same for every user on the platform.
   */
  const exampleCovers = useQuery({
    queryKey: ["albumCovers", EXAMPLE_ALBUM_IDS],
    enabled: submitted.trim() === "",
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: () => lookupAlbumCovers(EXAMPLE_ALBUM_IDS, store),
  });

  const wishPhotos = useWishPhotos(useMemo(() => wishes.map((wish) => wish.id), [wishes]));

  /**
   * What is already on the shelf, and the grade of it.
   *
   * Keyed by release, not album: owning the CD is not owning the LP, and telling somebody
   * holding a different pressing that they already have it is how a collection ends up
   * missing the record they were standing in the shop with.
   */
  const owned = useQuery({
    queryKey: ["ownedReleases"],
    queryFn: async () => {
      const map = new Map<string, { condition: Copy["condition"]; addedAt: number }>();
      for (const copy of await store.listCopies()) {
        const seen = map.get(copy.releaseId);
        // The oldest is the copy somebody thinks of as "the one I have".
        if (seen === undefined || copy.createdAt < seen.addedAt) {
          map.set(copy.releaseId, { condition: copy.condition, addedAt: copy.createdAt });
        }
      }
      return map;
    },
  });

  const run = useCallback((query: string) => setSubmitted(query), []);

  /**
   * Recent searches hold things somebody meant, not every prefix they passed through on
   * the way — which is why this is not called from the debounce. A search counts as meant
   * once it is pressed for deliberately (the search key, a scan, repeating an earlier
   * one) or once it produces something that gets added. Barcodes are skipped either way:
   * a number nobody typed is not a search anybody would want to repeat.
   */
  const remember = useCallback(
    (query: string) => {
      if (BARCODE.test(query.trim())) return;
      void rememberSearch(store, query).then(() =>
        queryClient.invalidateQueries({ queryKey: ["recentSearches"] }),
      );
    },
    [store, queryClient],
  );

  const query = term.trim();
  /** A barcode is only a barcode once it is complete, so half a scan never goes out. */
  const queryReady = BARCODE.test(query) || query.length >= MIN_TERM_LENGTH;
  /** Typed something new and the request has not gone out yet. */
  const waiting = queryReady && query !== submitted;

  const barcode = BARCODE.test(submitted.trim());

  /**
   * The artists half of the same search (screen 10a). Skipped for a barcode: a number
   * identifies a pressing, and no artist is named 602537.
   */
  const artists = useArtistSearchLogic(submitted.trim(), !barcode);

  const all = resultsQuery.data ?? [];
  const results = useMemo(
    () => (format === "ALL" ? all : all.filter((release) => release.format === format)),
    [all, format],
  );

  /**
   * The search runs itself after the field stands still.
   *
   * Adding a record is a search you repeat with small corrections — a misheard title, an
   * artist spelled two ways — and reaching for the keyboard's search key between every
   * attempt is a tap that only ever means "yes, I did mean what I just typed". The search
   * key still works, and skips the wait.
   */
  useEffect(() => {
    if (!queryReady) {
      // Emptying or shortening the field drops the results with it, rather than leaving
      // them stranded under a box that no longer says what produced them.
      run("");
      return;
    }
    if (query === submitted) return;
    const timer = setTimeout(() => run(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, queryReady, submitted, run]);

  return {
    term,
    setTerm,
    /** The keyboard's search key — the same search, without waiting out the debounce. */
    submit: useCallback(() => {
      if (query === "") return;
      run(query);
      remember(query);
    }, [query, run, remember]),
    canSubmit: query !== "",
    results,
    /** How many came back before the chips narrowed them, for the empty-filter wording. */
    unfilteredCount: all.length,
    format,
    setFormat,
    /** A barcode names one pressing, so the format chips have nothing to offer there. */
    showFormatFilter: !barcode && all.length > 0,
    artists,
    /**
     * True from the keystroke, not from the request: the skeletons stand in for the wait
     * as a whole, and a debounce the reader cannot see is still a wait.
     */
    searching: waiting || resultsQuery.isFetching,
    failed: resultsQuery.isError && !waiting,
    /** Ask the archive again. The query is keyed on the term, so this repeats it. */
    retry: () => void resultsQuery.refetch(),
    hasSearched: submitted.trim() !== "" || waiting,
    submittedTerm: submitted.trim(),
    /** True when the thing with no results was a scanned or pasted barcode (screen 8c). */
    searchedBarcode: barcode,
    recentSearches: recent.data ?? [],
    repeatSearch: (value: string) => {
      setTerm(value);
      run(value.trim());
      remember(value);
    },
    clearRecent: () => forgetSearches.mutate(),
    /** Screen 5a's quick-add strip: things you already said you wanted. */
    wishlist: wishes,
    /** The pressing's sleeve when the entry was made from one, else the album's. */
    wishCoverOf: (wish: WishlistItem): string | null => {
      const pressing =
        wish.releaseId === null ? undefined : wishPressingCovers.data?.get(wish.releaseId);
      return pressing ?? wishCovers.data?.get(wish.albumId) ?? null;
    },
    /** A picture somebody gave the entry themselves, which no catalogue can supply. */
    wishPictureOf: (wish: WishlistItem): string | null => wishPhotos.get(wish.id) ?? null,
    /** The example a tap is currently resolving, if any. */
    openingExample,
    /**
     * The pressing an example tile opens the confirm sheet on.
     *
     * A tile names an album and the sheet is written about a release, so one has to be
     * chosen before the sheet can be raised. The first pressing is only the seed: the
     * sheet lists the rest under it and swaps freely, which is where the choice of which
     * copy you actually own belongs.
     *
     * Fetched through the query client under the key the sheet itself uses, so the sheet
     * opens with its own pressings list already warm rather than asking a second time.
     *
     * Null when the album has no pressings the mirror can name -- the caller falls back to
     * running the search, which is the older behaviour and never a dead end.
     */
    resolveExample: async (albumId: string): Promise<Release | null> => {
      setOpeningExample(albumId);
      try {
        const pressings = await queryClient.fetchQuery({
          queryKey: ["pressings", albumId],
          queryFn: () => lookupPressings(albumId),
          staleTime: 60 * 60 * 1000,
        });
        return pressings[0] ?? null;
      } catch {
        return null;
      } finally {
        setOpeningExample(null);
      }
    },
    /** The plate's sleeves, by album id. Null until the batch lands, and after a miss. */
    exampleCoverOf: (albumId: string): string | null => exampleCovers.data?.get(albumId) ?? null,
    /**
     * A tap on an example runs its search, and never files anything.
     *
     * The same handoff a wish makes: the tile names an album, the shelf holds a pressing,
     * so the only honest thing a tap can do is put the album in the field and let the
     * results answer which copy you have.
     */
    searchExample: (title: string, artistName: string) => {
      const query = `${artistName} ${title}`;
      setTerm(query);
      run(query);
      remember(query);
    },
    searchWish: (title: string, artistName: string) => {
      const wish = `${artistName} ${title}`;
      setTerm(wish);
      run(wish);
      remember(wish);
    },
    addRelease: (release: Release) => {
      // The search that found something you kept is one worth offering again.
      if (submitted.trim() !== "") remember(submitted);
      add(release);
    },
    addingMbid,
    ownedCopy: (release: Release) => owned.data?.get(release.id) ?? null,
  };
}
