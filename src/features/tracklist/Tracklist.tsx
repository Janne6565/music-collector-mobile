import type { TrackMedium, Tracklist as TracklistData } from "@/api/tracklist";
import {
  TRACK_ROW_CAP,
  capMedia,
  durationParts,
  knownDurationMs,
  trackDuration,
  trackTotal,
} from "@/features/tracklist/tracklistFormat";
import { useTracklistLogic } from "@/features/tracklist/useTracklistLogic";
import { fonts } from "@/theme/colors";
import type { DetailChrome } from "@janne6565/rekordo-shared";
import { ChevronDown, CloudOff } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Screens 26a–26e on the phone (26d) — the titles under the sleeve.
 *
 * The web section's counterpart, and deliberately the same shape: one label with the count
 * beside it, a disc heading per medium once there are two, and rows of number · title ·
 * duration. The screen is the scroller, so the list simply continues past the fold; nothing
 * here scrolls inside itself.
 *
 * Drawn in the chrome it is handed, because the library's detail screen takes its colours
 * from the sleeve and a section that ignored that would be a white card on a dark page.
 */
export function Tracklist({
  releaseId,
  chrome,
  trackCount,
  discCount,
  shared = false,
}: {
  readonly releaseId: string | undefined;
  readonly chrome: DetailChrome;
  /** What the screen already knows, so the header is true before the titles arrive. */
  readonly trackCount?: number | null;
  readonly discCount?: number | null;
  /** Somebody else's shelf: "the rest of this copy is yours" is not a sentence for it. */
  readonly shared?: boolean;
}) {
  // A record that names no release has no section, and asks for none of the machinery
  // behind one.
  if (releaseId === undefined) return null;
  return (
    <Section
      releaseId={releaseId}
      chrome={chrome}
      trackCount={trackCount}
      discCount={discCount}
      shared={shared}
    />
  );
}

function Section({
  releaseId,
  chrome,
  trackCount,
  discCount,
  shared,
}: {
  readonly releaseId: string;
  readonly chrome: DetailChrome;
  readonly trackCount?: number | null;
  readonly discCount?: number | null;
  readonly shared: boolean;
}) {
  const { t } = useTranslation();
  const { tracklist, loading, unreachable, retry } = useTracklistLogic(releaseId);
  const [expanded, setExpanded] = useState(false);

  const counted = tracklist === undefined ? null : trackTotal(tracklist.media);
  const tracks =
    counted !== null && counted > 0 ? counted : (tracklist?.trackCount ?? trackCount ?? null);
  const discs = tracklist?.media.length || (tracklist?.discCount ?? discCount ?? null);
  const totalMs = tracklist === undefined ? null : knownDurationMs(tracklist.media);

  const summary: string[] = [];
  if (tracks !== null) summary.push(String(tracks));
  // A single-medium release says nothing about discs: its format is stated above it.
  if (discs !== null && discs > 1) summary.push(t("tracklist.discs", { count: discs }));
  if (loading) {
    summary.push(t("tracklist.reading"));
  } else if (totalMs !== null) {
    const { hours, minutes } = durationParts(totalMs);
    summary.push(
      hours > 0
        ? t("tracklist.hoursMinutes", { hours, minutes })
        : t("tracklist.minutes", { count: minutes }),
    );
  }

  return (
    <View style={[styles.section, { borderTopColor: chrome.line }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: chrome.muted }]}>{t("tracklist.label")}</Text>
        <Text style={[styles.summary, { color: chrome.muted }]}>
          {tracks === null && !loading ? t("tracklist.none") : summary.join(" · ")}
        </Text>
      </View>

      {loading ? (
        <Skeleton rows={Math.min(tracks ?? 8, TRACK_ROW_CAP)} chrome={chrome} />
      ) : unreachable ? (
        <Unreachable chrome={chrome} shared={shared} onRetry={retry} />
      ) : tracklist === undefined || tracklist.absence !== null ? (
        <Absent chrome={chrome} tracklist={tracklist} />
      ) : (
        <Rows
          chrome={chrome}
          media={tracklist.media}
          expanded={expanded}
          onExpand={() => setExpanded(true)}
        />
      )}
    </View>
  );
}

