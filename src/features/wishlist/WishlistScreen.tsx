import { FormatThumb } from "@/components/FormatThumb";
import { formatRelativeTime } from "@/domain/relativeTime";
import { WishSheet } from "@/features/wishlist/WishSheet";
import { useWishlistLogic } from "@/features/wishlist/useWishlistLogic";
import { colors, fonts } from "@/theme/colors";
import type { WishSort, WishlistItem } from "@janne6565/music-collector-shared";
import { CHOOSABLE_WISH_SORTS, FORMAT_LABELS } from "@janne6565/music-collector-shared";
import { useRouter } from "expo-router";
import { ArrowUpDown, ChevronDown, ChevronRight, Disc3, Heart, Pencil, Plus, Search, Users } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  LayoutAnimation,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
              <Text style={styles.dragHintText}>{t("wishlist.longPressHint")}</Text>
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
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          // A carried row must not take the list with it.
          scrollEnabled={lifted === null}
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
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: "/wishlist/[wishId]", params: { wishId: item.id } })
                }
                onLongPress={() => setLifted(index)}
                delayLongPress={250}
                style={styles.rowPressable}
              >
                <View style={styles.thumb}>
                  <FormatThumb format={item.desiredFormat ?? "OTHER"} />
                </View>
                <View style={styles.body}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {item.artistName}
                    {item.year === null ? "" : ` · ${item.year}`}
                  </Text>
                  {item.note !== null && (
                    <Text style={styles.rowNote} numberOfLines={1}>
                      {item.note}
                    </Text>
                  )}
                  <View style={styles.metaRow}>
                    <Text style={styles.formatChip}>
                      {item.desiredFormat === null
                        ? t("wishlist.anyFormat")
                        : FORMAT_LABELS[item.desiredFormat]}
                    </Text>
                    <Text style={styles.added}>
                      {formatRelativeTime(item.createdAt, i18n.language)}
                    </Text>
                  </View>
                </View>
              </Pressable>
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
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 15,
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
  row: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
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
  rowPressable: { flexDirection: "row", gap: 12, padding: 12 },
  thumb: { width: 56 },
  body: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  rowSubtitle: { fontSize: 12, color: colors.inkMuted, marginTop: 1 },
  rowNote: { fontSize: 11.5, color: colors.inkSubtle, marginTop: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 },
  formatChip: {
    fontSize: 10,
    color: colors.inkMuted,
    backgroundColor: "rgba(25,23,19,0.06)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    overflow: "hidden",
  },
  added: { fontSize: 10, color: colors.inkSubtle },
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
