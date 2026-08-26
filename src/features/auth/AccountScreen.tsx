import { useRouter } from "expo-router";
import { ChevronRight, LogOut } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { formatRelativeTime } from "@/domain/relativeTime";
import { AuthForm } from "@/features/auth/AuthForm";
import { FirstSyncPrompt } from "@/features/auth/FirstSyncPrompt";
import { useAccountLogic } from "@/features/auth/useAccountLogic";
import { CollectionStatsBlock } from "@/features/profile/CollectionStatsBlock";
import { useStore } from "@/local/StoreProvider";
import { colors, fonts } from "@/theme/colors";

/**
 * The "You" tab — screen 8b, the same sections as the web account page (7a).
 *
 * An account is optional, and this screen says so rather than presenting sign-in as a
 * gate. Everything in the app works before you ever reach here, which is why the signed-out
 * state shows the sign-in form and the collection stats side by side: the collection is
 * already yours.
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
    return <FirstSyncPrompt onChoose={logic.resolveFirstSync} onExport={logic.exportCsv} busy={logic.busy} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.body}>
        {logic.user === null ? (
          <>
            <AuthForm logic={logic} />
            <CollectionStatsBlock />
          </>
        ) : (
          <SignedIn logic={logic} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SignedIn({ logic }: { readonly logic: ReturnType<typeof useAccountLogic> }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { store } = useStore();
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => store.stats() });

  return (
    <>
      <Text style={styles.heading}>{t("account.title")}</Text>

      <View style={styles.profile}>
        <View style={styles.avatar} />
        <View style={styles.profileText}>
          <Text style={styles.name}>{logic.user?.displayName ?? logic.user?.email}</Text>
          <Text style={styles.email} numberOfLines={1}>
            {logic.user?.email}
          </Text>
        </View>
      </View>

      <View style={styles.tiles}>
        <Tile value={stats.data?.copyCount} label={t("account.stat.copies")} />
        <Tile value={stats.data?.releaseGroupCount} label={t("account.stat.releases")} />
      </View>

      <Text style={styles.section}>{t("account.section.profile")}</Text>
      <View style={styles.card}>
        <NameRow logic={logic} />
      </View>

      {/* Sharing lives with the account rather than in the Friends tab: it is a decision
          about this account, and somebody looking for "who can see my collection" comes
          here first. */}
      <Text style={styles.section}>{t("sharing.title")}</Text>
      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/sharing")}
          style={styles.row}
        >
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{t("sharing.title")}</Text>
            <Text style={styles.rowBody}>{t("sharing.rowBody")}</Text>
          </View>
          <ChevronRight size={16} color={colors.inkSubtle} strokeWidth={1.75} />
        </Pressable>
      </View>

      <Text style={styles.section}>{t("account.section.signIn")}</Text>
      <View style={styles.card}>
        <Row title={t("auth.email")} value={logic.user?.email ?? ""} />
        <Row title={t("auth.password")} body={t("account.passwordBody")} last />
      </View>

      <Text style={styles.section}>{t("account.section.storage")}</Text>
      <View style={styles.card}>
        <Row
          title={t("account.sync.title")}
          body={
            logic.lastSyncedAt === null
              ? t("account.sync.never")
              : t("account.sync.last", {
                  when: formatRelativeTime(logic.lastSyncedAt, i18n.language),
                })
          }
          trailing={
            <Switch
              value={logic.syncEnabled}
              onValueChange={(next) => void logic.setSyncEnabled(next)}
              accessibilityLabel={t("account.sync.title")}
              trackColor={{ true: colors.ink, false: colors.line }}
            />
          }
        />
        <Row
          title={t("account.local.title")}
          body={t("account.local.always")}
          trailing={
            // Fixed on, and honest about it. Every screen reads from the local store, so a
            // switch that turned it off would break reading rather than move data.
            <Switch
              value
              disabled
              accessibilityLabel={`${t("account.local.title")} — ${t("account.local.always")}`}
              trackColor={{ true: colors.ink, false: colors.line }}
            />
          }
        />
        {/* Two files, not one. The collection and the wishlist are different shapes — a
            copy has a price, a condition and a pressing; a wish has an album and a format
            — and a single sheet with half its columns blank on every other row is a sheet
            no spreadsheet can pivot. */}
        <ExportRow
          title={t("account.export.library.title")}
          body={t("account.export.library.body")}
          onPress={() => void logic.exportCsv()}
        />
        <ExportRow
          title={t("account.export.wishlist.title")}
          body={t("account.export.wishlist.body")}
          onPress={() => void logic.exportWishlistCsv()}
          last
        />
      </View>

      <Text style={styles.section}>{t("legal.title")}</Text>
      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/legal")}
          style={styles.row}
        >
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{t("legal.title")}</Text>
            <Text style={styles.rowBody}>{t("legal.rowBody")}</Text>
          </View>
          <ChevronRight size={16} color={colors.inkSubtle} strokeWidth={1.75} />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => void logic.signOut()}
        disabled={logic.busy}
        style={[styles.signOut, logic.busy && styles.dim]}
      >
        <LogOut size={15} color={colors.inkMuted} strokeWidth={1.75} />
        <Text style={styles.signOutText}>{t("auth.signOut")}</Text>
      </Pressable>
      <Text style={styles.footnote}>{t("auth.signOutKeepsData")}</Text>

      {/* Deletion lives on Your data with the rest of the DSGVO actions, behind the typed
          confirmation. Two ways to delete an account is one too many, and the one that
          asked less would be the one somebody hit by accident. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/legal/data")}
        style={styles.delete}
      >
        <Text style={styles.deleteText}>{t("account.delete.title")}</Text>
      </Pressable>
    </>
  );
}

/**
 * The one field on this screen that is written back to the server.
 *
 * The field and its button sit on their own line under the label rather than at the end of
 * a row: a name is long enough that the sliver left beside a label on a phone would show
 * about four letters of it.
 */
function NameRow({ logic }: { readonly logic: ReturnType<typeof useAccountLogic> }) {
  const { t } = useTranslation();
  const busy = logic.renaming;
  const canSave = logic.nameChanged && !busy;
  return (
    <View style={[styles.row, styles.rowLast, styles.nameRow]}>
      <Text style={styles.rowTitle}>{t("account.name.title")}</Text>
      <View style={styles.nameField}>
        <TextInput
          value={logic.nameDraft}
          onChangeText={logic.editName}
          placeholder={t("account.name.placeholder")}
          placeholderTextColor={colors.inkSubtle}
          maxLength={120}
          autoCapitalize="words"
          textContentType="name"
          returnKeyType="done"
          onSubmitEditing={() => void logic.saveName()}
          accessibilityLabel={t("account.name.title")}
          style={styles.nameInput}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => void logic.saveName()}
          disabled={!canSave}
          style={[styles.nameSave, !canSave && styles.dim]}
        >
          {busy ? (
            <ActivityIndicator color={colors.paper} size="small" />
          ) : (
            <Text style={styles.nameSaveText}>{t("common.save")}</Text>
          )}
        </Pressable>
      </View>
      <Text style={[styles.rowBody, logic.renameFailed && styles.nameFailed]}>
        {logic.renameFailed ? t("account.name.failed") : t("account.name.body")}
      </Text>
    </View>
  );
}

