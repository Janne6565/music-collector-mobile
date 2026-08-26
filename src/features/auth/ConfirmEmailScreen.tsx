import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { confirmEmailAddress } from "@/api/auth";
import { looksTruncated, maskAddress } from "@/features/auth/confirmToken";
import { accountChanged } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { colors, fonts } from "@/theme/colors";

type State = "pending" | "done" | "dead" | "truncated";

/**
 * Screen 21e — the other end of a confirmation link, at `musiccollector://confirm/<token>`.
 *
 * The app has a session, so unlike the web page (21d) this one can end in the library
 * rather than in a dead tab. The cut-short state is the one place it cannot help, and it
 * says so without pretending the mail was the person's fault.
 *
 * The mail itself carries an https URL, which on a phone opens the browser — turning that
 * into a link that opens the app needs universal links, which is deployment work. This
 * screen is what those links will land on.
 *
 * The token is redeemed on mount, once: React mounts effects twice in development, and a
 * one-time token spent by the first run would report a dead link on a confirmation that had
 * just worked.
 */
export function ConfirmEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const signedIn = useAppSelector((state) => state.auth.status === "signedIn");
  const { token } = useLocalSearchParams<{ token: string }>();
  const raw = token ?? "";
  const [state, setState] = useState<State>(looksTruncated(raw) ? "truncated" : "pending");
  const [address, setAddress] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (looksTruncated(raw) || raw === "" || attempted.current) return;
    attempted.current = true;
    void (async () => {
      try {
        const user = await confirmEmailAddress(raw);
        // Masked unless this phone is the one holding the account: the link may have been
        // opened by somebody who is not its owner.
        setAddress(signedIn ? user.email : maskAddress(user.email));
        if (signedIn) dispatch(accountChanged(user));
        setState("done");
      } catch {
        setState("dead");
      }
    })();
  }, [raw, signedIn, dispatch]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.wordmark}>Music Collector</Text>
        <View style={styles.rule} />

        <Text style={styles.title}>{t(`auth.confirmPage.${state}.title`)}</Text>
        {state === "pending" ? (
          <ActivityIndicator color={colors.ink} style={styles.spinner} />
        ) : (
          <Text style={styles.lede}>
            {state === "done"
              ? t("auth.confirmPage.done.body", { email: address ?? "" })
              : t(`auth.confirmPage.${state}.body`)}
          </Text>
        )}

        {state === "done" && (
          <>
            {signedIn && <Text style={styles.aside}>{t("auth.confirmPage.done.unchanged")}</Text>}
            <Primary
              label={signedIn ? t("auth.confirmPage.done.backToLibrary") : t("auth.signIn")}
              onPress={() => router.replace(signedIn ? "/" : "/(tabs)/you")}
            />
          </>
        )}

        {state === "dead" && (
          <>
            <Primary
              label={t("auth.confirmPage.dead.sendMine")}
              onPress={() => router.replace("/(tabs)/you")}
            />
            <Pressable accessibilityRole="button" onPress={() => router.replace("/")}>
              <Text style={styles.secondary}>{t("auth.confirmPage.dead.notNow")}</Text>
            </Pressable>
          </>
        )}

        {state === "truncated" && (
          <>
            <View style={styles.sample}>
              <Text style={styles.sampleText}>
                {t("auth.confirmPage.truncated.exampleHead")}
                <Text style={styles.sampleLost}>????</Text>
              </Text>
            </View>
            <Primary
              label={t("auth.confirmPage.truncated.openMail")}
              onPress={() => void Linking.openURL("message://")}
            />
            <Pressable accessibilityRole="button" onPress={() => router.replace("/")}>
              <Text style={styles.secondary}>{t("auth.confirmPage.truncated.back")}</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function Primary({ label, onPress }: { readonly label: string; readonly onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.primary}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  body: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  wordmark: { fontSize: 19, fontFamily: fonts.serif, color: colors.ink },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginBottom: 14 },
  title: { fontSize: 28, lineHeight: 33, fontFamily: fonts.serif, color: colors.ink },
  lede: { fontSize: 14, lineHeight: 21, color: colors.inkMuted },
  aside: { fontSize: 12.5, lineHeight: 19, color: colors.inkSubtle },
  spinner: { alignSelf: "flex-start", paddingVertical: 6 },
  sample: { backgroundColor: colors.canvas, borderRadius: 10, padding: 14 },
  sampleText: { fontSize: 12.5, fontFamily: "Menlo", color: colors.inkSubtle },
  sampleLost: { color: colors.ink, fontWeight: "600" },
  primary: {
    marginTop: 8,
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: colors.paper, fontSize: 15, fontWeight: "600" },
  secondary: { textAlign: "center", fontSize: 13.5, color: colors.inkMuted, paddingVertical: 8 },
});
