import type { LibraryFilter } from "@/local/LocalStore";
import { useStore } from "@/local/StoreProvider";
import { readCatalogueGap } from "@/local/settings";
import { syncOutcomeCleared } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useSync } from "@/sync/SyncProvider";
import { catalogueKeyOf, catalogueKeysOf, inRollPool } from "@janne6565/rekordo-shared";
import type { Copy, Format, Release } from "@janne6565/rekordo-shared";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

export type FormatFilter = Format | "ALL";

export interface LibraryRow {
  readonly copy: Copy;
  readonly release: Release | undefined;
}

export type LibraryLogic = ReturnType<typeof useLibraryLogic>;

export function useLibraryLogic() {
  const { store } = useStore();
  const { syncNow } = useSync();
  const [format, setFormat] = useState<FormatFilter>("ALL");
  /**
   * 26c — the shelf's second axis, and the reason its filters are worth a sheet.
   *
   * Applied here rather than in the query, because the store filters by format and the
   * rating lives on the copy that has already been read. Keeping the query key to the
   * format alone also means moving the star does not go back to disk, and — the reason
   * it matters — leaves `["copies","ALL","ADDED_DESC"]` intact as the key the roll sheet
   * warms itself from.
   */
  const [minRating, setMinRating] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sort] = useState<NonNullable<LibraryFilter["sort"]>>("ADDED_DESC");
  /**
   * 29e-5: the shelf filtered down to what the sign-in brought in.
   *
   * Not a filter chip and not a route — it is the second half of a sentence the strip
   * above the grid is still saying, and it goes away with the strip.
   */
  const [showingArrived, setShowingArrived] = useState(false);
  const dispatch = useAppDispatch();
  const outcome = useAppSelector((state) => state.auth.syncOutcome);

  const statsQuery = useQuery({ queryKey: ["stats"], queryFn: () => store.stats() });
  /**
   * What the last sync could not describe.
   *
   * Read here rather than derived from the rows on screen: a row with no release looks
   * the same whether the catalogue is still on its way or the mirror has answered and
   * has nothing, and only the sync knows which.
   */
  const gapQuery = useQuery({
    queryKey: ["catalogueGap"],
    queryFn: () => readCatalogueGap(store),
  });

  const copiesQuery = useQuery({
    queryKey: ["copies", format, sort],
    queryFn: async () => {
      const copies = await store.listCopies({ format, sort });
      const releases = await store.getReleases(catalogueKeysOf(copies));
      return copies.map((copy) => ({ copy, release: releases.get(catalogueKeyOf(copy) ?? "") }));
    },
  });

  // The pool predicate is the roll's, deliberately: "at least four stars" has to mean the
  // same thing on the shelf as it does in the sheet, unrated copies excluded and all.
  const all = useMemo(() => {
    const rows = copiesQuery.data ?? [];
    if (minRating === null) return rows;
    return rows.filter((row) => inRollPool(row, { format: "ALL", minRating }));
  }, [copiesQuery.data, minRating]);
  const arrived = new Set(outcome?.ids ?? []);

  return {
    rows: showingArrived && outcome !== null ? all.filter((row) => arrived.has(row.copy.id)) : all,
    outcome,
    showingArrived,
    showArrived: () => setShowingArrived(true),
    dismissOutcome: () => {
      setShowingArrived(false);
      dispatch(syncOutcomeCleared());
    },
    stats: statsQuery.data,
    catalogueGap: gapQuery.data,
    loading: copiesQuery.isLoading,
    failed: copiesQuery.isError,
    collectionEmpty: statsQuery.data !== undefined && statsQuery.data.copyCount === 0,
    format,
    setFormat: useCallback((next: FormatFilter) => setFormat(next), []),
    minRating,
    setMinRating,
    /** What "Show" would show — the filters alone, not the sync strip's narrowing. */
    matching: all.length,
    filtered: format !== "ALL" || minRating !== null,
    clearFilters: useCallback(() => {
      setFormat("ALL");
      setMinRating(null);
    }, []),
    refreshing,
    /**
     * A pull on the shelf runs a sync, not just a re-read.
     *
     * Re-reading the local store was all this used to do, which can only ever redraw what
     * the last sync already wrote -- so the one gesture anybody makes at a shelf full of
     * untitled placeholders was the one gesture guaranteed not to fix it.
     */
    refetch: useCallback(async () => {
      setRefreshing(true);
      try {
        await syncNow();
      } finally {
        setRefreshing(false);
      }
      // The sync invalidates every query when it changes something; these cover the case
      // where it did not, so a pull still ends in fresh reads.
      void copiesQuery.refetch();
      void statsQuery.refetch();
      void gapQuery.refetch();
    }, [syncNow, copiesQuery, statsQuery, gapQuery]),
  };
}
