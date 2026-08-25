import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { lookupByBarcode, searchReleases } from "@/api/releases";
import type { Release } from "@/domain/types";
import { createCopy } from "@/local/copyWrites";
import { clearRecentSearches, readRecentSearches, rememberSearch } from "@/local/settings";
import { createWishlistItem } from "@/local/wishWrites";
import { useStore } from "@/local/StoreProvider";
import * as Crypto from "expo-crypto";

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

export function useAddLogic() {
  const { store, clock } = useStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [scanning, setScanning] = useState(false);

  const resultsQuery = useQuery({
    queryKey: ["releaseSearch", submitted],
    enabled: submitted.trim() !== "",
    queryFn: () => {
      const query = submitted.trim();
      return BARCODE.test(query) ? lookupByBarcode(query) : searchReleases(query);
    },
  });

  const addCopy = useMutation({
    mutationFn: async (release: Release) => {
      // Cache the release with the copy: the library and detail screens read metadata from
      // the local store and must keep working with no network at all.
      await store.cacheReleases([release]);
      const copy = createCopy(
        release,
        {
          condition: null,
          sleeveCondition: null,
          pricePaidCents: null,
          currency: "EUR",
          purchasedOn: null,
          purchasedAt: null,
          notes: null,
          rating: null,
        },
        clock,
        Date.now(),
        Crypto.randomUUID(),
      );
      await store.putCopy(copy);
      return copy;
    },
    onSuccess: async (copy) => {
      await queryClient.invalidateQueries({ queryKey: ["copies"] });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
      router.replace(`/copies/${copy.id}`);
    },
  });

  /**
   * Wishing for something you do not own yet. Keyed on the release *group*: you want the
   * album on vinyl, not one particular pressing of it.
   */
  const addWish = useMutation({
    mutationFn: async (release: Release) => {
      if (await store.wishlistHas(release.albumId)) return;
      await store.putWishlistItem(
        createWishlistItem(
          {
            albumId: release.albumId,
            title: release.title,
            artistName: release.artistName,
            year: release.year,
            desiredFormat: release.format,
            note: null,
          },
          clock,
          Date.now(),
          Crypto.randomUUID(),
        ),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

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

  /** A scanned barcode goes straight into the search box and submits itself. */
  const handleScan = useCallback(
    (barcode: string) => {
      setScanning(false);
      setTerm(barcode);
      run(barcode);
    },
    [run],
  );

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
    scanning,
    startScanning: useCallback(() => setScanning(true), []),
    stopScanning: useCallback(() => setScanning(false), []),
    handleScan,
    results: resultsQuery.data ?? [],
    /**
     * True from the keystroke, not from the request: the skeletons stand in for the wait
     * as a whole, and a debounce the reader cannot see is still a wait.
     */
    searching: waiting || resultsQuery.isFetching,
    failed: resultsQuery.isError && !waiting,
    hasSearched: submitted.trim() !== "" || waiting,
    submittedTerm: submitted.trim(),
    /** True when the thing with no results was a scanned or pasted barcode (screen 8c). */
    searchedBarcode: BARCODE.test(submitted.trim()),
    recentSearches: recent.data ?? [],
    repeatSearch: (value: string) => {
      setTerm(value);
      run(value.trim());
      remember(value);
    },
    clearRecent: () => forgetSearches.mutate(),
    /** Screen 5a's quick-add strip: things you already said you wanted. */
    wishlist: (wishlist.data ?? []).slice(0, 4),
    searchWish: (title: string, artistName: string) => {
      const wish = `${artistName} ${title}`;
      setTerm(wish);
      run(wish);
      remember(wish);
    },
    addRelease: (release: Release) => {
      // The search that found something you kept is one worth offering again.
      if (submitted.trim() !== "") remember(submitted);
      addCopy.mutate(release);
    },
    addingMbid: addCopy.isPending ? addCopy.variables?.id : undefined,
    wishFor: (release: Release) => addWish.mutate(release),
    wishingMbid: addWish.isPending ? addWish.variables?.id : undefined,
  };
}
