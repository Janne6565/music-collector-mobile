import { describe, expect, it } from "bun:test";
import type { Release } from "@janne6565/rekordo-shared";
import { hiddenPressings, shownPressings } from "./shownPressings";

function release(id: string): Release {
  return {
    id,
    albumId: "album-1",
    title: "London Calling",
    artistName: "The Clash",
    year: 1999,
    format: "CD",
    label: "Columbia",
    catalogNumber: "495347 2",
    country: "Europe",
    barcode: "5099749534728",
    releaseDate: null,
    trackCount: null,
    discCount: null,
    coverArtUrl: null,
    coverTheme: null,
    cachedAt: 0,
  };
}

const ALL = ["a", "b", "c", "d", "e"].map(release);

describe("shownPressings", () => {
  it("lists the catalogue's first three when nothing further down is picked", () => {
    expect(shownPressings(ALL, ALL[1] ?? null).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("puts a pick from further down in the last row, so the check is on screen", () => {
    expect(shownPressings(ALL, ALL[4] ?? null).map((r) => r.id)).toEqual(["a", "b", "e"]);
  });

  it("leaves a short list alone", () => {
    expect(shownPressings(ALL.slice(0, 2), null).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("counts the row a displaced pick pushed out as hidden", () => {
    const shown = shownPressings(ALL, ALL[4] ?? null);
    expect(hiddenPressings(ALL, shown)).toBe(2);
  });
});
