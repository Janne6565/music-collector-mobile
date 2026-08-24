import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { lookupByBarcode, searchReleases } from "@/api/releases";
import type { Release } from "@/domain/types";
import { createCopy } from "@/local/copyWrites";
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

  /** A scanned barcode goes straight into the search box and submits itself. */
  const handleScan = useCallback((barcode: string) => {
    setScanning(false);
    setTerm(barcode);
    setSubmitted(barcode);
  }, []);

  return {
    term,
    setTerm,
    submit: useCallback(() => setSubmitted(term), [term]),
    canSubmit: term.trim().length > 0,
    scanning,
    startScanning: useCallback(() => setScanning(true), []),
    stopScanning: useCallback(() => setScanning(false), []),
    handleScan,
    results: resultsQuery.data ?? [],
    searching: resultsQuery.isFetching,
    failed: resultsQuery.isError,
    hasSearched: submitted.trim() !== "",
    addRelease: (release: Release) => addCopy.mutate(release),
    addingMbid: addCopy.isPending ? addCopy.variables?.mbid : undefined,
  };
}
