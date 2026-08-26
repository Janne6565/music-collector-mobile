import { describe, expect, it } from "bun:test";
import type { LocalStore } from "@/local/LocalStore";
import { readCatalogueGap, writeCatalogueGap } from "@/local/settings";

/** Just the two methods the settings helpers touch. */
function fakeStore(initial: Record<string, string> = {}): LocalStore {
  const settings = new Map(Object.entries(initial));
  return {
    readSetting: async (key: string) => settings.get(key),
    writeSetting: async (key: string, value: string) => {
      settings.set(key, value);
    },
  } as unknown as LocalStore;
}

describe("the catalogue gap", () => {
  it("round-trips what the last sync could not describe", async () => {
    const store = fakeStore();

    await writeCatalogueGap(store, { missing: 29, unreachable: true });

    expect(await readCatalogueGap(store)).toEqual({ missing: 29, unreachable: true });
  });

  it("reads as nothing missing before a sync has ever recorded one", async () => {
    expect(await readCatalogueGap(fakeStore())).toEqual({ missing: 0, unreachable: false });
  });

  it("reads as nothing missing rather than throwing on a value it cannot parse", async () => {
    // The shelf is drawn from this. A preference that will not parse must not be able to
    // take the screen down with it.
    expect(await readCatalogueGap(fakeStore({ catalogueGap: "{not json" }))).toEqual({
      missing: 0,
      unreachable: false,
    });
  });
});
