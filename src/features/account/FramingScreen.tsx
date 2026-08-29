import type { AvatarCrop } from "@/api/avatar";
import { type Framing, useFraming, usePreviewStyle } from "@/features/account/useFraming";
import type { SharedValue } from "react-native-reanimated";
import type { ChosenPicture } from "@/features/account/useProfilePictureLogic";
import { colors, fonts } from "@/theme/colors";
import { RotateCcw } from "lucide-react-native";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { FadeIn, runOnJS, useAnimatedReaction } from "react-native-reanimated";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Screen 27c — framing, full screen and against dark.
 *
 * <p>The dark is not decoration: it is what lets the lit circle be the only thing on the
 * screen, and it is why the accent here is the {@code d08a5f} variant rather than the
 * paper-bound one. Drag moves, pinch zooms, double tap goes in and back out, and it opens
 * on the centre square, so the button underneath is a single tap for the picture most
 * people picked.
 *
 * <p>The two previews are the two sizes that actually decide whether a crop works: 56,
 * where the profile header draws it, and 24, where the feed does and a face is only a
 * colour. They are animated rather than re-rendered, so they track the gesture exactly.
 */
export function FramingScreen({
  picture,
  onCancel,
  onConfirm,
}: {
  readonly picture: ChosenPicture;
  readonly onCancel: () => void;
  readonly onConfirm: (crop: AvatarCrop) => void;
}) {
  const { t } = useTranslation();
  const stageSize = Math.min(Dimensions.get("window").width - 44, 346);
  const framing = useFraming(picture, stageSize, Math.round(stageSize * 0.87));

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      {/*
       * A gesture root of its own. React Native's `Modal` is a separate native window, and
       * a detector inside one is out of reach of any root the app set up outside it — on
       * Android that means the picture simply does not move.
       */}
      <GestureHandlerRootView style={styles.screen}>
        <View style={styles.bar}>
          <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={12}>
            <Text style={styles.cancel}>{t("common.cancel")}</Text>
          </Pressable>
          <Text style={styles.barTitle}>{t("account.picture.framing.title")}</Text>
          <ResetButton
            moved={framing.moved}
            onReset={framing.reset}
            label={t("account.picture.framing.reset")}
          />
        </View>

        <View style={styles.stageArea}>
          <GestureDetector gesture={framing.gesture}>
            {/* `collapsable` off: an Android view with no drawing of its own can be folded
                away at the native level, and a folded view has nothing to attach to. */}
            <View style={[styles.stage, { width: stageSize, height: stageSize }]} collapsable={false}>
              <Animated.Image
                source={{ uri: picture.uri }}
                style={[
                  {
                    position: "absolute",
                    left: (stageSize - framing.fitted.width) / 2,
                    top: (stageSize - framing.fitted.height) / 2,
                    width: framing.fitted.width,
                    height: framing.fitted.height,
                  },
                  framing.imageStyle,
                ]}
              />
              <Scrim diameter={framing.diameter} stage={stageSize} />
            </View>
          </GestureDetector>
          <Text style={styles.hint}>{t("account.picture.framing.hint")}</Text>
        </View>

        <View style={styles.foot}>
          <View style={styles.footRow}>
            <View style={styles.previews}>
              <Preview framing={framing} picture={picture} size={56} />
              <Preview framing={framing} picture={picture} size={24} />
            </View>
            <Text style={styles.publicLine}>{t("account.picture.framing.publicShort")}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => onConfirm(framing.crop())}
            style={styles.use}
          >
            <Text style={styles.useText}>{t("account.picture.framing.use")}</Text>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * The way back to the square it opened on.
 *
 * It appears only once something has been moved, so the bar is empty for the picture that
 * needed no framing at all — which, the whole screen assumes, is most of them.
 *
 * This is the one thing the gestures tell React about, and it crosses over as a boolean
 * that flips at most a handful of times, never as a position.
 */
function ResetButton({
  moved,
  onReset,
  label,
}: {
  readonly moved: SharedValue<boolean>;
  readonly onReset: () => void;
  readonly label: string;
}) {
  const [shown, setShown] = useState(false);
  /*
   * The shared value itself, not the `Framing` it came from. A worklet is serialised along
   * with everything it closes over, so reaching through the whole object for one field
   * takes the object with it — and one of its fields is the gesture, which cannot be
   * copied. It fails at runtime, not at build time: "Cannot copy value of type
   * `ComposedGesture`". Hand worklets the values they need, never the bag they live in.
   */
  useAnimatedReaction(
    () => moved.value,
    (now, before) => {
      if (now !== before) runOnJS(setShown)(now);
    },
  );

  if (!shown) return <View style={styles.reset} />;
  return (
    <Animated.View entering={FadeIn.duration(160)} style={styles.reset}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onReset}
        hitSlop={12}
      >
        <RotateCcw size={17} color="rgba(255,255,255,0.7)" strokeWidth={1.75} />
      </Pressable>
    </Animated.View>
  );
}

/**
 * The dark outside the circle.
 *
 * <p>One view, sized far larger than the stage and given a border thick enough to reach
 * every edge of it: the hole in the middle of a rounded border *is* the circle, so what is
 * dimmed is exactly what is not in the crop.
 *
 * <p>It used to be four rectangles around the circle's bounding box, which left the four
 * corners of that box undimmed. On any picture that filled the stage, that read as a black
 * frame around a square rather than as a circular mask, because that is what it was.
 */
function Scrim({ diameter, stage }: { readonly diameter: number; readonly stage: number }) {
  /* Big enough that the ring still covers the corners of the stage from the middle of it. */
  const outer = Math.ceil(stage * 1.5) * 2;
  const ring = (outer - diameter) / 2;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={{
          position: "absolute",
          left: (stage - outer) / 2,
          top: (stage - outer) / 2,
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          borderWidth: ring,
          borderColor: "rgba(12,11,10,0.68)",
        }}
      />
      <View
        style={[
          styles.lit,
          { left: (stage - diameter) / 2, top: (stage - diameter) / 2, width: diameter, height: diameter, borderRadius: diameter / 2 },
        ]}
      />
    </View>
  );
}

/** What the circle will look like at one of the sizes the app actually draws. */
function Preview({
  framing,
  picture,
  size,
}: {
  readonly framing: Framing;
  readonly picture: ChosenPicture;
  readonly size: number;
}) {
  const style = usePreviewStyle(framing, size);
  return (
    <View style={[styles.preview, { width: size, height: size, borderRadius: size / 2 }]}>
      <Animated.Image source={{ uri: picture.uri }} style={style} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  bar: {
    paddingTop: 58,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cancel: { fontFamily: fonts.sans, fontSize: 15, fontWeight: "500", color: "rgba(255,255,255,0.7)" },
  barTitle: {
    fontFamily: "Menlo",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.4)",
  },
  reset: { width: 44, alignItems: "flex-end" },
  stageArea: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 22 },
  stage: { overflow: "hidden" },
  lit: { position: "absolute", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)" },
  hint: {
    marginTop: 16,
    textAlign: "center",
    fontFamily: "Menlo",
    fontSize: 10,
    color: "rgba(255,255,255,0.42)",
  },
  foot: { paddingHorizontal: 22, paddingBottom: 42 },
  footRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  previews: { flexDirection: "row", alignItems: "center", gap: 12 },
  preview: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: colors.nightRaised,
  },
  publicLine: { fontFamily: "Menlo", fontSize: 11, color: colors.accentNight },
  use: {
    height: 50,
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  useText: { fontFamily: fonts.sans, fontSize: 15, fontWeight: "600", color: colors.night },
});
