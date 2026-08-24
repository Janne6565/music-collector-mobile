/*
 * MIRROR of music-collector-frontend/src/local/LocalStore.ts
 *
 * The web and mobile apps must agree exactly on the clock, the domain shape and the write
 * path, or the same collection would merge differently depending on which device synced
 * last. These files are copied verbatim for now; phase 3 extracts them into a shared
 * package alongside the merge function. Until then: change both, in the same commit.
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
  /** Copies of the same album, for the detail screen's "other copies you own". */
  listCopiesInReleaseGroup(releaseGroupMbid: string): Promise<Copy[]>;
  putCopy(copy: Copy): Promise<void>;
  /** Writes a tombstone rather than removing the row, so a delete can sync. */
  softDeleteCopy(id: string, at: number): Promise<void>;

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
}
