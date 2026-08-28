import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { usePulse } from "@/components/Skeleton";
import type { Format } from "@janne6565/rekordo-shared";

/**
 * The format mark, ported from Format Marks.dc.html.
 *
 * One rule for all four formats: the cover stays whole and unobscured, and the thing you
 * own leans out from behind it on the right. The format is read from the shape of the
 * sliver rather than from a badge, which is what lets it work at 44px in a dense grid,
 * before any text is legible — vinyl and CD separate on value alone at that size, dark
 * against cream, and the cassette and the plug hold because their edges are straight.
 *
 * It replaced four unrelated compositions: a jewel case, a cassette lying on its case and
 * nine waveform bars, two of which were drawn *over* the artwork.
 *
 * Only the right edge of each object is ever visible — the cover ends at 83.33% and the
 * objects are laid out in the deck's full coordinates — so what this port has to get right
 * is the rim. The vinyl's label and the CD's centre hole are behind the cover and are not
 * drawn at all rather than drawn where nothing can see them. React Native has no radial or
 * conic gradients, so the two discs are layered views with a linear sheen; every other
 * part of the mark is a rectangle and is exact.
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
   * The real cover, drawn into the cover panel.
   *
   * Artwork fills the cover and nothing is drawn over it. The object leans out beside it
   * instead, which is the whole point of the mark: a cover you can read, and a format you
   * can read next to it.
   */
  readonly cover?: ReactNode;
  /** Breathes the mark while the cover it will hold is still on its way. */
  readonly waiting?: boolean;
}) {
  const pulse = usePulse(waiting === true);

  return (
    /*
     * The whole mark breathes while it waits, not just the cover panel — the object beside
     * it is as much a placeholder as the paper is, and one of the two standing still while
     * the other moves reads as a bug rather than as a distinction.
     */
    <Animated.View style={[styles.root, style, { opacity: pulse }]}>
      {format === "VINYL" && <Record />}
      {format === "CD" && <Disc />}
      {format === "CASSETTE" && <Cassette />}
      {format === "DIGITAL" && <Plug />}
      {/* `OTHER` leans nothing out. It is not a format but the absence of one — the answer
          for a copy whose release this device cannot describe yet — so there is no object
          to draw. A bare cover is what "not known" actually looks like. */}
      <Cover cover={cover} />
    </Animated.View>
  );
}

/**
 * The cover panel — a square, the same in every format, and the one the artwork fills.
 *
 * The paper is a sibling of the artwork rather than the panel's own background, so the
 * cover lands on paper rather than on whatever is behind the mark. The edge is a sibling
 * too, and drawn last: a border on the clipping view paints under its children, and the
 * artwork would swallow it. The clip is a child of the shadow-caster rather than the same
 * view, because iOS draws no shadow on a view that clips its own contents.
 */
function Cover({ cover }: { readonly cover?: ReactNode }) {
  return (
    <View style={styles.cover}>
      <View style={styles.coverClip}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: PAPER }]} />
        {cover}
        <View pointerEvents="none" style={styles.coverEdge} />
      </View>
    </View>
  );
}

/** The record, leaning out on the right: dark, with the groove ring that reaches the rim. */
function Record() {
  return (
    <View style={styles.disc}>
      <View style={styles.recordGroove} />
    </View>
  );
}

/** The same silhouette as the record, and that is the point: at 44px what separates them
 *  is value, not outline. White, with a sheen standing in for the deck's iridescence. */
function Disc() {
  return (
    <View style={[styles.disc, styles.discCd]}>
      <LinearGradient
        colors={["rgba(255,255,255,0.95)", "rgba(238,240,242,0.55)", "rgba(255,255,255,0.9)"]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.discSheen}
      />
    </View>
  );
}

/** The shell seen end-on. Straight edges, which is what holds it together at 44px. */
function Cassette() {
  return (
    <>
      <View style={styles.shell} />
      <View style={styles.shellWindow} />
      <View style={[styles.hub, styles.hubTop]} />
      <View style={[styles.hub, styles.hubBottom]} />
    </>
  );
}

