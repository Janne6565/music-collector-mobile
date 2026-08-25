import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/local/StoreProvider";

/**
 * Each copy's own photo, as a file URI an Image can render.
 *
 * The library grid needs the same standing-in the detail hero does: a release the Cover
 * Art Archive never had still looks like a record on the shelf if its owner photographed
 * it. Cheap here — the bytes are already files, so this is one query and no reading.
 *
 * A photo pulled from another device has a row but no file yet; the URI is handed over
 * anyway and `ReleaseArt` falls back to the placeholder when it fails to load, which is
 * the same thing the strip does.
 *
 * Mirrored from music-collector-frontend/src/features/photos/useCoverPhotos.ts, which has
 * to build object URLs from IndexedDB blobs instead.
 */
export function useCoverPhotos(copyIds: readonly string[]): ReadonlyMap<string, string> {
  const { store } = useStore();

  const photos = useQuery({
    // Joined, so the key changes only when the set of copies on screen does — a new array
    // of the same ids on every render would otherwise refetch forever.
    queryKey: ["cover-photos", copyIds.join(",")],
    queryFn: async () => {
      const covers = await store.listCoverPhotos(copyIds);
      return new Map([...covers].map(([copyId, photo]) => [copyId, store.photoUri(photo.id)]));
    },
  });

  return photos.data ?? EMPTY;
}

const EMPTY: ReadonlyMap<string, string> = new Map();
