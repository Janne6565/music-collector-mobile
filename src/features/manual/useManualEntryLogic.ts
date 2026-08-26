import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import type { Format, ManualRelease } from "@janne6565/music-collector-shared";
import { createManualCopy } from "@janne6565/music-collector-shared";
import { useStore } from "@/local/StoreProvider";
import { readDefaultCurrency } from "@/local/settings";

/**
 * Preselected, because the shelf has to draw something.
 *
 * Format is the one field with no honest blank: the library filters by it and a copy with
 * no picture is drawn as its format's silhouette. Vinyl is what screen 14a starts on.
 */
const DEFAULT_FORMAT: Format = "VINYL";

export interface ManualFields {
  artist: string;
  title: string;
  year: string;
  label: string;
  format: Format;
}

const EMPTY: ManualFields = {
  artist: "",
  title: "",
  year: "",
  label: "",
  format: DEFAULT_FORMAT,
};

function blankToNull(value: string): string | null {
  return value.trim() === "" ? null : value.trim();
}

/**
 * Screen 14a — the copy nobody has a record of.
 *
 * One column and five fields, of which two are required. Everything the copy itself can
 * say — condition, price, where it came from, a rating — is deliberately not here: it is
 * the editor's job on the copy that this creates, which is where the deck sends you next
 * ("Condition, price, shop, rating · Later").
 */
export function useManualEntryLogic() {
  const { store, clock } = useStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [fields, setFields] = useState<ManualFields>(EMPTY);

  const set = useCallback(<K extends keyof ManualFields>(key: K, value: ManualFields[K]) => {
    setFields((current) => ({ ...current, [key]: value }));
  }, []);

  /**
   * Artists already on the shelf, so a second tape by the same band does not become a
   * second artist through a different spelling.
   */
  const shelf = useQuery({
    queryKey: ["manualArtists"],
    queryFn: async () => {
      const copies = await store.listCopies();
      const releases = await store.getReleases(copies.map((copy) => copy.releaseId));
      const counts = new Map<string, number>();
      for (const copy of copies) {
        const name = releases.get(copy.releaseId)?.artistName;
        if (name === undefined || name.trim() === "") continue;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      return counts;
    },
  });

  const typed = fields.artist.trim().toLowerCase();
  /**
   * The one name worth offering under the field, with how many of them you already own.
   *
   * One rather than a list: the deck draws a single line there, and on a phone a dropdown
   * over a form the keyboard is already covering half of is not an improvement.
   */
  const artistHint = useMemo(() => {
    if (typed === "" || shelf.data === undefined) return null;
    for (const [name, count] of shelf.data) {
      if (name.toLowerCase().startsWith(typed) && name.toLowerCase() !== typed) {
        return { name, count };
      }
    }
    return null;
  }, [shelf.data, typed]);

  const save = useMutation({
    mutationFn: async () => {
      const year = Number.parseInt(fields.year.trim(), 10);
      const manual: ManualRelease = {
        manualTitle: blankToNull(fields.title),
        manualArtist: blankToNull(fields.artist),
        manualYear: Number.isNaN(year) ? null : year,
        manualLabel: blankToNull(fields.label),
        manualCatalogNumber: null,
        manualFormat: fields.format,
      };
      const copy = createManualCopy(
        manual,
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
    onSuccess: async (copy) => {
      await queryClient.invalidateQueries();
      // Replace rather than push, and open the editor unfolded — the same landing every
      // other add uses. "Later" is a promise that the rest of the form is one screen away,
      // and this is that screen.
      router.replace(`/copies/${copy.id}?fresh=1`);
    },
  });

  return {
    fields,
    set,
    artistHint,
    /** The two things that name a record on a shelf. */
    canSave: fields.artist.trim() !== "" && fields.title.trim() !== "",
    save: () => save.mutate(),
    saving: save.isPending,
  };
}
