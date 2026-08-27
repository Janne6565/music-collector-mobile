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
 * How many pictures this device knows about but is not holding — a development diagnostic.
 *
 * The engine sweeps for these itself and says nothing about it, so when a shelf shows the
 * wrong cover there is no way to tell a download that is not happening from an image that
 * is not being redrawn. This separates the two: still missing afterwards means the fetch
 * is the problem, none missing means the display is.
 */
export async function countPhotosMissingBytes(store: NativeLocalStore): Promise<number> {
  let missing = 0;
  for (const photo of await store.listAllPhotos()) {
    if (photo.storageKey === null || photo.deletedAt !== null) continue;
    if (!(await store.hasPhotoBytes(photo.id))) missing += 1;
  }
  return missing;
}
