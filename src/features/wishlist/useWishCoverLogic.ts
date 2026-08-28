import { useStore } from "@/local/StoreProvider";
import type { Photo } from "@janne6565/rekordo-shared";
import { createPhoto, tombstonePhoto } from "@janne6565/rekordo-shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { type PhotoSource, pickImage, storePhotoBytes } from "@/features/photos/pickImage";

/** Where a wish's picture comes from on a phone. The camera is first for the same reason
 * it is on a copy: you are often standing in front of the record. */
export type CoverSource = PhotoSource;

/**
 * The one picture a wishlist entry wears instead of the catalogue's answer (19b).
 *
 * Every entry may have one, not only a record no catalogue has: the mirror's answer is one
 * pressing's sleeve among several and often not the one being hunted for, and a wish is a
 * note to yourself — the picture on it should be the one you recognise the record by.
 *
 * The sibling of `usePhotoStripLogic`, minus the strip: an entry has one cover, not a roll
 * of photographs, so choosing a new one puts the old one down.
 */
export function useWishCoverLogic(wishId: string) {
  const { store, clock } = useStore();
  const queryClient = useQueryClient();

  const photo = useQuery({
    queryKey: ["wish-photo", wishId],
    queryFn: async () => (await store.listWishPhotos([wishId])).get(wishId) ?? null,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["wish-photo", wishId] });
    await queryClient.invalidateQueries({ queryKey: ["wish-photos"] });
  };

  const choose = useMutation({
    mutationFn: async (source: CoverSource) => {
      const picked = await pickImage(source);
      if (picked === null) return;

      const previous = photo.data ?? null;
      const id = Crypto.randomUUID();
      await storePhotoBytes(store, id, picked.uri);

      await store.putPhoto(
        createPhoto(
          {
            wishId,
            contentType: picked.contentType,
            byteSize: picked.byteSize,
            sortIndex: 0,
          },
          clock,
          Date.now(),
          id,
        ),
      );
      // Tombstoned rather than overwritten: a photo id points at one image forever, and
      // the new one's bytes have not been uploaded yet.
      if (previous !== null) await store.putPhoto(tombstonePhoto(previous, clock, Date.now()));
    },
    onSuccess: invalidate,
  });

  const drop = useMutation({
    mutationFn: async () => {
      const held: Photo | null = photo.data ?? null;
      if (held === null) return;
      await store.putPhoto(tombstonePhoto(held, clock, Date.now()));
      await store.deletePhotoBytes(held.id);
    },
    onSuccess: invalidate,
  });

  return {
    /** The picture this entry wears, or null when it wears the catalogue's answer. */
    uri: photo.data === null || photo.data === undefined ? null : store.photoUri(photo.data.id),
    has: (photo.data ?? null) !== null,
    choose: (source: CoverSource) => choose.mutate(source),
    drop: () => drop.mutate(),
    working: choose.isPending || drop.isPending,
  };
}
