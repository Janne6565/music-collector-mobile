import { albumAsRelease } from "@/features/add/albumRelease";
import type { LocalStore, Release, WishlistItem } from "@janne6565/rekordo-shared";
import { catalogueKeyOf } from "@janne6565/rekordo-shared";

/**
 * Writes what a wishlist cover lookup learned into the same `releases` table copies read
 * from.
 *
 * A copy stores a release row and so keeps its sleeve when the mirror is unreachable; a
 * wish stored only ids, so its artwork was two live requests on every open and the whole
 * list went blank offline — while the shelf beside it, showing the same records, did not.
 * That asymmetry was never a decision, it fell out of one side caching and the other not.
 *
 * So the lookups now fill the cache rather than only answering the screen, and
 * `coverOf` falls back to it. Nothing new is stored: the row is the one a copy of the same
 * record would already have, which is why the second-device case comes out in the wash —
 * a wish and a copy of the same pressing now share one cached row.
 */
export async function cacheWishAlbums(
  store: LocalStore,
  items: readonly WishlistItem[],
  covers: ReadonlyMap<string, string | null>,
  cachedAt: number,
): Promise<void> {
  /*
   * Only the albums nothing is cached for yet.
   *
   * The covers endpoint answers with a URL and nothing else, so an album row has to be
   * built out of the wish's own facts — which are album-level and came from the same
   * catalogue, so they are the right ones. But they are the *wish's* copy of them, and
   * overwriting a row the mirror itself supplied would trade a full release for a
   * reconstruction. Absent is the only case where a reconstruction is an improvement.
   */
  const albumIds = [
    ...new Set(
      items
        .filter((item) => covers.get(item.albumId) != null)
        .map((item) => item.albumId)
        .filter((albumId) => albumId !== ""),
    ),
  ];
  if (albumIds.length === 0) return;

  const held = await store.getReleases(albumIds);
  const rows: Release[] = [];
  const written = new Set<string>();
  for (const item of items) {
    const cover = covers.get(item.albumId);
    if (cover == null || held.has(item.albumId) || written.has(item.albumId)) continue;
    written.add(item.albumId);
    rows.push(
      albumAsRelease(
        {
          albumId: item.albumId,
          title: item.title,
          artistName: item.artistName,
          year: item.year,
          // Only the artist screen sections by it, and a wish was never asked.
          primaryType: null,
          coverArtUrl: cover,
        },
        cachedAt,
      ),
    );
  }
  if (rows.length > 0) await store.cacheReleases(rows);
}

/** The cached sleeve for a wish, or null when nothing has ever been fetched for it. */
export function cachedCoverOf(
  item: Pick<WishlistItem, "releaseId" | "albumId">,
  cached: ReadonlyMap<string, Release> | undefined,
): string | null {
  const key = catalogueKeyOf(item);
  if (key === null || cached === undefined) return null;
  return cached.get(key)?.coverArtUrl ?? cached.get(item.albumId)?.coverArtUrl ?? null;
}
