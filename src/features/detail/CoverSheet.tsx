import type { DetailChrome } from "@janne6565/rekordo-shared";
import { X } from "lucide-react-native";
import { type ReactNode, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  type GestureResponderHandlers,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * How much of the sleeve survives the crop once the header has closed up — a band across
 * the top, full width, so the record is still named by its artwork however far down you
 * have read.
 */
const COVER_MIN = 96;
/** How far the collapsed band steps back towards the page's colour. */
const VEIL = 0.55;

/**
 * The frame a record is read in: a pinned sleeve that crops as you scroll, and a way out
 * that does not scroll with it.
 *
 * Shared between your own copy and somebody else's, because the frame is the part they
 * have in common. What goes *in* it is not: your own copy can be edited, photographed,
 * rated and thrown away, and on somebody else's those are not disabled but absent. So the
 * body is the caller's and only the shell lives here.
 *
 * Everything moves by transform. Only transforms and opacity run on the native driver, and
 * a header that animates its height runs on the JS thread — the scroll offset is written
 * straight into an Animated.Value by `Animated.event` and never round-trips through JS
 * while a thumb is on the glass.
 */
export function CoverSheet({
  art,
  chrome,
  onClose,
  fade,
  handlers,
  children,
}: {
  readonly art: ReactNode;
  readonly chrome: DetailChrome;
  readonly onClose: () => void;
  /** Drives the whole sheet's opacity while it is being flipped to a neighbour. */
  readonly fade?: Animated.Value;
  /** A pan responder's handlers, when the caller has neighbours to move between. */
  readonly handlers?: GestureResponderHandlers;
  readonly children: ReactNode;
}) {
  const { t } = useTranslation();
  const coverMax = useWindowDimensions().width;

  const scrollY = useRef(new Animated.Value(0)).current;
  const travel = coverMax - COVER_MIN;
  const collapsed = scrollY.interpolate({
    inputRange: [0, travel],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  /*
   * The frame rides up out of the picture and clips it; the picture is never resized. Full
   * width the whole way down, cropped top and bottom, ending as a band across the top.
   */
  const headerY = collapsed.interpolate({ inputRange: [0, 1], outputRange: [0, -travel] });
  /*
   * And the picture drifts back down inside it at half the rate, so what survives the crop
   * is the middle of the sleeve rather than its bottom edge. Without this the frame would
   * slide off the top of the artwork and leave the last few pixels of it standing.
   */
  const imageY = collapsed.interpolate({ inputRange: [0, 1], outputRange: [0, travel / 2] });
  /*
   * And it recedes as it goes. Once the sleeve is a band behind the words it is no longer
   * what you are reading, so it steps back towards the page's own colour.
   */
  const veil = collapsed.interpolate({ inputRange: [0, 1], outputRange: [0, VEIL] });
  /*
   * What the sleeve does when the list is pulled past its own top.
   *
   * The picture is pinned outside the scroll view and the body scrolls under it, which is
   * a seam the screen spends the rest of its time hiding: they read as one canvas only
   * while the offset is positive. iOS drives it negative on every bounce, and a sleeve
   * that clamped at zero there would stand still while the words slid out from under it —
   * the one moment the page admits it is two layers.
   *
   * So the sleeve answers the pull as well, by growing: its top edge stays where it is and
   * its bottom edge follows the words down, which is the whole distance the seam could
   * otherwise open. Uniform rather than vertical, because a sleeve is square and a
   * stretched record looks like a mistake — the extra width is cropped by the frame.
   */
  const pull = { inputRange: [-coverMax, 0], extrapolate: "clamp" as const };
  const stretch = scrollY.interpolate({ ...pull, outputRange: [2, 1] });
  /*
   * A scale runs about the centre, so half the growth would go up over the status bar and
   * only the other half would reach the words. This puts the box back down by that half.
   */
  const stretchY = scrollY.interpolate({ ...pull, outputRange: [coverMax / 2, 0] });

  return (
    // No background of its own: the layers behind it own the colour, which is what lets a
    // wash run underneath while this stays put.
    <Animated.View
      style={[styles.root, fade === undefined ? null : { opacity: fade }]}
      {...handlers}
    >
      <Animated.ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: coverMax }]}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        {children}
      </Animated.ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.pinnedCover,
          {
            width: coverMax,
            height: coverMax,
            // Only one of these two is ever doing anything: `headerY` is clamped to the
            // scrolled-down half and the stretch to the pulled-past-the-top half.
            transform: [{ translateY: headerY }, { translateY: stretchY }, { scale: stretch }],
          },
        ]}
      >
        {/* Explicitly square rather than left to work itself out: everything inside is
            absolutely positioned, and a box that is not definite on its own collapses. */}
        <Animated.View
          style={{ width: coverMax, height: coverMax, transform: [{ translateY: imageY }] }}
        >
          {art}
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: chrome.background, opacity: veil }]}
        />
      </Animated.View>

      {/* Outside the scroll view entirely: it is the way out, and a way out that scrolls
          away is one you have to go looking for. */}
      <SafeAreaView style={styles.backWrap} edges={["top"]} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("detail.back")}
          onPress={onClose}
          style={[styles.back, { backgroundColor: chrome.surface }]}
        >
          <X size={18} color={chrome.ink} strokeWidth={1.75} />
        </Pressable>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 40 },
  pinnedCover: { position: "absolute", left: 0, top: 0, overflow: "hidden" },
  backWrap: { position: "absolute", left: 18, right: 18, top: 0, alignItems: "flex-start" },
  back: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
});

export const COVER_BAND = COVER_MIN;
