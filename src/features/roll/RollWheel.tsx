import { ReleaseArt } from "@/components/ReleaseArt";
import { useCoverPhotos } from "@/features/photos/useCoverPhotos";
import { curve } from "@/lib/motion";
import { colors } from "@/theme/colors";
import type { RollPhase, RollStrip } from "@janne6565/rekordo-shared";
import {
  ROLL_MIN_SPIN_MS,
  ROLL_PHONE_WHEEL,
  ROLL_PICK_GROW_DELAY_MS,
  ROLL_PICK_GROW_MS,
  ROLL_PICK_LAP,
  ROLL_PICK_SCALE,
  ROLL_SETTLE_EASING,
  ROLL_SETTLE_MS,
  ROLL_SPIN_EASING,
  ROLL_STRIP_LAPS,
  ROLL_SWAP_MS,
  catalogArtShown,
  copyFormat,
  copyPreviewSrc,
  rollBandHeight,
  rollLapWidth,
  rollRestOffset,
  rollThrowPlan,
} from "@janne6565/rekordo-shared";
import { LinearGradient } from "expo-linear-gradient";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

const WHEEL = ROLL_PHONE_WHEEL;

/** How wide the paper fade over each end of the band is. */
const FADE = WHEEL.fade;

/** How long the picked slot takes to open out into the result's artwork. */
const HERO_MS = 420;

const SETTLE_CURVE = Easing.bezier(
  ...(ROLL_SETTLE_EASING as unknown as [number, number, number, number]),
);
const SPIN_CURVE = Easing.bezier(
  ...(ROLL_SPIN_EASING as unknown as [number, number, number, number]),
);

/**
 * The wheel — turn 26a's band of covers, drifting, thrown, and stopped on one of them.
 *
 * Everything about *what* it is showing comes from the shared roll module; what lives here
 * is only how this platform moves it. The strip is the lap three times over so there are
 * covers either side of every resting place, and the transform is the one thing that ever
 * changes: no cover is ever remounted mid-throw, which is what lets the settle land on the
 * same object that was spinning.
 */
