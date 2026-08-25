import type { LocalStore } from "@janne6565/music-collector-shared";

/**
 * The device's storage contract: the shared one, plus the one thing only a phone has.
 *
 * Photo bytes live in a real file on the device rather than in a blob store, and an
 * <Image> renders them straight from a `file://` URI. The web app has no equivalent and no
 * use for one, which is why this hangs off the shared interface instead of widening it.
 */
export interface NativeLocalStore extends LocalStore {
  /** The on-device file URI for one photo's bytes. */
  photoUri(id: string): string;
}

// Re-exported so the rest of the app keeps importing its storage contract from one place,
// whether the part it needs is shared or native.
export type { LibraryFilter, LocalStore } from "@janne6565/music-collector-shared";
