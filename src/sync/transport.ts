import { downloadPhotoBytes, uploadPhotoBytes } from "@/api/photos";
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

    push: (copies, wishes, photos) => pushChanges(copies, wishes, photos),

    uploadPhoto: (photo) =>
      uploadPhotoBytes(photo.id, photo.copyId, store.photoUri(photo.id), photo.contentType),

    async downloadPhoto(photo) {
      await store.putPhotoBytes(photo.id, await downloadPhotoBytes(photo.id), photo.contentType);
    },
  };
}

/** The engine, wired to this app's transport. Every caller goes through here. */
export function createSyncEngine(store: NativeLocalStore, clock: ClockSource): SyncEngine {
  return new SyncEngine(store, clock, createSyncTransport(store));
}
