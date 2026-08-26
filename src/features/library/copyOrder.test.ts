import { beforeEach, describe, expect, it } from "bun:test";
import { neighboursOf, rememberCopyOrder } from "@/features/library/copyOrder";

describe("the order the shelf was showing", () => {
  beforeEach(() => rememberCopyOrder([]));

  it("hands back what sits either side", () => {
    rememberCopyOrder(["a", "b", "c"]);
    expect(neighboursOf("b")).toEqual({ previous: "a", next: "c" });
  });

  it("does not wrap at the ends", () => {
    // A shelf that loops has no last record, and the swipe that would have said so
    // quietly starts again instead.
    rememberCopyOrder(["a", "b", "c"]);
    expect(neighboursOf("a").previous).toBeNull();
    expect(neighboursOf("c").next).toBeNull();
  });

  it("has no neighbours for a copy the list never held", () => {
    // A deep link or a cold start reaches the screen with no list behind it. Nulls are the
    // honest answer; inventing an order would swipe somebody somewhere they never were.
    rememberCopyOrder(["a", "b"]);
    expect(neighboursOf("zzz")).toEqual({ previous: null, next: null });
    rememberCopyOrder([]);
    expect(neighboursOf("a")).toEqual({ previous: null, next: null });
  });
});
