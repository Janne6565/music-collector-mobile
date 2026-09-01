import { lookupPressings } from "@/api/releases";
import { useSatisfyWishes } from "@/features/wishlist/useSatisfyWishes";
import { useStore } from "@/local/StoreProvider";
import { readDefaultCurrency } from "@/local/settings";
import type { Format, Release } from "@janne6565/rekordo-shared";
import {
  type CopyDraft,
  asWishFormat,
  createAlbumCopy,
  createCopy,
  createWishlistItem,
} from "@janne6565/rekordo-shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useCallback, useState } from "react";

export type AddDestination = "SHELF" | "WISHLIST";

/**
 * The one sheet between a search result and a saved copy.
 *
 * A search hit names a *release*, but a shelf holds a *pressing*, and the two are not the
 * same claim: "Bitches Brew" came back as one row and exists as forty-seven objects. The
 * sheet is where that gap is closed — a best guess you can accept in one tap, the other
 * pressings a tap further, and the format still editable because the catalogue is
 * describing a record while you are holding one.
 *
 * It serves both destinations. They are the same question with the same answer sheet, and
 * the quiet line at the bottom flips it, so a mis-tap costs a tap rather than a delete.
 *
 * Turn 28 of the deck, screen 6c.
 */
export function useAddSheetLogic(
  release: Release,
  initial: AddDestination,
  onDone: () => void,
  /**
   * Whether `release` is a pressing somebody chose, or only the record they tapped.
   *
   * False when the sheet was opened on an album -- an artist row, an example tile -- where
   * there is no pressing yet and picking one for them would record a guess as an answer.
   */
  pressingChosen = true,
) {
  const { store, clock } = useStore();
  const queryClient = useQueryClient();
  const satisfyWishes = useSatisfyWishes();

  const [destination, setDestination] = useState<AddDestination>(initial);
  // Null means nobody has chosen a pressing. The sheet still draws from `release`, which
  // for an album-first open is the album shaped as the release a copy of it would have had.
  const [picked, setPicked] = useState<Release | null>(pressingChosen ? release : null);
  const shown = picked ?? release;
  const [format, setFormat] = useState<Format>(release.format);
  const [picking, setPicking] = useState(false);

  /**
   * The other pressings of the same album.
   *
   * Fetched behind the sheet, which is answerable without it: the best guess is already on
   * screen and the line that opens this only appears once there is something behind it.
   */
  const pressings = useQuery({
    queryKey: ["pressings", release.albumId],
    queryFn: () => lookupPressings(release.albumId),
  });

  const save = useMutation({
    mutationFn: async () => {
      // Cached under `shown.id` either way -- for an album-first add that id is the album's,
      // which is the key the shelf will look its facts up by. Without this the new row has
      // no title until the next sync fills the mirror in.
      await store.cacheReleases([shown]);
      if (destination === "WISHLIST") {
        const wish = createWishlistItem(
          {
            albumId: shown.albumId,
            releaseId: picked?.id ?? null,
            title: shown.title,
            artistName: shown.artistName,
            year: shown.year,
            desiredFormat: asWishFormat(format),
            note: null,
          },
          clock,
          Date.now(),
          Crypto.randomUUID(),
        );
        await store.putWishlistItem(wish);
        return null;
      }

      const draft: CopyDraft = {
        condition: null,
        sleeveCondition: null,
        catalogArt: "AUTO",
        pricePaidCents: null,
        currency: await readDefaultCurrency(store),
        purchasedOn: null,
        purchasedAt: null,
        notes: null,
        rating: null,
      };
      const now = Date.now();
      const id = Crypto.randomUUID();
      const copy =
        picked === null
          ? createAlbumCopy({ albumId: shown.albumId }, draft, clock, now, id)
          : createCopy(picked, draft, clock, now, id);
      // The format on the chips is an answer about the object, so it overrides the
      // catalogue — and only when it disagrees, or every copy would carry a redundant one.
      const stated = format === shown.format ? copy : { ...copy, manualFormat: format };
      await store.putCopy(stated);
      // One record, added by a person: the only origin that reaches anybody's feed.
      await store.rememberOrigins([stated.id], "MANUAL");
      await satisfyWishes(stated, shown);
      return stated;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["copies"] });
      await queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
      await queryClient.invalidateQueries({ queryKey: ["ownedReleases"] });
      onDone();
    },
  });

  const candidates = pressings.data ?? [];

  return {
    destination,
    /** The quiet line under the button: the same record, the other list. */
    flip: useCallback(
      () => setDestination((current) => (current === "SHELF" ? "WISHLIST" : "SHELF")),
      [],
    ),
    /** What the sheet draws: the chosen pressing, or the record itself when there is none. */
    picked: shown,
    /** Whether a pressing has actually been chosen, as opposed to one being shown. */
    hasPressing: picked !== null,
    format,
    setFormat,
    picking,
    openPicker: useCallback(() => setPicking(true), []),
    closePicker: useCallback(() => setPicking(false), []),
    pressings: candidates,
    /** How many pressings are not the one on screen, for the "3 others" line. */
    others: Math.max(0, candidates.length - 1),
    /**
     * Whether there is a choice to make at all.
     *
     * An album the archive knows one pressing of is not a decision, and a box that opens a
     * list of one would be a promise of a choice that is not there. Everything else is
     * pickable, and says so on the box rather than in a link beside it.
     *
     * With no pressing chosen even a list of one is a decision, because the choice on offer
     * is not "which of these" but "this one, or none".
     */
    canPick: picked === null ? candidates.length > 0 : candidates.length > 1,
    /** True while the album's pressings are still on their way; the line waits for them. */
    loadingPressings: pressings.isPending,
    pick: useCallback((next: Release) => {
      setPicked(next);
      if (next.format !== "OTHER") setFormat(next.format);
      setPicking(false);
    }, []),
    /**
     * Whether the pressing on screen is the archive's own first answer.
     *
     * Only that one is labelled a guess. Once somebody has picked from the list it is not
     * a guess any more, it is their choice, and leaving the badge on would say otherwise.
     */
    isGuess: picked !== null && picked.id === release.id && pressingChosen,
    save: () => save.mutate(),
    saving: save.isPending,
  };
}