function ExportRow({
  title,
  body,
  onPress,
  last = false,
}: {
  readonly title: string;
  readonly body: string;
  readonly onPress: () => void;
  readonly last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, last && styles.rowLast]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
      <ChevronRight size={16} color={colors.inkSubtle} strokeWidth={1.75} />
    </Pressable>
  );
}

function Tile({ value, label }: { readonly value: number | undefined; readonly label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value ?? "—"}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function Row({
  title,
  value,
  body,
  trailing,
  last = false,
}: {
  readonly title: string;
  readonly value?: string;
  readonly body?: string;
  readonly trailing?: React.ReactNode;
  readonly last?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {body !== undefined && <Text style={styles.rowBody}>{body}</Text>}
      </View>
      {value !== undefined && (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      )}
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
  body: { padding: 18, paddingBottom: 40, gap: 10 },
  heading: { fontSize: 14, fontWeight: "600", color: colors.ink },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  avatar: { width: 52, height: 52, borderRadius: 999, backgroundColor: colors.canvas },
  profileText: { flex: 1 },
  name: { fontFamily: fonts.serif, fontSize: 21, color: colors.ink },
  email: { fontSize: 11.5, color: colors.inkMuted, marginTop: 3 },
  tiles: { flexDirection: "row", gap: 9 },
  tile: {
    flex: 1,
    padding: 13,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  tileValue: { fontSize: 18, fontWeight: "600", color: colors.ink },
  tileLabel: { fontSize: 10.5, color: colors.inkMuted, marginTop: 2 },
  section: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.inkSubtle,
    marginTop: 14,
  },
  card: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 13.5, color: colors.ink },
  rowBody: { fontSize: 11, color: colors.inkSubtle, marginTop: 2 },
  /*
   * Capped, because a value is measured on one line and shrinks from there: with a basis
   * of its whole width against the label's basis of zero, every point that had to give
   * came out of the label. A long e-mail took the row down to "E-m…"; the password row,
   * which was handing a whole sentence to a value rather than to a body, got "Pas/sw/ord".
   * Past the cap the value ellipsises, which is what it was already asking for.
   */
  rowValue: { fontSize: 12.5, color: colors.inkSubtle, flexShrink: 1, maxWidth: "60%" },
  nameRow: { flexDirection: "column", alignItems: "stretch", gap: 8 },
  nameField: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  nameSave: {
    height: 40,
    minWidth: 82,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
  nameSaveText: { fontSize: 13, fontWeight: "600", color: colors.paper },
  nameFailed: { color: colors.accent },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    marginTop: 20,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  signOutText: { fontSize: 14, fontWeight: "600", color: colors.inkMuted },
  footnote: { fontSize: 11.5, color: colors.inkSubtle, textAlign: "center" },
  delete: { marginTop: 10, alignItems: "center", padding: 6 },
  deleteText: { fontSize: 12.5, fontWeight: "500", color: colors.accentStrong },
  dim: { opacity: 0.5 },
});
