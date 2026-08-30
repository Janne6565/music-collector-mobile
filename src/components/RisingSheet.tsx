import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";

/**
 * The panel of a bottom sheet, rising into place while the scrim behind it only fades.
 *
 * `<Modal animationType="slide">` moves the whole modal window, and every sheet in this app
 * draws its own scrim inside that window — so the dim rectangle slid up together with the
 * panel, leaving the top of the screen briefly undimmed and the grey edge visibly travelling.
 * The fix is to hand the scrim to `animationType="fade"` and animate the panel here instead.
 *
 * The rise starts from the panel's own measured height rather than a constant, so a short
 * sheet travels a short distance: a fixed offset would send a two-row sheet on the same
 * journey as a full-height one and make the small ones look flung.
 */
const RISE_MS = 260;

/**
 * Sheets that are kept mounted behind a `visible` prop have to replay the rise every time
 * they reopen; ones that are mounted only while open get it from the first layout. Both go
 * through the same path, which is why `visible` defaults to true.
 */
interface RisingSheetProps {
  readonly visible?: boolean;
  readonly style?: ViewStyle | readonly ViewStyle[];
  readonly children: React.ReactNode;
}

export function RisingSheet({ visible = true, style, children }: RisingSheetProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const height = useRef(0);
  // Held invisible until the first layout has been measured, otherwise the panel shows for
  // one frame at its resting place before being pushed down to start the rise.
  const [ready, setReady] = useState(false);
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

  const play = useCallback(() => {
    if (height.current === 0) return;
    setReady(true);
    // Motion is the whole of what this component adds, so with it turned off there is
    // nothing left to do but sit at the resting place.
    if (reduceMotion) {
      translateY.setValue(0);
      return;
    }
    translateY.setValue(height.current);
    Animated.timing(translateY, {
      toValue: 0,
      duration: RISE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, translateY]);

  useEffect(() => {
    if (visible) play();
    else setReady(false);
  }, [visible, play]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    // Later layouts are the panel growing around its own content — a keyboard appearing, a
    // pressing picker opening. Replaying the rise there would drop the sheet mid-use.
    if (next === 0 || height.current !== 0) return;
    height.current = next;
    if (visible) play();
  };

  return (
    <Animated.View
      onLayout={onLayout}
      style={[style, { opacity: ready ? 1 : 0, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}
