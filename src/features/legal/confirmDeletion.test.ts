import { describe, expect, it } from "bun:test";
import { isDeletionConfirmed } from "@/features/legal/confirmDeletion";

/**
 * The gate in front of the one irreversible action in the app.
 *
 * Strict enough that nothing types itself, lax enough that a keyboard without an Ö is not a
 * reason to be stuck with an account you asked to delete.
 */
describe("isDeletionConfirmed", () => {
  it("accepts the word the English screen prints", () => {
    expect(isDeletionConfirmed("DELETE")).toBe(true);
  });

  it("accepts the German word whatever the interface language is", () => {
    expect(isDeletionConfirmed("LÖSCHEN")).toBe(true);
  });

  it("accepts it in lower case and with stray spaces, which are not decisions", () => {
    expect(isDeletionConfirmed("  löschen ")).toBe(true);
  });

  it("accepts the umlaut-free spelling", () => {
    expect(isDeletionConfirmed("LOESCHEN")).toBe(true);
  });

  it("refuses a near miss", () => {
    expect(isDeletionConfirmed("losche")).toBe(false);
    expect(isDeletionConfirmed("delet")).toBe(false);
    expect(isDeletionConfirmed("")).toBe(false);
  });
});
