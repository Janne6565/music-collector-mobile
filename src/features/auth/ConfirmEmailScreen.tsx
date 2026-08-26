import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { confirmEmailAddress } from "@/api/auth";
import { accountChanged } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { colors, fonts } from "@/theme/colors";

type State = "pending" | "done" | "invalid" | "noToken";

/**
 * The other end of a confirmation link, at `musiccollector://confirm?token=…`.
 *
 * The mail itself carries an https URL, which on a phone opens the browser rather than this
 * app -- turning it into one that opens the app needs universal links, which is deployment
 * work this screen deliberately does not wait for. It is here for the route that does exist
 * today and so that the flow lands in the app the moment those links are configured; the
 * ordinary path is the browser, and the account screen re-reads the account on focus.
 *
 * There is nothing to fill in, so the token is redeemed on mount -- once. A one-time token
 * spent by a second run would report a dead link on a confirmation that had just worked.
 */
export function ConfirmEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const signedIn = useAppSelector((state) => state.auth.status === "signedIn");
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [state, setState] = useState<State>(
    token === undefined || token === "" ? "noToken" : "pending",
  );
  const attempted = useRef(false);

  useEffect(() => {
    if (token === undefined || token === "" || attempted.current) return;
    attempted.current = true;
    void (async () => {
      try {
        const user = await confirmEmailAddress(token);
        // The account in the store still says unconfirmed; the server just handed back the
        // version that does not. Only if this phone is the one holding that account.
        if (signedIn) dispatch(accountChanged(user));
        setState("done");
      } catch {
        setState("invalid");
      }
    })();
  }, [token, signedIn, dispatch]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.title}>
          {state === "done" ? t("auth.confirmDoneTitle") : t("auth.confirmTitle")}
        </Text>
        {state === "pending" ? (
          <ActivityIndicator color={colors.ink} style={styles.spinner} />
        ) : (
          <Text style={styles.lede}>{t(`auth.confirm.${state}`)}</Text>
        )}

        {state !== "pending" && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace(state === "done" ? "/" : "/(tabs)/you")}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>
              {state === "done" ? t("auth.confirmContinue") : t("auth.confirmResendHint")}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  body: { flex: 1, justifyContent: "center", padding: 24, gap: 14 },
  title: { fontSize: 28, fontFamily: fonts.serif, color: colors.ink },
  lede: { fontSize: 14, lineHeight: 21, color: colors.inkMuted },
  spinner: { alignSelf: "flex-start", paddingVertical: 6 },
  primary: {
    marginTop: 10,
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: colors.paper, fontSize: 15, fontWeight: "600" },
});
