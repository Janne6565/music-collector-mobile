import { Camera, ImagePlus, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useRef } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type { DetailChrome } from "@janne6565/music-collector-shared";
import type { PhotoStripLogic } from "@/features/photos/usePhotoStripLogic";

/**
 * One thumbnail, over a tile that holds its place until the file has decoded.
 *
 * Reading a photo off the device is fast but not free, and a strip of frames that pop in
 * one after another is the part people notice. The chrome-coloured tile underneath keeps
 * the row's shape from the first frame, and the photo crosses over it.
 */
function PhotoThumb({ uri, chrome }: { readonly uri: string; readonly chrome: DetailChrome }) {
  const reveal = useRef(new Animated.Value(0)).current;

  return (
    <>
      <View style={[styles.image, styles.underlay, { backgroundColor: chrome.surface }]} />
      <Animated.Image
        source={{ uri }}
        style={[styles.image, { opacity: reveal }]}
        onLoadStart={() => reveal.setValue(0)}
        onLoad={() =>
          Animated.timing(reveal, { toValue: 1, duration: 200, useNativeDriver: true }).start()
        }
      />
    </>
  );
}

/**
 * Your own pictures of this copy, with the camera as the primary action.
 *
 * Works with no account — the photos live on the device. Signing in uploads them and
 * brings them to your other devices.
 */
export function PhotoStrip({
  logic,
  chrome,
}: {
  readonly logic: PhotoStripLogic;
  readonly chrome: DetailChrome;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <Text style={[styles.label, { color: chrome.muted }]}>{t("photos.title")}</Text>

      <View style={styles.strip}>
        {logic.photos.map((photo) => (
          <View key={photo.id} style={styles.tile}>
            <PhotoThumb uri={logic.uriFor(photo)} chrome={chrome} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("photos.remove")}
              onPress={() => logic.remove(photo)}
              disabled={logic.removing === photo.id}
              style={[styles.removeBadge, { backgroundColor: chrome.ink }]}
            >
              <Trash2 size={11} color={chrome.background} strokeWidth={2} />
            </Pressable>
            {photo.storageKey === null && (
              // Not an error: a photo that has not uploaded is perfectly usable here, it
              // simply is not on your other devices yet.
              <View style={[styles.localBadge, { backgroundColor: chrome.surface }]}>
                <Text style={[styles.localBadgeText, { color: chrome.muted }]}>
                  {t("photos.deviceOnly")}
                </Text>
              </View>
            )}
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("photos.take")}
          onPress={() => logic.add("CAMERA")}
          disabled={logic.adding}
          style={[styles.addTile, { borderColor: chrome.line }]}
        >
          {logic.adding ? (
            <ActivityIndicator size="small" color={chrome.muted} />
          ) : (
            <Camera size={18} color={chrome.muted} strokeWidth={1.75} />
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("photos.choose")}
          onPress={() => logic.add("LIBRARY")}
          disabled={logic.adding}
          style={[styles.addTile, { borderColor: chrome.line }]}
        >
          <ImagePlus size={18} color={chrome.muted} strokeWidth={1.75} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 22 },
  label: { fontSize: 9.5, letterSpacing: 0.9, textTransform: "uppercase", fontWeight: "500" },
  strip: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  tile: { width: 64, height: 64 },
  image: { width: "100%", height: "100%", borderRadius: 6 },
  underlay: { position: "absolute", top: 0, left: 0 },
  removeBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  localBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 2,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    alignItems: "center",
  },
  localBadgeText: { fontSize: 8, fontWeight: "600" },
  addTile: {
    width: 64,
    height: 64,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
});
