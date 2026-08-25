import { Check, FileDown } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { pullChanges } from "@/api/sync";
import { useStore } from "@/local/StoreProvider";
import type { FirstSyncStrategy } from "@janne6565/music-collector-shared";
import { colors, fonts } from "@/theme/colors";

interface FirstSyncPromptProps {
  readonly onChoose: (strategy: FirstSyncStrategy) => Promise<void>;
  readonly onExport: () => Promise<void>;
  readonly busy: boolean;
}

/**
 * Screen 8a — a guest signs in and already has a collection on this phone.
 *
 * Two options rather than three: "keep the local one and discard the account" was a way to
 * throw away a whole synced collection from a screen you can reach by accident. Merging
 * never overwrites, so it is the safe default; keeping the account version leaves the local
 * copies exactly where they are, unsynced, and reversible.
 */
export function FirstSyncPrompt({ onChoose, onExport, busy }: FirstSyncPromptProps) {
  const { t } = useTranslation();
  const { store } = useStore();
  const [choice, setChoice] = useState<FirstSyncStrategy>("MERGE");

  const preview = useQuery({
    queryKey: ["firstSync", "preview"],
    queryFn: async () => {
      const local = await store.listCopies();
      // A peek, not a sync: nothing is written locally until a choice is made.
      const account = (await pullChanges(0)).copies.filter((copy) => copy.deletedAt === null);
      const accountIds = new Set(account.map((copy) => copy.id));
      // "Already there" is by copy id, which is the only thing the merge keys on. Two
      // separate copies of the same pressing are two records on purpose, so counting them
      // as duplicates would promise a deduplication that will not happen.
      const alreadyThere = local.filter((copy) => accountIds.has(copy.id)).length;
      return {
        localCount: local.length,
        accountCount: accountIds.size,
        willAdd: local.length - alreadyThere,
        alreadyThere,
      };
    },
  });

  const counts = preview.data ?? { localCount: 0, accountCount: 0, willAdd: 0, alreadyThere: 0 };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <Text style={styles.title}>{t("firstSync.title", { count: counts.localCount })}</Text>
        <Text style={styles.lede}>{t("firstSync.body", { count: counts.accountCount })}</Text>

        <View style={styles.choices}>
          <Choice
            selected={choice === "MERGE"}
            onPress={() => setChoice("MERGE")}
            title={t("firstSync.merge.title")}
            body={t("firstSync.merge.body", {
              added: counts.willAdd,
              skipped: counts.alreadyThere,
            })}
          />
          <Choice
            selected={choice === "KEEP_ACCOUNT"}
            onPress={() => setChoice("KEEP_ACCOUNT")}
            title={t("firstSync.keepAccount.title")}
            body={t("firstSync.keepAccount.body", { count: counts.localCount })}
          />
        </View>

        <Pressable accessibilityRole="button" onPress={() => void onExport()} style={styles.export}>
          <FileDown size={15} color={colors.accentStrong} strokeWidth={1.75} />
          <Text style={styles.exportText}>{t("firstSync.exportFirst")}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => void onChoose(choice)}
          disabled={busy}
          style={[styles.primary, busy && styles.dim]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.paper} />
          ) : (
            <Text style={styles.primaryText}>
              {t(choice === "MERGE" ? "firstSync.confirmMerge" : "firstSync.confirmKeep")}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Choice({
  selected,
  onPress,
  title,
  body,
}: {
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly title: string;
  readonly body: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <Check size={13} color={colors.paper} strokeWidth={2.5} />}
      </View>
      <View style={styles.choiceText}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceBody}>{body}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper, justifyContent: "flex-end" },
  sheet: { padding: 22, paddingBottom: 30, gap: 10 },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.line,
    alignSelf: "center",
    marginBottom: 12,
  },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
  lede: { fontSize: 13.5, lineHeight: 21, color: colors.inkMuted },
  choices: { gap: 10, marginTop: 10 },
  choice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  choiceSelected: { borderWidth: 1.5, borderColor: colors.ink },
  radio: {
    width: 19,
    height: 19,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  radioSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  choiceText: { flex: 1 },
  choiceTitle: { fontSize: 13.5, fontWeight: "600", color: colors.ink },
  choiceBody: { fontSize: 11.5, lineHeight: 17, color: colors.inkMuted, marginTop: 3 },
  export: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 6,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(162,87,58,0.07)",
  },
  exportText: { flex: 1, fontSize: 11.5, lineHeight: 17, color: colors.inkMuted },
  primary: {
    height: 50,
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: colors.paper, fontSize: 15, fontWeight: "600" },
  dim: { opacity: 0.5 },
});
