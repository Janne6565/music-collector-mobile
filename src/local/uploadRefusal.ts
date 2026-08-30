import type { LocalStore } from "@janne6565/rekordo-shared";

/**
 * Why the last photo upload was turned away, as the sync engine recorded it.
 *
 * The engine writes this (shared `sync/uploadRefusal.ts`); this reads it. Deliberately a
 * local copy of the key and the parse rather than an import, because the engine's half is
 * newer than the shared version this app installs. When the package next ships, this file
 * becomes a re-export and nothing else moves.
 */
const PHOTO_UPLOAD_REFUSAL = "photo.upload.refusal";

/** The `at` of the refusal already shown in a sheet, so it is shown once and not on every launch. */
const PHOTO_UPLOAD_REFUSAL_SEEN = "photo.upload.refusal.seen";

export type UploadRefusalReason = "full" | "tooLarge";

export interface UploadRefusal {
  readonly reason: UploadRefusalReason;
  readonly photoId: string;
  readonly at: number;
}

export async function readUploadRefusal(store: LocalStore): Promise<UploadRefusal | null> {
  const raw = await store.readSetting(PHOTO_UPLOAD_REFUSAL);
  if (raw === undefined || raw === "") return null;
  try {
    const parsed = JSON.parse(raw) as Partial<UploadRefusal>;
    if (parsed.reason !== "full" && parsed.reason !== "tooLarge") return null;
    if (typeof parsed.photoId !== "string" || typeof parsed.at !== "number") return null;
    return { reason: parsed.reason, photoId: parsed.photoId, at: parsed.at };
  } catch {
    return null;
  }
}

/**
 * Whether this refusal still owes somebody a sheet.
 *
 * Keyed on the refusal's timestamp rather than a boolean: a second refusal after a
 * successful upload is news again, and a flag would have swallowed it.
 */
export async function refusalNeedsSheet(
  store: LocalStore,
  refusal: UploadRefusal,
): Promise<boolean> {
  const seen = await store.readSetting(PHOTO_UPLOAD_REFUSAL_SEEN);
  return seen !== String(refusal.at);
}

export async function markRefusalSeen(store: LocalStore, refusal: UploadRefusal): Promise<void> {
  await store.writeSetting(PHOTO_UPLOAD_REFUSAL_SEEN, String(refusal.at));
}
