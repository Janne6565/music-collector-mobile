import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccountLogic } from "@/features/auth/useAccountLogic";
import { colors, fonts } from "@/theme/colors";

/**
 * Screen 21g — moving the account to a different address.
 *
 * The rule the whole screen is shaped by, and why it can afford to be calm: the current
 * address keeps working — signing in, resets, everything — until the new one answers, so a
 * typo cannot lock anybody out. The account is not un-confirmed while it waits; it is
 * confirmed at the old address and pending at the new.
 *
 * The password is asked for because a stray session should not be able to walk off with the
 * account. An account made through a provider has none, so the field is not shown rather
 * than shown and ignored.
 */
export function ChangeEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const logic = useAccountLogic();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const needsPassword = logic.user?.hasPassword !== false;
  const ready = email.trim().length > 0 && (!needsPassword || password.length > 0);

  const submit = async () => {
    if (!ready || logic.changingEmail) return;
    if (await logic.changeEmail(email, needsPassword ? password : null)) {
      router.back();
    }
  };

  if (logic.user === null) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.ink} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>{t("account.changeEmail.title")}</Text>
        <Text style={styles.lede}>{t("account.changeEmail.lede")}</Text>

        <View style={styles.card}>
          <Text style={styles.current}>{logic.user.email}</Text>
          <Text style={styles.currentNote}>
            {logic.emailConfirmed
              ? t("account.changeEmail.currentConfirmed")
              : t("account.changeEmail.currentUnconfirmed")}
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t("account.changeEmail.newAddress")}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            style={styles.input}
          />
        </View>

        {needsPassword && (
          <View style={styles.field}>
            <Text style={styles.label}>{t("account.changeEmail.password")}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="password"
              style={styles.input}
            />
            <Text style={styles.hint}>{t("account.changeEmail.passwordWhy")}</Text>
          </View>
        )}

        <View style={styles.next}>
          <Text style={styles.nextTitle}>{t("account.changeEmail.next.title")}</Text>
          {(["one", "two", "three", "four"] as const).map((step, index) => (
            <View key={step} style={styles.step}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.stepText}>
                {t(`account.changeEmail.next.${step}`, { email: logic.user?.email ?? "" })}
              </Text>
            </View>
          ))}
        </View>

        {logic.changeFailed && <Text style={styles.failed}>{t("account.changeEmail.failed")}</Text>}

        <Pressable
          accessibilityRole="button"
          onPress={() => void submit()}
          disabled={!ready || logic.changingEmail}
          style={[styles.primary, (!ready || logic.changingEmail) && styles.dim]}
        >
          {logic.changingEmail ? (
            <ActivityIndicator size="small" color={colors.paper} />
          ) : (
            <Text style={styles.primaryText}>{t("account.changeEmail.submit")}</Text>
          )}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.cancel}>{t("common.cancel")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  body: { padding: 18, paddingBottom: 40, gap: 14 },
  title: { fontSize: 26, fontFamily: fonts.serif, color: colors.ink },
  lede: { fontSize: 13.5, lineHeight: 20, color: colors.inkMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: 14,
    gap: 2,
  },
  current: { fontSize: 13, fontWeight: "600", color: colors.ink },
  currentNote: { fontSize: 11.5, color: colors.inkMuted },
  field: { gap: 6 },
  label: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
  },
  hint: { fontSize: 11.5, lineHeight: 17, color: colors.inkSubtle },
  next: { backgroundColor: colors.canvas, borderRadius: 12, padding: 14, gap: 7 },
  nextTitle: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  step: { flexDirection: "row", gap: 10 },
  stepNumber: { fontSize: 11, fontFamily: "Menlo", color: colors.inkSubtle, width: 12 },
  stepText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.inkMuted },
  failed: { fontSize: 13, color: colors.accentStrong },
  primary: {
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: colors.paper, fontSize: 15, fontWeight: "600" },
  cancel: { textAlign: "center", fontSize: 13.5, color: colors.inkMuted, paddingVertical: 8 },
  dim: { opacity: 0.5 },
});
