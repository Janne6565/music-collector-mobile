import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { FormatThumb } from "@/components/FormatThumb";
import { usePulse } from "@/components/Skeleton";
import type { Format } from "@janne6565/rekordo-shared";
/**
 * Everything the art actually needs: a URL to try, and a format to fall back to.
 *
 * Structural rather than `Release`, because an album (a release group) has a cover too and
 * has no format of its own — its placeholder is the generic sleeve. Widening the prop is
 * cheaper than casting an album into a shape it is not. Mirrors `CoverSubject` in
 * rekordo-frontend/src/components/ReleaseArt.tsx.
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
 * Mirrored from rekordo-frontend/src/components/ReleaseArt.tsx.
 */
export function ReleaseArt({
  release,
  style,
  variant = "sleeve",
  previewUri = null,
  allowCatalogArt = true,
  format,
  placeholder = "format",
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
  /**
   * What the `bleed` hero draws when there is no picture at all.
   *
   * "format" is the silhouette, which on an item detail is the answer: it says what is on
   * the shelf when there is nothing to show of it. "plain" is the quiet ground, for a
   * hero whose surroundings already say the format in words — a shared sheet names it in
   * the facts grid, so drawing a vinyl the width of the sheet on top of that is furniture
   * repeating what is written directly underneath it.
   *
   * Ignored by `sleeve`, whose whole subject is the silhouette.
   */
  readonly placeholder?: "format" | "plain";
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
   * Whether the subject itself has not been read yet.
   *
   * `undefined` and a null `coverArtUrl` are two different answers and were being drawn as
   * one: the second says this release has no art and the placeholder is the final picture,
   * the first says nobody has looked yet — the catalogue row has not arrived from the
   * store or from sync, and a cover may well appear a moment later. Drawn as "no art" it
   * came out as a still placeholder that then popped into a sleeve, which is the "blank
   * beige, no skeleton" this fixes.
   */
  const unresolved = release === undefined;
  /**
   * How long an unresolved row is given before its placeholder settles.
   *
   * A release row does not always arrive: the catalogue does not travel with sync, so a
   * copy on a second device can sit without one indefinitely. Breathing on `undefined`
   * alone would leave those tiles pulsing for good, promising a picture nothing is going
   * to bring — so the wait is bounded, and what is left afterwards is the still
   * placeholder, which by then is the honest answer.
   */
  const [waitedOut, setWaitedOut] = useState(false);
  useEffect(() => {
    if (!unresolved) {
      setWaitedOut(false);
      return;
    }
    const timer = setTimeout(() => setWaitedOut(true), UNRESOLVED_GRACE_MS);
    return () => clearTimeout(timer);
  }, [unresolved]);
  /**
   * The cover crosses over the sleeve rather than replacing it in one frame, which is
   * what stops a grid of covers arriving as a series of snaps.
   */
  const reveal = useRef(new Animated.Value(0)).current;
  /**
   * Anything still on its way breathes — a fetched cover, a photo being read off this
   * phone, or a release whose row is not here yet. It used to be catalogue art alone, on
   * the argument that a local file is never away; a large photo decoded off disk is away
   * long enough to look broken, and a placeholder that only sometimes breathes reads as a
   * bug rather than as a distinction.
   */
  const waiting = gone ? unresolved && !waitedOut : !shown;
  const pulse = usePulse(waiting);

  /*
   * Opacity is driven from state, never from the Image's own callbacks.
   *
   * It used to be reset in `onLoadStart` and raised in `onLoad`, which made the cover
   * appear or not appear depending on whether React Native happened to have the bytes
   * cached: for an image it has already decoded it may fire `onLoadStart` without ever
   * firing `onLoad` again, and the reveal then sat at zero for good. That is exactly the
   * shape of the bug -- the same record loading one time and showing nothing the next,
   * with a placeholder underneath standing in for a picture that was in fact right there.
   *
   * Keyed on the URL, so a component handed a second release still hides the old cover
   * the instant the source swaps rather than flashing it at full opacity.
   */
  useEffect(() => {
    reveal.setValue(0);
  }, [url, reveal]);

  useEffect(() => {
    if (!shown) return;
    Animated.timing(reveal, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [shown, reveal]);

  const art = gone ? null : (
    <Animated.Image
      source={{ uri: url }}
      style={[StyleSheet.absoluteFill, { opacity: reveal }]}
      onLoad={() => setLoadedUrl(url)}
      onError={() => setFailed((seen) => new Set(seen).add(url))}
    />
  );

  if (variant === "bleed") {
    return (
      /*
       * The frame carries its own aspect ratio here. It used to take its height from the
       * silhouette underneath, which meant the hero collapsed to nothing -- image laid out
       * at zero, never even fetched -- the moment that silhouette was conditional. Anything
       * layered in this frame is absolutely positioned, so the box has to be definite on
       * its own or the whole thing quietly disappears.
       */
      <View style={[styles.frame, styles.bleed, style]}>
        {gone && !waiting && placeholder === "format" ? (
          /*
           * Nothing is coming — and known to be, which is why the release has to be
           * resolved for this branch: a silhouette is a statement about what is on the
           * shelf, and stating it before the row has arrived means saying "vinyl, no
           * picture" about a record whose picture is one read away.
           *
           * The silhouette is the answer, not a wait. This is the one
           * place it still belongs in the hero -- it says what is on the shelf when there
           * is no picture of it. A caller whose layout already says the format in words
           * asks for "plain" instead and gets the ground below.
           */
          <FormatThumb format={format ?? release?.format ?? "OTHER"} />
        ) : (
          /*
           * A plain ground while the cover is on its way. The hero is edge to edge, and a
           * format silhouette at that size reads as the answer rather than as a wait --
           * so it flashes a vinyl the size of the screen and then throws it away. A quiet
           * rectangle says "not yet" without claiming anything.
           */
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.ground, { opacity: waiting ? pulse : 1 }]}
          />
        )}
        {art}
      </View>
    );
  }

  return (
    <FormatThumb
      format={format ?? release?.format ?? "OTHER"}
      style={style}
      cover={art}
      waiting={waiting}
    />
  );
}

/** See `waitedOut`. Long enough to cover a store read and a sync round, short enough that
 *  a tile which is never getting a cover stops promising one. */
const UNRESOLVED_GRACE_MS = 4000;

const styles = StyleSheet.create({
  /*
   * No height of its own: it takes the silhouette's, which is square by its own aspect
   * ratio. A percentage height here resolves against a parent whose own height comes from
   * `aspectRatio`, and Yoga does not treat that as definite -- so it came out as zero.
   */
  frame: { width: "100%", overflow: "hidden" },
  /** Square, and definite, so the hero has a height with or without a silhouette in it. */
  bleed: { aspectRatio: 1 },
  ground: { backgroundColor: "#efece6" },
});
