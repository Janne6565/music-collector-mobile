import { describe, expect, it } from "bun:test";
import { fromCsv, parseCsv, toCsv } from "@/domain/csv";
import type { Copy, Release } from "@janne6565/music-collector-shared";
const release: Release = {
  id: "r1",
  albumId: "rg1",
  title: 'Bitches Brew, "complete"',
  artistName: "Miles Davis",
  year: 1970,
  format: "VINYL",
  label: "Columbia",
  catalogNumber: "GP 26",
  country: "US",
  barcode: null,
  releaseDate: null,
  trackCount: null,
  discCount: null,
  coverArtUrl: null,
  coverTheme: null,
  cachedAt: 0,
};

const copy: Copy = {
  id: "c1",
  releaseId: "r1",
  manualTitle: null,
  manualArtist: null,
  manualYear: null,
  manualLabel: null,
  manualCatalogNumber: null,
  manualFormat: null,
  condition: "VG_PLUS",
  sleeveCondition: "NM",
  catalogArt: "AUTO",
  pricePaidCents: 3400,
  currency: "EUR",
  purchasedOn: "2026-08-12",
  purchasedAt: "Rush Hour, Amsterdam",
  notes: "Gatefold, faint ring wear.\nPlays clean after a wash.",
  notesConflict: null,
  rating: 4,
  createdAt: 1,
  deletedAt: null,
  fieldClocks: {} as Copy["fieldClocks"],
};

describe("csv", () => {
  it("survives commas, quotes and newlines in a round trip", () => {
    const text = toCsv([copy], new Map([[release.id, release]]));
    const { rows, skipped } = fromCsv(text);

    expect(skipped).toBe(0);
    expect(rows).toEqual([
      {
        releaseId: "r1",
        // Carried through even for a catalogued row: which columns describe the pressing
        // does not depend on where the pressing came from.
        title: 'Bitches Brew, "complete"',
        artist: "Miles Davis",
        year: 1970,
        format: "VINYL",
        label: "Columbia",
        catalogNumber: "GP 26",
        mediaCondition: "VG_PLUS",
        sleeveCondition: "NM",
        pricePaidCents: 3400,
        currency: "EUR",
        purchasedOn: "2026-08-12",
        purchasedAt: "Rush Hour, Amsterdam",
        rating: 4,
        notes: "Gatefold, faint ring wear.\nPlays clean after a wash.",
      },
    ]);
  });

  it("keeps a hand-entered pressing readable, so an export of it can come back", () => {
    // A `local:` row has no archive entry to look up on re-import — these columns are the
    // only record of what the record is.
    const { rows } = fromCsv(
      "releaseId,title,artist,year,format,label,catalogNumber\n" +
        "local:c9,Untitled live tape,Sun Ra Arkestra,1978,CASSETTE,Saturn,ES 9956\n",
    );

    expect(rows[0]).toMatchObject({
      releaseId: "local:c9",
      title: "Untitled live tape",
      artist: "Sun Ra Arkestra",
      year: 1978,
      format: "CASSETTE",
      label: "Saturn",
      catalogNumber: "ES 9956",
    });
  });

  it("locates columns by name, not position", () => {
    const { rows } = fromCsv("notes,releaseId\nA note,r9\n");
    expect(rows[0]?.releaseId).toBe("r9");
    expect(rows[0]?.notes).toBe("A note");
  });

  it("skips a row with no release to attach the copy to", () => {
    const { rows, skipped } = fromCsv("releaseId,notes\n,orphan\nr1,kept\n");
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it("accepts the shorthand grades people actually type", () => {
    const { rows } = fromCsv("releaseId,mediaCondition\nr1,vg+\n");
    expect(rows[0]?.mediaCondition).toBe("VG_PLUS");
  });

  it("ignores a trailing newline rather than reading it as a row", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});
