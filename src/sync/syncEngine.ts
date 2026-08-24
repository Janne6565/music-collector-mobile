/*
 * MIRROR of music-collector-frontend/src/sync/syncEngine.ts, with the generated Orval
 * client swapped for the mobile fetch client. The reconciliation logic must stay identical
 * — change both together.
 */
import { pullChanges, pushChanges } from "@/api/sync";
import { mergeCopies, mergeWishlistItems } from "@/domain/merge";
import type { Copy, WishlistItem } from "@/domain/types";
import type { LocalStore } from "@/local/LocalStore";
import { type ClockSource, tombstoneCopy } from "@/local/copyWrites";
import { tombstoneWishlistItem } from "@/local/wishWrites";

/**
 * Reconciles the local store with the server.
 *
 * Sync is deliberately not in the read path: screens always read local, and this runs
 * alongside them. That is what lets the app work identically with and without an account —
 * and it is why turning sync off, or losing the network, changes nothing about what the
 * user can do.
 */

/** How the very first sync after signing in should treat the two collections. */
export type FirstSyncStrategy = "MERGE" | "KEEP_LOCAL" | "KEEP_ACCOUNT";

export interface SyncResult {
  readonly pulled: number;
  readonly pushed: number;
  readonly cursor: number;
}

export class SyncEngine {
  constructor(
    private readonly store: LocalStore,
    private readonly clock: ClockSource,
  ) {}

  /**
   * Deletes go through the same stamped write path as any other edit. An unstamped
   * tombstone would lose every merge, and the copy would reappear on the next sync.
   */
  private async discard(copy: Copy, now: number): Promise<void> {
    await this.store.putCopy(tombstoneCopy(copy, this.clock, now));
  }

  /**
   * Signing in for the first time on a device that already has a collection.
   *
   * Nothing happens until the person chooses, because every option here is destructive in
   * one direction or another and none of them should be picked on their behalf.
   */
  async firstSync(strategy: FirstSyncStrategy): Promise<SyncResult> {
    if (strategy === "KEEP_ACCOUNT") {
      // Drop the local collection by tombstoning it, so the discard itself replicates
      // rather than leaving the records to come back from another device later.
      const now = Date.now();
      for (const copy of await this.store.listCopies()) {
        await this.discard(copy, now);
      }
      for (const wish of await this.store.listWishlist()) {
        await this.store.putWishlistItem(tombstoneWishlistItem(wish, this.clock, now));
      }
      await this.store.writePendingIds([]);
      return this.sync();
    }

    if (strategy === "KEEP_LOCAL") {
      // Snapshot what is local *before* pulling. Reading it afterwards would count the
      // account's records as local and keep exactly what this option is meant to discard.
      const localIds = new Set(await this.allCopyIds());

      const pulled = await this.pullAll();
      const now = Date.now();
      for (const copy of pulled.copies) {
        if (!localIds.has(copy.id) && copy.deletedAt === null) {
          await this.discard(copy, now);
        }
      }
      for (const wish of pulled.wishes) {
        if (!localIds.has(wish.id) && wish.deletedAt === null) {
          await this.store.putWishlistItem(tombstoneWishlistItem(wish, this.clock, now));
        }
      }
      await this.store.writePendingIds(await this.allCopyIds());
      return this.sync();
    }

    await this.store.writePendingIds(await this.allCopyIds());
    return this.sync();
  }

  /** A normal incremental sync: pull what is new, push what changed locally. */
  async sync(): Promise<SyncResult> {
    const pulled = await this.pullAll();
    const pushed = await this.pushPending();
    return {
      pulled: pulled.copies.length + pulled.wishes.length,
      pushed,
      cursor: await this.store.readSyncCursor(),
    };
  }

  private async pullAll(): Promise<{ copies: Copy[]; wishes: WishlistItem[] }> {
    const applied: Copy[] = [];
    const appliedWishes: WishlistItem[] = [];
    let cursor = await this.store.readSyncCursor();
    let hasMore = true;

    while (hasMore) {
      const page = await pullChanges(cursor);
      for (const remote of page.wishes) {
        const local = await this.store.getWishlistItemIncludingDeleted(remote.id);
        const merged = mergeWishlistItems(local, remote);
        await this.store.adoptWishlistItem(merged);
        appliedWishes.push(merged);
      }
      for (const remote of page.copies) {
        // Tombstones included. Looking this up with getCopy would hide a locally deleted
        // copy, make the server's live version look like a record we had never seen, and
        // adopt it wholesale — resurrecting every delete on the next sync.
        const local = await this.store.getCopyIncludingDeleted(remote.id);
        const merged = mergeCopies(local, remote);
        await this.store.adoptCopy(merged);
        applied.push(merged);
      }
      cursor = page.cursor;
      hasMore = page.hasMore;
      await this.store.writeSyncCursor(cursor);
    }
    return { copies: applied, wishes: appliedWishes };
  }

  private async pushPending(): Promise<number> {
    const pendingIds = await this.store.readPendingIds();
    if (pendingIds.length === 0) return 0;

    // One pending set covers both kinds, so a session that added a record and wished for
    // another sends a single request rather than racing two.
    const copies: Copy[] = [];
    const wishes: WishlistItem[] = [];
    for (const id of pendingIds) {
      const copy = await this.store.getCopyIncludingDeleted(id);
      if (copy !== undefined) {
        copies.push(copy);
        continue;
      }
      const wish = await this.store.getWishlistItemIncludingDeleted(id);
      if (wish !== undefined) wishes.push(wish);
    }
    if (copies.length === 0 && wishes.length === 0) {
      await this.store.writePendingIds([]);
      return 0;
    }

    const response = await pushChanges(copies, wishes);
    // Adopt whatever the server decided, so the two sides are byte-identical afterwards
    // and the next push does not resend the same records.
    for (const merged of response.copies) {
      await this.store.adoptCopy(merged);
    }
    for (const merged of response.wishes) {
      await this.store.adoptWishlistItem(merged);
    }
    if (response.cursor > 0) {
      await this.store.writeSyncCursor(response.cursor);
    }
    await this.store.writePendingIds([]);
    return copies.length + wishes.length;
  }

  /** Everything the device holds, of both kinds — they share one pending set. */
  private async allCopyIds(): Promise<string[]> {
    const copies = await this.store.listCopies();
    const wishes = await this.store.listWishlist();
    return [...copies.map((copy) => copy.id), ...wishes.map((wish) => wish.id)];
  }
}
