import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { lookupByBarcode, searchReleases } from "@/api/releases";
import type { Release } from "@/domain/types";
import { createCopy } from "@/local/copyWrites";
import { clearRecentSearches, readRecentSearches, rememberSearch } from "@/local/settings";
import { createWishlistItem } from "@/local/wishWrites";
import { useStore } from "@/local/StoreProvider";
import * as Crypto from "expo-crypto";

const BARCODE = /^\d{8,14}$/;

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
      if (await store.wishlistHas(release.releaseGroupMbid)) return;
      await store.putWishlistItem(
        createWishlistItem(
          {
            releaseGroupMbid: release.releaseGroupMbid,
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

  const run = useCallback(
    (query: string) => {
      setSubmitted(query);
      // Remembered on submit rather than on keystroke, so the list holds searches somebody
      // meant, not every prefix they passed through on the way. A barcode is skipped: a
      // number nobody typed is not a search anybody would want to repeat.
      if (!BARCODE.test(query.trim())) {
        void rememberSearch(store, query).then(() =>
          queryClient.invalidateQueries({ queryKey: ["recentSearches"] }),
        );
      }
    },
    [store, queryClient],
  );

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
    submit: useCallback(() => run(term), [run, term]),
    canSubmit: term.trim().length > 0,
    scanning,
    startScanning: useCallback(() => setScanning(true), []),
    stopScanning: useCallback(() => setScanning(false), []),
    handleScan,
    results: resultsQuery.data ?? [],
    searching: resultsQuery.isFetching,
    failed: resultsQuery.isError,
    hasSearched: submitted.trim() !== "",
    submittedTerm: submitted.trim(),
    /** True when the thing with no results was a scanned or pasted barcode (screen 8c). */
    searchedBarcode: BARCODE.test(submitted.trim()),
    recentSearches: recent.data ?? [],
    repeatSearch: (value: string) => {
      setTerm(value);
      run(value);
    },
    clearRecent: () => forgetSearches.mutate(),
    /** Screen 5a's quick-add strip: things you already said you wanted. */
    wishlist: (wishlist.data ?? []).slice(0, 4),
    searchWish: (title: string, artistName: string) => {
      const query = `${artistName} ${title}`;
      setTerm(query);
      run(query);
    },
    addRelease: (release: Release) => addCopy.mutate(release),
    addingMbid: addCopy.isPending ? addCopy.variables?.mbid : undefined,
    wishFor: (release: Release) => addWish.mutate(release),
    wishingMbid: addWish.isPending ? addWish.variables?.mbid : undefined,
  };
}
