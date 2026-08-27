import { Camera, EyeOff, ImagePlus, Star, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type { DetailChrome } from "@janne6565/music-collector-shared";
import type { PhotoStripLogic } from "@/features/photos/usePhotoStripLogic";
import { curve, useReducedMotion } from "@/lib/motion";
import { DURATION } from "@janne6565/music-collector-shared";

/**
 * One thumbnail, over a tile that holds its place until the file has decoded.
 *
 * Reading a photo off the device is fast but not free, and a strip of frames that pop in
 * one after another is the part people notice. The chrome-coloured tile underneath keeps
 * the row's shape from the first frame, and the photo crosses over it.
 */
function PhotoThumb({ uri, chrome }: { readonly uri: string; readonly chrome: DetailChrome }) {
  const reveal = useRef(new Animated.Value(0)).current;
  const [loaded, setLoaded] = useState<string | null>(null);

  /*
   * Driven from state rather than from the Image's callbacks — the same fix ReleaseArt
   * needed. Resetting in `onLoadStart` means an image React Native has already decoded can
   * fire that without ever firing `onLoad` again, and the tile then stays at zero opacity
   * for good: a photo that is present, loaded, and invisible.
   */
  useEffect(() => {
    reveal.setValue(0);
  }, [uri, reveal]);

  useEffect(() => {
    if (loaded !== uri) return;
    Animated.timing(reveal, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [loaded, uri, reveal]);

  return (
    <>
      <View style={[styles.image, styles.underlay, { backgroundColor: chrome.surface }]} />
      <Animated.Image
        source={{ uri }}
        style={[styles.image, { opacity: reveal }]}
        onLoad={() => setLoaded(uri)}
      />
    </>
  );
}

/**
 * Whether this photo is the one standing for the copy right now.
 *
 * The first in the list, unless the catalogue's artwork has been starred instead — which
 * is a choice the order cannot express, so it lives on the copy.
 */
function isPreview(logic: PhotoStripLogic, photoId: string): boolean {
  return logic.catalogArt !== "PREFERRED" && logic.photos[0]?.id === photoId;
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
  hasCatalogArt,
}: {
  readonly logic: PhotoStripLogic;
  readonly chrome: DetailChrome;
  /**
   * Whether the release has artwork to answer about at all. The strip does not read the
   * release itself — the screen around it already has one, and a second fetch to ask one
   * yes-or-no question is how two answers start disagreeing.
   */
  readonly hasCatalogArt: boolean;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <Text style={[styles.label, { color: chrome.muted }]}>{t("photos.title")}</Text>

      <View style={styles.strip}>
        {logic.photos.map((photo) => (
          <PhotoTile key={photo.id}>
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
            {/* A star is a move to the front, because the preview *is* the first picture —
                one gesture rather than two, and the same write the web makes. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("photos.star")}
              onPress={() => logic.star(photo)}
              disabled={logic.choosing}
              style={[styles.starBadge, { backgroundColor: chrome.surface }]}
            >
              <Star
                size={11}
                color={chrome.accent}
                fill={isPreview(logic, photo.id) ? chrome.accent : "transparent"}
                strokeWidth={2}
              />
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
          </PhotoTile>
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

      {/*
       * The catalogue's artwork is one of this copy's images too, but it is not a photo and
       * has no position in the strip to be starred by dragging — so its two answers live
       * here instead. Only offered where there is artwork to answer about.
       */}
      {hasCatalogArt && (
        <View style={styles.catalogRow}>
          <Pressable
            accessibilityRole="button"
            onPress={logic.starCatalogArt}
            disabled={logic.choosing || logic.catalogArt === "HIDDEN"}
            style={styles.catalogAction}
          >
            <Star
              size={13}
              color={chrome.accent}
              fill={logic.catalogArt === "PREFERRED" ? chrome.accent : "transparent"}
              strokeWidth={1.9}
            />
            <Text style={[styles.catalogLabel, { color: chrome.muted }]}>
              {t("photos.useCatalogArt")}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={logic.catalogArt === "HIDDEN" ? logic.restoreCatalogArt : logic.hideCatalogArt}
            disabled={logic.choosing}
            style={styles.catalogAction}
          >
            <EyeOff size={13} color={chrome.muted} strokeWidth={1.75} />
            <Text style={[styles.catalogLabel, { color: chrome.muted }]}>
              {t(logic.catalogArt === "HIDDEN" ? "photos.showCatalogArt" : "photos.hideCatalogArt")}
            </Text>
          </Pressable>
        </View>
      )}
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
  starBadge: {
    position: "absolute",
    bottom: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  catalogRow: { flexDirection: "row", gap: 16, marginTop: 12 },
  catalogAction: { flexDirection: "row", alignItems: "center", gap: 6 },
  catalogLabel: { fontSize: 11.5 },
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

/**
 * One photo arriving.
 *
 * The bytes are already on this device — the camera or the picker just wrote them — so
 * there is nothing to wait for and the tile appears at full opacity. What it does is
 * scale up from .94, which reads as "this is the one that just landed" without pretending
 * anything was fetched. `timing` rather than `spring`, so it matches the web.
 */
function PhotoTile({ children }: { readonly children: ReactNode }) {
  const scale = useRef(new Animated.Value(0.94)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue: 1,
      duration: DURATION.base,
      easing: curve.enter,
      useNativeDriver: true,
    }).start();
  }, [scale, reduced]);

  return <Animated.View style={[styles.tile, { transform: [{ scale }] }]}>{children}</Animated.View>;
}
