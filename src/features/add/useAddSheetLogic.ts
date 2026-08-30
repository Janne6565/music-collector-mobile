import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useCallback, useState } from "react";
import { lookupPressings } from "@/api/releases";
import { useSatisfyWishes } from "@/features/wishlist/useSatisfyWishes";
import { useStore } from "@/local/StoreProvider";
import { readDefaultCurrency } from "@/local/settings";
import type { Format, Release } from "@janne6565/rekordo-shared";
import { asWishFormat, createCopy, createWishlistItem } from "@janne6565/rekordo-shared";

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
) {
  const { store, clock } = useStore();
  const queryClient = useQueryClient();
  const satisfyWishes = useSatisfyWishes();

  const [destination, setDestination] = useState<AddDestination>(initial);
  const [picked, setPicked] = useState<Release>(release);
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
      await store.cacheReleases([picked]);
      if (destination === "WISHLIST") {
        const wish = createWishlistItem(
          {
            albumId: picked.albumId,
            releaseId: picked.id,
            title: picked.title,
            artistName: picked.artistName,
            year: picked.year,
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

      const copy = createCopy(
        picked,
        {
          condition: null,
          sleeveCondition: null,
          catalogArt: "AUTO",
          pricePaidCents: null,
          currency: await readDefaultCurrency(store),
          purchasedOn: null,
          purchasedAt: null,
          notes: null,
          rating: null,
        },
        clock,
        Date.now(),
        Crypto.randomUUID(),
      );
      // The format on the chips is an answer about the object, so it overrides the
      // catalogue — and only when it disagrees, or every copy would carry a redundant one.
      const stated = format === picked.format ? copy : { ...copy, manualFormat: format };
      await store.putCopy(stated);
      // One record, added by a person: the only origin that reaches anybody's feed.
      await store.rememberOrigins([stated.id], "MANUAL");
      await satisfyWishes(stated, picked);
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
    picked,
    format,
    setFormat,
    picking,
    openPicker: useCallback(() => setPicking(true), []),
    closePicker: useCallback(() => setPicking(false), []),
    pressings: candidates,
    /** How many pressings are not the one on screen, for the "3 others" line. */
    others: Math.max(0, candidates.length - 1),
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
    isGuess: picked.id === release.id,
    save: () => save.mutate(),
    saving: save.isPending,
  };
}
