import type { ExampleRelease } from "@/features/add/types";

/**
 * The shipped example set (deck "Add · Empty State", screen 1a).
 *
 * A fixed list rather than anything derived: the screen this fills is the one an account
 * has before it has a shelf, a wishlist or a search history, so there is by definition
 * nothing personal to derive from. It is the same six for everybody, which is what makes
 * it cheap — one covers call, cached forever, identical for every user on the platform.
 *
 * These are release *groups* (albums), not pressings. A tile stands for the record, and
 * which copy you own is still yours to pick from the search it opens.
 *
 * Ids come in two shapes, and the covers endpoint answers for both: a bare uuid is a
 * MusicBrainz release group, `discogs:release-N` is a Discogs release. Records too new or
 * too small for MusicBrainz are usually on Discogs, which is also the source the search
 * asks first, so a Discogs id is not a fallback here -- it is the id that matches what a
 * tap will actually find.
 *
 * Every entry has been checked against the live mirror and has art. An id with nothing
 * behind it draws an empty square and searches to nothing, which on the first screen of a
 * new account reads as a broken app rather than as an example, so do not add one without
 * looking it up first.
 */
export const EXAMPLE_RELEASES: readonly ExampleRelease[] = [
  {
    albumId: "discogs:release-37840941",
    title: "Chapters Left Unread",
    artistName: "Dust Of Apollon",
  },
  {
    albumId: "b82f59df-2659-4c23-a3b6-9eb2518b4327",
    title: "पर्वत (The Mountain)",
    artistName: "Gorillaz",
  },
  {
    albumId: "48282ba2-a382-45ff-81bf-670565dd65de",
    title: "ten days",
    artistName: "Fred again..",
  },
  {
    albumId: "ae1ff272-3682-4e39-8f9b-2a9eb30eddc3",
    title: "THIS MUSIC MAY CONTAIN HOPE.",
    artistName: "RAYE",
  },
  {
    albumId: "cc83b4b5-fcf5-4e9c-b360-fc77182574f6",
    title: "Glanz Null",
    artistName: "Apsilon",
  },
  {
    albumId: "c257b3f6-973b-4b27-8ee6-b39c904006ba",
    title: "So Much Country ’Till We Get There",
    artistName: "Westside Cowboy",
  },
];

/** Asked for in one batch, so the plate resolves in a single request. */
export const EXAMPLE_ALBUM_IDS: readonly string[] = EXAMPLE_RELEASES.map(
  (example) => example.albumId,
);
