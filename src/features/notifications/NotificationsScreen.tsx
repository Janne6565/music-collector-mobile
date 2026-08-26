import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Lock } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type NotificationCategory,
  notificationPreferences,
  updateNotificationPreference,
} from "@/api/notifications";
import { useAppSelector } from "@/store/hooks";
import { colors, fonts } from "@/theme/colors";

const ORDER: readonly NotificationCategory[] = [
  "FRIEND_REQUEST",
  "FRIEND_ACTIVITY",
  "SECURITY",
  "PRODUCT_NEWS",
];

/**
 * Screen 22a on the phone, with 22e's off states folded in — they are the same screen.
 *
 * Two levels, deliberately: *what* may reach you belongs to the account, *which device*
 * buzzes belongs to the device. Only the first exists today. There is no push transport, so
 * no device could receive one, and the column says that rather than showing switches that
 * would quietly do nothing.
 *
 * The grid is read from the server, not the local store — unlike everything else under
 * Settings, which stays on this phone. That is the whole point of it: set here, and the web
 * reads the same switches.
 */
export function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAppSelector((state) => state.auth.user);

  const grid = useQuery({
    queryKey: ["notificationPreferences"],
    queryFn: notificationPreferences,
    enabled: user !== null,
  });

  const flip = useMutation({
    mutationFn: async (next: { category: NotificationCategory; mail: boolean; push: boolean }) =>
      updateNotificationPreference(next.category, next.mail, next.push),
    onSuccess: (answer) => queryClient.setQueryData(["notificationPreferences"], answer),
  });

  const categories = grid.data?.categories ?? [];
  const pushAvailable = grid.data?.pushAvailable === true;
  // Security mail is excluded on purpose: it is not silenceable, so counting it would mean
  // this line could never appear.
  const allQuiet =
    categories.length > 0 && categories.every((row) => row.mailLocked || (!row.mail && !row.push));
  const emailReachable = user?.emailVerified !== false;

  const set = (category: NotificationCategory, channel: "mail" | "push", on: boolean) => {
    const row = categories.find((candidate) => candidate.category === category);
    if (row === undefined) return;
    flip.mutate({
      category,
      mail: channel === "mail" ? on : row.mail,
      push: channel === "push" ? on : row.push,
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <ChevronLeft size={20} color={colors.ink} strokeWidth={1.75} />
        </Pressable>
        <Text style={styles.barTitle}>{t("notifications.title")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.scope}>{t("notifications.scopeMobile")}</Text>

        {allQuiet && (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{t("notifications.allQuiet.title")}</Text>
            <Text style={styles.noticeBody}>{t("notifications.allQuiet.body")}</Text>
          </View>
        )}

        <View style={styles.headerRow}>
          <Text style={[styles.columnLabel, styles.categoryColumn]}>
            {t("notifications.column.category")}
          </Text>
          <Text style={styles.columnLabel}>{t("notifications.channel.mail")}</Text>
          <Text style={styles.columnLabel}>{t("notifications.channel.push")}</Text>
        </View>

        {grid.isPending ? (
          <View style={styles.card}>
            <ActivityIndicator color={colors.ink} style={styles.spinner} />
          </View>
        ) : (
          <View style={styles.card}>
            {ORDER.map((category, index) => {
              const row = categories.find((candidate) => candidate.category === category);
              if (row === undefined) return null;
              return (
                <View key={category} style={[styles.row, index === ORDER.length - 1 && styles.rowLast]}>
                  <View style={styles.categoryColumn}>
                    <Text style={styles.rowTitle}>{t(`notifications.category.${category}.title`)}</Text>
                    <Text style={styles.rowBody}>{t(`notifications.category.${category}.short`)}</Text>
                  </View>

                  <View style={styles.cell}>
                    {row.mailLocked ? (
                      <Lock size={15} color={colors.inkSubtle} strokeWidth={1.75} />
                    ) : !emailReachable ? (
                      <Text style={styles.cellNote}>{t("notifications.noConfirmedAddress")}</Text>
                    ) : (
                      <Switch
                        value={row.mail}
                        onValueChange={(on) => set(category, "mail", on)}
                        trackColor={{ true: colors.ink, false: colors.line }}
                      />
                    )}
                  </View>

                  <View style={styles.cell}>
                    {pushAvailable ? (
                      <Switch
                        value={row.push}
                        onValueChange={(on) => set(category, "push", on)}
                        trackColor={{ true: colors.ink, false: colors.line }}
                      />
                    ) : (
                      <Text style={styles.dash}>—</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.footnote}>{t("notifications.lockFootnote")}</Text>

        {!pushAvailable && (
          <>
            <Text style={styles.sectionLabel}>{t("notifications.devices.heading")}</Text>
            <View style={styles.card}>
              <View style={[styles.row, styles.rowLast]}>
                <View style={styles.categoryColumn}>
                  <Text style={styles.rowTitle}>{t("notifications.devices.none")}</Text>
                  <Text style={styles.rowBody}>{t("notifications.noPush.bodyMobile")}</Text>
                </View>
              </View>
            </View>
          </>
        )}

        <Text style={styles.footnote}>{t("notifications.savesAsYouGo")}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  barTitle: { fontFamily: fonts.sans, fontSize: 14, fontWeight: "600", color: colors.ink },
  body: { padding: 18, paddingBottom: 40, gap: 10 },
  scope: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.inkMuted },
  notice: {
    backgroundColor: colors.canvas,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  noticeTitle: { fontFamily: fonts.sans, fontSize: 13, fontWeight: "600", color: colors.ink },
  noticeBody: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.inkMuted },
  headerRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 14, marginTop: 6 },
  columnLabel: {
    width: 58,
    textAlign: "center",
    fontFamily: fonts.sans,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.inkSubtle,
  },
  categoryColumn: { flex: 1, gap: 2 },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  spinner: { paddingVertical: 28 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowTitle: { fontFamily: fonts.sans, fontSize: 13.5, fontWeight: "600", color: colors.ink },
  rowBody: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.inkMuted },
  cell: { width: 58, alignItems: "center" },
  cellNote: {
    fontFamily: fonts.sans,
    fontSize: 10,
    lineHeight: 13,
    textAlign: "center",
    color: colors.accent,
  },
  dash: { fontFamily: fonts.sans, fontSize: 14, color: colors.inkSubtle },
  sectionLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.inkSubtle,
    marginTop: 14,
  },
  footnote: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 16, color: colors.inkSubtle },
});
