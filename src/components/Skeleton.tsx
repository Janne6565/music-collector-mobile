import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, type ViewStyle } from "react-native";

/** The deck's three bar weights, strongest first — on the add screen's dark chrome. */
export type SkeletonTone = "strong" | "soft" | "faint";

const TONES: Record<SkeletonTone, string> = {
  strong: "rgba(255,255,255,0.10)",
  soft: "rgba(255,255,255,0.075)",
  faint: "rgba(255,255,255,0.055)",
};

/**
 * A pulse rather than the web's travelling gradient.
 *
 * The deck's shimmer is a gradient sliding across the block, which needs a gradient
 * library this app does not carry; a synchronised pulse at the same 1.4s is the same
 * signal — "this is a placeholder, something is on its way" — without adding a dependency
 * to move a highlight nobody will look at directly.
 */
const CYCLE_MS = 700;

interface SkeletonProps {
  readonly tone?: SkeletonTone;
  readonly style?: ViewStyle | readonly ViewStyle[];
}

/**
 * One placeholder block (turn 9).
 *
 * Deliberately dimensionless: the rule the deck sets out is that a skeleton keeps the
 * dimensions of the content it replaces, so the caller — which is the only thing that
 * knows those dimensions — supplies them, and this contributes nothing but the pulse.
 */
export function Skeleton({ tone = "strong", style }: SkeletonProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (live) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    // An indicator that will not stop moving is exactly the kind of motion people turn
    // off. Held at a steady mid-tone instead, which still reads as "not content yet".
    if (reduceMotion) {
      pulse.setValue(0.75);
      return;
    }
    const step = (toValue: number) =>
      Animated.timing(pulse, {
        toValue,
        duration: CYCLE_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      });
    const loop = Animated.loop(Animated.sequence([step(0.5), step(1)]));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      // Hidden from VoiceOver: the status line above the list already says the search is
      // running, and reading out a dozen empty boxes adds nothing to that.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ backgroundColor: TONES[tone], borderRadius: 3, opacity: pulse }, style]}
    />
  );
}
