import type { LocalStore } from "@/local/LocalStore";
import type { WishSort } from "@janne6565/music-collector-shared";
import { parseWishSort } from "@janne6565/music-collector-shared";

/**
 * The handful of device-local preferences the account screen exposes.
 *
 * They live in the local store rather than in Redux because they have to survive a reload
 * before the session is restored — the sync loop consults `syncEnabled` on the first tick,
 * which happens well before any screen has rendered.
 */

const SYNC_ENABLED = "syncEnabled";
const LAST_SYNCED_AT = "lastSyncedAt";
/** The last few things typed into the add search, newest first. */
const RECENT_SEARCHES = "recentSearches";
const RECENT_SEARCH_LIMIT = 6;
/**
 * How the wishlist is ordered on this device.
 *
 * A preference, not synced data — unlike the hand-built order itself, which is a
 * `sortIndex` on every entry. Which column you happen to be reading a list by is a fact
 * about the screen in front of you; where you dragged a row to is a fact about the list.
 */
const WISHLIST_SORT = "wishlistSort";

/** Defaults to on: someone who signed in asked for sync, and asked for it silently. */
export async function readSyncEnabled(store: LocalStore): Promise<boolean> {
  return (await store.readSetting(SYNC_ENABLED)) !== "false";
}

export async function writeSyncEnabled(store: LocalStore, enabled: boolean): Promise<void> {
  await store.writeSetting(SYNC_ENABLED, enabled ? "true" : "false");
}

export async function readLastSyncedAt(store: LocalStore): Promise<number | null> {
  const raw = await store.readSetting(LAST_SYNCED_AT);
  if (raw === undefined) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function writeLastSyncedAt(store: LocalStore, at: number): Promise<void> {
  await store.writeSetting(LAST_SYNCED_AT, String(at));
}

export async function readRecentSearches(store: LocalStore): Promise<string[]> {
  const raw = await store.readSetting(RECENT_SEARCHES);
  if (raw === undefined) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((term): term is string => typeof term === "string")
      : [];
  } catch {
    // A preference that fails to parse is not worth an error path; an empty list is the
    // same thing the person saw before they had ever searched.
    return [];
  }
}

/** Most recent first, de-duplicated case-insensitively, capped. */
export async function rememberSearch(store: LocalStore, term: string): Promise<void> {
  const trimmed = term.trim();
  if (trimmed === "") return;
  const existing = await readRecentSearches(store);
  const kept = existing.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase());
  await store.writeSetting(
    RECENT_SEARCHES,
    JSON.stringify([trimmed, ...kept].slice(0, RECENT_SEARCH_LIMIT)),
  );
}

export async function clearRecentSearches(store: LocalStore): Promise<void> {
  await store.writeSetting(RECENT_SEARCHES, "[]");
}

export async function readWishlistSort(store: LocalStore): Promise<WishSort> {
  return parseWishSort(await store.readSetting(WISHLIST_SORT));
}

export async function writeWishlistSort(store: LocalStore, sort: WishSort): Promise<void> {
  await store.writeSetting(WISHLIST_SORT, sort);
}
