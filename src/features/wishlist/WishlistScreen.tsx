import { ReleaseArt } from "@/components/ReleaseArt";
import { WishRow, wishCardStyle } from "@/components/WishRow";
import { formatRelativeTime } from "@/domain/relativeTime";
import { WishSheet } from "@/features/wishlist/WishSheet";
import { useWishlistLogic } from "@/features/wishlist/useWishlistLogic";
import { colors, fonts } from "@/theme/colors";
import type { WishSort, WishlistItem } from "@janne6565/rekordo-shared";
import { CHOOSABLE_WISH_SORTS, FORMAT_LABELS } from "@janne6565/rekordo-shared";
import { useRouter } from "expo-router";
import { ArrowUpDown, ChevronDown, ChevronRight, Disc3, Heart, Pencil, Plus, Search, Users, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  LayoutAnimation,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Screen 16a — the wishlist.
 *
 * A plain scrolling column rather than a FlatList: the list is two dozen rows at most, and
 * a row that can be picked up and carried needs its neighbours measured, which is exactly
 * what virtualisation takes away.
 */
export function WishlistScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const logic = useWishlistLogic();

  /** "MANUAL" opens the sheet with empty fields; an item reopens it on that entry. */
  const [sheet, setSheet] = useState<"MANUAL" | WishlistItem | null>(null);
  const [sortOpen, setSortOpen] = useState(false);

  /** Which row is in the air, and how far it has been carried. */
  const [lifted, setLifted] = useState<number | null>(null);
  const shift = useRef(new Animated.Value(0)).current;
  /** Row geometry, filled in by onLayout — the drag needs neighbours, not just itself. */
  const rows = useRef<{ y: number; height: number }[]>([]);
  const carried = useRef(0);

  const measure = (index: number) => (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    rows.current[index] = { y, height };
  };

  /**
   * Where a row carried this far would land.
   *
   * Walks the measured rows and counts how many midpoints the dragged row's own midpoint
   * has passed. Measured rather than assumed uniform: an entry with a note is taller than
   * one without, and a drag that miscounts by a row is a drag nobody trusts.
   */
  const targetIndex = (from: number, dy: number): number => {
    const own = rows.current[from];
    if (own === undefined) return from;
    const centre = own.y + own.height / 2 + dy;
    let index = 0;
    for (let i = 0; i < logic.items.length; i += 1) {
      const row = rows.current[i];
      if (row !== undefined && centre > row.y + row.height / 2) index = i;
    }
    return index;
  };

  const responder = (index: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => lifted === index,
      onMoveShouldSetPanResponder: () => lifted === index,
      onPanResponderMove: (_event, gesture) => {
        carried.current = gesture.dy;
        shift.setValue(gesture.dy);
      },
      onPanResponderRelease: () => {
        const to = targetIndex(index, carried.current);
        shift.setValue(0);
        carried.current = 0;
        setLifted(null);
        if (to !== index) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          logic.reorder(index, to);
        }
      },
      onPanResponderTerminate: () => {
        shift.setValue(0);
        carried.current = 0;
        setLifted(null);
      },
    });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{t("nav.wishlist")}</Text>
            <Text style={styles.count}>{t("wishlist.count", { count: logic.count })}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("wishlist.addToWishlist")}
            // The search screen, not the sheet: a wishlist is where records you found
            // somewhere else end up, and finding them is what the add screen is for.
            onPress={() => router.push("/add")}
            style={styles.addButton}
          >
            <Plus size={19} color={colors.paper} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Only once there is a list to narrow: a field over an empty screen claims a
            permanent strip for something that can only ever return nothing. */}
        {logic.count > 0 && (
          <View style={styles.searchField}>
            <Search size={16} color={colors.inkMuted} strokeWidth={1.75} />
            <TextInput
              value={logic.search}
              onChangeText={logic.handleSearch}
              placeholder={t("wishlist.filterPlaceholder")}
              placeholderTextColor={colors.inkSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor={colors.accent}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {logic.filtering && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("wishlist.filterClear")}
                onPress={() => logic.handleSearch("")}
                hitSlop={10}
              >
                <X size={15} color={colors.inkMuted} strokeWidth={2} />
              </Pressable>
            )}
          </View>
        )}

        {logic.count > 0 && (
          <View style={styles.controls}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSortOpen((was) => !was)}
              style={styles.sortChip}
            >
              <Text style={styles.sortChipText}>{t(`wishlist.sort.${logic.sort}`)}</Text>
              <ChevronDown size={13} color={colors.inkSubtle} strokeWidth={2} />
            </Pressable>
            <View style={styles.dragHint}>
              <ArrowUpDown size={13} color={colors.inkMuted} strokeWidth={1.75} />
              <Text style={styles.dragHintText}>
                {logic.filtering ? t("wishlist.dragWhileFiltered") : t("wishlist.longPressHint")}
              </Text>
            </View>
          </View>
        )}

        {sortOpen && (
          <View style={styles.sortMenu}>
            {[...CHOOSABLE_WISH_SORTS, ...(logic.manual ? (["MANUAL"] as const) : [])].map(
              (option: WishSort) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  onPress={() => {
                    logic.setSort(option);
                    setSortOpen(false);
                  }}
                  style={styles.sortOption}
                >
                  <Text
                    style={[styles.sortOptionText, logic.sort === option && styles.sortOptionOn]}
                  >
                    {t(`wishlist.sort.${option}`)}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
        )}
      </View>

      {logic.loading ? null : logic.count === 0 ? (
        <EmptyWishlist onTypeItIn={() => setSheet("MANUAL")} />
      ) : logic.noMatches ? (
        <Text style={styles.noMatches}>{t("wishlist.filterNoMatches")}</Text>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          // A carried row must not take the list with it.
          scrollEnabled={lifted === null}
          refreshControl={
            <RefreshControl
              refreshing={logic.refreshing}
              onRefresh={() => void logic.refetch()}
              tintColor={colors.inkMuted}
            />
          }
        >
          {logic.items.map((item, index) => (
            <Animated.View
              key={item.id}
              onLayout={measure(index)}
              {...responder(index).panHandlers}
              style={[
                styles.row,
                lifted === index && styles.rowLifted,
                // One transform, not two: a second `transform` key replaces the first, and
                // splitting the lift across both styles would silently drop the scale.
                lifted === index && { transform: [{ translateY: shift }, { scale: 1.015 }] },
              ]}
            >
              <WishRow
                onPress={() =>
                  router.push({ pathname: "/wishlist/[wishId]", params: { wishId: item.id } })
                }
                // A drag reorders the *whole* list, and an index into a narrowed one points
                // at the wrong entry — so a long press does nothing until the box is empty
                // again rather than silently carrying somebody else's row.
                onLongPress={logic.filtering ? undefined : () => setLifted(index)}
                art={
                  /* The wanted format is the silhouette, not the artwork: an entry for the
                     vinyl of a record you already have on CD should look like the thing you
                     are hunting. */
                  <ReleaseArt
                    release={{ coverArtUrl: logic.coverOf(item) }}
                    previewUri={logic.pictureOf(item)}
                    format={item.desiredFormat ?? "OTHER"}
                  />
                }
                title={item.title}
                subtitle={`${item.artistName}${item.year === null ? "" : ` · ${item.year}`}`}
                note={item.note}
                format={
                  item.desiredFormat === null
                    ? t("wishlist.anyFormat")
                    : FORMAT_LABELS[item.desiredFormat]
                }
                trailing={formatRelativeTime(item.createdAt, i18n.language)}
              />
            </Animated.View>
          ))}
        </ScrollView>
      )}

      {sheet !== null && (
        <WishSheet onClose={() => setSheet(null)} entry={sheet === "MANUAL" ? null : sheet} />
      )}
    </SafeAreaView>
  );
}

