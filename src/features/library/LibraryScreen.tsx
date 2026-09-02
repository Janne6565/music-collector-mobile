import { CopyTile } from "@/components/CopyTile";
import { ReleaseArt } from "@/components/ReleaseArt";
import { ConfirmStrip } from "@/features/auth/ConfirmStrip";
import { SyncOutcomeStrip } from "@/features/auth/SyncOutcomeStrip";
import { FilterSheet } from "@/features/library/FilterSheet";
import { rememberCopyOrder } from "@/features/library/copyOrder";
import { type LibraryRow, useLibraryLogic } from "@/features/library/useLibraryLogic";
import { useCoverPhotos } from "@/features/photos/useCoverPhotos";
import { RollSheet } from "@/features/roll/RollSheet";
import type { CatalogueGap } from "@/local/settings";
import { colors, fonts } from "@/theme/colors";
import type { Format } from "@janne6565/rekordo-shared";
import { catalogArtShown, copyFormat, copyPreviewSrc } from "@janne6565/rekordo-shared";
import { FORMAT_LABELS } from "@janne6565/rekordo-shared";
import { useRouter } from "expo-router";
import { Dices, Plus, SlidersHorizontal } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function LibraryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const logic = useLibraryLogic();
  /**
   * 26a — the roll, over the shelf rather than instead of it.
   *
   * Local state and not a route: the sheet carries its own pool and the library keeps its
   * filter, its scroll and its place in the stack underneath, which is the whole reason
   * the dice can live in the toolbar.
   */
  const [rolling, setRolling] = useState(false);
  const [filtering, setFiltering] = useState(false);
  /**
   * What the shelf is, in the words the sheet uses.
   *
   * With the chips gone this line is the only thing saying the grid is narrowed, so it
   * has to name the filter rather than merely admit to one — a shelf that says "filtered"
   * and nothing else sends you back into the sheet to find out what you did.
   */
  const shelfLine = logic.filtered
    ? [
        logic.format === "ALL" ? null : FORMAT_LABELS[logic.format as Format],
        logic.minRating === null ? null : t("roll.poolRated", { count: logic.minRating }),
      ]
        .filter((part) => part !== null)
        .join(" · ")
    : t("library.sortedByAdded");
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
      <SyncOutcomeStrip logic={logic} />

      {/*
       * 26a's meta row: what the shelf currently is on the left, and the two things you do
       * to it on the right. It replaced a flat strip of format chips, which said the same
       * thing in more room and could never say the second half of it — the shelf has a
       * rating floor now, and there was nowhere in a single row of chips to put it.
       */}
      <View style={styles.meta}>
        <Text style={styles.metaText} numberOfLines={1}>
          {shelfLine}
        </Text>
        <View style={styles.metaActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("roll.openLabel")}
            onPress={() => setRolling(true)}
            disabled={logic.collectionEmpty}
            style={[styles.metaAction, logic.collectionEmpty && styles.metaActionOff]}
            hitSlop={6}
          >
            <Dices
              size={14}
              color={logic.collectionEmpty ? colors.inkSubtle : colors.accent}
              strokeWidth={1.75}
            />
            <Text
              style={[styles.metaActionText, logic.collectionEmpty && styles.metaActionTextOff]}
            >
              {t("roll.open")}
            </Text>
          </Pressable>
          <View style={styles.metaRule} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("library.filters.openLabel")}
            onPress={() => setFiltering(true)}
            style={styles.metaAction}
            hitSlop={6}
          >
            <SlidersHorizontal size={13} color={colors.accent} strokeWidth={1.75} />
            <Text style={styles.metaActionText}>{t("library.filters.open")}</Text>
          </Pressable>
        </View>
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

      {rolling && <RollSheet onClose={() => setRolling(false)} />}
      {filtering && <FilterSheet logic={logic} onClose={() => setFiltering(false)} />}
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
    <CopyTile
      style={styles.item}
      onPress={onPress}
      art={
        <ReleaseArt
          release={row.release}
          format={copyFormat(row.copy, row.release)}
          previewUri={previewUri}
          allowCatalogArt={allowCatalogArt}
        />
      }
      title={row.release?.title ?? "—"}
      subtitle={
        row.release === undefined
          ? ""
          : `${row.release.artistName}${row.release.year === null ? "" : ` · ${row.release.year}`}`
      }
      rating={row.copy.rating}
    />
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
  // The row owns the air under it as well as over it: it is a control strip, and letting
  // the shelf start right below it read as the first row belonging to it.
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
  },
  metaText: { flex: 1, fontSize: 11.5, fontWeight: "500", color: colors.inkMuted },
  metaActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  metaAction: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaActionOff: { opacity: 0.5 },
  metaActionText: { fontSize: 11.5, fontWeight: "600", color: colors.accent },
  metaActionTextOff: { color: colors.inkSubtle },
  metaRule: { width: StyleSheet.hairlineWidth, height: 12, backgroundColor: "rgba(25,23,19,0.16)" },
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
  empty: { padding: 18, gap: 6 },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  emptyBody: { fontSize: 13, color: colors.inkMuted, padding: 18 },
});
