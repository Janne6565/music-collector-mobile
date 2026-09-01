import { lookupByBarcode, lookupPressings } from "@/api/releases";
import { useStore } from "@/local/StoreProvider";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { type KeptScan, type ScanDestination, scanActions } from "@/store/scanSlice";
import type { Copy, Format, Release } from "@janne6565/rekordo-shared";
import { copyFormat, isBarcode, pickPressing } from "@janne6565/rekordo-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCameraPermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * What the card under the camera window is currently asking.
 *
 *   MATCH      one release, or several that agree — the ordinary case
 *   PRESSINGS  several pressings share the barcode and one has to be picked
 *   DUPLICATE  this is already on the shelf, which is a fact rather than an error
 *   MISSING    the read was clean and no catalogue has the number
 *   OFFLINE    the read was clean and nobody could be asked
 */
export type ScanCardKind = "MATCH" | "PRESSINGS" | "DUPLICATE" | "MISSING" | "OFFLINE";

export interface ScanCard {
  readonly kind: ScanCardKind;
  readonly barcode: string;
  /** Every pressing the barcode resolved to, catalogue order. Empty when it resolved to none. */
  readonly candidates: readonly Release[];
  /** The one the card is about, and the one the buttons act on. */
  readonly picked: Release | null;
  readonly format: Format | null;
  /** The copy already on the shelf, for the duplicate card's date and grade. */
  readonly owned: Copy | null;
}

/**
 * How long a barcode is ignored after being read.
 *
 * The camera reports the same symbol many times a second while it is in frame, and the
 * card would otherwise be rebuilt under the finger about to press it. Long enough to keep
 * a hand steady over one sleeve, short enough that deliberately re-scanning the record you
 * just skipped works on the second try rather than the tenth.
 */
const SAME_CODE_COOLDOWN_MS = 2500;

/**
 * How long the viewfinder waits before offering advice.
 *
 * The advice is about a dim shop or the wrong distance, and both take a moment to become
 * true. Said immediately it would be noise on every scan; said never it would be missing
 * exactly where the scanner stops working.
 */
const ADVICE_AFTER_MS = 6000;

/** The formats a confirm card offers. `OTHER` is a catalogue answer, never a choice. */
export const SCAN_FORMATS: readonly Format[] = ["VINYL", "CD", "CASSETTE", "DIGITAL"];

