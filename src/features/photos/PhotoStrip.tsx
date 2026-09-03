import { type CoverSubject, ReleaseArt } from "@/components/ReleaseArt";
import type { PhotoStripLogic } from "@/features/photos/usePhotoStripLogic";
import { curve, useReducedMotion } from "@/lib/motion";
import type { DetailChrome } from "@janne6565/rekordo-shared";
import { DURATION } from "@janne6565/rekordo-shared";
import { Camera, CloudOff, Eye, EyeOff, ImagePlus, Star, Trash2 } from "lucide-react-native";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";

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
  // Keyed on `uri` and not reading it, exactly as ReleaseArt resets the same way.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the uri, see above.
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
  release,
}: {
  readonly logic: PhotoStripLogic;
  readonly chrome: DetailChrome;
  /**
   * The release, for the tile that draws its artwork.
   *
   * Handed in rather than fetched — the screen around this already has one, and a second
   * fetch of the same row is how two answers start disagreeing. Undefined, or with no
   * artwork, and there is simply no catalogue tile: nothing to show and nothing to answer.
   */
  readonly release: CoverSubject | undefined;
}) {
  const { t } = useTranslation();
  const hasCatalogArt = release?.coverArtUrl != null;

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
            {/*
             * A star is a move to the front, because the preview *is* the first picture —
             * one gesture rather than two, and the same write the web makes.
             *
             * Top left, and as dark as the bin opposite it. It used to sit bottom right in
             * the surface colour, which put it under the "on device" strip -- a later
             * sibling, so it painted over it -- and, on the half that hung off the tile,
             * near-white on near-white paper. The one gesture that decides which picture
             * stands for a copy was invisible and unpressable on exactly the photos that
             * had not uploaded yet. Reported 2026-09-03.
             */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("photos.star")}
              onPress={() => logic.star(photo)}
              disabled={logic.choosing}
              style={[styles.starBadge, { backgroundColor: chrome.ink }]}
            >
              <Star
                size={11}
                color={isPreview(logic, photo.id) ? chrome.accent : chrome.background}
                fill={isPreview(logic, photo.id) ? chrome.accent : "transparent"}
                strokeWidth={2}
              />
            </Pressable>
            {photo.storageKey === null && (
              // Not an error: a photo that has not uploaded is perfectly usable here, it
              // simply is not on your other devices yet. 28e gives it the cloud-off glyph
              // the rest of the app uses for exactly that, and no dimming and no red: the
              // photo is fine, and only its copy elsewhere is missing.
              <View style={[styles.localBadge, { backgroundColor: chrome.surface }]}>
                <CloudOff size={8} color={chrome.muted} strokeWidth={2} />
                <Text style={[styles.localBadgeText, { color: chrome.muted }]}>
                  {t("photos.deviceOnly")}
                </Text>
              </View>
            )}
          </PhotoTile>
        ))}

        {/*
         * The catalogue's artwork, as one of this copy's images.
         *
         * It always was one -- `copyPreviewSrc` ranks it against the photographs and
         * `catalogArtShown` decides whether it is in the list at all -- but the strip only
         * ever drew the photographs, so the two answers about it lived underneath as a pair
         * of sentences. You were asked to star or hide a picture the list did not show you.
         * The web frontend has drawn this tile all along; this is mobile catching up to it.
         *
         * The badges say the same two things the sentences did, in the places the photo
         * tiles already use for them: the star on the left sets the preview, and the eye on
         * the right takes the artwork out of this copy's images, or puts it back.
         */}
        {hasCatalogArt && (
          <PhotoTile>
            <ReleaseArt
              release={release}
              variant="bleed"
              placeholder="plain"
              style={styles.image}
            />
            {/* Dimmed rather than dropped: a tile that vanished when hidden would take the
                only way back with it, which is the corner the two sentences were painted
                into. */}
            {logic.catalogArt === "HIDDEN" && (
              <View style={[styles.image, styles.underlay, styles.hiddenWash]} />
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("photos.useCatalogArt")}
              onPress={logic.starCatalogArt}
              disabled={logic.choosing || logic.catalogArt === "HIDDEN"}
              style={[
                styles.starBadge,
                { backgroundColor: chrome.ink },
                logic.catalogArt === "HIDDEN" && styles.badgeOff,
              ]}
            >
              <Star
                size={11}
                color={logic.catalogArt === "PREFERRED" ? chrome.accent : chrome.background}
                fill={logic.catalogArt === "PREFERRED" ? chrome.accent : "transparent"}
                strokeWidth={2}
              />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(
                logic.catalogArt === "HIDDEN" ? "photos.showCatalogArt" : "photos.hideCatalogArt",
              )}
              onPress={
                logic.catalogArt === "HIDDEN" ? logic.restoreCatalogArt : logic.hideCatalogArt
              }
              disabled={logic.choosing}
              style={[styles.removeBadge, { backgroundColor: chrome.ink }]}
            >
              {logic.catalogArt === "HIDDEN" ? (
                <Eye size={11} color={chrome.background} strokeWidth={2} />
              ) : (
                <EyeOff size={11} color={chrome.background} strokeWidth={2} />
              )}
            </Pressable>

            <View style={[styles.localBadge, { backgroundColor: chrome.surface }]}>
              <Text style={[styles.localBadgeText, { color: chrome.muted }]}>
                {t(logic.catalogArt === "HIDDEN" ? "photos.catalogHidden" : "photos.catalog")}
              </Text>
            </View>
          </PhotoTile>
        )}

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
  /*
   * Wide enough for the badges, which are the reason this is not the 8 the rest of the
   * screen uses. Each one hangs 5 past its tile, so at 8 the bin on one tile and the star
   * on the next overlapped by a couple of pixels and read as one smudged control. 16 leaves
   * 6 between them, and the same gap between rows, where they hang over just as far.
   */
  strip: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 10 },
  tile: { width: 64, height: 64 },
  image: { width: "100%", height: "100%", borderRadius: 6 },
  underlay: { position: "absolute", top: 0, left: 0 },
  starBadge: {
    position: "absolute",
    top: -5,
    left: -5,
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  // The artwork is still one of the images while it is hidden, so the tile stays and says
  // so rather than leaving. Paper-coloured, because the page is what shows through when a
  // copy has dropped the catalogue's cover.
  hiddenWash: { backgroundColor: "rgba(250,248,245,0.72)" },
  badgeOff: { opacity: 0.35 },
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
    flexDirection: "row",
    gap: 3,
    paddingVertical: 2,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    alignItems: "center",
    justifyContent: "center",
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

  return (
    <Animated.View style={[styles.tile, { transform: [{ scale }] }]}>{children}</Animated.View>
  );
}
