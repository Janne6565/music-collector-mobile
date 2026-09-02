import { describe, expect, it } from "bun:test";
import type { LocalStore, Release, WishlistItem } from "@janne6565/rekordo-shared";
import { cacheWishAlbums, cachedCoverOf } from "./cacheWishReleases";

/** Only the two methods this touches; everything else would be scenery. */
function fakeStore(seed: readonly Release[] = []) {
  const rows = new Map(seed.map((release) => [release.id, release]));
  return {
    rows,
    store: {
      getReleases: async (ids: readonly string[]) =>
        new Map([...rows].filter(([id]) => ids.includes(id))),
      cacheReleases: async (releases: readonly Release[]) => {
        for (const release of releases) rows.set(release.id, release);
      },
    } as unknown as LocalStore,
  };
}

function wish(over: Partial<WishlistItem> = {}): WishlistItem {
  return {
    id: "w1",
    albumId: "musicbrainz:alb-1",
    releaseId: null,
    pendingBarcode: null,
    title: "ten days",
    artistName: "Fred again..",
    year: 2025,
    desiredFormat: "VINYL",
    ...over,
  } as WishlistItem;
}

describe("caching what a wishlist cover lookup learned", () => {
  it("writes a row the wish can read back when the mirror is unreachable", async () => {
    const { store, rows } = fakeStore();
    const item = wish();

    await cacheWishAlbums(store, [item], new Map([[item.albumId, "https://art/1.jpg"]]), 1000);

    // Cached under the album id, because that is what catalogueKeyOf falls back to.
    expect(rows.get(item.albumId)?.coverArtUrl).toBe("https://art/1.jpg");
    expect(cachedCoverOf(item, rows)).toBe("https://art/1.jpg");
  });

  it("leaves a row the mirror itself supplied alone", async () => {
    const existing = {
      id: "musicbrainz:alb-1",
      albumId: "musicbrainz:alb-1",
      title: "the mirror's title",
      coverArtUrl: "https://art/original.jpg",
    } as Release;
    const { store, rows } = fakeStore([existing]);

    await cacheWishAlbums(
      store,
      [wish()],
      new Map([["musicbrainz:alb-1", "https://art/2.jpg"]]),
      1,
    );

    // A reconstruction from the wish's own facts is only ever an improvement on nothing.
    expect(rows.get("musicbrainz:alb-1")).toBe(existing);
  });

  it("writes nothing for an album the mirror has no art for", async () => {
    const { store, rows } = fakeStore();

    await cacheWishAlbums(store, [wish()], new Map([["musicbrainz:alb-1", null]]), 1);

    expect(rows.size).toBe(0);
  });

  it("prefers the pressing's own row over the album's", () => {
    const item = wish({ releaseId: "musicbrainz:rel-9" });
    const rows = new Map<string, Release>([
      ["musicbrainz:rel-9", { coverArtUrl: "https://art/pressing.jpg" } as Release],
      ["musicbrainz:alb-1", { coverArtUrl: "https://art/album.jpg" } as Release],
    ]);

    // The sleeve that was on screen when the entry was made, not whichever pressing the
    // mirror ranks first.
    expect(cachedCoverOf(item, rows)).toBe("https://art/pressing.jpg");
  });

  it("falls back to the album when the pressing is not cached", () => {
    const item = wish({ releaseId: "musicbrainz:rel-9" });
    const rows = new Map<string, Release>([
      ["musicbrainz:alb-1", { coverArtUrl: "https://art/album.jpg" } as Release],
    ]);

    expect(cachedCoverOf(item, rows)).toBe("https://art/album.jpg");
  });

  it("answers null rather than throwing when nothing has ever been fetched", () => {
    expect(cachedCoverOf(wish(), undefined)).toBeNull();
    expect(cachedCoverOf(wish(), new Map())).toBeNull();
  });
});