function Rows({
  chrome,
  media,
  expanded,
  onExpand,
}: {
  readonly chrome: DetailChrome;
  readonly media: readonly TrackMedium[];
  readonly expanded: boolean;
  readonly onExpand: () => void;
}) {
  const { t } = useTranslation();
  const { shown, hidden } = expanded ? { shown: [...media], hidden: 0 } : capMedia(media);
  // One disc needs no heading — the format is named in the facts above the section.
  const headed = media.length > 1;

  return (
    <View>
      {shown.map((medium) => (
        <View key={medium.position}>
          {headed && (
            <Text style={[styles.medium, { color: chrome.muted }]}>
              {[
                t("tracklist.medium", {
                  format: medium.format ?? t("tracklist.disc"),
                  position: medium.position,
                  total: media.length,
                }),
                medium.title,
              ]
                .filter((part) => part !== null && part !== "")
                .join(" · ")}
            </Text>
          )}
          {medium.tracks.map((track) => (
            <View
              key={`${medium.position}-${track.number}-${track.title}`}
              style={[styles.row, { borderTopColor: chrome.line }]}
            >
              <Text style={[styles.number, { color: chrome.muted }]}>{track.number}</Text>
              <View style={styles.titleColumn}>
                {/* Wrapped, never truncated: a movement title cut at its colon is worse
                    than three lines of type, and a phone has no tooltip to fall back on. */}
                <Text style={[styles.title, { color: chrome.ink }]}>{track.title}</Text>
                {track.artistName !== null && (
                  <Text style={[styles.trackArtist, { color: chrome.muted }]}>
                    {track.artistName}
                  </Text>
                )}
              </View>
              {/* Right-aligned and tabular, so a missing duration leaves the cell empty
                  rather than breaking the one edge holding a long list together. */}
              <Text style={[styles.duration, { color: chrome.muted }]}>
                {trackDuration(track.lengthMs)}
              </Text>
            </View>
          ))}
        </View>
      ))}
      {hidden > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={onExpand}
          style={[styles.more, { borderTopColor: chrome.line }]}
        >
          <ChevronDown size={14} color={chrome.accent} strokeWidth={2} />
          <Text style={[styles.moreText, { color: chrome.accent }]}>
            {t("tracklist.showRemainingShort", { count: hidden })}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** The wait, at the height the answer will need, so nothing below it jumps (26e). */
function Skeleton({ rows, chrome }: { readonly rows: number; readonly chrome: DetailChrome }) {
  const widths = ["62%", "48%", "78%", "55%", "70%", "42%", "66%", "58%"] as const;
  const bars = Array.from({ length: Math.max(rows, 3) }, (_, index) => ({
    key: `row-${index}`,
    width: widths[index % widths.length],
  }));
  return (
    <View accessibilityLabel={undefined}>
      {bars.map((bar) => (
        <View key={bar.key} style={[styles.row, { borderTopColor: chrome.line }]}>
          <View style={[styles.bar, { width: 18, backgroundColor: chrome.line }]} />
          <View style={styles.titleColumn}>
            <View style={[styles.bar, { width: bar.width, backgroundColor: chrome.line }]} />
          </View>
          <View style={[styles.bar, { width: 26, backgroundColor: chrome.line }]} />
        </View>
      ))}
    </View>
  );
}

/** A tracklist that does not exist and never will: dashed, and with nothing to press. */
function Absent({
  chrome,
  tracklist,
}: {
  readonly chrome: DetailChrome;
  readonly tracklist: TracklistData | undefined;
}) {
  const { t } = useTranslation();
  const key =
    tracklist?.absence === "HAND_ENTERED"
      ? "tracklist.absent.handEntered"
      : tracklist?.absence === "DISCOGS"
        ? "tracklist.absent.discogs"
        : "tracklist.absent.notInCatalogue";
  return (
    <View style={[styles.absent, { borderColor: chrome.line }]}>
      <Text style={[styles.absentText, { color: chrome.muted }]}>{t(key)}</Text>
    </View>
  );
}

/** The one tracklist state worth touching: a solid edge, the accent, and a retry. */
function Unreachable({
  chrome,
  shared,
  onRetry,
}: {
  readonly chrome: DetailChrome;
  readonly shared: boolean;
  readonly onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View
      style={[styles.unreachable, { borderColor: chrome.accent, backgroundColor: chrome.surface }]}
    >
      <CloudOff size={16} color={chrome.accent} strokeWidth={1.75} />
      <View style={styles.unreachableBody}>
        <Text style={[styles.absentText, { color: chrome.ink }]}>
          {shared ? t("tracklist.unreachableShared") : t("tracklist.unreachable")}
        </Text>
        <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={8}>
          <Text style={[styles.retry, { color: chrome.accent }]}>{t("tracklist.retry")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22, borderTopWidth: 1, paddingTop: 16 },
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  label: {
    fontFamily: fonts.sans,
    fontSize: 9.5,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  summary: { fontFamily: fonts.sans, fontSize: 10.5, fontVariant: ["tabular-nums"] },
  medium: {
    fontFamily: fonts.sans,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingTop: 14,
    paddingBottom: 2,
  },
  row: { flexDirection: "row", alignItems: "baseline", borderTopWidth: 1, paddingVertical: 7 },
  number: { fontFamily: fonts.sans, fontSize: 10.5, width: 34, fontVariant: ["tabular-nums"] },
  titleColumn: { flex: 1, minWidth: 0, paddingRight: 10 },
  title: { fontFamily: fonts.sans, fontSize: 13, fontWeight: "500", lineHeight: 18 },
  trackArtist: { fontFamily: fonts.sans, fontSize: 11.5, marginTop: 2 },
  duration: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    width: 42,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  more: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  moreText: { fontFamily: fonts.sans, fontSize: 12.5, fontWeight: "600" },
  bar: { height: 8, borderRadius: 3 },
  absent: { marginTop: 12, borderWidth: 1, borderStyle: "dashed", borderRadius: 10, padding: 14 },
  absentText: { fontFamily: fonts.sans, fontSize: 12.5, fontWeight: "500", lineHeight: 19 },
  unreachable: {
    marginTop: 12,
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
  },
  unreachableBody: { flex: 1, minWidth: 0 },
  retry: { fontFamily: fonts.sans, fontSize: 12.5, fontWeight: "600", marginTop: 10 },
});
