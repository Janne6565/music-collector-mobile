import { describe, expect, it } from "bun:test";
import {
  fillPercent,
  formatMegabytes,
  readStorage,
  tickPercent,
} from "@/features/account/storageReading";

const MB = 1024 * 1024;
const QUOTA = 20 * MB;

const usage = (photoBytes: number, photoCount: number, avatarBytes = 0) => ({
  photoBytes,
  photoCount,
  avatarBytes,
  usedBytes: photoBytes + avatarBytes,
  quotaBytes: QUOTA,
});

describe("readStorage", () => {
  it("calls an account with no photos empty, and counts the whole quota free", () => {
    expect(readStorage(usage(0, 0))).toEqual({ kind: "empty", freeBytes: QUOTA });
  });

  it("stays empty when a profile picture is the only thing stored", () => {
    // 28c state 1 is the population, not an edge case, and 50 kB must not push it out of
    // the reading that the whole state was written for.
    const reading = readStorage(usage(0, 0, 50_000));
    expect(reading.kind).toBe("empty");
  });

  it("reads a third full as ordinary", () => {
    const reading = readStorage(usage(6.7 * MB, 22));
    expect(reading.kind).toBe("normal");
  });

  it("warns once what is left is countable in photos", () => {
    const reading = readStorage(usage(17.5 * MB, 58));
    expect(reading).toMatchObject({ kind: "nearlyFull", roomForPhotos: 8 });
  });

  it("is full when the next photo would not fit, not only at the exact line", () => {
    // 100 kB short of the quota is full in the only sense that matters to somebody about
    // to photograph a sleeve.
    const reading = readStorage(usage(QUOTA - 100_000, 66));
    expect(reading.kind).toBe("full");
  });

  it("reports how far over an account carried from before the scaling change is", () => {
    const reading = readStorage(usage(33.1 * MB, 12));
    expect(reading.kind).toBe("over");
    expect(reading.kind === "over" && Math.round(reading.overBy / MB)).toBe(13);
  });

  it("refuses to draw a bar against a quota of zero", () => {
    expect(readStorage({ ...usage(0, 0), quotaBytes: 0 }).kind).toBe("offline");
  });
});

describe("the bar", () => {
  it("never fills past its own end", () => {
    expect(fillPercent(readStorage(usage(33.1 * MB, 12)))).toBe(100);
  });

  it("moves the allowance tick once the scale flips", () => {
    // 20 of 33.1 MB: the width now means 33.1, so the tick lands at 60%.
    expect(Math.round(tickPercent(readStorage(usage(33.1 * MB, 12))))).toBe(60);
  });

  it("leaves the tick at the end while the bar still fits", () => {
    expect(tickPercent(readStorage(usage(6.7 * MB, 22)))).toBe(100);
  });
});

describe("formatMegabytes", () => {
  it("drops a decimal that would only ever be zero", () => {
    expect(formatMegabytes(QUOTA, "en")).toBe("20");
  });

  it("keeps one decimal where there is one", () => {
    expect(formatMegabytes(10.24 * MB, "en")).toBe("10.2");
  });

  it("writes the German decimal comma", () => {
    expect(formatMegabytes(10.24 * MB, "de")).toBe("10,2");
  });
});
