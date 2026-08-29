import type { AvatarCrop } from "@/api/avatar";
import type { ChosenPicture } from "@/features/account/useProfilePictureLogic";
import { colors, fonts } from "@/theme/colors";
import { useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

const MAX_ZOOM = 4;

/**
 * Screen 27c — framing, full screen and against dark.
 *
 * <p>The dark is not decoration: it is what lets the lit circle be the only thing on the
 * screen, and it is why the accent here is the {@code d08a5f} variant rather than the
 * paper-bound one. Drag moves, pinch zooms, and it opens on the centre square, so the
 * button underneath is a single tap for the picture most people picked.
 *
 * <p>The two previews are the two sizes that actually decide whether a crop works: 56, where
 * the profile header draws it, and 24, where the feed does and a face is only a colour.
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
  const framing = useFraming(picture);

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.screen}>
        <View style={styles.bar}>
          <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={12}>
            <Text style={styles.cancel}>{t("common.cancel")}</Text>
          </Pressable>
          <Text style={styles.barTitle}>{t("account.picture.framing.title")}</Text>
          <View style={styles.barSpacer} />
        </View>

        <View style={styles.stageArea}>
          <View style={styles.stage} {...framing.handlers}>
            <Image source={{ uri: picture.uri }} style={framing.imageStyle} />
            {/*
             * One element does the whole mask: an enormous spread of dark outside the
             * circle, and a lit hairline at its edge. Shadows do not spread like this on
             * Android, so the dim is four rectangles rather than one ring.
             */}
            <Scrim diameter={framing.diameter} stage={framing.stageSize} />
          </View>
          <Text style={styles.hint}>{t("account.picture.framing.hint")}</Text>
        </View>

        <View style={styles.foot}>
          <View style={styles.footRow}>
            <View style={styles.previews}>
              <Preview picture={picture} crop={framing.crop()} size={56} />
              <Preview picture={picture} crop={framing.crop()} size={24} />
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
      </View>
    </Modal>
  );
}

/** The dark outside the circle, as four bands and a ring. */
function Scrim({ diameter, stage }: { readonly diameter: number; readonly stage: number }) {
  const inset = (stage - diameter) / 2;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.dim, { left: 0, right: 0, top: 0, height: inset }]} />
      <View style={[styles.dim, { left: 0, right: 0, bottom: 0, height: inset }]} />
      <View style={[styles.dim, { left: 0, top: inset, bottom: inset, width: inset }]} />
      <View style={[styles.dim, { right: 0, top: inset, bottom: inset, width: inset }]} />
      <View
        style={[
          styles.lit,
          { left: inset, top: inset, width: diameter, height: diameter, borderRadius: diameter / 2 },
        ]}
      />
    </View>
  );
}

/** What the circle will look like at one of the sizes the app actually draws. */
function Preview({
  picture,
  crop,
  size,
}: {
  readonly picture: ChosenPicture;
  readonly crop: AvatarCrop;
  readonly size: number;
}) {
  const scale = size / crop.size;
  return (
    <View style={[styles.preview, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        source={{ uri: picture.uri }}
        style={{
          position: "absolute",
          left: -crop.x * scale,
          top: -crop.y * scale,
          width: picture.width * scale,
          height: picture.height * scale,
        }}
      />
    </View>
  );
}

/**
 * Where the circle sits over the picture.
 *
 * <p>Held as a zoom and an offset rather than as the rectangle itself, because that is what
 * the two gestures move: dragging is an offset, pinching is a zoom. The rectangle the server
 * needs is derived at the end, which also means the clamping is right in one place — the
 * offset is never allowed anywhere that would leave the circle with a corner of nothing in it.
 *
 * <p>Built on {@link PanResponder} rather than a gesture library. It is in React Native
 * already, it reads both touches off the raw event, and this is the only screen in the app
 * that needs a pinch — a native dependency for one gesture would mean a rebuild.
 */
function useFraming(picture: ChosenPicture) {
  const stageSize = Math.min(Dimensions.get("window").width - 44, 346);
  const diameter = Math.round(stageSize * 0.87);
  const base = diameter / Math.min(picture.width, picture.height);

  const centred = useMemo(
    () => ({
      x: (diameter - picture.width * base) / 2,
      y: (diameter - picture.height * base) / 2,
    }),
    [diameter, base, picture.width, picture.height],
  );

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(centred);
  /** Where the gesture started, so a drag is measured from its own beginning. */
  const from = useRef({ offset: centred, zoom: 1, spread: 0 });

  const clamp = (next: { x: number; y: number }, atScale: number) => ({
    x: Math.min(0, Math.max(diameter - picture.width * atScale, next.x)),
    y: Math.min(0, Math.max(diameter - picture.height * atScale, next.y)),
  });

  const handlers = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          from.current = { offset, zoom, spread: 0 };
        },
        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches;
          if (touches.length >= 2) {
            const spread = distance(touches[0], touches[1]);
            // The first frame of a pinch is where it is measured from; without this the
            // scale would jump by whatever the fingers happened to be apart.
            if (from.current.spread === 0) {
              from.current = { offset, zoom, spread };
              return;
            }
            const next = Math.min(
              MAX_ZOOM,
              Math.max(1, from.current.zoom * (spread / from.current.spread)),
            );
            const after = base * next;
            const before = base * from.current.zoom;
            // Zooms about the middle of the circle, so the face somebody just centred stays
            // centred while the fingers move.
            const centre = {
              x: diameter / 2 - from.current.offset.x,
              y: diameter / 2 - from.current.offset.y,
            };
            setZoom(next);
            setOffset(
              clamp(
                {
                  x: diameter / 2 - (centre.x / before) * after,
                  y: diameter / 2 - (centre.y / before) * after,
                },
                after,
              ),
            );
            return;
          }
          from.current.spread = 0;
          setOffset(
            clamp(
              { x: from.current.offset.x + gesture.dx, y: from.current.offset.y + gesture.dy },
              base * zoom,
            ),
          );
        },
      }).panHandlers,
    // Recreated when the gesture's starting point moves, which is what keeps a second drag
    // from measuring against the first one's origin.
    [offset, zoom, base, diameter, picture.width, picture.height],
  );

  const scale = base * zoom;
  const inset = (stageSize - diameter) / 2;

  return {
    handlers,
    stageSize,
    diameter,
    imageStyle: {
      position: "absolute" as const,
      left: inset + offset.x,
      top: inset + offset.y,
      width: picture.width * scale,
      height: picture.height * scale,
    },
    crop: (): AvatarCrop => ({ x: -offset.x / scale, y: -offset.y / scale, size: diameter / scale }),
  };
}

function distance(a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }): number {
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
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
  barSpacer: { width: 44 },
  stageArea: { flex: 1, justifyContent: "center", paddingHorizontal: 22 },
  stage: { alignSelf: "center", overflow: "hidden", aspectRatio: 1, width: "100%", maxWidth: 346 },
  dim: { position: "absolute", backgroundColor: "rgba(12,11,10,0.68)" },
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
