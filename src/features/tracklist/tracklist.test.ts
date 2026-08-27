import { describe, expect, it } from "bun:test";
import { toTracklist } from "@/api/tracklistPayload";
import {
  capMedia,
  durationParts,
  knownDurationMs,
  TRACK_ROW_CAP,
  trackDuration,
  trackTotal,
} from "@/features/tracklist/tracklistFormat";

/**
 * The phone's copy of the tracklist rules (design 26).
 *
 * The mapper is tested here and not only on the web because this client is hand-written:
 * a field the backend renames would otherwise empty the section in silence, which is
 * exactly how the copy list once went blank.
 */

describe("toTracklist", () => {
  it("reads a payload into media and rows", () => {
    const tracklist = toTracklist({
      trackCount: 26,
      discCount: 2,
      media: [
        {
          position: 1,
          format: '12" Vinyl',
          title: "",
          tracks: [
            { number: "A1", title: "In the Flesh?", lengthMs: 199560 },
            { number: "B6", title: "Goodbye Cruel World" },
          ],
        },
      ],
    });

    expect(tracklist.trackCount).toBe(26);
    expect(tracklist.media).toHaveLength(1);
    expect(tracklist.media[0].tracks.map((track) => track.number)).toEqual(["A1", "B6"]);
    // A duration nobody knows stays null all the way to the row, which draws nothing.
    expect(tracklist.media[0].tracks[1].lengthMs).toBeNull();
    expect(tracklist.absence).toBeNull();
  });

  it("drops a row it could not draw rather than rendering undefined", () => {
    const tracklist = toTracklist({
      media: [{ position: 1, tracks: [{ title: "No number" }, { number: "2", title: "Fine" }] }],
    });
    expect(tracklist.media[0].tracks).toHaveLength(1);
  });

  it("keeps a reason it understands and ignores one it does not", () => {
    expect(toTracklist({ unavailableReason: "DISCOGS" }).absence).toBe("DISCOGS");
    // A server one version ahead must leave the section on the generic wording rather
    // than putting a raw enum name on the screen.
    expect(toTracklist({ unavailableReason: "SOMETHING_NEW" }).absence).toBeNull();
  });
});

describe("the rules the two apps have to agree on", () => {
  it("pads the seconds, and says nothing for an untimed track", () => {
    expect(trackDuration(419_000)).toBe("6:59");
    expect(trackDuration(null)).toBe("");
  });

  it("adds up only what is known", () => {
    const media = toTracklist({
      media: [
        {
          position: 1,
          tracks: [
            { number: "1", title: "One", lengthMs: 60_000 },
            { number: "2", title: "Two" },
          ],
        },
      ],
    }).media;
    expect(knownDurationMs(media)).toBe(60_000);
    expect(durationParts(33_120_000)).toEqual({ hours: 9, minutes: 12 });
  });

  it("caps a box set and keeps the catalogue's numbering on what it shows", () => {
    const media = toTracklist({
      media: Array.from({ length: 8 }, (_, disc) => ({
        position: disc + 1,
        tracks: Array.from({ length: 15 }, (_, index) => ({
          number: String(index + 1),
          title: `Disc ${disc + 1} track ${index + 1}`,
        })),
      })),
    }).media;

    const { shown, hidden } = capMedia(media);
    expect(trackTotal(shown)).toBe(TRACK_ROW_CAP);
    expect(hidden).toBe(90);
    expect(shown[0].tracks[0].number).toBe("1");
  });
});
