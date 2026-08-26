import { useRef, useState } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { FormatThumb } from "@/components/FormatThumb";
import type { Format } from "@janne6565/music-collector-shared";
/**
 * Everything the art actually needs: a URL to try, and a format to fall back to.
 *
 * Structural rather than `Release`, because an album (a release group) has a cover too and
 * has no format of its own — its placeholder is the generic sleeve. Widening the prop is
 * cheaper than casting an album into a shape it is not. Mirrors `CoverSubject` in
 * music-collector-frontend/src/components/ReleaseArt.tsx.
 */
export interface CoverSubject {
  readonly coverArtUrl: string | null;
  readonly format?: Format;
}

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
  previewUri = null,
  allowCatalogArt = true,
  format,
}: {
  readonly release: CoverSubject | undefined;
  readonly style?: ArtStyle;
  readonly variant?: "sleeve" | "bleed";
  /**
   * The copy's preview image — the first picture in its own list.
   *
   * It outranks the catalogue's artwork rather than standing in for it: the images of a
   * copy are one ordered list with the catalogue art among them, and starring a photo is
   * what puts it at the front. A preview that ranked below the archive would make that
   * gesture do nothing on the four records in ten the archive does have — which is what
   * this app did until the two clients were brought into line. Pass it through
   * `copyPreviewSrc`, which is null when the catalogue art has been starred instead.
   *
   * The catalogue cover is still the next candidate, so a preview whose file is not on
   * this device yet shows artwork rather than a placeholder.
   */
  readonly previewUri?: string | null;
  /**
   * Whether the release's own cover art may be drawn at all.
   *
   * False for a copy that has dropped it: what the archive holds for a pressing is
   * sometimes the wrong cover, and a copy that said so should fall back to its own photo
   * or the silhouette rather than keep being handed what it discarded.
   */
  readonly allowCatalogArt?: boolean;
  /**
   * The format to draw the silhouette in, when the caller knows better than the release.
   *
   * A copy may be a cassette of a pressing the archive lists as vinyl, and the tile it
   * sits in should say what is on the shelf — see `copyFormat`.
   */
  readonly format?: Format;
}) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  // A set rather than one URL: with a preview there are two addresses in play, and
  // remembering only the last failure would let the first one look untried again.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const cover = allowCatalogArt ? (release?.coverArtUrl ?? null) : null;
  // Preview first, catalogue second, and whichever has already failed is skipped.
  const url =
    [previewUri, cover].find((candidate) => candidate != null && !failed.has(candidate)) ?? null;

  const gone = url === null;
  const shown = !gone && loadedUrl === url;
  /**
   * Whether the thing being waited for is a fetch.
   *
   * The breathing sleeve belongs to catalogue art and nothing else: a photo taken on this
   * phone is already on it, so it paints on the frame it is asked for rather than
   * inventing a wait for something that was never away.
   */
  const fetched = !gone && url !== previewUri;
  /**
   * The cover crosses over the sleeve rather than replacing it in one frame, which is
   * what stops a grid of covers arriving as a series of snaps.
   */
  const reveal = useRef(new Animated.Value(0)).current;

  const art = gone ? null : (
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
      onError={() => setFailed((seen) => new Set(seen).add(url))}
    />
  );

  if (variant === "bleed") {
    return (
      <View style={[styles.frame, style]}>
        {/*
          * Kept mounted underneath rather than swapped out -- which the code said and did
          * not do, and it is load-bearing twice over. It stops anything behind the frame
          * showing through an image that is still decoding, and it is the only thing
          * giving the frame a height: the cover is absolutely positioned, so with the
          * silhouette conditional the box collapsed, the image was laid out at zero and
          * React Native never even fetched it. The shelf was unaffected because a sleeve
          * nests the cover in a box with real bounds; only the hero drew nothing.
          */}
        <FormatThumb format={format ?? release?.format ?? "OTHER"} waiting={fetched && !shown} />
        {art}
      </View>
    );
  }

  return (
    <FormatThumb
      format={format ?? release?.format ?? "OTHER"}
      style={style}
      cover={art}
      waiting={fetched && !shown}
    />
  );
}

const styles = StyleSheet.create({
  /*
   * No height of its own: it takes the silhouette's, which is square by its own aspect
   * ratio. A percentage height here resolves against a parent whose own height comes from
   * `aspectRatio`, and Yoga does not treat that as definite -- so it came out as zero.
   */
  frame: { width: "100%", overflow: "hidden" },
});
