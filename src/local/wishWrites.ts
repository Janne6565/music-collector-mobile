/*
 * MIRROR of music-collector-frontend/src/local/wishWrites.ts
 *
 * The web and mobile apps must agree exactly on the domain shape, the write path and the
 * merge, or the same collection would converge differently depending on which device
 * synced last. Change both, in the same commit.
 */
import { hlcEncode } from "@/domain/hlc";
import type { Format, WishlistItem } from "@/domain/types";
import { WISH_MERGEABLE_FIELDS } from "@/domain/types";
import type { ClockSource } from "@/local/copyWrites";

export interface WishDraft {
  readonly albumId: string;
  readonly title: string;
  readonly artistName: string;
  readonly year: number | null;
  readonly desiredFormat: Format | null;
  readonly note: string | null;
}

/** Stamps every mergeable field, for the same reason a copy does: an unstamped field is
 * indistinguishable from an infinitely old one at merge time. */
export function createWishlistItem(
  draft: WishDraft,
  clock: ClockSource,
  now: number,
  id: string,
): WishlistItem {
  const stamp = hlcEncode(clock.next());
  const fieldClocks = Object.fromEntries(
    WISH_MERGEABLE_FIELDS.map((field) => [field, stamp]),
  ) as WishlistItem["fieldClocks"];

  return { id, ...draft, createdAt: now, deletedAt: null, fieldClocks };
}

/** Restamps only what changed, so concurrent edits to different fields both survive. */
export function applyWishPatch(
  item: WishlistItem,
  patch: Partial<WishDraft>,
  clock: ClockSource,
): WishlistItem {
  const changed = (Object.keys(patch) as (keyof WishDraft)[]).filter(
    (key) => patch[key] !== undefined && patch[key] !== item[key],
  );
  if (changed.length === 0) return item;

  const stamp = hlcEncode(clock.next());
  const fieldClocks = { ...item.fieldClocks };
  const updated: Record<string, unknown> = { ...item };
  for (const key of changed) {
    fieldClocks[key] = stamp;
    updated[key] = patch[key];
  }
  return { ...updated, fieldClocks } as WishlistItem;
}

/** A delete is a stamped write of a tombstone, exactly as it is for a copy. */
export function tombstoneWishlistItem(
  item: WishlistItem,
  clock: ClockSource,
  now: number,
): WishlistItem {
  return {
    ...item,
    deletedAt: now,
    fieldClocks: { ...item.fieldClocks, deletedAt: hlcEncode(clock.next()) },
  };
}
