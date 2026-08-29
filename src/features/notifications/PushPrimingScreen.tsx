import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { askForPush, syncPushRegistration } from "@/features/notifications/push";
import { useStore } from "@/local/StoreProvider";
import { colors, fonts } from "@/theme/colors";

/**
 * Screen 22b — asking for the OS prompt before spending it.
 *
 * iOS offers the prompt once and a "no" is close to permanent, so this screen exists to make
 * the question answerable: it lists exactly the two things that would ever arrive, and names
 * the one that would not. It is shown the moment it is earned — right after the first
 * friendship forms — and never at launch, on sign-in, or after a record is added.
 *
 * **Neither escape may open the system dialog.** "Skip" in the corner and "Not now" at the
 * bottom do the same thing on purpose: the top-right is where a thumb goes to dismiss, and a
 * dismissal that spent the prompt would be a trap. Only the dark button asks iOS anything.
 */
export function PushPrimingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { store } = useStore();
  const { friend, occasion } = useLocalSearchParams<{ friend?: string; occasion?: string }>();
  const [asking, setAsking] = useState(false);

  const leave = () => router.back();

  const allow = async () => {
    setAsking(true);
    try {
      if (await askForPush()) {
        await syncPushRegistration(store);
      }
    } finally {
      setAsking(false);
      leave();
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.bar}>
        <View style={styles.spacer} />
        <Pressable accessibilityRole="button" onPress={leave} hitSlop={12}>
          <Text style={styles.skip}>{t("push.priming.skip")}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {friend !== undefined && friend !== "" ? (
          <Text style={styles.eyebrow}>{t("push.priming.eyebrow", { name: friend })}</Text>
        ) : occasion === "existing" ? (
          // Reached from launch rather than from an acceptance, where "you two are friends
          // now" would be a lie about a friendship that may be months old.
          <Text style={styles.eyebrow}>{t("push.priming.eyebrowExisting")}</Text>
        ) : null}
        <Text style={styles.title}>{t("push.priming.title")}</Text>
        <Text style={styles.lede}>{t("push.priming.lede")}</Text>

        <View style={styles.list}>
          <View style={styles.item}>
            <Text style={styles.itemTitle}>{t("push.priming.request.title")}</Text>
            <Text style={styles.itemBody}>{t("push.priming.request.body")}</Text>
          </View>
          <View style={styles.item}>
            <Text style={styles.itemTitle}>{t("push.priming.signIn.title")}</Text>
            <Text style={styles.itemBody}>{t("push.priming.signIn.body")}</Text>
          </View>
        </View>

        {/* Naming what would *not* arrive is what makes the list a promise rather than a
            sales pitch. Board 22c killed this one on the lock screen. */}
        <Text style={styles.notThis}>{t("push.priming.notThis")}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void allow()}
          disabled={asking}
          style={[styles.primary, asking && styles.dim]}
        >
          {asking ? (
            <ActivityIndicator size="small" color={colors.paper} />
          ) : (
            <Text style={styles.primaryText}>{t("push.priming.allow")}</Text>
          )}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={leave}>
          <Text style={styles.secondary}>{t("push.priming.notNow")}</Text>
        </Pressable>
        <Text style={styles.footnote}>{t("push.priming.footnote")}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 12 },
  spacer: { flex: 1 },
  skip: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkMuted },
  body: { paddingHorizontal: 22, paddingBottom: 24, gap: 12 },
  eyebrow: { fontFamily: fonts.sans, fontSize: 13, fontWeight: "600", color: colors.accent },
  title: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 33, color: colors.ink },
  lede: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20, color: colors.inkMuted },
  list: { gap: 14, marginTop: 8 },
  item: { gap: 3 },
  itemTitle: { fontFamily: fonts.sans, fontSize: 14, fontWeight: "600", color: colors.ink },
  itemBody: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18, color: colors.inkMuted },
  notThis: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18, color: colors.inkSubtle, marginTop: 10 },
  footer: { paddingHorizontal: 22, paddingBottom: 28, gap: 6 },
  primary: {
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: colors.paper, fontFamily: fonts.sans, fontSize: 15, fontWeight: "600" },
  secondary: {
    textAlign: "center",
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: colors.inkMuted,
    paddingVertical: 10,
  },
  footnote: {
    textAlign: "center",
    fontFamily: fonts.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.inkSubtle,
  },
  dim: { opacity: 0.5 },
});
