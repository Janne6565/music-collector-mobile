import { LinearGradient } from "expo-linear-gradient";
import { Disc3 } from "lucide-react-native";
import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";

/**
 * What the item detail's hero shows when there is no picture of the record.
 *
 * It occupies exactly the frame a cover would: full bleed, square, cropping under the
 * header as you scroll like any sleeve does. That is the whole point — the header should
 * not change shape depending on whether the archive happened to have artwork, and a copy
 * with no cover should still look like a record you own rather than like a screen that
 * failed to load.
 *
 * The format silhouette used to stand here instead. It is the right answer in a grid tile,
 * where it is the only thing that can say what a 44px square is — but at the width of the
 * screen it was a vinyl the size of the hero, saying in a drawing what the badge directly
 * underneath already says in words, and its 6:5 composition left a band of bare ground
 * across the bottom of a square frame.
 *
 * So this is paper rather than an object: the sleeve's own stock, the light falling across
 * it, and the disc pressed into it faintly enough to read as an emboss rather than as a
 * picture of a record. Drawn rather than shipped as a file, like every other mark in the
 * app, so it is sharp at any size and carries no bytes.
 */
export function CoverPlaceholder() {
  // The mark is a proportion of the frame, and a lucide icon takes a number. Measured
  // rather than guessed, because this same placeholder is drawn at a wishlist entry's
  // tile size and at the full width of a phone.
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View style={[StyleSheet.absoluteFill, styles.paper]} onLayout={onLayout}>
      {/*
       * Light across the sleeve, top-left to bottom-right. Flat beige is what a broken
       * image looks like; a sheet of paper catching light is what an empty sleeve looks
       * like, and the difference is one gradient.
       */}
      <LinearGradient
        colors={["rgba(255,255,255,0.55)", "rgba(255,255,255,0.06)", "rgba(25,23,19,0.06)"]}
        locations={[0, 0.58, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {width > 0 && (
        <View style={styles.centre}>
          <Disc3 size={width * MARK_SCALE} color={MARK_INK} strokeWidth={0.7} />
        </View>
      )}
    </View>
  );
}

/** How much of the frame the embossed disc takes across. */
const MARK_SCALE = 0.32;

/**
 * Faint on purpose.
 *
 * Anything darker reads as an icon — a symbol placed on the sleeve — rather than as the
 * paper's own surface, and an icon at this size competes with the title underneath for
 * being the thing the screen is about.
 */
const MARK_INK = "rgba(25,23,19,0.13)";

const styles = StyleSheet.create({
  /** The sleeve stock `FormatThumb` prints its cover panel on, so the two agree. */
  paper: { backgroundColor: "#e7e2d9", overflow: "hidden" },
  centre: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
});
