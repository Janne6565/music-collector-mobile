import { useRouter } from "expo-router";
import { useMemo, useRef } from "react";
import { Animated, PanResponder } from "react-native";
import { neighboursOf } from "@/features/library/copyOrder";
import { useReducedMotion } from "@/lib/motion";

/** How far a drag has to go, or how fast it has to be, to count as a page turn. */
const COMMIT_DISTANCE = 80;
const COMMIT_VELOCITY = 0.4;

/**
 * Swiping left and right between the copies the shelf was showing.
 *
 * `PanResponder` rather than a gesture library, because the wishlist already reorders with
 * one and one idiom for gestures beats two. The whole difficulty is not stealing the
 * vertical scroll -- or, now that the screen is a sheet, its dismissal -- so the responder
 * claims a gesture only once it is twice as sideways as it is down.
 *
 * The swap is a cross-fade rather than a slide. A page that travels sideways promises a
 * shelf you are moving along, and this is a sheet you are leafing through -- the fade says
 * "a different record" without claiming a direction the screen does not otherwise have.
 *
 * It changes the route's parameter rather than navigating. `replace` on a modal route tore
 * the sheet down and presented a new one -- the whole thing closing and reopening to show
 * the record next to it -- while `setParams` leaves the sheet standing and swaps what is
 * inside it, keeping the URL honest about which copy that is.
 */
export function useCopySwipe(copyId: string) {
  const router = useRouter();
  const reduced = useReducedMotion();

  const fade = useRef(new Animated.Value(1)).current;
  const neighbours = neighboursOf(copyId);
  // Read through a ref so the responder, which is built once, always sees the current pair
  // rather than the ones this copy had when the screen mounted.
  const current = useRef(neighbours);
  current.current = neighbours;
  const still = useRef(reduced);
  still.current = reduced;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,

        onPanResponderRelease: (_event, gesture) => {
          // Distance or speed: a long drag and a quick flick both count, which is what a
          // thumb actually does.
          const committed =
            Math.abs(gesture.dx) > COMMIT_DISTANCE || Math.abs(gesture.vx) > COMMIT_VELOCITY;
          const target = gesture.dx < 0 ? current.current.next : current.current.previous;

          // At the ends nothing happens. A shelf that wraps has no last record.
          if (!committed || target === null) return;

          if (still.current) {
            // Somebody who asked for less movement gets the swap and none of the fade.
            router.setParams({ copyId: target });
            return;
          }

          Animated.timing(fade, {
            toValue: 0,
            duration: 110,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (!finished) return;
            router.setParams({ copyId: target });
            Animated.timing(fade, {
              toValue: 1,
              duration: 190,
              useNativeDriver: true,
            }).start();
          });
        },
      }),
    [fade, router],
  );

  return {
    handlers: responder.panHandlers,
    /** Drives the content's opacity, so one record dissolves into the next. */
    fade,
    /** Whether there is anywhere to go, so a screen can say so if it ever wants to. */
    hasNeighbours: neighbours.previous !== null || neighbours.next !== null,
  };
}
