import { useReducedMotion } from "@/lib/motion";
import { useMemo, useRef } from "react";
import { Animated, PanResponder } from "react-native";

/** How far a drag has to go, or how fast it has to be, to count as a page turn. */
const COMMIT_DISTANCE = 80;
const COMMIT_VELOCITY = 0.4;

/**
 * Leafing sideways through a sheet, and the cross-fade that swaps what is in it.
 *
 * One responder for both sheets that have neighbours — your own copy and a friend's. They
 * had a copy each, identical down to the thresholds, and only one of them was ever fixed
 * when the claiming turned out to be wrong.
 *
 * **The gesture is claimed in the capture phase.** Both sheets put their body in a scroll
 * view, and a scroll view is a responder: asked in the bubbling phase, an ancestor is only
 * offered a touch no descendant wanted, so the drag went to the scroller and the sheet
 * never heard about it. Capture asks the ancestor first. The guard is what makes that
 * safe — twice as sideways as it is down, and past 24 points — so a vertical scroll, whose
 * `dy` dominates from the first frame, is never taken away from the list.
 *
 * `onPanResponderTerminationRequest` then refuses to hand it back, because a native sheet
 * presentation has pan recognisers of its own that would otherwise reclaim it mid-drag.
 *
 * The swap is a cross-fade rather than a slide. A page that travels sideways promises a
 * shelf you are moving along, and this is a sheet you are leafing through — the fade says
 * "a different record" without claiming a direction the screen does not otherwise have.
 *
 * @param onPrev the record to the left, or undefined at the start of the shelf
 * @param onNext the record to the right, or undefined at the end of it
 */
export function usePageFlip({
  onPrev,
  onNext,
}: {
  readonly onPrev?: () => void;
  readonly onNext?: () => void;
}) {
  const reduced = useReducedMotion();
  const fade = useRef(new Animated.Value(1)).current;

  // Read through refs so the responder, which is built once, always sees the current pair
  // rather than the ones the sheet had when it mounted.
  const moves = useRef({ onPrev, onNext });
  moves.current = { onPrev, onNext };
  const still = useRef(reduced);
  still.current = reduced;

  const responder = useMemo(() => {
    const sideways = (dx: number, dy: number) =>
      Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy) * 2;
    return PanResponder.create({
      // Never on touch-down: everything under here is still tappable and scrollable until
      // a gesture proves it is a sideways drag.
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_event, gesture) => sideways(gesture.dx, gesture.dy),
      onMoveShouldSetPanResponder: (_event, gesture) => sideways(gesture.dx, gesture.dy),
      onPanResponderTerminationRequest: () => false,

      onPanResponderRelease: (_event, gesture) => {
        // Distance or speed: a long drag and a quick flick both count, which is what a
        // thumb actually does.
        const committed =
          Math.abs(gesture.dx) > COMMIT_DISTANCE || Math.abs(gesture.vx) > COMMIT_VELOCITY;
        const go = gesture.dx < 0 ? moves.current.onNext : moves.current.onPrev;

        // At the ends nothing happens. A shelf that wraps has no last record.
        if (!committed || go === undefined) return;

        if (still.current) {
          // Somebody who asked for less movement gets the swap and none of the fade.
          go();
          return;
        }

        Animated.timing(fade, { toValue: 0, duration: 110, useNativeDriver: true }).start(
          ({ finished }) => {
            if (!finished) return;
            go();
            Animated.timing(fade, { toValue: 1, duration: 190, useNativeDriver: true }).start();
          },
        );
      },
    });
  }, [fade]);

  return {
    handlers: responder.panHandlers,
    /** Drives the content's opacity, so one record dissolves into the next. */
    fade,
  };
}
