import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useCallback } from "react";
import type { CatalogArtChoice, Photo } from "@janne6565/music-collector-shared";
import {
  applyCopyPatch,
  createPhoto,
  reorderPhoto,
  tombstonePhoto,
} from "@janne6565/music-collector-shared";
import { useStore } from "@/local/StoreProvider";
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
    // Same reason as the detail read: swiping between copies must not empty the strip for
    // a frame on its way to filling it again.
    placeholderData: keepPreviousData,
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

  /*
   * Which picture stands for this copy is two writes, not one — the same pair the web
   * makes, and for the same reason. Order is what a star sets, because the preview is the
   * first photo; but the catalogue's artwork is not a photo and has no position to be
   * moved to, so preferring it is a field on the copy instead.
   */
  const copy = useQuery({
    queryKey: ["copy", copyId, "catalogArt"],
    queryFn: () => store.getCopy(copyId),
  });
  const catalogArt: CatalogArtChoice = copy.data?.catalogArt ?? "AUTO";

  const invalidatePreview = async () => {
    await queryClient.invalidateQueries({ queryKey: ["photos", copyId] });
    await queryClient.invalidateQueries({ queryKey: ["copy", copyId] });
    // The shelf reads the preview out of this list too.
    await queryClient.invalidateQueries({ queryKey: ["cover-photos"] });
  };

  const move = useMutation({
    mutationFn: async ({ photoId, to }: { photoId: string; to: number }) => {
      const current = await store.listPhotos(copyId);
      const from = current.findIndex((photo) => photo.id === photoId);
      if (from === -1 || from === to) return;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (moved === undefined) return;
      next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
      for (const [index, photo] of next.entries()) {
        const renumbered = reorderPhoto(photo, index, clock);
        // Identity, not equality: reorderPhoto hands back the same object when the index
        // did not change, so an untouched photo is never restamped into winning a merge.
        if (renumbered !== photo) await store.putPhoto(renumbered);
      }
    },
    onSuccess: invalidatePreview,
  });

  const chooseCatalogArt = useMutation({
    mutationFn: async (choice: CatalogArtChoice) => {
      const current = await store.getCopy(copyId);
      if (current === undefined) return;
      // applyCopyPatch restamps nothing when the value is unchanged, so choosing what is
      // already chosen does not start winning merges against real edits.
      await store.putCopy(applyCopyPatch(current, { catalogArt: choice }, clock));
    },
    onSuccess: invalidatePreview,
  });

  const first = photos.data?.[0];

  return {
    photos: photos.data ?? [],
    /**
     * The first photo of this copy — its preview, which outranks the catalogue's artwork
     * rather than standing in for it. Pass it through `copyPreviewSrc`, which is null
     * when the catalogue art has been starred instead.
     */
    firstUri: first === undefined ? null : store.photoUri(first.id),
    uriFor: useCallback((photo: Photo) => store.photoUri(photo.id), [store]),
    add: (source: PhotoSource) => add.mutate(source),
    adding: add.isPending,
    remove: (photo: Photo) => remove.mutate(photo),
    removing: remove.isPending ? remove.variables?.id : undefined,
    catalogArt,
    /**
     * Star one of this copy's own photos: to the front, and off the catalogue.
     *
     * Both halves, exactly as the web writes them. Starring a photo is not a reason to
     * un-hide the artwork, so a copy that has hidden it keeps that answer.
     */
    star: (photo: Photo) => {
      move.mutate({ photoId: photo.id, to: 0 });
      if (catalogArt === "PREFERRED") chooseCatalogArt.mutate("AUTO");
    },
    /** Star the release's own artwork instead — the one choice order cannot express. */
    starCatalogArt: () => chooseCatalogArt.mutate("PREFERRED"),
    hideCatalogArt: () => chooseCatalogArt.mutate("HIDDEN"),
    restoreCatalogArt: () => chooseCatalogArt.mutate("AUTO"),
    choosing: move.isPending || chooseCatalogArt.isPending,
  };
}
