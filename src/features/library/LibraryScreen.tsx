import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConfirmStrip } from "@/features/auth/ConfirmStrip";
import { rememberCopyOrder } from "@/features/library/copyOrder";
import { ReleaseArt } from "@/components/ReleaseArt";
import type { Format } from "@janne6565/music-collector-shared";
import { catalogArtShown, copyFormat, copyPreviewSrc } from "@janne6565/music-collector-shared";
import { FORMAT_LABELS } from "@janne6565/music-collector-shared";
import { type FormatFilter, type LibraryRow, useLibraryLogic } from "@/features/library/useLibraryLogic";
import { useCoverPhotos } from "@/features/photos/useCoverPhotos";
import type { CatalogueGap } from "@/local/settings";
import { colors, fonts } from "@/theme/colors";

const FILTERS: readonly FormatFilter[] = ["ALL", "VINYL", "CD", "CASSETTE", "DIGITAL"];

export function LibraryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const logic = useLibraryLogic();
  const copyIds = useMemo(() => logic.rows.map((row) => row.copy.id), [logic.rows]);
  const covers = useCoverPhotos(copyIds);
  // Left here on the way past so the detail screen can be swiped through *this* order --
  // the one with the filter and sort actually applied, not a canonical one it invents.
  useEffect(() => {
    rememberCopyOrder(copyIds);
  }, [copyIds]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("nav.library")}</Text>
        <View style={styles.headerRight}>
          <Text style={styles.count}>
            {t("library.itemCount", { count: logic.stats?.copyCount ?? 0 })}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("library.addItem")}
            onPress={() => router.push("/add")}
            style={styles.addButton}
          >
            <Plus size={17} color={colors.paper} strokeWidth={1.75} />
          </Pressable>
        </View>
      </View>

      {/* 21b: under the header, where the deck puts it — once per device, then never
          again. Above it the strip would have read as chrome rather than as a line about
          the shelf you are looking at. */}
      <ConfirmStrip />

      <View style={styles.filters}>
        {FILTERS.map((filter) => (
          <Pressable
            key={filter}
            onPress={() => logic.setFormat(filter)}
            style={[styles.chip, logic.format === filter && styles.chipActive]}
          >
            <Text style={[styles.chipText, logic.format === filter && styles.chipTextActive]}>
              {filter === "ALL" ? t("format.all") : FORMAT_LABELS[filter as Format]}
              {filter !== "ALL" && logic.stats !== undefined
                ? ` ${logic.stats.byFormat[filter as Format]}`
                : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      <CatalogueNotice gap={logic.catalogueGap} />

      {logic.collectionEmpty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t("library.empty.title")}</Text>
          <Text style={styles.emptyBody}>{t("library.empty.body")}</Text>
        </View>
      ) : (
        <FlatList
          data={logic.rows}
          keyExtractor={(row) => row.copy.id}
          numColumns={3}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.grid}
          refreshing={logic.refreshing || logic.loading}
          onRefresh={() => void logic.refetch()}
          renderItem={({ item }) => (
            <GridItem
              row={item}
              onPress={() => router.push(`/copies/${item.copy.id}`)}
              previewUri={copyPreviewSrc(item.copy, covers.get(item.copy.id) ?? null)}
              allowCatalogArt={catalogArtShown(item.copy, true)}
            />
          )}
          ListEmptyComponent={
            logic.loading ? null : <Text style={styles.emptyBody}>{t("library.noMatches")}</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

/**
 * What the shelf says when it is holding records it cannot name.
 *
 * Sync brings the copies and leaves the catalogue behind them to be fetched separately, so
 * a device that has just signed in can hold a full collection of untitled placeholders.
 * That state used to be completely silent, and it reads on screen as a broken import
 * rather than an unfinished one — which is the opposite of what to do about it.
 */
function CatalogueNotice({ gap }: { readonly gap: CatalogueGap | undefined }) {
  const { t } = useTranslation();
  if (gap === undefined || gap.missing === 0) return null;

  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>
        {gap.unreachable
          ? t("library.catalogue.pending", { count: gap.missing })
          : t("library.catalogue.unknown", { count: gap.missing })}
      </Text>
      {gap.unreachable ? (
        <Text style={styles.noticeHint}>{t("library.catalogue.offline")}</Text>
      ) : null}
    </View>
  );
}

function GridItem({
  row,
  onPress,
  previewUri,
  allowCatalogArt,
}: {
  readonly row: LibraryRow;
  readonly onPress: () => void;
  readonly previewUri: string | null;
  readonly allowCatalogArt: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.item}>
      <ReleaseArt
        release={row.release}
        format={copyFormat(row.copy, row.release)}
        previewUri={previewUri}
        allowCatalogArt={allowCatalogArt}
      />
      <Text style={styles.itemTitle} numberOfLines={1}>
        {row.release?.title ?? "—"}
      </Text>
      <Text style={styles.itemSubtitle} numberOfLines={1}>
        {row.release === undefined
          ? ""
          : `${row.release.artistName}${row.release.year === null ? "" : ` · ${row.release.year}`}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.ink },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  count: { fontSize: 11.5, color: colors.inkSubtle },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  // The row owns the air under it as well as over it: the chips are a control strip, and
  // letting the shelf start right below them read as the first row belonging to them.
  filters: { flexDirection: "row", gap: 7, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, fontWeight: "500", color: colors.ink },
  chipTextActive: { color: colors.paper, fontWeight: "600" },
  notice: {
    marginHorizontal: 18,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    gap: 3,
  },
  noticeText: { fontSize: 12, color: colors.ink },
  noticeHint: { fontSize: 11.5, color: colors.inkMuted },
  grid: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24, gap: 12 },
  column: { gap: 10 },
  item: { flex: 1 / 3 },
  itemTitle: { fontSize: 11.5, fontWeight: "600", marginTop: 6, color: colors.ink },
  itemSubtitle: { fontSize: 10.5, color: colors.inkMuted },
  empty: { padding: 18, gap: 6 },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  emptyBody: { fontSize: 13, color: colors.inkMuted, padding: 18 },
});
