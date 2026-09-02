import { useStore } from "@/local/StoreProvider";
import { colors } from "@/theme/colors";
import { FORMAT_LABELS } from "@janne6565/rekordo-shared";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

/**
 * What is on the shelf, under the ways in to the signed-out You tab.
 *
 * Computed from the local store rather than fetched: somebody with no account has exactly
 * the same numbers, and calculating them twice in two places is how they drift. Which is
 * the point of putting it here at all — the collection is already yours before any account
 * exists, so the tab says so rather than presenting sign-in as a gate.
 *
 * The two tiles are the two the signed-in page shows, reading the same `stats()` under the
 * same labels. They used to be the total spent and the average per copy, which made the
 * one number a stranger to this device sees the first thing it says about you, and left
 * the tab's two halves counting different things.
 */
export function CollectionStatsBlock() {
  const { t } = useTranslation();
  const { store } = useStore();
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => store.stats() });

  if (stats.data === undefined) return null;
  const { copyCount, releaseGroupCount, byFormat } = stats.data;

  return (
    <View style={styles.root}>
      {/* No summary line above these any more: it read "240 copies · 197", which is the
          two tiles in a sentence. */}
      <View style={styles.tiles}>
        <Tile value={copyCount} label={t("account.stat.copies")} />
        <Tile value={releaseGroupCount} label={t("account.stat.releases")} />
      </View>

      <View style={styles.formats}>
        {(["VINYL", "CD", "CASSETTE", "DIGITAL"] as const).map((format) => (
          <View key={format} style={styles.formatRow}>
            <Text style={styles.formatName}>{FORMAT_LABELS[format]}</Text>
            <Text style={styles.formatCount}>{byFormat[format]}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.footnote}>{t("profile.exportNote")}</Text>
    </View>
  );
}

/** The signed-in page's tile, down to the metrics: it is the same figure either side. */
function Tile({ value, label }: { readonly value: number; readonly label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, marginTop: 20 },
  tiles: { flexDirection: "row", gap: 9 },
  tile: {
    flex: 1,
    padding: 13,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  tileValue: { fontSize: 18, fontWeight: "600", color: colors.ink },
  tileLabel: { fontSize: 10.5, color: colors.inkMuted, marginTop: 2 },
  formats: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 12,
    overflow: "hidden",
  },
  formatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  formatName: { fontSize: 14, color: colors.ink },
  formatCount: { fontSize: 13, color: colors.inkSubtle },
  footnote: { fontSize: 11.5, color: colors.inkSubtle, marginTop: 4 },
});
