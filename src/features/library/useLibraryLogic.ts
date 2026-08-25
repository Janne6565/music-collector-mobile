import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { Copy, Format, Release } from "@/domain/types";
import type { LibraryFilter } from "@/local/LocalStore";
import { useStore } from "@/local/StoreProvider";

export type FormatFilter = Format | "ALL";

export interface LibraryRow {
  readonly copy: Copy;
  readonly release: Release | undefined;
}

export function useLibraryLogic() {
  const { store } = useStore();
  const [format, setFormat] = useState<FormatFilter>("ALL");
  const [sort] = useState<NonNullable<LibraryFilter["sort"]>>("ADDED_DESC");

  const statsQuery = useQuery({ queryKey: ["stats"], queryFn: () => store.stats() });

  const copiesQuery = useQuery({
    queryKey: ["copies", format, sort],
    queryFn: async () => {
      const copies = await store.listCopies({ format, sort });
      const releases = await store.getReleases(copies.map((copy) => copy.releaseId));
      return copies.map((copy) => ({ copy, release: releases.get(copy.releaseId) }));
    },
  });

  return {
    rows: copiesQuery.data ?? [],
    stats: statsQuery.data,
    loading: copiesQuery.isLoading,
    failed: copiesQuery.isError,
    collectionEmpty: statsQuery.data !== undefined && statsQuery.data.copyCount === 0,
    format,
    setFormat: useCallback((next: FormatFilter) => setFormat(next), []),
    refetch: useCallback(() => {
      void copiesQuery.refetch();
      void statsQuery.refetch();
    }, [copiesQuery, statsQuery]),
  };
}
