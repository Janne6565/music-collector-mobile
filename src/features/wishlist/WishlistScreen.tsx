import { Check, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FormatThumb } from "@/components/FormatThumb";
import type { WishlistItem } from "@/domain/types";
import { FORMAT_LABELS } from "@/domain/types";
import { useWishlistLogic } from "@/features/wishlist/useWishlistLogic";
import { colors, fonts } from "@/theme/colors";

export function WishlistScreen() {
  const { t } = useTranslation();
  const logic = useWishlistLogic();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("nav.wishlist")}</Text>
        <Text style={styles.count}>{t("wishlist.count", { count: logic.items.length })}</Text>
      </View>

      {logic.collectFailed && <Text style={styles.error}>{t("wishlist.collectFailed")}</Text>}

      <FlatList
        data={logic.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <Row item={item} logic={logic} />}
        ListEmptyComponent={logic.loading ? null : <Text style={styles.empty}>{t("wishlist.empty")}</Text>}
      />
    </SafeAreaView>
  );
}

function Row({
  item,
  logic,
}: {
  readonly item: WishlistItem;
  readonly logic: ReturnType<typeof useWishlistLogic>;
}) {
  const { t } = useTranslation();
  const collecting = logic.collecting === item.id;

  return (
    <View style={styles.row}>
      <View style={styles.card}>
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
            {item.desiredFormat === null ? "" : ` · ${FORMAT_LABELS[item.desiredFormat]}`}
          </Text>
          {item.note !== null && (
            <Text style={styles.rowNote} numberOfLines={1}>
              {item.note}
            </Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("wishlist.remove")}
          onPress={() => logic.remove(item)}
          disabled={logic.removing === item.id}
          style={styles.remove}
        >
          <Trash2 size={15} color={colors.inkMuted} strokeWidth={1.75} />
        </Pressable>
      </View>

      {/* The dark "Got it" panel from screen 1d, as a tap target rather than a swipe. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => logic.collect(item)}
        disabled={collecting}
        style={styles.gotIt}
      >
        {collecting ? (
          <ActivityIndicator size="small" color={colors.paper} />
        ) : (
          <>
            <Check size={16} color={colors.paper} strokeWidth={2} />
            <Text style={styles.gotItText}>{t("wishlist.gotIt")}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 18, paddingTop: 8, gap: 4 },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.ink },
  count: { fontSize: 12.5, color: colors.inkMuted },
  list: { padding: 18, gap: 10 },
  error: { paddingHorizontal: 18, paddingTop: 8, fontSize: 12.5, color: colors.accent },
  empty: { fontSize: 13, color: colors.inkMuted },
  row: { flexDirection: "row", borderRadius: 12, overflow: "hidden" },
  card: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRightWidth: 0,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  thumb: { width: 56 },
  body: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  rowSubtitle: { fontSize: 12, color: colors.inkMuted },
  rowNote: { fontSize: 11.5, color: colors.inkSubtle, marginTop: 2 },
  remove: { padding: 6 },
  gotIt: {
    width: 96,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  gotItText: { color: colors.paper, fontSize: 13, fontWeight: "600" },
});
