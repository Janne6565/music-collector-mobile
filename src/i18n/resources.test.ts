import { describe, expect, it } from "bun:test";
import { resources } from "@/i18n/resources";

function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafPaths(child, prefix === "" ? key : `${prefix}.${key}`),
  );
}

describe("translation resources", () => {
  const languages = Object.keys(resources) as (keyof typeof resources)[];
  const expected = leafPaths(resources.en.common).sort();

  for (const language of languages) {
    it(`${language} defines exactly the same keys as en`, () => {
      expect(leafPaths(resources[language].common).sort()).toEqual(expected);
    });
  }
});
