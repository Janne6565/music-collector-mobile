import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { lookupRelease } from "@/api/releases";
import type { Copy, Release } from "@/domain/types";
import { type CopyDraft, applyCopyPatch, tombstoneCopy } from "@/local/copyWrites";
import { useStore } from "@/local/StoreProvider";

export interface DetailData {
  readonly copy: Copy;
  readonly release: Release | undefined;
  readonly otherCopies: readonly { copy: Copy; release: Release | undefined }[];
}

export function useDetailLogic(copyId: string) {
  const { store, clock } = useStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  /**
   * Everything the screen draws, read from the local store alone.
   *
   * Nothing in here touches the network. The app is local-first: a copy that exists on this
   * device has all of its metadata on this device too, so opening it must be as fast as a
   * SQLite read — which is what it was not while the cover theme was fetched inline.
   */
  const detailQuery = useQuery<DetailData | null>({
    queryKey: ["copy", copyId],
    queryFn: async () => {
      const copy = await store.getCopy(copyId);
      if (copy === undefined) return null;

      const release = await store.getRelease(copy.releaseId);
      const siblings =
        release === undefined ? [] : await store.listCopiesInReleaseGroup(release.albumId);
      const releases = await store.getReleases(siblings.map((sibling) => sibling.releaseId));

      return {
        copy,
        release,
        otherCopies: siblings
          .filter((sibling) => sibling.id !== copy.id)
          .map((sibling) => ({ copy: sibling, release: releases.get(sibling.releaseId) })),
      };
    },
  });

  useCoverThemeEnrichment(detailQuery.data?.release);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["copy", copyId] });
    await queryClient.invalidateQueries({ queryKey: ["copies"] });
    await queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  const save = useMutation({
    mutationFn: async (patch: Partial<CopyDraft>) => {
      const copy = await store.getCopy(copyId);
      if (copy === undefined) return;
      await store.putCopy(applyCopyPatch(copy, patch, clock));
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async () => {
      const copy = await store.getCopy(copyId);
      if (copy === undefined) return;
      await store.putCopy(tombstoneCopy(copy, clock, Date.now()));
    },
    onSuccess: async () => {
      await invalidate();
      router.replace("/");
    },
  });

  return {
    data: detailQuery.data ?? null,
    loading: detailQuery.isLoading,
    save: (patch: Partial<CopyDraft>) => save.mutate(patch),
    saving: save.isPending,
    remove: () => remove.mutate(),
    removing: remove.isPending,
  };
}

/**
 * Fills in a release's cover theme in the background, once.
 *
 * The palette is only sampled server-side on the detail lookup, so a release cached from a
 * search arrives without one. Fetching it costs a round trip and, on a cover the server has
 * never sampled, several seconds of image fetch and decode — which is why it happens beside
 * the screen rather than in front of it. The screen renders in its neutral paper chrome and
 * takes on the sleeve's colour when the answer lands.
 *
 * `staleTime: Infinity` is what keeps it to once: a release whose cover genuinely has no
 * palette still comes back with a null theme, and without this every reopen would ask again.
 */
export function useCoverThemeEnrichment(release: Release | undefined): void {
  const { store } = useStore();
  const queryClient = useQueryClient();

  useQuery({
    queryKey: ["coverTheme", release?.id],
    enabled: release !== undefined && release.coverTheme === null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
    queryFn: async () => {
      if (release === undefined) return null;
      const enriched = await lookupRelease(release.id).catch(() => null);
      if (enriched === null || enriched.coverTheme === null) return null;
      await store.cacheReleases([enriched]);
      // Only now, and only when something actually changed, does the screen re-read.
      await queryClient.invalidateQueries({ queryKey: ["copy"] });
      return enriched;
    },
  });
}