/**
 * A USB-A plug leaning out, which is what "digital" is when you actually own a copy of it.
 *
 * It replaced a waveform, which drew a sound rather than a thing — the other three marks
 * are all objects you can hold, and a file on a stick is the honest member of that set.
 */
function Plug() {
  return (
    <>
      <View style={styles.plugBody} />
      <View style={styles.plugLed} />
      <View style={styles.plugShell} />
      <View style={[styles.plugStamp, styles.plugStampTop]} />
      <View style={[styles.plugStamp, styles.plugStampBottom]} />
      <View style={styles.plugSeam} />
    </>
  );
}

/** The deck's paper, flattened: React Native has no repeating gradient to stripe it with. */
const PAPER = "#e7e2d9";

const styles = StyleSheet.create({
  /*
   * A square cover plus the object beside it, which is 6:5. Stated here rather than
   * assumed of the caller, so a mark handed a square box still draws its record round.
   */
  root: { width: "100%", aspectRatio: 6 / 5, position: "relative" },

  cover: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "83.333%",
    height: "100%",
    shadowColor: "#191713",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 3, height: 1 },
    elevation: 3,
  },
  coverClip: { ...StyleSheet.absoluteFill, borderRadius: 2, overflow: "hidden" },
  coverEdge: {
    ...StyleSheet.absoluteFill,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(25,23,19,0.12)",
  },

  disc: {
    position: "absolute",
    right: 0,
    top: "8%",
    width: "70%",
    height: "84%",
    borderRadius: 999,
    backgroundColor: "#2a2620",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.35)",
    /*
     * The deck's drop shadow, and on the CD it is not decoration but the whole reason the
     * disc is visible: a near-white disc leaning out over near-white paper has nothing but
     * this to separate it from the page. Which is also why nothing here clips — iOS draws
     * no shadow on a view that clips its own contents, and the sheen is round on its own.
     */
    shadowColor: "#191713",
    shadowOpacity: 0.28,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  discCd: {
    backgroundColor: "#fbfaf8",
    borderColor: "rgba(25,23,19,0.22)",
    shadowOpacity: 0.22,
  },
  /** The one groove the rim actually shows; the rest of the deck's rings are behind the cover. */
  recordGroove: {
    width: "68%",
    height: "68%",
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#191713",
    backgroundColor: "#26231d",
  },
  discSheen: { ...StyleSheet.absoluteFill, borderRadius: 999 },

  shell: {
    position: "absolute",
    right: 0,
    top: "13%",
    width: "33%",
    height: "74%",
    borderRadius: 3,
    backgroundColor: "#26231d",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.4)",
  },
  shellWindow: {
    position: "absolute",
    right: "8%",
    top: "22%",
    width: "17%",
    height: "56%",
    borderRadius: 2,
    backgroundColor: "rgba(250,248,245,0.34)",
  },
  hub: {
    position: "absolute",
    right: "11.5%",
    width: "10%",
    height: "14%",
    borderRadius: 999,
    backgroundColor: "#191713",
    borderWidth: 1.5,
    borderColor: "rgba(250,248,245,0.55)",
  },
  hubTop: { top: "28%" },
  hubBottom: { top: "58%" },

  plugBody: {
    position: "absolute",
    right: "13.5%",
    top: "37%",
    width: "30%",
    height: "26%",
    borderRadius: 3,
    backgroundColor: "#2a2620",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.45)",
  },
  plugLed: {
    position: "absolute",
    right: "15.5%",
    top: "41.5%",
    width: "3.5%",
    height: "5%",
    borderRadius: 999,
    backgroundColor: "#a2573a",
  },
  plugShell: {
    position: "absolute",
    right: 0,
    top: "40.5%",
    width: "15.5%",
    height: "19%",
    borderRadius: 2,
    backgroundColor: "#c6c1b7",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(25,23,19,0.4)",
  },
  plugStamp: {
    position: "absolute",
    right: "4.5%",
    width: "3.8%",
    height: "4.6%",
    backgroundColor: "#6b665e",
  },
  plugStampTop: { top: "44%" },
  plugStampBottom: { top: "51.4%" },
  plugSeam: {
    position: "absolute",
    right: "15.5%",
    top: "39.5%",
    width: "0.8%",
    height: "21%",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
});
