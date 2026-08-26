import { useRouter } from "expo-router";
import { useMemo, useRef } from "react";
import { PanResponder } from "react-native";
import { neighboursOf } from "@/features/library/copyOrder";

/**
 * Swiping left and right between the copies the shelf was showing.
 *
 * `PanResponder` rather than a gesture library because the wishlist already reorders with
 * one, and one idiom for gestures beats two.
 *
 * The whole difficulty is not stealing the vertical scroll. The responder only claims a
 * gesture once it is clearly horizontal — twice as much sideways as down, and past a
 * threshold — so an ordinary flick down the page never becomes a page turn.
 *
 * It changes the route's parameter rather than navigating. Now that the screen is a sheet,
 * `replace` tore it down and presented a new one on every swipe -- the whole thing closing
 * and reopening to show the record next to it. `setParams` leaves the sheet standing and
 * swaps what is inside it, while keeping the URL honest about which copy that is.
 */
export function useCopySwipe(copyId: string) {
  const router = useRouter();
  const neighbours = neighboursOf(copyId);
  // Read through a ref so the responder, which is built once, always sees the current pair
  // rather than the ones this copy had when the screen mounted.
  const current = useRef(neighbours);
  current.current = neighbours;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
        onPanResponderRelease: (_event, gesture) => {
          // Distance or speed: a long drag and a quick flick both count, which is what a
          // thumb actually does.
          const committed = Math.abs(gesture.dx) > 80 || Math.abs(gesture.vx) > 0.4;
          if (!committed) return;
          const target = gesture.dx < 0 ? current.current.next : current.current.previous;
          // At the ends nothing happens. A shelf that wraps has no last record.
          if (target === null) return;
          router.setParams({ copyId: target });
        },
      }),
    [router],
  );

  return {
    handlers: responder.panHandlers,
    /** Whether there is anywhere to go, so a screen can say so if it ever wants to. */
    hasNeighbours: neighbours.previous !== null || neighbours.next !== null,
  };
}
