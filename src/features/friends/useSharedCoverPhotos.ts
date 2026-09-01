import type { SharedCopy } from "@/api/friends";
import { downloadPhotoBytes } from "@/api/photos";
import { encodeBase64 } from "@/local/sqliteStore";
import { useQuery } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system/legacy";

/**
 * Where somebody else's pictures are kept.
 *
 * Deliberately not the store's own photo directory. These belong to another collection:
 * putting them there would make them look like this device's photos to the sync sweep, the
 * archive export and everything else that walks that folder. A cache directory says what
 * they are — droppable, re-fetchable, nobody's record of anything.
 */
const SHARED_DIR = `${FileSystem.cacheDirectory ?? ""}shared-covers/`;

/**
 * The photos on somebody else's shelf, as file URIs an Image can render.
 *
 * The sibling of `useCoverPhotos`, which reads the same kind of picture out of the local
 * store — that one cannot serve here, because a viewer holds none of the owner's bytes.
 * These arrive over `/api/v1/photos/{id}/content`, which is authorised per request against
 * the owner's sharing settings.
 *
 * Fetched through the API client rather than pointed at with a bare URI: a friends-only
 * shelf needs the viewer's token on the request, and an Image source cannot carry one.
 * Only copies the server named a photo for cost anything.
 */
export function useSharedCoverPhotos(copies: readonly SharedCopy[]): ReadonlyMap<string, string> {
  // Keyed on the pairs rather than the array, so the query re-runs when the set of photos
  // on screen changes rather than on every render.
  const pairs = copies
    .filter((copy) => copy.id !== undefined && copy.previewPhotoId !== undefined)
    .map((copy) => `${copy.id}:${copy.previewPhotoId}`)
    .sort();

  const photos = useQuery({
    queryKey: ["shared-cover-photos", pairs.join(",")],
    enabled: pairs.length > 0,
    queryFn: async () => {
      await FileSystem.makeDirectoryAsync(SHARED_DIR, { intermediates: true }).catch(() => {});
      const built = new Map<string, string>();
      for (const pair of pairs) {
        const [copyId, photoId] = pair.split(":");
        if (copyId === undefined || photoId === undefined) continue;
        const path = `${SHARED_DIR}${photoId}`;
        if ((await FileSystem.getInfoAsync(path)).exists) {
          built.set(copyId, path);
          continue;
        }
        // A refusal is a 404 by design, and a shelf with one unreadable picture is still a
        // shelf: that tile falls back to the catalogue cover rather than the page failing.
        const bytes = await downloadPhotoBytes(photoId).catch(() => null);
        if (bytes === null) continue;
        await FileSystem.writeAsStringAsync(path, encodeBase64(bytes), {
          encoding: FileSystem.EncodingType.Base64,
        });
        built.set(copyId, path);
      }
      return built;
    },
  });

  return photos.data ?? EMPTY;
}

const EMPTY: ReadonlyMap<string, string> = new Map();
