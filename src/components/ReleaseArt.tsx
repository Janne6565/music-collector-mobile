import { useRef, useState } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { FormatThumb } from "@/components/FormatThumb";
import { usePulse } from "@/components/Skeleton";
import type { Release } from "@/domain/types";

/**
 * The layout properties both a View and an Image accept. Typing the prop as `ViewStyle`
 * does not compile against `Image`, whose `overflow` is narrower — and the callers only
 * ever pass box geometry anyway.
 */
type ArtStyle = Pick<ViewStyle, "width" | "height" | "borderRadius" | "aspectRatio">;

/**
 * A release's cover, falling back to the format placeholder.
 *
 * The fallback is not decoration. The server builds the Cover Art Archive URL from the
 * release mbid, and for a release it has not probed it cannot yet know whether any bytes
 * sit behind it — around four in ten do not. Without this the detail screen showed an
 * empty frame where the placeholder belonged.
 *
 * The same placeholder also holds the frame while the bytes are on their way, pulsing to
 * say the wait is still running. Using the silhouette rather than a grey block is what
 * keeps the two kinds of missing cover from reading as different things: the frame never
 * changes shape, the cover fades in over it, and a release that turns out to have no
 * cover simply keeps what was already on screen once the pulse stops.
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
}: {
  readonly release: Release | undefined;
  readonly style?: ArtStyle;
}) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = release?.coverArtUrl ?? null;

  const gone = url === null || failedUrl === url;
  const shown = !gone && loadedUrl === url;
  const pulse = usePulse(!gone && !shown);
  /**
   * Separate from the pulse: the cover crosses over the silhouette rather than replacing
   * it in one frame, which is what stops a grid of covers arriving as a series of snaps.
   */
  const reveal = useRef(new Animated.Value(0)).current;

  return (
    <View style={[styles.frame, style]}>
      {/* Kept mounted underneath rather than swapped out, so nothing behind the frame is
          ever visible through an image that is still decoding. */}
      {!shown && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: pulse }]}>
          <FormatThumb format={release?.format ?? "OTHER"} />
        </Animated.View>
      )}
      {!gone && (
        <Animated.Image
          source={{ uri: url }}
          style={[StyleSheet.absoluteFill, { opacity: reveal }]}
          // Reset here rather than on the URL changing: a component handed a second
          // release would otherwise show its cover at full opacity the instant the
          // source swapped, before any of its bytes had arrived.
          onLoadStart={() => reveal.setValue(0)}
          onLoad={() => {
            setLoadedUrl(url);
            Animated.timing(reveal, {
              toValue: 1,
              duration: 220,
              useNativeDriver: true,
            }).start();
          }}
          onError={() => setFailedUrl(url)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", height: "100%", overflow: "hidden" },
});
