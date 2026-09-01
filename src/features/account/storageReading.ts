import type { StorageUsage } from "@/api/storage";

/**
 * What the storage meter says, derived from the server's four numbers (design 28c).
 *
 * A pure function on purpose: the row has eight readings and only two of them are the
 * ordinary case, so the interesting part is the arithmetic and it is worth testing without
 * a screen. The component's whole job is to draw whatever comes out of here.
 *
 * Deliberately a copy of the web's module rather than a shared export. It is forty lines of
 * arithmetic against a DTO both clients already have, and the shared package costs a publish
 * and two installs to change; the tests either side are what keep the two honest.
 */

/**
 * A scaled sleeve photo, as both clients now write them: 1600px long edge at JPEG 0.82.
 *
 * Only ever used for the words "about 8 more photos", never to decide whether an upload
 * fits -- the server owns that, and it counts bytes. An estimate is the honest shape here
 * anyway: nobody can say what their next photograph will weigh.
 */
const TYPICAL_PHOTO_BYTES = 320_000;

/**
 * Where "nearly full" begins: the point at which what is left is countable in photos.
 *
 * A fraction of the quota would have been the obvious rule and is the wrong one. The
 * sentence this triggers says "room for about N more photos", and that sentence stops being
 * useful long before it stops being true, so the threshold is the number of photos rather
 * than a percentage.
 */
const NEARLY_FULL_BYTES = 3 * 1024 * 1024;

const MB = 1024 * 1024;

export type StorageReading =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "empty"; readonly freeBytes: number }
  | {
      readonly kind: "normal";
      readonly photos: number;
      readonly used: number;
      readonly quota: number;
    }
  | {
      readonly kind: "nearlyFull";
      readonly photos: number;
      readonly used: number;
      readonly quota: number;
      readonly roomForPhotos: number;
    }
  | {
      readonly kind: "full";
      readonly photos: number;
      readonly used: number;
      readonly quota: number;
    }
  | {
      readonly kind: "over";
      readonly photos: number;
      readonly used: number;
      readonly quota: number;
      readonly overBy: number;
    };

/** How much of the track is ink. Never past 100: over its own end is drawn differently. */
export function fillPercent(reading: StorageReading): number {
  if (!("used" in reading)) return 0;
  return Math.min(100, (reading.used / reading.quota) * 100);
}

/**
 * Where the 20 MB tick sits once the bar has outgrown it (28c state 7).
 *
 * Past the allowance the scale flips: the full width becomes what is stored, so the tick
 * has to move to keep meaning the same thing it always meant.
 */
export function tickPercent(reading: StorageReading): number {
  return reading.kind === "over" ? (reading.quota / reading.used) * 100 : 100;
}

export function readStorage(usage: StorageUsage): StorageReading {
  const used = usage.usedBytes;
  const quota = usage.quotaBytes;
  const photos = usage.photoCount;
  // A quota of zero would be a misconfigured server; drawing a bar against it divides by
  // zero, and "offline" is the reading that already means "no number to show".
  if (quota <= 0) return { kind: "offline" };

  // Checked before anything else, including "over": an account with no photos has nothing
  // to delete, so every sentence about deleting would be advice it cannot take. Only a
  // profile picture can put such an account over, and 50 kB never will.
  if (photos === 0) return { kind: "empty", freeBytes: Math.max(0, quota - used) };

  if (used > quota) return { kind: "over", photos, used, quota, overBy: used - quota };

  const remaining = quota - used;
  const roomForPhotos = Math.floor(remaining / TYPICAL_PHOTO_BYTES);
  // "Full" is not "exactly at the line". An account with 100 kB left is full in the only
  // sense the person cares about: the next photograph will not fit.
  if (roomForPhotos === 0) return { kind: "full", photos, used, quota };
  if (remaining < NEARLY_FULL_BYTES) {
    return { kind: "nearlyFull", photos, used, quota, roomForPhotos };
  }
  return { kind: "normal", photos, used, quota };
}

/**
 * Megabytes as the row prints them: one decimal, and none at all when it would be a zero.
 *
 * "20.0 of 20 MB" reads as a measurement that happens to be round; "20 of 20 MB" reads as
 * full, which is what it is. Locale-aware because German writes 10,2.
 */
export function formatMegabytes(bytes: number, locale: string): string {
  const value = Math.round((bytes / MB) * 10) / 10;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}