export function RollWheel({
  strip,
  phase,
  bandWidth,
  reduced,
  position,
  hero,
  heroWidth,
  heroHeight,
}: {
  readonly strip: RollStrip;
  readonly phase: RollPhase;
  readonly bandWidth: number;
  readonly reduced: boolean;
  /**
   * Whether the copy the wheel stopped on is now the result's artwork.
   *
   * It is the same view either way — the slot the settle parked on simply opens out to the
   * width of the sheet. The deck asks for the throw to read as one continuous object, and
   * cross-fading a wheel out and a hero in is two objects however well it is timed.
   *
   * It needs no travel, only size: the picked slot rests on the band's centreline and the
   * result's artwork is centred in the sheet, and the band runs the full width of the
   * screen, so those two centres are already the same point.
   */
  readonly hero: boolean;
  readonly heroWidth: number;
  readonly heroHeight: number;
  /**
   * Where the strip is, for whoever needs to know at the moment of a tap. A ref rather
   * than a prop back up: the position is a running animation, not state, and rendering on
   * every frame of it would be absurd.
   */
  readonly position?: MutableRefObject<(() => number) | null>;
}) {
  const x = useRef(new Animated.Value(0)).current;
  /** Where the strip actually is, kept in step by a listener — Animated will not say. */
  const at = useRef(0);
  const running = useRef<Animated.CompositeAnimation | null>(null);
  const lapWidth = rollLapWidth(strip, WHEEL);

  useEffect(() => {
    const id = x.addListener(({ value }) => {
      at.current = value;
    });
    if (position !== undefined) position.current = () => at.current;
    return () => {
      x.removeListener(id);
      if (position !== undefined) position.current = null;
    };
  }, [x, position]);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    const stop = () => {
      animation?.stop();
      running.current?.stop();
    };
    running.current?.stop();
    if (lapWidth === 0) return;

    if (reduced) {
      // No drift and no blur: the pick simply is where it is. The sheet cross-fades the
      // result in instead, which is the whole of the movement under this setting.
      x.setValue(phase === "IDLE" ? 0 : rollRestOffset(bandWidth, strip, WHEEL));
      return;
    }

    const rest = rollRestOffset(bandWidth, strip, WHEEL);

    if (phase === "THROWING") {
      // The spin is planned all the way to the resting place, so it can end at the speed
      // the settle needs to be handed. Moving the start whole laps from where the wheel
      // already is changes nothing on screen — the strip repeats every lap — and is what
      // stops a repeat throw from snapping back to the top.
      const plan = rollThrowPlan(at.current, rest, lapWidth);
      x.setValue(plan.from);
      animation = Animated.timing(x, {
        toValue: plan.handover,
        duration: ROLL_MIN_SPIN_MS,
        easing: SPIN_CURVE,
        useNativeDriver: true,
      });
      running.current = animation;
      animation.start();
      return stop;
    }

    if (phase === "SETTLING" || phase === "SETTLED") {
      animation = Animated.timing(x, {
        toValue: rest,
        // A sheet that mounts already settled — reopened, or reduced motion — has nothing
        // to animate; the transform is simply where it ended up.
        duration: phase === "SETTLED" ? 0 : ROLL_SETTLE_MS,
        easing: SETTLE_CURVE,
        useNativeDriver: true,
      });
      running.current = animation;
      animation.start();
      return stop;
    }

    // Idle: picked up from where the strip already is rather than from nought. Two steps,
    // because whatever is left of the lap it is in the middle of has to run before the lap
    // can go on repeat.
    const from =
      at.current % lapWidth > 0 ? (at.current % lapWidth) - lapWidth : at.current % lapWidth;
    x.setValue(from);
    const lead = Animated.timing(x, {
      toValue: -lapWidth,
      duration: (WHEEL.idleLapMs * (from + lapWidth)) / lapWidth,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation = lead;
    running.current = lead;
    lead.start(({ finished }) => {
      if (!finished) return;
      x.setValue(0);
      const loop = Animated.loop(
        Animated.timing(x, {
          toValue: -lapWidth,
          duration: WHEEL.idleLapMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      animation = loop;
      running.current = loop;
      loop.start();
    });
    return stop;
  }, [phase, strip, bandWidth, lapWidth, reduced, x]);

  /**
   * How far open the picked cover is: 0 in the lap, 1 leaning forward as the wheel stops,
   * 2 filling the sheet as the result.
   *
   * One value through both steps, so the second picks up exactly where the first left off.
   * Size rather than a transform, because the hero is nearly a whole screen wider than the
   * slot and a scale that large drags the artwork's resolution with it.
   */
  const swell = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const open = hero ? 2 : phase === "SETTLING" || phase === "SETTLED" ? 1 : 0;
    if (reduced) {
      swell.setValue(open);
      return;
    }
    const animation = Animated.timing(swell, {
      toValue: open,
      // Coming back out of the hero takes the same span as the block below it swapping
      // back, so the cover and the button arrive together rather than one chasing the other.
      duration: open === 2 ? HERO_MS : open === 1 ? ROLL_PICK_GROW_MS : ROLL_SWAP_MS,
      // Held back so the lean lands exactly as the strip stops, rather than growing all
      // the way through a settle that is still travelling.
      delay: open === 1 && phase === "SETTLING" ? ROLL_PICK_GROW_DELAY_MS : 0,
      easing: open === 2 ? curve.enter : open === 1 ? SETTLE_CURVE : curve.move,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [phase, hero, reduced, swell]);

  /** The artwork's size at each of those three stops. */
  const pickWidth = swell.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [WHEEL.cover, WHEEL.cover * ROLL_PICK_SCALE, heroWidth],
  });
  const pickHeight = swell.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [WHEEL.band, WHEEL.band * ROLL_PICK_SCALE, heroHeight],
  });
  /** Everything that is not the pick, gone by the time it is the result's artwork. */
  const rest = swell.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 1, 0] });

  const slots = useMemo(
    () => Array.from({ length: ROLL_STRIP_LAPS }, () => strip.lap).flat(),
    [strip],
  );
  const covers = useCoverPhotos(useMemo(() => strip.lap.map((row) => row.copy.id), [strip]));

  return (
    // Taller than the covers, so the picked one has room to lean forward without the
    // clipping box slicing its top and bottom off — and then as tall as the artwork it
    // becomes, so the band and the hero are one box rather than two.
    <Animated.View
      style={[
        styles.band,
        {
          height: swell.interpolate({
            inputRange: [0, 1, 2],
            outputRange: [rollBandHeight(WHEEL), rollBandHeight(WHEEL), heroHeight],
          }),
        },
      ]}
    >
      <Animated.View
        style={[
          styles.strip,
          {
            transform: [{ translateX: x }],
            // The band is meant to blur while it is thrown. React Native has no filter, so
            // the covers lose their edges by dropping opacity instead — the same reading
            // (this is moving too fast to look at) by the only means the platform has.
            opacity: phase === "THROWING" && !reduced ? 0.72 : 1,
          },
        ]}
      >
        {slots.map((row, index) => {
          // The one slot the wheel is stopping on — the copy in the lap the settle aims at,
          // not every appearance of that record on the strip.
          const chosen = index === strip.pickSlot + ROLL_PICK_LAP * strip.lap.length;
          return (
            <View
              // The same copy legitimately appears once a lap, so the key has to say which
              // slot as well as which record.
              key={`${index}:${row.copy.id}`}
              style={[
                styles.slot,
                // The slot keeps the lap's pitch whatever the artwork inside it is doing.
                // An oversized child overflows a box this size rather than widening it, so
                // the pick can open out without shoving its neighbours along the strip.
                chosen ? styles.chosenSlot : null,
              ]}
            >
              <Animated.View
                style={
                  chosen
                    ? { width: pickWidth, height: pickHeight }
                    : { width: "100%", height: "100%", opacity: rest }
                }
              >
                <ReleaseArt
                  release={row.release}
                  format={copyFormat(row.copy, row.release)}
                  previewUri={copyPreviewSrc(row.copy, covers.get(row.copy.id) ?? null)}
                  allowCatalogArt={catalogArtShown(row.copy, true)}
                  style={styles.art}
                />
              </Animated.View>
            </View>
          );
        })}
      </Animated.View>
      {/* The two ends of the wheel. They go with it: once the pick is the result's
          artwork there is no strip running off the edges for them to describe, and they
          would simply be washing out the sides of the cover. */}
      <Animated.View
        style={[styles.fade, { left: 0, width: FADE, opacity: rest }]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[colors.paper, "rgba(250,248,245,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        style={[styles.fade, { right: 0, width: FADE, opacity: rest }]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={["rgba(250,248,245,0)", colors.paper]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  band: { overflow: "hidden" },
  slot: {
    width: WHEEL.cover,
    height: WHEEL.band,
    marginRight: WHEEL.gap,
    alignItems: "center",
    justifyContent: "center",
  },
  // Above its neighbours as it opens out, or the two beside it draw over its edges.
  chosenSlot: { zIndex: 1 },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  art: { width: "100%", height: "100%" },
  fade: { position: "absolute", top: 0, bottom: 0 },
});
