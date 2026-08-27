import { DURATION, EASING, MARK_HOLD } from "@janne6565/rekordo-shared";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

/**
 * The device's half of turn 13's motion set.
 *
 * The values themselves come from the shared package, so the two clients cannot drift
 * apart on what "base" means. What lives here is what React Native needs and CSS does not:
 * the easing curves as `Easing` objects, the reduce-motion query, and the two one-shots
 * that have no declarative form on this platform.
 */

export const curve = {
  enter: Easing.bezier(...(EASING.enter as unknown as [number, number, number, number])),
  exit: Easing.bezier(...(EASING.exit as unknown as [number, number, number, number])),
  move: Easing.bezier(...(EASING.move as unknown as [number, number, number, number])),
};

/**
 * Whether the reader has asked for less movement.
 *
 * Read once and then listened to, because it can be turned on while the app is open — and
 * on this platform there is no media query to fall back on.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduced(on);
    });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      alive = false;
      listener.remove();
    };
  }, []);
  return reduced;
}

/**
 * A Cross: one block of content replacing another in place.
 *
 * Never per row. The list keeps its scroll and its height is not animated, so the keyboard
 * never appears to move under a search that is still resolving.
 */
export function useCross(key: string): Animated.Value {
  const opacity = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: reduced ? DURATION.quick : DURATION.base,
      easing: reduced ? curve.exit : curve.enter,
      useNativeDriver: true,
    }).start();
  }, [key, opacity, reduced]);

  return opacity;
}

/**
 * The Mark ring: one-shot, and not a transition.
 *
 * In at quick, hold, out at slow. Unchanged under reduced motion — it is opacity, and it
 * is the only thing telling you where the record went.
 */
export function useMarkRing(active: boolean): Animated.Value {
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const animation = Animated.sequence([
      Animated.timing(ring, {
        toValue: 1,
        duration: DURATION.quick,
        easing: curve.enter,
        useNativeDriver: true,
      }),
      Animated.delay(MARK_HOLD),
      Animated.timing(ring, {
        toValue: 0,
        duration: DURATION.slow,
        easing: curve.exit,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [active, ring]);

  return ring;
}
