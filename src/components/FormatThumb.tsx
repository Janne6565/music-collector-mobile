import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, type ViewStyle } from "react-native";
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
export function FormatThumb({ format, style }: { readonly format: Format; readonly style?: ViewStyle }) {
  return (
    <View style={[styles.root, style]}>
      <View style={styles.sleeve} />
      {format === "VINYL" && <Vinyl />}
      {format === "CD" && <Disc />}
      {format === "CASSETTE" && <Cassette />}
      {(format === "DIGITAL" || format === "OTHER") && <Waveform />}
    </View>
  );
}

function Vinyl() {
  return (
    <>
      <View style={styles.record}>
        <View style={styles.recordGroove} />
        <View style={styles.recordLabel} />
      </View>
      <View style={styles.sleeveFront} />
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
  sleeve: { ...StyleSheet.absoluteFill, backgroundColor: SLEEVE, borderRadius: 3 },
  sleeveFront: {
    position: "absolute",
    left: 0,
    top: "6%",
    width: "88%",
    height: "88%",
    borderRadius: 3,
    backgroundColor: "#eae6de",
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
