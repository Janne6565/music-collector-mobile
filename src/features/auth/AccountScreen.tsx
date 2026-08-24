import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthForm } from "@/features/auth/AuthForm";
import { CollectionStatsBlock } from "@/features/profile/CollectionStatsBlock";
import { useAccountLogic } from "@/features/auth/useAccountLogic";
import type { FirstSyncStrategy } from "@/sync/syncEngine";
import { colors, fonts } from "@/theme/colors";

/**
 * The "You" tab.
 *
 * An account is optional, and this screen says so rather than presenting sign-in as a
 * gate. Everything in the app works before you ever reach here.
 */
export function AccountScreen() {
  const logic = useAccountLogic();

  if (logic.restoring) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.ink} />
      </SafeAreaView>
    );
  }

  if (logic.firstSyncPending) {
    return <FirstSyncPrompt onChoose={logic.resolveFirstSync} busy={logic.busy} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.body}>
        {logic.user === null ? <AuthForm logic={logic} /> : <SignedIn logic={logic} />}
        <CollectionStatsBlock />
      </ScrollView>
    </SafeAreaView>
  );
}

function SignedIn({ logic }: { readonly logic: ReturnType<typeof useAccountLogic> }) {
  const { t } = useTranslation();
  return (
    <>
      <Text style={styles.title}>{logic.user?.displayName ?? logic.user?.email}</Text>
      <Text style={styles.lede}>{t("auth.syncing")}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void logic.signOut()}
        disabled={logic.busy}
        style={[styles.secondary, logic.busy && styles.disabled]}
      >
        <Text style={styles.secondaryText}>{t("auth.signOut")}</Text>
      </Pressable>
      <Text style={styles.footnote}>{t("auth.signOutKeepsData")}</Text>
    </>
  );
}

function FirstSyncPrompt({
  onChoose,
  busy,
}: {
  readonly onChoose: (strategy: FirstSyncStrategy) => Promise<void>;
  readonly busy: boolean;
}) {
  const { t } = useTranslation();
  const options: readonly { key: FirstSyncStrategy; title: string; body: string }[] = [
    { key: "MERGE", title: t("firstSync.merge.title"), body: t("firstSync.merge.body") },
    { key: "KEEP_LOCAL", title: t("firstSync.keepLocal.title"), body: t("firstSync.keepLocalShort") },
    { key: "KEEP_ACCOUNT", title: t("firstSync.keepAccount.title"), body: t("firstSync.keepAccountShort") },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.body}>
        <Text style={styles.title}>{t("firstSync.title")}</Text>
        <Text style={styles.lede}>{t("firstSync.lede")}</Text>
        {options.map((option) => (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            onPress={() => void onChoose(option.key)}
            disabled={busy}
            style={[styles.choice, busy && styles.disabled]}
          >
            <Text style={styles.choiceTitle}>{option.title}</Text>
            <Text style={styles.choiceBody}>{option.body}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  body: { padding: 18, gap: 10 },
  title: { fontFamily: fonts.serif, fontSize: 28, color: colors.ink },
  lede: { fontSize: 13, color: colors.inkMuted, marginBottom: 8 },
  label: { fontSize: 10, letterSpacing: 0.9, textTransform: "uppercase", color: colors.inkSubtle },
  input: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    fontSize: 14,
    color: colors.ink,
  },
  error: { fontSize: 13, color: colors.accent },
  primary: {
    height: 46,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  primaryText: { color: colors.paper, fontSize: 14, fontWeight: "600" },
  secondary: {
    height: 46,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  secondaryText: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  link: { fontSize: 13, color: colors.inkMuted, textDecorationLine: "underline", marginTop: 4 },
  footnote: { fontSize: 12, color: colors.inkSubtle, marginTop: 4 },
  choice: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    gap: 3,
  },
  choiceTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  choiceBody: { fontSize: 12, color: colors.inkMuted },
});