/**
 * Screen 16f.
 *
 * The wishlist starts where records get found, so the empty state names those places
 * rather than putting one button in the middle of a blank screen.
 */
function EmptyWishlist({ onTypeItIn }: { readonly onTypeItIn: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();

  const ways = [
    { key: "search", icon: Search, go: () => router.push("/add") },
    { key: "artist", icon: Disc3, go: () => router.push("/add") },
    // The friends tab is turn 15's; until it lands there is nowhere for this one to go.
    { key: "friend", icon: Users, go: null },
    { key: "manual", icon: Pencil, go: onTypeItIn },
  ] as const;

  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Heart size={22} color={colors.inkSubtle} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>{t("wishlist.emptyTitle")}</Text>
      <Text style={styles.emptyLede}>{t("wishlist.emptyLede")}</Text>
      <View style={styles.ways}>
        {ways.map(({ key, icon: Icon, go }) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            disabled={go === null}
            onPress={go ?? undefined}
            style={[styles.way, go === null && styles.wayOff]}
          >
            <Icon size={16} color={colors.inkSubtle} strokeWidth={1.75} />
            <Text style={styles.wayText}>{t(`wishlist.way.${key}`)}</Text>
            <ChevronRight size={15} color={colors.inkSubtle} strokeWidth={1.75} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 18, paddingTop: 8 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.ink },
  count: { fontSize: 12.5, color: colors.inkMuted, marginTop: 6 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    height: 42,
    paddingHorizontal: 14,
    marginTop: 15,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.ink, padding: 0 },
  noMatches: { fontSize: 13, color: colors.inkMuted, paddingHorizontal: 18, paddingTop: 26 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    // The list starts straight under this row, and without it the first entry crowded the
    // pill. On the controls rather than the header, so an empty wishlist -- which has no
    // controls at all -- does not gain a gap it has nothing to separate.
    marginBottom: 12,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  sortChipText: { fontSize: 12, fontWeight: "600", color: colors.ink },
  dragHint: { flexDirection: "row", alignItems: "center", gap: 5 },
  dragHintText: { fontSize: 11.5, color: colors.inkMuted },
  sortMenu: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: "hidden",
  },
  sortOption: { paddingHorizontal: 14, paddingVertical: 11 },
  sortOptionText: { fontSize: 13, color: colors.ink },
  sortOptionOn: { fontWeight: "700" },
  list: { padding: 18, paddingBottom: 120, gap: 9 },
  row: wishCardStyle,
  rowLifted: {
    // The deck's carried row: lifted off the page and shadowed. The scale rides along with
    // the drag's own transform above.
    shadowColor: colors.ink,
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    zIndex: 2,
  },
  empty: { flex: 1, alignItems: "center", paddingHorizontal: 30, paddingTop: 70 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink, marginTop: 18 },
  emptyLede: {
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.inkMuted,
    textAlign: "center",
    marginTop: 8,
  },
  ways: { alignSelf: "stretch", marginTop: 24 },
  way: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  wayOff: { opacity: 0.45 },
  wayText: { flex: 1, fontSize: 12.5, color: colors.ink },
});
