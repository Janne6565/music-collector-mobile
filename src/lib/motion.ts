import { DURATION, EASING, MARK_HOLD } from "@janne6565/rekordo-shared";
import { useEffect, useRef, useSyncExternalStore } from "react";
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
 *
 * One subscription for the whole process, not one per caller. This is asked by every
 * placeholder that breathes, and the roll's wheel alone mounts sixty of those at once —
 * which was sixty native listeners and sixty round trips to the accessibility service for
 * a single boolean that cannot differ between them.
 */
let reducedMotion = false;
let watching = false;
const watchers = new Set<() => void>();

function reduceMotionChanged(on: boolean): void {
  if (on === reducedMotion) return;
  reducedMotion = on;
  for (const watcher of watchers) watcher();
}

/**
 * The listener is never removed. It is the app's, not any component's: dropping it when
 * the last placeholder unmounts would mean re-probing the service the next time one
 * appears, which is the cost this exists to remove.
 */
function watchReduceMotion(watcher: () => void): () => void {
  watchers.add(watcher);
  if (!watching) {
    watching = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(reduceMotionChanged);
    AccessibilityInfo.addEventListener("reduceMotionChanged", reduceMotionChanged);
  }
  return () => {
    watchers.delete(watcher);
  };
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(watchReduceMotion, () => reducedMotion);
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

  // `key` is the whole input: a Cross is replayed *because* the key changed, so the body
  // has no need to read it and every need to be re-run by it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the key, see above.
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
