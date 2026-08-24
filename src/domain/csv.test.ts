import { describe, expect, it } from "bun:test";
import { fromCsv, parseCsv, toCsv } from "@/domain/csv";
import type { Copy, Release } from "@/domain/types";

const release: Release = {
  mbid: "r1",
  releaseGroupMbid: "rg1",
  title: 'Bitches Brew, "complete"',
  artistName: "Miles Davis",
  year: 1970,
  format: "VINYL",
  label: "Columbia",
  catalogNumber: "GP 26",
  country: "US",
  barcode: null,
  coverArtUrl: null,
  coverTheme: null,
  cachedAt: 0,
};

const copy: Copy = {
  id: "c1",
  releaseMbid: "r1",
  condition: "VG_PLUS",
  sleeveCondition: "NM",
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
    const text = toCsv([copy], new Map([[release.mbid, release]]));
    const { rows, skipped } = fromCsv(text);

    expect(skipped).toBe(0);
    expect(rows).toEqual([
      {
        releaseMbid: "r1",
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

  it("locates columns by name, not position", () => {
    const { rows } = fromCsv("notes,releaseMbid\nA note,r9\n");
    expect(rows[0]?.releaseMbid).toBe("r9");
    expect(rows[0]?.notes).toBe("A note");
  });

  it("skips a row with no release to attach the copy to", () => {
    const { rows, skipped } = fromCsv("releaseMbid,notes\n,orphan\nr1,kept\n");
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it("accepts the shorthand grades people actually type", () => {
    const { rows } = fromCsv("releaseMbid,mediaCondition\nr1,vg+\n");
    expect(rows[0]?.mediaCondition).toBe("VG_PLUS");
  });

  it("ignores a trailing newline rather than reading it as a row", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});
