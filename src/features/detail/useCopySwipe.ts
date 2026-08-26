import { useRouter } from "expo-router";
import { useMemo, useRef } from "react";
import { Animated, Dimensions, PanResponder } from "react-native";
import { neighboursOf } from "@/features/library/copyOrder";
import { useReducedMotion } from "@/lib/motion";

/** How far a drag has to go, or how fast it has to be, to count as a page turn. */
const COMMIT_DISTANCE = 80;
const COMMIT_VELOCITY = 0.4;

/**
 * How much of a drag survives when there is nothing in that direction.
 *
 * Not zero: a dead edge feels like a broken gesture, and a little give is how a surface
 * says "there is nothing here" without refusing to move at all.
 */
const RUBBER = 0.22;

/**
 * Swiping left and right between the copies the shelf was showing.
 *
 * `PanResponder` rather than a gesture library, because the wishlist already reorders with
 * one and one idiom for gestures beats two. The whole difficulty is not stealing the
 * vertical scroll -- or, now that the screen is a sheet, its dismissal -- so the responder
 * claims a gesture only once it is twice as sideways as it is down.
 *
 * The content follows the finger and then finishes the journey on its own. That is the part
 * that makes it feel like turning a page instead of watching one be replaced: the outgoing
 * copy leaves in the direction you pushed it, and the next arrives from the other side.
 *
 * It changes the route's parameter rather than navigating. `replace` on a modal route tore
 * the sheet down and presented a new one -- the whole thing closing and reopening to show
 * the record next to it -- while `setParams` leaves the sheet standing and swaps what is
 * inside it, keeping the URL honest about which copy that is.
 */
export function useCopySwipe(copyId: string) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const width = Dimensions.get("window").width;

  const dragX = useRef(new Animated.Value(0)).current;
  const neighbours = neighboursOf(copyId);
  // Read through a ref so the responder, which is built once, always sees the current pair
  // rather than the ones this copy had when the screen mounted.
  const current = useRef(neighbours);
  current.current = neighbours;
  const settings = useRef({ reduced, width });
  settings.current = { reduced, width };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,

        onPanResponderMove: (_event, gesture) => {
          const towards = gesture.dx < 0 ? current.current.next : current.current.previous;
          dragX.setValue(towards === null ? gesture.dx * RUBBER : gesture.dx);
        },

        onPanResponderRelease: (_event, gesture) => {
          // Distance or speed: a long drag and a quick flick both count, which is what a
          // thumb actually does.
          const committed =
            Math.abs(gesture.dx) > COMMIT_DISTANCE || Math.abs(gesture.vx) > COMMIT_VELOCITY;
          const target = gesture.dx < 0 ? current.current.next : current.current.previous;

          // At the ends nothing happens. A shelf that wraps has no last record.
          if (!committed || target === null) {
            Animated.spring(dragX, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 0,
              speed: 18,
            }).start();
            return;
          }

          const { reduced: still, width: screen } = settings.current;
          if (still) {
            // Somebody who asked for less movement gets the swap and none of the travel.
            dragX.setValue(0);
            router.setParams({ copyId: target });
            return;
          }

          const leaving = gesture.dx < 0 ? -screen : screen;
          Animated.timing(dragX, {
            toValue: leaving,
            duration: 160,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (!finished) return;
            router.setParams({ copyId: target });
            // Placed on the far side before the next frame draws, so the arriving copy
            // comes in from the direction the last one left towards.
            dragX.setValue(-leaving);
            Animated.spring(dragX, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 0,
              speed: 14,
            }).start();
          });
        },

        // A gesture taken away mid-drag (a phone call, the sheet deciding it wants it) must
        // not leave the page parked off-centre.
        onPanResponderTerminate: () => {
          Animated.spring(dragX, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
        },
      }),
    [dragX, router],
  );

  return {
    handlers: responder.panHandlers,
    /** Drives the page's own translation, so the content travels with the finger. */
    dragX,
    /** Whether there is anywhere to go, so a screen can say so if it ever wants to. */
    hasNeighbours: neighbours.previous !== null || neighbours.next !== null,
  };
}
