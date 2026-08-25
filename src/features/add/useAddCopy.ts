import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import type { Release } from "@/domain/types";
import { createCopy } from "@/local/copyWrites";
import { useStore } from "@/local/StoreProvider";

/**
 * Taking a release out of the catalogue and making it a copy you own.
 *
 * Its own hook because two screens do it: the search results (screen 2a/10a) and the
 * pressings under an album on the artist screen (10c). Both have to write the same record
 * — the same cached release, the same empty detail fields, the same landing on the copy —
 * and a second implementation of that is how the two paths start producing copies that
 * differ in ways nobody intended.
 */
export function useAddCopy() {
  const { store, clock } = useStore();
  const queryClient = useQueryClient();
  const router = useRouter();

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
          pricePaidCents: null,
          currency: "EUR",
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
      return copy;
    },
    onSuccess: async (copy) => {
      await queryClient.invalidateQueries({ queryKey: ["copies"] });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
      // Replace rather than push: the screen that added the copy is a step on the way to
      // it, and going back from a record you just filed should return to the search, not
      // to the list you picked it from.
      router.replace(`/copies/${copy.id}`);
    },
  });

  return {
    add: (release: Release) => addCopy.mutate(release),
    /** Which release is being written, so only its own row shows a spinner. */
    addingMbid: addCopy.isPending ? addCopy.variables?.id : undefined,
  };
}
