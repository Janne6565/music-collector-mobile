import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { claimConfirmStrip } from "@/local/settings";
import { useStore } from "@/local/StoreProvider";
import { useAppSelector } from "@/store/hooks";
import { colors } from "@/theme/colors";

/**
 * Screen 21b — the one time verification is allowed to speak unprompted.
 *
 * A strip on the shelf somebody was already heading for, not a screen. A dedicated "check
 * your inbox" page would stop a person who came here to add a record in order to tell them
 * about a mailbox they can read later, and its only button would be "skip".
 *
 * Once per device and never again: the flag is claimed the moment it is first asked for.
 * Everywhere else verification is banned from speaking — no badge on the tab bar, no dot on
 * You, no modal, ever (21a).
 */
export function ConfirmStrip() {
  const { t } = useTranslation();
  const router = useRouter();
  const { store } = useStore();
  const user = useAppSelector((state) => state.auth.user);
  const unconfirmed = user !== null && user.emailVerified === false;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!unconfirmed) return;
    let cancelled = false;
    void claimConfirmStrip(store).then((claimed) => {
      if (!cancelled && claimed) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [unconfirmed, store]);

  if (!visible || user === null) return null;

  return (
    <View style={styles.strip}>
      <View style={styles.text}>
        <Text style={styles.title}>{t("auth.strip.title", { email: user.email })}</Text>
        <Text style={styles.body}>{t("auth.strip.body")}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push("/account/email")}>
          <Text style={styles.link}>{t("auth.strip.wrongAddress")}</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.close")}
        onPress={() => setVisible(false)}
        hitSlop={8}
      >
        <X size={16} color={colors.inkSubtle} strokeWidth={1.75} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  text: { flex: 1, gap: 3 },
  title: { fontSize: 13, fontWeight: "600", color: colors.ink },
  body: { fontSize: 12, lineHeight: 17, color: colors.inkMuted },
  link: { fontSize: 12.5, fontWeight: "600", color: colors.accent, paddingTop: 4 },
});
