import { useState } from "react";
import { Image, StyleSheet, type ViewStyle } from "react-native";
import { FormatThumb } from "@/components/FormatThumb";
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
 * The failed URL is remembered rather than a boolean, so the component self-corrects when
 * it is handed a different release without needing to be re-keyed by the caller.
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
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = release?.coverArtUrl ?? null;

  if (url === null || failedUrl === url) {
    return <FormatThumb format={release?.format ?? "OTHER"} style={style} />;
  }

  return (
    <Image
      source={{ uri: url }}
      style={[styles.image, style]}
      onError={() => setFailedUrl(url)}
    />
  );
}

const styles = StyleSheet.create({
  image: { width: "100%", height: "100%" },
});
