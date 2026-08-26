import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import { useState } from "react";
import { lookupRelease } from "@/api/releases";
import type { Release } from "@janne6565/music-collector-shared";
import { createCopy } from "@janne6565/music-collector-shared";
import type { LocalStore } from "@/local/LocalStore";
import { useSatisfyWishes } from "@/features/wishlist/useSatisfyWishes";
import { useStore } from "@/local/StoreProvider";
import { readDefaultCurrency } from "@/local/settings";

/**
 * Taking a release out of the catalogue and making it a copy you own.
 *
 * Its own hook because two screens do it: the search results (screen 2a/10a) and the
 * pressings under an album on the artist screen (10c). Both have to write the same record
 * — the same cached release, the same empty detail fields, the same landing on the copy —
 * and a second implementation of that is how the two paths start producing copies that
 * differ in ways nobody intended.
 */
export function useAddCopy(options: { readonly stay?: boolean } = {}) {
  const { store, clock } = useStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const satisfyWishes = useSatisfyWishes();

  /** Which pressing was just added, for the row that is staying put to ring itself. */
  const [added, setAdded] = useState<string | null>(null);

  const addCopy = useMutation({
    mutationFn: async (release: Release) => {
      // Cache the release with the copy: the library and detail screens read metadata from
      // the local store and must keep working with no network at all.
      await store.cacheReleases([release]);
      const copy = createCopy(
        release,
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
      await store.putCopy(copy);
      // One record, added by a person: the only origin that reaches anybody's feed.
      await store.rememberOrigins([copy.id], "MANUAL");
      return copy;
    },
    onSuccess: async (copy, release) => {
      await queryClient.invalidateQueries({ queryKey: ["copies"] });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
      // Screen 16e: filing the record a wish was waiting for takes the entry off the list,
      // whichever way in you used and whether or not you came from the wishlist at all.
      await satisfyWishes(copy, release);
      // A search result carries no cover theme — only the detail lookup samples one, and on
      // a cover the server has never seen that takes seconds. Warm it now, so the record
      // that was just filed opens already themed instead of changing colour under the user.
      // Fire and forget: it changes nothing here, and failing is a non-event.
      void warmCoverTheme(release, store);
      /*
       * A pressing added from a discography (10c) stays where it is: the reader is mid-
       * list, and moving the list under them to celebrate would cost them their place.
       * The row says so itself, with a tick and the Mark ring.
       */
      if (options.stay === true) {
        setAdded(copy.releaseId);
        return;
      }

      // Replace rather than push: the screen that added the copy is a step on the way to
      // it, and going back from a record you just filed should return to the search, not
      // to the list you picked it from.
      //
      // `fresh` opens the copy with its editor already unfolded — the mobile shape of the
      // web's details step (screen 8d). A copy that has just been filed is the one moment
      // its condition, price and where you found it are all still in your head, and a
      // read-only page with an Edit button spends that moment asking you to press again.
      router.replace(`/copies/${copy.id}?fresh=1`);
    },
  });

  return {
    add: (release: Release) => addCopy.mutate(release),
    added,
    /** Which release is being written, so only its own row shows a spinner. */
    addingMbid: addCopy.isPending ? addCopy.variables?.id : undefined,
  };
}

/**
 * Fetches and stores one release's cover theme without anyone waiting for it.
 *
 * Failures are swallowed on purpose: the theme is decoration, the copy is already saved,
 * and the detail screen asks again for itself if this never lands.
 */
async function warmCoverTheme(release: Release, store: LocalStore): Promise<void> {
  if (release.coverTheme !== null) return;
  const enriched = await lookupRelease(release.id).catch(() => null);
  if (enriched !== null && enriched.coverTheme !== null) {
    await store.cacheReleases([enriched]).catch(() => undefined);
  }
}
