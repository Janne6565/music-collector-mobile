import { useStore } from "@/local/StoreProvider";
import { useQuery } from "@tanstack/react-query";

/**
 * Each copy's own photo, as a file URI an Image can render.
 *
 * The library grid draws the same preview the detail hero does: the copy's own picture
 * first, and the archive's cover behind it. Cheap here — the bytes are already files, so
 * this is one query and no reading.
 *
 * A photo pulled from another device has a row but no file yet; the URI is handed over
 * anyway and `ReleaseArt` falls through to the catalogue cover, then the placeholder,
 * when it fails to load — the same thing the strip does.
 *
 * Mirrored from rekordo-frontend/src/features/photos/useCoverPhotos.ts, which has
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
