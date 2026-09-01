import { formatMoney, spendByCurrency } from "@/domain/currency";
import { useStore } from "@/local/StoreProvider";
import { colors, fonts } from "@/theme/colors";
import { FORMAT_LABELS } from "@janne6565/rekordo-shared";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

/**
 * The stats block from screen 1l.
 *
 * Computed from the local store rather than fetched: someone with no account has exactly
 * the same numbers, and calculating them twice in two places is how they drift.
 */
export function CollectionStatsBlock() {
  const { t, i18n } = useTranslation();
  const { store } = useStore();
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => store.stats() });
  /**
   * Split by the currency each copy was actually paid in (20d).
   *
   * The tiles used to add every `pricePaidCents` together and print a euro sign, which was
   * harmless only while nothing could produce a copy in anything else. Since Settings has a
   * currency picker, mixed collections are deliberate — and nothing here converts, because
   * a total that silently depends on today's exchange rate is worse than two side by side.
   */
  const spend = useQuery({
    queryKey: ["collectionSpend"],
    queryFn: async () => spendByCurrency(await store.listCopies()),
  });

  if (stats.data === undefined) return null;
  const { copyCount, releaseGroupCount, byFormat } = stats.data;
  const byCurrency = spend.data ?? [];

  return (
    <View style={styles.root}>
      <Text style={styles.summary}>
        {t("profile.copies", { count: copyCount })}
        {releaseGroupCount > 0 && ` · ${releaseGroupCount}`}
      </Text>

      <View style={styles.tiles}>
        <Tile
          value={
            byCurrency.length === 0
              ? "—"
              : byCurrency
                  .map((entry) => formatMoney(entry.totalCents, entry.currency, i18n.language))
                  .join(" + ")
          }
          label={
            byCurrency.length === 1
              ? t("profile.totalSpentIn", { currency: byCurrency[0].currency })
              : t("profile.totalSpent")
          }
        />
        <Tile
          value={
            byCurrency.length === 0
              ? "—"
              : byCurrency
                  .map((entry) =>
                    formatMoney(
                      Math.round(entry.totalCents / entry.copies),
                      entry.currency,
                      i18n.language,
                    ),
                  )
                  .join(" · ")
          }
          label={
            byCurrency.length === 1
              ? t("profile.averageIn", { currency: byCurrency[0].currency })
              : t("profile.averagePerCopy")
          }
        />
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

function Tile({ value, label }: { readonly value: string; readonly label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, marginTop: 20 },
  summary: { fontSize: 12.5, color: colors.inkMuted },
  tiles: { flexDirection: "row", gap: 9 },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 14,
  },
  tileValue: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  tileLabel: { fontSize: 11, color: colors.inkMuted, marginTop: 3 },
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
