import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";

/**
 * Hold what is on screen until its replacement has been faded out.
 *
 * A panel that swaps on the same frame as the control above it makes the switch feel like
 * a cut, and a panel that cross-fades by stacking both has to lay out two of them. This
 * does neither: the outgoing content stays mounted at falling opacity, the value swaps at
 * the bottom of the fade, and the incoming content rises from it.
 *
 * Out is quicker than in, which is the asymmetry that reads as one thing replacing another
 * rather than two things trading places.
 *
 * The same shape the record sheet uses to flip between copies — see `useCopySwipe`.
 */
export function useSwap<T>(value: T, { out = 110, into = 190 } = {}) {
  const [shown, setShown] = useState(value);
  const opacity = useRef(new Animated.Value(1)).current;
  // Read in the effect without making it a dependency: re-running on every render would
  // restart the fade it is in the middle of.
  const latest = useRef(value);
  latest.current = value;

  // `value` is read through `latest` on purpose (see above) but still has to *trigger* the
  // fade, so it stays in the list without appearing in the body.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the value, see above.
  useEffect(() => {
    if (Object.is(shown, latest.current)) return;
    Animated.timing(opacity, { toValue: 0, duration: out, useNativeDriver: true }).start(
      ({ finished }) => {
        // Interrupted means something else has taken the animation over; leaving the old
        // content up is better than swapping it in behind whatever is now running.
        if (!finished) return;
        setShown(latest.current);
        Animated.timing(opacity, { toValue: 1, duration: into, useNativeDriver: true }).start();
      },
    );
  }, [value, shown, opacity, out, into]);

  return { shown, opacity };
}
