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

  const detailQuery = useQuery<DetailData | null>({
    queryKey: ["copy", copyId],
    queryFn: async () => {
      const copy = await store.getCopy(copyId);
      if (copy === undefined) return null;

      let release = await store.getRelease(copy.releaseMbid);
      // The cover theme is only computed server-side on the detail lookup, so a release
      // cached from a search has none yet. Fetch it once, then it is local forever.
      if (release !== undefined && release.coverTheme === null) {
        const enriched = await lookupRelease(copy.releaseMbid).catch(() => null);
        if (enriched !== null) {
          await store.cacheReleases([enriched]);
          release = enriched;
        }
      }

      const siblings =
        release === undefined ? [] : await store.listCopiesInReleaseGroup(release.releaseGroupMbid);
      const releases = await store.getReleases(siblings.map((sibling) => sibling.releaseMbid));

      return {
        copy,
        release,
        otherCopies: siblings
          .filter((sibling) => sibling.id !== copy.id)
          .map((sibling) => ({ copy: sibling, release: releases.get(sibling.releaseMbid) })),
      };
    },
  });

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
