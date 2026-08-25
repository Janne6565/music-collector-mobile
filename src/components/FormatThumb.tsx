import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { usePulse } from "@/components/Skeleton";
import type { Format } from "@/domain/types";

/**
 * Placeholder artwork, ported from FormatThumb.dc.html.
 *
 * Stands in wherever a release has no cover art, which is common on MusicBrainz. It
 * carries information rather than just filling space: the silhouette tells you the format
 * at a glance in a dense grid, before any text is legible.
 *
 * React Native has no conic or repeating gradients, so the web version's textures are
 * approximated with layered views and a linear gradient sheen.
 */
export function FormatThumb({
  format,
  style,
  cover,
  waiting,
}: {
  readonly format: Format;
  readonly style?: ViewStyle;
  /**
   * The real cover, drawn into the sleeve.
   *
   * Artwork belongs on the sleeve, not over the whole tile: a record sticks out past its
   * cover, a CD sits in front of one. Which panel is the sleeve depends on the format —
   * vinyl has a front panel over the record, the others use the full tile — and that is
   * exactly the geometry this component already owns.
   */
  readonly cover?: ReactNode;
  /** Breathes the sleeve while the cover it will hold is still on its way. */
  readonly waiting?: boolean;
}) {
  const pulse = usePulse(waiting === true);
  const vinyl = format === "VINYL";

  return (
    <View style={[styles.root, style]}>
      {/* For vinyl this is only the ground behind the record; the front panel below is
          the sleeve that holds the cover. Every other format wears it as the sleeve. */}
      <Sleeve style={styles.sleeve} fill={SLEEVE} pulse={pulse} cover={vinyl ? undefined : cover} />
      {vinyl && <Vinyl cover={cover} pulse={pulse} />}
      {format === "CD" && <Disc />}
      {format === "CASSETTE" && <Cassette />}
      {(format === "DIGITAL" || format === "OTHER") && <Waveform />}
    </View>
  );
}

/**
 * A sleeve panel: its paper, and whatever cover is printed on it.
 *
 * The paper is a sibling of the cover rather than the panel's own background, so it can
 * breathe while the cover is still arriving without taking the cover with it.
 */
function Sleeve({
  style,
  fill,
  pulse,
  cover,
}: {
  readonly style: ViewStyle;
  readonly fill: string;
  readonly pulse: Animated.Value;
  readonly cover?: ReactNode;
}) {
  return (
    <View style={style}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: fill, opacity: pulse }]}
      />
      {cover}
    </View>
  );
}

function Vinyl({ cover, pulse }: { readonly cover?: ReactNode; readonly pulse: Animated.Value }) {
  return (
    <>
      <View style={styles.record}>
        <View style={styles.recordGroove} />
        <View style={styles.recordLabel} />
      </View>
      <Sleeve style={styles.sleeveFront} fill="#eae6de" pulse={pulse} cover={cover} />
    </>
  );
}

function Disc() {
  return (
    <>
      <View style={styles.disc}>
        <View style={styles.discHole} />
      </View>
      <LinearGradient
        colors={["rgba(255,255,255,0.5)", "rgba(255,255,255,0.06)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.case}
      />
      <View style={styles.caseSpine} />
    </>
  );
}

function Cassette() {
  return (
    <>
      <LinearGradient
        colors={["rgba(255,255,255,0.42)", "rgba(255,255,255,0.06)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.case}
      />
      <View style={styles.tapeWindow}>
        <View style={styles.spool} />
        <View style={styles.spool} />
      </View>
    </>
  );
}

const BARS = [10, 18, 28, 20, 34, 24, 14, 22, 12] as const;

function Waveform() {
  return (
    <View style={styles.waveform}>
      {BARS.map((height, index) => (
        <View
          // Bars are positional; the index is their only identity.
          key={`${height}-${index}`}
          style={[styles.bar, { height: `${height * 2}%`, opacity: 0.38 + height / 100 }]}
        />
      ))}
    </View>
  );
}

const SLEEVE = "#e7e2d9";

const styles = StyleSheet.create({
  root: { width: "100%", aspectRatio: 1, position: "relative" },
  sleeve: { ...StyleSheet.absoluteFill, borderRadius: 3, overflow: "hidden" },
  sleeveFront: {
    position: "absolute",
    left: 0,
    top: "6%",
    width: "88%",
    height: "88%",
    borderRadius: 3,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(25,23,19,0.14)",
  },
  record: {
    position: "absolute",
    right: 0,
    top: "10%",
    width: "80%",
    height: "80%",
    borderRadius: 999,
    backgroundColor: "#26231d",
    alignItems: "center",
    justifyContent: "center",
  },
  recordGroove: { width: "60%", height: "60%", borderRadius: 999, borderWidth: 1, borderColor: "#1c1a16" },
  recordLabel: { position: "absolute", width: "18%", height: "18%", borderRadius: 999, backgroundColor: "#a2573a" },
  disc: {
    position: "absolute",
    left: "13%",
    top: "19%",
    width: "62%",
    height: "62%",
    borderRadius: 999,
    backgroundColor: "#eeeae3",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(25,23,19,0.16)",
  },
  discHole: { width: "22%", height: "22%", borderRadius: 999, backgroundColor: "#faf8f5" },
  case: {
    position: "absolute",
    left: "4%",
    top: "10%",
    width: "80%",
    height: "80%",
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(25,23,19,0.3)",
  },
  caseSpine: {
    position: "absolute",
    left: "4%",
    top: "16%",
    width: "4%",
    height: "68%",
    backgroundColor: "rgba(25,23,19,0.18)",
  },
  tapeWindow: {
    position: "absolute",
    left: "11%",
    top: "52%",
    width: "66%",
    height: "32%",
    borderRadius: 3,
    backgroundColor: "rgba(25,23,19,0.34)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
  },
  spool: {
    width: "22%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: "rgba(250,248,245,0.55)",
    borderWidth: 2,
    borderColor: "rgba(25,23,19,0.35)",
  },
  waveform: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "3%",
  },
  bar: { width: "4%", borderRadius: 2, backgroundColor: "#191713" },
});
