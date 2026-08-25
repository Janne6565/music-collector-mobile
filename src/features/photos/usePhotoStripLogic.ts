import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useCallback } from "react";
import type { Photo } from "@/domain/types";
import { useStore } from "@/local/StoreProvider";
import { createPhoto, tombstonePhoto } from "@/local/photoWrites";

export type PhotoSource = "CAMERA" | "LIBRARY";

/**
 * Photos of your own copy.
 *
 * On a phone the camera is the point — you are holding the record — so taking one is a
 * first-class action rather than a file picker afterthought.
 */
export type PhotoStripLogic = ReturnType<typeof usePhotoStripLogic>;

export function usePhotoStripLogic(copyId: string) {
  const { store, clock } = useStore();
  const queryClient = useQueryClient();

  const photos = useQuery({
    queryKey: ["photos", copyId],
    queryFn: () => store.listPhotos(copyId),
  });

  const add = useMutation({
    mutationFn: async (source: PhotoSource) => {
      const result =
        source === "CAMERA"
          ? await ImagePicker.launchCameraAsync({ quality: 0.8, mediaTypes: ["images"] })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ["images"] });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (asset === undefined) return;

      const id = Crypto.randomUUID();
      // Copied into the app's own storage rather than referenced where the picker left it:
      // a cache URI can be cleared by the OS at any time, taking the photo with it.
      await FileSystem.copyAsync({ from: asset.uri, to: store.photoUri(id) }).catch(async () => {
        await FileSystem.makeDirectoryAsync(store.photoUri("").replace(/[^/]*$/, ""), {
          intermediates: true,
        });
        await FileSystem.copyAsync({ from: asset.uri, to: store.photoUri(id) });
      });

      await store.putPhoto(
        createPhoto(
          {
            copyId,
            contentType: asset.mimeType ?? "image/jpeg",
            byteSize: asset.fileSize ?? 0,
            sortIndex: photos.data?.length ?? 0,
          },
          clock,
          Date.now(),
          id,
        ),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["photos", copyId] });
    },
  });

  const remove = useMutation({
    mutationFn: async (photo: Photo) => {
      await store.putPhoto(tombstonePhoto(photo, clock, Date.now()));
      await store.deletePhotoBytes(photo.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["photos", copyId] });
    },
  });

  const first = photos.data?.[0];

  return {
    photos: photos.data ?? [],
    /**
     * The first photo, for the detail hero to stand in with when the release has no
     * artwork of its own.
     */
    firstUri: first === undefined ? null : store.photoUri(first.id),
    uriFor: useCallback((photo: Photo) => store.photoUri(photo.id), [store]),
    add: (source: PhotoSource) => add.mutate(source),
    adding: add.isPending,
    remove: (photo: Photo) => remove.mutate(photo),
    removing: remove.isPending ? remove.variables?.id : undefined,
  };
}
