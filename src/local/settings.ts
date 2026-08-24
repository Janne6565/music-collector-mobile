import type { LocalStore } from "@/local/LocalStore";

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
