import type { LocalStore } from "@janne6565/music-collector-shared";

/**
 * The phone's half of the archive's byte seam.
 *
 * React Native's `Blob` is a handle into a native registry with no way to read it in
 * JavaScript, so `getPhotoBytes` is no use to the exporter here — it reads the file the
 * store already keeps on disk instead. The web app has the same file reading Dexie's row,
 * which is why `exportMcArchive` asks for a reader rather than calling the store itself.
 */
interface RawPhotoBytes {
  photoBuffer(id: string): Promise<Uint8Array | undefined>;
}

export async function readPhotoBytes(
  store: LocalStore,
  photoId: string,
): Promise<Uint8Array | undefined> {
  const raw = store as Partial<RawPhotoBytes>;
  return typeof raw.photoBuffer === "function" ? await raw.photoBuffer(photoId) : undefined;
}
