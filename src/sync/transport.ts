import * as FileSystem from "expo-file-system/legacy";
import { downloadPhotoBytes, uploadPhotoBytes } from "@/api/photos";
import { lookupReleases } from "@/api/releases";
import { pullChanges, pushChanges } from "@/api/sync";
import type { NativeLocalStore } from "@/local/LocalStore";
import type { ClockSource, SyncTransport } from "@janne6565/music-collector-shared";
import { SyncEngine } from "@janne6565/music-collector-shared";

/**
 * The device's half of sync.
 *
 * Reconciliation itself is in the shared package — one program for both apps rather than
 * two copies that drifted. What is left here is what a phone genuinely does differently:
 * its own fetch client, and photo bytes that move by file URI because that is what the
 * camera wrote and what an <Image> can render.
 */
export function createSyncTransport(store: NativeLocalStore): SyncTransport {
  return {
    pull: (cursor) => pullChanges(cursor),

    async push(copies, wishes, photos, releases) {
      // Only the ids actually going up, so a stale answer about a copy that is not in this
      // batch cannot ride along with it.
      const remembered = await store.readOrigins();
      const origins = Object.fromEntries(
        copies
          .map((copy) => copy.id)
          .filter((id) => remembered[id] !== undefined)
          .map((id) => [id, remembered[id]]),
      );

      const page = await pushChanges(copies, wishes, photos, releases, origins);

      // After the server has answered, never before: a push that failed has to be able to
      // say the same thing again.
      await store.forgetOrigins(Object.keys(origins));
      return page;
    },

    // Whichever owner the photo carries: the server takes one and refuses both.
    uploadPhoto: (photo) =>
      uploadPhotoBytes(
        photo.id,
        photo.copyId === null ? { wishId: photo.wishId as string } : { copyId: photo.copyId },
        store.photoUri(photo.id),
        photo.contentType,
      ),

    /**
     * The catalogue behind the copies that just arrived. It does not travel inside a sync
     * batch — a release is a shared cache, not somebody's record — so the engine asks for
     * it separately, and without this a phone that has only ever pulled shows a shelf of
     * untitled placeholders.
     */
    async fetchReleases(releaseIds) {
      return lookupReleases(releaseIds);
    },

    async downloadPhoto(photo) {
      await store.putPhotoBytes(photo.id, await downloadPhotoBytes(photo.id), photo.contentType);
    },
  };
}

/** The engine, wired to this app's transport. Every caller goes through here. */
export function createSyncEngine(store: NativeLocalStore, clock: ClockSource): SyncEngine {
  return new SyncEngine(store, clock, createSyncTransport(store));
}

/**
 * Bytes for pictures this device knows about but has never held.
 *
 * The shared engine already fetches these — but only for the photos pulled in the same
 * pass, so a row that arrived before its bytes did, or whose download failed once, is never
 * looked at again. Its comment says "try again next sync"; there was no next attempt,
 * because the photo cannot appear in a later pull.
 *
 * What that looks like is not a missing photo. `ReleaseArt` is handed a file URI for a file
 * that is not there, the image fails, and the copy quietly falls back to the catalogue's
 * cover — so a starred photo taken on another device shows the pressing's sleeve instead,
 * and a hand-entered record with no catalogue at all shows the silhouette for ever.
 *
 * Existence is checked with `getInfoAsync` rather than `getPhotoBytes`, which would read
 * every file on the device into base64 to answer a yes-or-no question.
 */
export async function fetchMissingPhotoBytes(store: NativeLocalStore): Promise<number> {
  let fetched = 0;
  for (const photo of await store.listAllPhotos()) {
    if (photo.storageKey === null || photo.deletedAt !== null) continue;
    if ((await FileSystem.getInfoAsync(store.photoUri(photo.id))).exists) continue;
    try {
      await store.putPhotoBytes(photo.id, await downloadPhotoBytes(photo.id), photo.contentType);
      fetched += 1;
    } catch {
      // Offline, or the object is gone. Next pass tries again — and now there really is one.
    }
  }
  return fetched;
}
