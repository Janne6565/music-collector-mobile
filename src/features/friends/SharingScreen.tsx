import type { Visibility } from "@/api/friends";
import { useSharingLogic } from "@/features/friends/useSharingLogic";
import { colors, fonts } from "@/theme/colors";
import { useRouter } from "expo-router";
import { Check, ChevronLeft, EyeOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Screen 15f — three lists, three separate answers.
 *
 * The collection and the wishlist are asked separately because a public wishlist over a
 * friends-only shelf is the normal case: what you are hunting for is a much smaller thing
 * to share than what you own.
 */
export function SharingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const logic = useSharingLogic();
  const settings = logic.settings;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <ChevronLeft size={20} color={colors.ink} strokeWidth={1.75} />
        </Pressable>
        <Text style={styles.barTitle}>{t("sharing.title")}</Text>
      </View>

      {settings === undefined ? (
        <View style={styles.centred}>
          <ActivityIndicator color={colors.inkSubtle} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t("sharing.handleLabel")}</Text>
                <Text style={styles.rowBody}>@{settings.handle}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t("sharing.findable.title")}</Text>
                <Text style={styles.rowBody}>{t("sharing.findable.body")}</Text>
              </View>
              <Switch
                value={settings.findable ?? true}
                onValueChange={(findable) => logic.set({ findable })}
                trackColor={{ true: colors.ink, false: colors.line }}
              />
            </View>
          </View>

          <Choices
            legend={t("sharing.collection.legend")}
            value={settings.collectionVisibility ?? "FRIENDS"}
            onChange={logic.setCollection}
          />

          <Choices
            legend={t("sharing.wishlist.legend")}
            value={settings.wishlistVisibility ?? "FRIENDS"}
            onChange={logic.setWishlist}
            note={t("sharing.wishlist.note")}
          />

          <Text style={styles.sectionLabel}>{t("sharing.money")}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t("sharing.prices.title")}</Text>
                <Text style={styles.rowBody}>
                  {settings.pricesPublic === true ? t("sharing.prices.on") : t("sharing.prices.off")}
                </Text>
              </View>
              <Switch
                value={settings.pricesPublic ?? false}
                onValueChange={(pricesPublic) => logic.set({ pricesPublic })}
                trackColor={{ true: colors.ink, false: colors.line }}
              />
            </View>
          </View>

          <View style={styles.footnote}>
            <EyeOff size={15} color={colors.inkMuted} strokeWidth={1.75} />
            <Text style={styles.footnoteText}>{t("sharing.perCopyNote")}</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/**
 * All three answers visible at once, rather than behind a picker. A privacy setting
 * somebody has to open a menu to compare is one they will get wrong.
 */
const CHOICES = [
  { value: "ONLY_ME", title: "sharing.choice.only_me.title", body: "sharing.choice.only_me.body" },
  { value: "FRIENDS", title: "sharing.choice.friends.title", body: "sharing.choice.friends.body" },
  { value: "PUBLIC", title: "sharing.choice.public.title", body: "sharing.choice.public.body" },
] as const;

function Choices({
  legend,
  value,
  onChange,
  note,
}: {
  readonly legend: string;
  readonly value: Visibility;
  readonly onChange: (value: Visibility) => void;
  readonly note?: string;
}) {
  const { t } = useTranslation();
  return (
    <View>
      <Text style={styles.sectionLabel}>{legend}</Text>
      <View style={styles.card}>
        {CHOICES.map((choice, index) => (
          <View key={choice.value}>
            {index > 0 && <View style={styles.divider} />}
            <Pressable
              onPress={() => onChange(choice.value)}
              style={styles.row}
              accessibilityRole="radio"
              accessibilityState={{ checked: value === choice.value }}
            >
              <View style={[styles.radio, value === choice.value && styles.radioOn]}>
                {value === choice.value && <Check size={11} color={colors.paper} strokeWidth={3} />}
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t(choice.title)}</Text>
                <Text style={styles.rowBody}>{t(choice.body)}</Text>
              </View>
            </Pressable>
          </View>
        ))}
      </View>
      {note !== undefined && <Text style={styles.note}>{note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  bar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  barTitle: { fontFamily: fonts.sans, fontSize: 15, fontWeight: "600", color: colors.ink },
  centred: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 4 },
  sectionLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.inkSubtle,
    marginTop: 20,
    marginBottom: 8,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  divider: { height: 1, backgroundColor: colors.line },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: fonts.sans, fontSize: 13.5, fontWeight: "600", color: colors.ink },
  rowBody: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.inkMuted, marginTop: 2 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  note: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.inkMuted, marginTop: 8 },
  footnote: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.canvas,
  },
  footnoteText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.inkMuted },
});
