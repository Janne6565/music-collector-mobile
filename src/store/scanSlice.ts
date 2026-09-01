import type { Format, Release } from "@janne6565/rekordo-shared";
import { type PayloadAction, createSlice } from "@reduxjs/toolkit";

/** Where a kept scan is headed. Both are equal answers, which is the whole point. */
export type ScanDestination = "SHELF" | "WISHLIST";

/**
 * One record kept during a scanning session, before any of it is written.
 *
 * A scan is `pending` when the phone had no way to find out what it was — the digits are
 * genuine, the name is not known yet. Everything else about the two cases is the same, so
 * they are one type with a nullable release rather than two the tray would have to branch
 * on in every row.
 */
export interface KeptScan {
  /** Local to the session; the copy's real id is generated when the batch is written. */
  readonly key: string;
  readonly barcode: string;
  readonly release: Release | null;
  /**
   * The format the person confirmed on the card, which may disagree with the catalogue —
   * a tape of a record catalogued as vinyl is an ordinary thing to hold. Null only when
   * nobody was asked, which cannot happen for a pending scan.
   */
  readonly format: Format | null;
  readonly destination: ScanDestination;
  /** They already own one of these, and said so deliberately on the duplicate card. */
  readonly secondCopy: boolean;
  readonly keptAt: number;
}

interface ScanState {
  readonly kept: KeptScan[];
  /**
   * What the last save wrote, so the saved screen can name it and Undo can take it back.
   *
   * Kept beside the tray rather than replacing it: Undo has to put the tray back exactly
   * as it was, and a tray already emptied cannot be restored from the copies, since a
   * pending scan's copy id was invented during the write.
   */
  readonly saved: { readonly copyIds: string[]; readonly wishIds: string[] } | null;
}

const initialState: ScanState = { kept: [], saved: null };

/**
 * The tray, in Redux rather than in the scanner's own state.
 *
 * Scanning a crate is four screens — the camera, the review sheet, the saved list, the
 * details run — and the tray is the one thing all four are about. Held in the camera
 * screen it would be lost the moment somebody opened the review sheet, which is the very
 * next thing they do.
 */
const scanSlice = createSlice({
  name: "scan",
  initialState,
  reducers: {
    kept(state, action: PayloadAction<KeptScan>) {
      state.kept.push(action.payload);
    },
    dropped(state, action: PayloadAction<string>) {
      state.kept = state.kept.filter((scan) => scan.key !== action.payload);
    },
    /** The heart chip on a review row: a mis-tap in the shop is fixed here. */
    redirected(state, action: PayloadAction<{ key: string; destination: ScanDestination }>) {
      const scan = state.kept.find((kept) => kept.key === action.payload.key);
      if (scan !== undefined) scan.destination = action.payload.destination;
    },
    reformatted(state, action: PayloadAction<{ key: string; format: Format }>) {
      const scan = state.kept.find((kept) => kept.key === action.payload.key);
      if (scan !== undefined) scan.format = action.payload.format;
    },
    /** The pressing picker, on the card and on a review row. */
    repressed(state, action: PayloadAction<{ key: string; release: Release }>) {
      const scan = state.kept.find((kept) => kept.key === action.payload.key);
      if (scan !== undefined) scan.release = action.payload.release;
    },
    saved(state, action: PayloadAction<{ copyIds: string[]; wishIds: string[] }>) {
      state.saved = action.payload;
      state.kept = [];
    },
    /** Undo: the records are gone again and the tray is back the way it was. */
    unsaved(state, action: PayloadAction<KeptScan[]>) {
      state.kept = action.payload;
      state.saved = null;
    },
    /** Leaving the flow for good — Done, or closing the camera with an empty tray. */
    cleared() {
      return initialState;
    },
  },
});

export const scanActions = scanSlice.actions;
export const scanReducer = scanSlice.reducer;

/** How the tray counts itself: "3 shelf · 1 wishlist". */
export function countByDestination(kept: readonly KeptScan[]): {
  shelf: number;
  wishlist: number;
} {
  return {
    shelf: kept.filter((scan) => scan.destination === "SHELF").length,
    wishlist: kept.filter((scan) => scan.destination === "WISHLIST").length,
  };
}
