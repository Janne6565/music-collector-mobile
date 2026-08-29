import type { AvatarCrop } from "@/api/avatar";
import type { ChosenPicture } from "@/features/account/useProfilePictureLogic";
import { Gesture } from "react-native-gesture-handler";
import type { ComposedGesture } from "react-native-gesture-handler";
import type { ImageStyle } from "react-native";
import {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export const MAX_ZOOM = 6;

/** What `useAnimatedStyle` hands back for an image, named so the interface can say it. */
type AnimatedImageStyle = ReturnType<typeof useAnimatedStyle<ImageStyle>>;

/** How far past an edge a finger may drag before the picture stops following, in stage px. */
const GIVE = 56;
/** How much of that give is spent by the time the finger is `GIVE` past the edge. */
const RESISTANCE = 0.55;

const SETTLE = { damping: 22, stiffness: 260, mass: 0.6 } as const;

/**
 * The two hands on the picture: where the circle sits over it, and how big it is.
 *
 * <p>Held as a scale and a translation of the picture's centre rather than as the crop
 * rectangle, because that is what the gestures move. The rectangle the server wants is
 * derived once, at the end, from whatever the fingers left behind.
 *
 * <p>Everything here lives in shared values and runs on the UI thread. The screen this
 * replaced put every frame of a pinch through `setState`, which re-rendered the stage and
 * both previews between one finger position and the next; on a large photo that is what
 * "the zoom is bad" actually was. React is told nothing until the crop is confirmed.
 */
export interface Framing {
  readonly gesture: ComposedGesture;
  /** The picture, positioned and scaled. Feed this to an `Animated.Image`. */
  readonly imageStyle: AnimatedImageStyle;
  /** The three numbers everything else is derived from, for the previews to read. */
  readonly at: {
    readonly x: SharedValue<number>;
    readonly y: SharedValue<number>;
    readonly scale: SharedValue<number>;
  };
  readonly stageSize: number;
  readonly diameter: number;
  /** The natural size the picture is laid out at, before the gestures scale it. */
  readonly fitted: { readonly width: number; readonly height: number };
  /** True while the picture sits exactly where it opened, so the reset can hide itself. */
  readonly moved: SharedValue<boolean>;
  readonly reset: () => void;
  /** The framed square in the picture's own pixels. Read once, when the button is pressed. */
  readonly crop: () => AvatarCrop;
}

/**
 * Beyond the edge the picture still follows a finger, but less and less of the way, and
 * springs back when the finger lifts.
 *
 * A hard stop reads as the app having missed the gesture. This reads as the edge of the
 * picture, which is what it is.
 */
function resist(value: number, limit: number): number {
  "worklet";
  const over = Math.abs(value) - limit;
  if (over <= 0) return value;
  const damped = (over * GIVE * RESISTANCE) / (over * RESISTANCE + GIVE);
  return Math.sign(value) * (limit + damped);
}

export function useFraming(picture: ChosenPicture, stageSize: number, diameter: number): Framing {
  /* The shorter side exactly fills the circle at zoom 1, so the picture always covers it. */
  const base = diameter / Math.min(picture.width, picture.height);
  const fitted = { width: picture.width * base, height: picture.height * base };

  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const moved = useSharedValue(false);

  /* Deltas, not totals: pan and pinch both write to the same two values in the same frame,
     so each has to add its own change rather than overwrite what the other just did. */
  const lastPan = useSharedValue({ x: 0, y: 0 });
  const lastScale = useSharedValue(1);

  const limitX = (atScale: number) => {
    "worklet";
    return Math.max(0, (fitted.width * atScale - diameter) / 2);
  };
  const limitY = (atScale: number) => {
    "worklet";
    return Math.max(0, (fitted.height * atScale - diameter) / 2);
  };

  /** Springs whatever the fingers left back inside the picture's own edges. */
  const settle = () => {
    "worklet";
    const target = Math.min(MAX_ZOOM, Math.max(1, scale.value));
    if (target !== scale.value) {
      // Re-centre by the same factor the scale is about to change by, or the corner the
      // spring is fixing would slide across the circle on the way back.
      const k = target / scale.value;
      x.value = withSpring(clampTo(x.value * k, limitX(target)), SETTLE);
      y.value = withSpring(clampTo(y.value * k, limitY(target)), SETTLE);
      scale.value = withSpring(target, SETTLE);
    } else {
      x.value = withSpring(clampTo(x.value, limitX(target)), SETTLE);
      y.value = withSpring(clampTo(y.value, limitY(target)), SETTLE);
    }
    moved.value = target !== 1 || x.value !== 0 || y.value !== 0;
  };

  const pan = Gesture.Pan()
    .maxPointers(2)
    // The centroid, so a two-finger pinch that also drifts does not fight the pinch.
    .averageTouches(true)
    .onStart(() => {
      lastPan.value = { x: 0, y: 0 };
    })
    .onUpdate((event) => {
      x.value = resist(x.value + event.translationX - lastPan.value.x, limitX(scale.value));
      y.value = resist(y.value + event.translationY - lastPan.value.y, limitY(scale.value));
      lastPan.value = { x: event.translationX, y: event.translationY };
    })
    .onEnd(settle);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      lastScale.value = 1;
    })
    .onUpdate((event) => {
      const factor = event.scale / lastScale.value;
      lastScale.value = event.scale;
      const next = Math.min(MAX_ZOOM * 1.6, Math.max(0.7, scale.value * factor));
      const k = next / scale.value;
      /*
       * Zooms about the fingers, not about the middle. Zooming about the middle is what
       * made the old one feel wrong: the detail somebody had pinched towards slid out from
       * under the fingers doing the pinching.
       */
      const focalX = event.focalX - stageSize / 2;
      const focalY = event.focalY - stageSize / 2;
      x.value = focalX - (focalX - x.value) * k;
      y.value = focalY - (focalY - y.value) * k;
      scale.value = next;
    })
    .onEnd(settle);

  /*
   * Double tap, the shortcut every photo app has: zoomed in, it gives the whole picture
   * back; zoomed out, it goes in on what was tapped rather than on the middle.
   */
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(260)
    .onEnd((event) => {
      if (scale.value > 1.02) {
        scale.value = withTiming(1, { duration: 220 });
        x.value = withTiming(0, { duration: 220 });
        y.value = withTiming(0, { duration: 220 });
        moved.value = false;
        return;
      }
      const next = 2.5;
      const focalX = event.x - stageSize / 2;
      const focalY = event.y - stageSize / 2;
      const k = next / scale.value;
      scale.value = withTiming(next, { duration: 220 });
      x.value = withTiming(clampTo(focalX - (focalX - x.value) * k, limitX(next)), {
        duration: 220,
      });
      y.value = withTiming(clampTo(focalY - (focalY - y.value) * k, limitY(next)), {
        duration: 220,
      });
      moved.value = true;
    });

  const imageStyle = useAnimatedStyle<ImageStyle>(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return {
    /*
     * Race, not Exclusive: Exclusive makes every drag wait for the double tap to fail
     * first, which is a real and visible lag on the one gesture people use most. A pan only
     * activates once a finger has travelled past the slop, which a genuine double tap never
     * does, so the two do not actually compete.
     */
    gesture: Gesture.Race(doubleTap, Gesture.Simultaneous(pan, pinch)),
    imageStyle,
    at: { x, y, scale },
    stageSize,
    diameter,
    fitted,
    moved,
    reset: () => {
      scale.value = withTiming(1, { duration: 220 });
      x.value = withTiming(0, { duration: 220 });
      y.value = withTiming(0, { duration: 220 });
      moved.value = false;
    },
    crop: () => {
      /*
       * Clamped again here rather than trusted. The button can be pressed while a spring is
       * still travelling, and a crop half a pixel off the edge is a 400 from the server.
       */
      const at = Math.min(MAX_ZOOM, Math.max(1, scale.value));
      const size = diameter / (base * at);
      const cx = clampTo(x.value, limitX(at));
      const cy = clampTo(y.value, limitY(at));
      return {
        x: Math.min(
          Math.max(0, (fitted.width * at) / 2 - diameter / 2 - cx) / (base * at),
          picture.width - size,
        ),
        y: Math.min(
          Math.max(0, (fitted.height * at) / 2 - diameter / 2 - cy) / (base * at),
          picture.height - size,
        ),
        size,
      };
    },
  };
}

/**
 * What one of the two previews has to draw: the same square, at the size the app will
 * really use. Kept on the UI thread with everything else, so the little circles move with
 * the picture instead of a frame behind it.
 */
export function usePreviewStyle(framing: Framing, size: number): AnimatedImageStyle {
  const { fitted, diameter, at } = framing;
  return useAnimatedStyle<ImageStyle>(() => {
    /*
     * The same arithmetic as `crop`, expressed in preview pixels instead of the picture's.
     * `k` is how much of a real avatar this circle is, so nothing here has to divide by the
     * scale and nothing goes to infinity while a spring passes through zero.
     */
    const k = size / diameter;
    return {
      position: "absolute" as const,
      left: -((fitted.width * at.scale.value) / 2 - diameter / 2 - at.x.value) * k,
      top: -((fitted.height * at.scale.value) / 2 - diameter / 2 - at.y.value) * k,
      width: fitted.width * at.scale.value * k,
      height: fitted.height * at.scale.value * k,
    };
  });
}

function clampTo(value: number, limit: number): number {
  "worklet";
  return Math.min(limit, Math.max(-limit, value));
}