export function useScannerLogic() {
  const { store } = useStore();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const kept = useAppSelector((state) => state.scan.kept);

  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [card, setCard] = useState<ScanCard | null>(null);
  const [looking, setLooking] = useState(false);
  const [advising, setAdvising] = useState(false);
  /** Pressings of the matched release's album, for "1 pressing of 4" and "3 others". */
  const [siblings, setSiblings] = useState<readonly Release[] | null>(null);
  const [picking, setPicking] = useState(false);

  /** Barcodes read recently, so one sleeve in frame is one question. */
  const recent = useRef(new Map<string, number>());

  /**
   * The advice timer, restarted whenever the scanner starts looking again.
   *
   * Keyed on whether a card is open rather than on every render: while the card is up the
   * camera is not being pointed at anything, and counting that as a failed scan would
   * greet every dismissal with advice about the light.
   */
  useEffect(() => {
    if (card !== null) {
      setAdvising(false);
      return;
    }
    setAdvising(false);
    const timer = setTimeout(() => setAdvising(true), ADVICE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [card]);

  const resolve = useCallback(
    async (barcode: string) => {
      setLooking(true);
      setSiblings(null);
      try {
        const candidates = await lookupByBarcode(barcode);
        if (candidates.length === 0) {
          setCard({
            kind: "MISSING",
            barcode,
            candidates,
            picked: null,
            format: null,
            owned: null,
          });
          return;
        }

        // The catalogue may hold the same barcode for four reissues. Which one the person
        // means is a question only they can answer, so several is its own card — but the
        // one it proposes is the one an offline scan would settle on, so the two paths
        // cannot name different pressings for the same read.
        const picked = pickPressing(candidates, null) ?? candidates[0];
        const owned = await ownedCopy(store, candidates);
        setCard({
          kind: owned !== null ? "DUPLICATE" : candidates.length > 1 ? "PRESSINGS" : "MATCH",
          barcode,
          candidates,
          picked,
          format: picked.format === "OTHER" ? null : picked.format,
          owned,
        });
        void warmSiblings(picked, setSiblings);
      } catch {
        // Not an error to report: the camera worked, nobody could be asked. The scan keeps
        // its digits and names itself when a connection returns.
        setCard({
          kind: "OFFLINE",
          barcode,
          candidates: [],
          picked: null,
          format: null,
          owned: null,
        });
      } finally {
        setLooking(false);
      }
    },
    [store],
  );

  const handleScan = useCallback(
    (raw: string) => {
      const barcode = raw.trim();
      if (!isBarcode(barcode)) return;
      // While a card is up, the question on screen has not been answered yet.
      if (card !== null || looking) return;

      const now = Date.now();
      const last = recent.current.get(barcode);
      if (last !== undefined && now - last < SAME_CODE_COOLDOWN_MS) return;
      recent.current.set(barcode, now);

      void resolve(barcode);
    },
    [card, looking, resolve],
  );

  const dismiss = useCallback(() => {
    setCard(null);
    setSiblings(null);
    setPicking(false);
  }, []);

  const keep = useCallback(
    (destination: ScanDestination) => {
      if (card === null) return;
      const scan: KeptScan = {
        key: Crypto.randomUUID(),
        barcode: card.barcode,
        release: card.picked,
        format: card.format,
        destination,
        secondCopy: card.kind === "DUPLICATE",
        keptAt: Date.now(),
      };
      dispatch(scanActions.kept(scan));
      dismiss();
    },
    [card, dispatch, dismiss],
  );

  return {
    permission,
    requestPermission,
    torch,
    toggleTorch: useCallback(() => setTorch((on) => !on), []),
    /** True once the viewfinder has been pointed at something for a while with no read. */
    advising: advising && card === null,
    looking,
    card,
    handleScan,
    dismiss,
    keep,
    /** The pressing picker, on both the several-pressings card and the "3 others" line. */
    picking,
    openPicker: useCallback(() => setPicking(true), []),
    closePicker: useCallback(() => setPicking(false), []),
    /**
     * What the picker offers: the pressings that share the barcode when several do,
     * otherwise every pressing of the album the match belongs to.
     */
    pressings: card === null ? [] : card.candidates.length > 1 ? card.candidates : (siblings ?? []),
    /** How many pressings the album has in total, or null while nobody knows yet. */
    pressingCount:
      card === null
        ? null
        : card.candidates.length > 1
          ? card.candidates.length
          : (siblings?.length ?? null),
    pick: useCallback((release: Release) => {
      setCard((open) =>
        open === null
          ? null
          : {
              ...open,
              picked: release,
              format: release.format === "OTHER" ? open.format : release.format,
            },
      );
      setPicking(false);
    }, []),
    setFormat: useCallback((format: Format) => {
      setCard((open) => (open === null ? null : { ...open, format }));
    }, []),
    kept,
    openReview: useCallback(() => router.push("/scan/review"), [router]),
    /**
     * Manual entry, carrying whatever the scanner did read. The digits are the one thing
     * the failed lookup genuinely established, and throwing them away would ask the person
     * to read them off the sleeve themselves.
     */
    enterManually: useCallback(
      (barcode?: string) =>
        router.push(barcode === undefined ? "/manual" : `/manual?barcode=${barcode}`),
      [router],
    ),
    /** The duplicate card's second button: the copy they already have. */
    openOwned: useCallback(
      (copyId: string) => {
        dismiss();
        router.push(`/copies/${copyId}`);
      },
      [dismiss, router],
    ),
    close: useCallback(() => {
      if (kept.length === 0) dispatch(scanActions.cleared());
      void queryClient.invalidateQueries({ queryKey: ["copies"] });
      router.back();
    }, [kept.length, dispatch, queryClient, router]),
  };
}

/**
 * The copy already on the shelf for one of these pressings, if there is one.
 *
 * Matched on the release rather than the album: owning the CD is not owning the LP, and
 * telling somebody holding a different pressing that they already have it is how a
 * collection ends up missing the record they were standing in the shop with.
 */
async function ownedCopy(
  store: { listCopies: () => Promise<Copy[]> },
  candidates: readonly Release[],
): Promise<Copy | null> {
  const ids = new Set(candidates.map((release) => release.id));
  const copies = await store.listCopies();
  return copies.find((copy) => ids.has(copy.releaseId)) ?? null;
}

/**
 * The other pressings of the matched album, fetched behind the card.
 *
 * Nobody waits for it: the card is already answerable without it, and all it adds is the
 * count in the header and what the "others" line opens. Failing is a non-event — the line
 * simply does not appear.
 */
async function warmSiblings(
  picked: Release,
  onLoaded: (releases: readonly Release[]) => void,
): Promise<void> {
  try {
    const pressings = await lookupPressings(picked.albumId);
    if (pressings.length > 0) onLoaded(pressings);
  } catch {
    // No count, no others line. The card stands on its own.
  }
}

/** What a kept scan is called in the tray, whether or not it has a name yet. */
export function scanFormat(scan: KeptScan): Format {
  return copyFormat({ manualFormat: scan.format }, scan.release ?? undefined);
}
