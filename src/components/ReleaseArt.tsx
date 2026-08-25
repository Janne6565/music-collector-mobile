import { useRef, useState } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { FormatThumb } from "@/components/FormatThumb";
import type { Release } from "@/domain/types";

/**
 * The layout properties both a View and an Image accept. Typing the prop as `ViewStyle`
 * does not compile against `Image`, whose `overflow` is narrower — and the callers only
 * ever pass box geometry anyway.
 */
type ArtStyle = Pick<ViewStyle, "width" | "height" | "borderRadius" | "aspectRatio">;

/**
 * A release's cover.
 *
 * The format thumbnail underneath is not decoration, and it is not only a fallback. The
 * server builds the Cover Art Archive URL from the release mbid, and for a release it has
 * not probed it cannot yet know whether any bytes sit behind it — around four in ten do
 * not. So the thumbnail holds the frame in all three cases: while the cover is on its way
 * (the sleeve breathing to say so), when there turns out to be nothing behind the URL,
 * and when there was never a URL at all.
 *
 * The cover is layered into the sleeve rather than over the tile. Replacing the whole
 * composition would bury the very thing the silhouette is there to say — which format
 * this copy is — in the one view where a release appears four times, once per format.
 * `bleed` is the item detail's hero (screens 3a and 1j), which the deck draws as an
 * edge-to-edge cover with no format furniture at all.
 *
 * The loaded and failed URLs are remembered rather than booleans, so the component
 * self-corrects when it is handed a different release without needing to be re-keyed by
 * the caller — a new URL is neither loaded nor failed, which is exactly "loading".
 *
 * Mirrored from music-collector-frontend/src/components/ReleaseArt.tsx.
 */
export function ReleaseArt({
  release,
  style,
  variant = "sleeve",
}: {
  readonly release: Release | undefined;
  readonly style?: ArtStyle;
  readonly variant?: "sleeve" | "bleed";
}) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = release?.coverArtUrl ?? null;

  const gone = url === null || failedUrl === url;
  const shown = !gone && loadedUrl === url;
  /**
   * The cover crosses over the sleeve rather than replacing it in one frame, which is
   * what stops a grid of covers arriving as a series of snaps.
   */
  const reveal = useRef(new Animated.Value(0)).current;

  const cover = gone ? null : (
    <Animated.Image
      source={{ uri: url }}
      style={[StyleSheet.absoluteFill, { opacity: reveal }]}
      // Reset here rather than on the URL changing: a component handed a second release
      // would otherwise show its cover at full opacity the instant the source swapped,
      // before any of its bytes had arrived.
      onLoadStart={() => reveal.setValue(0)}
      onLoad={() => {
        setLoadedUrl(url);
        Animated.timing(reveal, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      }}
      onError={() => setFailedUrl(url)}
    />
  );

  if (variant === "bleed") {
    return (
      <View style={[styles.frame, style]}>
        {/* Kept mounted underneath rather than swapped out, so nothing behind the frame
            is ever visible through an image that is still decoding. */}
        {!shown && <FormatThumb format={release?.format ?? "OTHER"} waiting={!gone} />}
        {cover}
      </View>
    );
  }

  return (
    <FormatThumb
      format={release?.format ?? "OTHER"}
      style={style}
      cover={cover}
      waiting={!gone && !shown}
    />
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", height: "100%", overflow: "hidden" },
});
