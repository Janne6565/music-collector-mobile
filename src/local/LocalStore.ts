/*
 * MIRROR of music-collector-frontend/src/local/LocalStore.ts
 *
 * The web and mobile apps implement the same interface, over IndexedDB and SQLite
 * respectively, so a screen written against it ports unchanged. Change both together.
 */
import type { CollectionStats, Copy, Format, Release, WishlistItem } from "@/domain/types";

export interface LibraryFilter {
  readonly format?: Format | "ALL";
  readonly search?: string;
  readonly sort?: "ADDED_DESC" | "ARTIST_ASC" | "YEAR_DESC";
}

/**
 * Everything the app reads and writes. There is no API behind this in phase 2 — the local
 * store *is* the source of truth, and the sync engine (phase 3) will reconcile it with the
 * server without any screen needing to know.
 *
 * The mobile app implements the same interface over expo-sqlite. Keep the two in step: a
 * screen written against this should port with no changes to its data access.
 */
export interface LocalStore {
  /** Idempotent; safe to call on every start. */
  open(): Promise<void>;

  listCopies(filter?: LibraryFilter): Promise<Copy[]>;
  getCopy(id: string): Promise<Copy | undefined>;
  /** Tombstones included — sync has to be able to push a delete. */
  getCopyIncludingDeleted(id: string): Promise<Copy | undefined>;
  /** Copies of the same album, for the detail screen's "other copies you own". */
  listCopiesInReleaseGroup(releaseGroupMbid: string): Promise<Copy[]>;
  /**
   * A local write. Records the copy as pending, so nothing has to remember to do that at
   * the call site — a write that forgot would simply never reach the server.
   */
  putCopy(copy: Copy): Promise<void>;
  /** A write that came from sync. Deliberately does not mark the copy pending, or the
   * client would push straight back what it just pulled, forever. */
  adoptCopy(copy: Copy): Promise<void>;

  // There is deliberately no deleteCopy here. A delete is an ordinary write of a
  // tombstone, stamped by `tombstoneCopy`, and it goes through putCopy like any other
  // edit. An unstamped delete would lose every merge and the copy would come back.

  cacheReleases(releases: readonly Release[]): Promise<void>;
  getRelease(mbid: string): Promise<Release | undefined>;
  getReleases(mbids: readonly string[]): Promise<Map<string, Release>>;

  listWishlist(): Promise<WishlistItem[]>;
  putWishlistItem(item: WishlistItem): Promise<void>;
  softDeleteWishlistItem(id: string, at: number): Promise<void>;

  stats(): Promise<CollectionStats>;

  /**
   * Stable per-installation id. It is the tie-breaker in every field-level merge, so it
   * must survive reloads — a device that reinvents its id on every start would make
   * conflict resolution non-deterministic.
   */
  deviceId(): Promise<string>;
  /** The device's HLC, persisted so it never goes backwards across a restart. */
  readClock(): Promise<string | undefined>;
  writeClock(encoded: string): Promise<void>;

  /** How far through the server's change log this device has read. */
  readSyncCursor(): Promise<number>;
  writeSyncCursor(cursor: number): Promise<void>;
  /** Ids written locally since the last successful push. */
  readPendingIds(): Promise<string[]>;
  writePendingIds(ids: readonly string[]): Promise<void>;
}
