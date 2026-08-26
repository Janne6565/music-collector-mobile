import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { usePulse } from "@/components/Skeleton";
import type { Format } from "@janne6565/music-collector-shared";
/**
 * Placeholder artwork, ported from FormatThumb.dc.html.
 *
 * Stands in wherever a release has no cover art, which is common on MusicBrainz. It
 * carries information rather than just filling space: the silhouette tells you the format
 * at a glance in a dense grid, before any text is legible.
 *
 * The tile itself is transparent. There is exactly one panel with paper on it — the sleeve
 * — and it is the same box in all four formats, so what sits around it is the page. This
 * port used to paint a second, full-bleed sheet of paper behind everything, which put a
 * warm grey border down the right and along the top and bottom of every cover in the
 * shelf and left the record looking like it was cut out of a card.
 *
 * React Native has no conic or repeating gradients, so the deck's textures are
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
   * cover, a CD sits in front of one. It is the same panel in every format — the furniture
   * that says which format this is goes over or beside it, never under it.
   */
  readonly cover?: ReactNode;
  /** Breathes the sleeve while the cover it will hold is still on its way. */
  readonly waiting?: boolean;
}) {
  const pulse = usePulse(waiting === true);

  return (
    <View style={[styles.root, style]}>
      {/* Vinyl draws its record first so the sleeve overlaps it; the rest wear their
          furniture on top of the sleeve. */}
      {format === "VINYL" && <Record />}
      <Sleeve pulse={pulse} cover={cover} elevated={format === "VINYL"} />
      {format === "CD" && <Disc />}
      {format === "CASSETTE" && <Cassette />}
      {/* `OTHER` wears nothing. It is not a format but the absence of one — the answer for
          a copy whose release this device cannot describe yet — and the waveform is the
          furniture of a specific format, so drawing it here both claims a file that was
          never claimed and stamps nine bars across whatever cover or photo the copy does
          have. A bare sleeve is what "not known" actually looks like. */}
      {format === "DIGITAL" && <Waveform />}
    </View>
  );
}

/**
 * The sleeve panel — the same box in all four formats, and the one the cover fills.
 *
 * The paper is a sibling of the cover rather than the panel's own background, so it can
 * breathe while the cover is still arriving without taking the cover with it. The edge is
 * a sibling too, and drawn last: a border on the clipping view paints under its children,
 * and the cover would swallow it.
 */
function Sleeve({
  pulse,
  cover,
  elevated,
}: {
  readonly pulse: Animated.Value;
  readonly cover?: ReactNode;
  /** Vinyl only: the sleeve stands off the record it is covering. */
  readonly elevated: boolean;
}) {
  return (
    <View style={[styles.sleeve, elevated && styles.sleeveShadow]}>
      {/* The clip is a child of the shadow-caster rather than the same view: iOS draws no
          shadow on a view that clips its own contents. */}
      <View style={styles.sleeveClip}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: SLEEVE, opacity: pulse }]}
        />
        {cover}
        <View pointerEvents="none" style={styles.sleeveEdge} />
      </View>
    </View>
  );
}

/** The record, peeking out to the right of the sleeve. */
function Record() {
  return (
    <View style={styles.record}>
      <View style={styles.recordGroove} />
      <View style={styles.recordLabel} />
    </View>
  );
}

function Disc() {
  return (
    /*
     * The disc and its case sit in front of the cover, unlike the vinyl, which peeks out
     * beside it. Drawn opaque they hide most of the artwork, so the whole assembly is eased
     * back a little: enough that a CD still reads as a CD, little enough that the cover
     * behind it is still the thing you see first.
     */
    <View pointerEvents="none" style={styles.discAssembly}>
      <View style={styles.disc}>
        <View style={styles.discHole} />
      </View>
      <LinearGradient
        colors={["rgba(255,255,255,0.5)", "rgba(255,255,255,0.06)"]}
        locations={[0.3, 0.3]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.case}
      />
      <View style={styles.caseSpine} />
    </View>
  );
}

function Cassette() {
  return (
    <>
      <LinearGradient
        colors={["rgba(255,255,255,0.42)", "rgba(255,255,255,0.06)"]}
        locations={[0.34, 0.34]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.case}
      />
      <View style={styles.tapeLine} />
      <View style={styles.tapeWindow}>
        <View style={styles.spool} />
        <View style={styles.spool} />
      </View>
    </>
  );
}

/** Bar heights, from the deck, as a percentage of the tile. */
const BARS = [10, 18, 28, 20, 34, 24, 14, 22, 12] as const;

function Waveform() {
  return (
    <>
      {BARS.map((height, index) => (
        <View
          // Bars are positional; the index is their only identity.
          key={`${height}-${index}`}
          style={[
            styles.bar,
            {
              left: `${13 + index * 7.25}%`,
              top: `${50 - height / 2}%`,
              height: `${height}%`,
              opacity: 0.38 + height / 100,
            },
          ]}
        />
      ))}
    </>
  );
}

const SLEEVE = "#e7e2d9";

const styles = StyleSheet.create({
  root: { width: "100%", aspectRatio: 1, position: "relative" },
  sleeve: { position: "absolute", left: 0, top: "6%", width: "88%", height: "88%" },
  sleeveShadow: {
    shadowColor: "#191713",
    shadowOpacity: 0.14,
    shadowRadius: 7,
    shadowOffset: { width: 3, height: 0 },
    elevation: 3,
  },
  sleeveClip: { ...StyleSheet.absoluteFill, borderRadius: 3, overflow: "hidden" },
  sleeveEdge: {
    ...StyleSheet.absoluteFill,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(25,23,19,0.1)",
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
  // The deck's single groove sits near the rim, not halfway in.
  recordGroove: { width: "94%", height: "94%", borderRadius: 999, borderWidth: 1, borderColor: "#1c1a16" },
  recordLabel: {
    position: "absolute",
    width: "16%",
    height: "16%",
    borderRadius: 999,
    backgroundColor: "#a2573a",
    borderWidth: 1,
    borderColor: "#15130f",
  },
  discAssembly: { ...StyleSheet.absoluteFill, opacity: 0.8 },
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
  tapeLine: {
    position: "absolute",
    left: "11%",
    top: "47%",
    width: "66%",
    height: "3%",
    backgroundColor: "rgba(25,23,19,0.22)",
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
  bar: { position: "absolute", width: "4%", borderRadius: 2, backgroundColor: "#191713" },
});
