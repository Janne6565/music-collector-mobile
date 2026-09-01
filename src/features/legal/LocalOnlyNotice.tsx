import { useStore } from "@/local/StoreProvider";
import { markLocalOnlyNoticeSeen } from "@/local/settings";
import { colors, fonts } from "@/theme/colors";
import { useRouter } from "expo-router";
import { HardDrive, Lock, Search, Trash2 } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Screen 17b — the one screen between "no account, thanks" and an empty library.
 *
 * It exists because local-only is not the same as private: the collection really does stay
 * on the device, but a catalogue search really does leave it, and deleting the app really
 * does take the shelf with it. Each of those is a surprise if it is discovered later.
 */
export function LocalOnlyNotice() {
  const { t } = useTranslation();
  const router = useRouter();
  const { store } = useStore();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.badge}>
          <HardDrive size={24} color={colors.ink} strokeWidth={1.6} />
        </View>
        <Text style={styles.title}>{t("localOnly.title")}</Text>
        <Text style={styles.lede}>{t("localOnly.lede")}</Text>

        <View style={styles.points}>
          <Point
            icon={<Lock size={16} color={colors.ink} strokeWidth={1.75} />}
            title={t("localOnly.stays.title")}
            body={t("localOnly.stays.body")}
          />
          <Point
            icon={<Search size={16} color={colors.ink} strokeWidth={1.75} />}
            title={t("localOnly.lookups.title")}
            body={t("localOnly.lookups.body")}
          />
          <Point
            icon={<Trash2 size={16} color={colors.ink} strokeWidth={1.75} />}
            title={t("localOnly.delete.title")}
            body={t("localOnly.delete.body")}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/legal/datenschutz")}
          style={styles.legalCard}
        >
          <Text style={styles.legalText}>{t("localOnly.tdddg")}</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            // Marked as read only when it is actually dismissed forward, so a person who
            // backs out of here still sees it the next time they take this route.
            void markLocalOnlyNoticeSeen(store).finally(() => router.replace("/"));
          }}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>{t("localOnly.start")}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/you")}>
          <Text style={styles.secondaryText}>{t("localOnly.createInstead")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Point({
  icon,
  title,
  body,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly body: string;
}) {
  return (
    <View style={styles.point}>
      <View style={styles.pointIcon}>{icon}</View>
      <View style={styles.pointText}>
        <Text style={styles.pointTitle}>{title}</Text>
        <Text style={styles.pointBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  body: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 20 },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(25,23,19,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 32,
    lineHeight: 36,
    color: colors.ink,
    marginTop: 22,
  },
  lede: { fontSize: 13.5, lineHeight: 22, color: colors.inkMuted, marginTop: 10 },
  points: { marginTop: 26, gap: 14 },
  point: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  pointIcon: { marginTop: 2 },
  pointText: { flex: 1 },
  pointTitle: { fontSize: 13, fontWeight: "600", color: colors.ink },
  pointBody: { fontSize: 12, lineHeight: 19, color: colors.inkMuted, marginTop: 3 },
  legalCard: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  legalText: { fontSize: 11.5, lineHeight: 19, color: colors.inkMuted },
  actions: { paddingHorizontal: 24, paddingBottom: 12, gap: 12 },
  primary: {
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: 15, fontWeight: "600", color: colors.paper },
  secondaryText: { textAlign: "center", fontSize: 12.5, color: colors.inkMuted },
});
