import { describe, expect, it } from "bun:test";
import { artistSubtitle } from "@/domain/artist";
import type { Artist } from "@janne6565/music-collector-shared";
function artist(overrides: Partial<Artist> = {}): Artist {
  return {
    mbid: "a1ced3e5-476c-4046-bd74-d428f419989b",
    name: "Daughter",
    disambiguation: "UK indie folk band fronted by Elena Tonra",
    type: "Group",
    country: "GB",
    beganIn: "2010",
    endedIn: null,
    score: 100,
    ...overrides,
  };
}

describe("artistSubtitle", () => {
  it("reads as one line for a band that is still going", () => {
    expect(artistSubtitle(artist())).toBe("Group · GB · 2010–");
  });

  it("closes the range for one that ended", () => {
    const miles = artist({
      name: "Miles Davis",
      type: "Person",
      country: "US",
      beganIn: "1926-05-26",
      endedIn: "1991-09-28",
    });
    expect(artistSubtitle(miles)).toBe("Person · US · 1926–1991");
  });

  it("omits what the archive does not know rather than leaving dangling separators", () => {
    // Plenty of artists have no type, no country, or no dates — a row that rendered
    // "· ·" for them would look broken rather than incomplete.
    expect(artistSubtitle(artist({ type: null, country: null }))).toBe("2010–");
    expect(artistSubtitle(artist({ beganIn: null }))).toBe("Group · GB");
    expect(artistSubtitle(artist({ type: null, country: null, beganIn: null }))).toBe("");
  });

  it("reads the same as the web client, which is the point of mirroring it", () => {
    // The two apps show the same artist in the same list on two devices. A subtitle that
    // differed between them would look like the archive disagreed with itself.
    expect(artistSubtitle(artist({ country: null }))).toBe("Group · 2010–");
  });
});
