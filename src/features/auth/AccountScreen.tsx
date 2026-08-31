import { useFocusEffect, useRouter } from "expo-router";
import { ChevronRight, LogOut } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { friendsApi } from "@/api/friends";
import { PictureRow } from "@/features/account/PictureRow";
import { StorageMeterRow } from "@/features/account/StorageMeterRow";
import { useProfilePictureLogic } from "@/features/account/useProfilePictureLogic";
import { AuthForm } from "@/features/auth/AuthForm";
import { FirstSyncPrompt } from "@/features/auth/FirstSyncPrompt";
import { useAccountLogic } from "@/features/auth/useAccountLogic";
import { Avatar } from "@/features/friends/Avatar";
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

  /*
   * The confirmation link is an https URL, so on a phone it opens the browser rather than
   * this app. Somebody who confirms there and comes back would otherwise find the screen
   * still nagging about it, so the account is re-read on focus -- but only while that
   * would change something. The dependency is the boolean, not the account: depending on
   * the account object would re-run the effect on the very dispatch this makes, forever.
   */
  const { refreshAccount } = logic;
  const needsConfirmation = logic.user !== null && !logic.emailConfirmed;
  useFocusEffect(
    useCallback(() => {
      if (needsConfirmation) void refreshAccount();
    }, [needsConfirmation, refreshAccount]),
  );

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
      {/*
       * The keyboard is part of this screen in a way it is not on the others: signed out,
       * the whole tab is a form. Without an inset for it the fields below the fold cannot
       * be reached at all — the content is there, and the one gesture that would bring it
       * up is the one the keyboard is sitting on.
       */}
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        /*
         * Signed out this tab is a form, and a form has nothing to pull down for: the
         * gesture would only fight the keyboard for the same drag.
         */
        refreshControl={
          logic.user === null ? undefined : (
            <RefreshControl
              refreshing={logic.refreshing}
              onRefresh={() => void logic.refresh()}
              tintColor={colors.inkMuted}
            />
          )
        }
      >
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
  const { t } = useTranslation();
  const router = useRouter();
  const { store } = useStore();
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => store.stats() });
  // Only for the handle: the picture row and its sheet say where the picture is public,
  // and that is the handle. Same query key as the Sharing screen, so it is one request.
  const sharing = useQuery({ queryKey: ["sharing"], queryFn: friendsApi.sharing });
  const name = logic.user?.displayName ?? logic.user?.email ?? "";
  const picture = useProfilePictureLogic(logic.user?.avatarUrl ?? null, logic.avatarChanged);

  return (
    <>
      <Text style={styles.heading}>{t("account.title")}</Text>

      <View style={styles.profile}>
        {/* 27i: the same 56 circle as the public profile header, because it is the same
            circle showing the same person. */}
        <Avatar name={name} uri={picture.url} size={56} />
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
        {/* Above the name, per 27a: it is the first thing about you that other people see,
            and the only row here anybody else ever looks at. */}
        <PictureRow logic={picture} name={name} handle={sharing.data?.handle ?? null} />
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

      {/* Beside sharing, and for the same reason: what may reach you outside the app is a
          decision about this account, not about this phone. It sat under Settings, whose
          whole promise is "only on this phone" — the one row there that was not. */}
      <Text style={styles.section}>{t("notifications.title")}</Text>
      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/settings/notifications")}
          style={styles.row}
        >
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{t("notifications.title")}</Text>
            <Text style={styles.rowBody}>{t("notifications.rowBody")}</Text>
          </View>
          <ChevronRight size={16} color={colors.inkSubtle} strokeWidth={1.75} />
        </Pressable>
      </View>

      <Text style={styles.section}>{t("account.section.signIn")}</Text>
      <View style={styles.card}>
        {/* One e-mail row, in whichever state it is in. 21c and 21g are not extra rows
            beside the plain one -- they are what it looks like when there is something to
            say about the address. */}
        {logic.emailConfirmed && logic.pendingEmail === null && (
          <Row title={t("auth.email")} value={logic.user?.email ?? ""} />
        )}
        {/* 21c. Only while there is something to do about it: a permanent "confirmed" row
            would be a badge for the ordinary state, which is not news. */}
        {!logic.emailConfirmed && logic.pendingEmail === null && <ConfirmRow logic={logic} />}
        {/* 21g. One row, two addresses, for as long as the change waits. */}
        {logic.pendingEmail !== null && <PendingChangeRow logic={logic} />}
        <Row title={t("auth.password")} body={t("account.passwordBody")} last />
      </View>

      <Text style={styles.section}>{t("account.section.storage")}</Text>
      <View style={styles.card}>
        {/* 28b: the allowance goes first, above the exports. Everything below it is about
            getting data out; this is the only row about what the account is holding. */}
        <StorageMeterRow />
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
        />
        {/* The archive is a third row rather than a second button on the first: it is not
            another way to export the collection, it is a different promise — the whole
            shelf, photographs and identities included, in a file that reads back in as the
            same records rather than as copies of them. */}
        <ExportRow
          title={t("account.export.archive.title")}
          body={t("account.export.archive.body")}
          onPress={() => void logic.exportArchive()}
        />
        {/* 20f: the two device toggles moved to Settings, because they describe this phone
            rather than the account. One pointer row replaces them, so the sync switch stays
            findable from the screen people already know it by. 28b puts it last: it is the
            row that leaves this card, and those go at the bottom. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/settings")}
          style={[styles.row, styles.rowLast]}
        >
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{t("account.deviceSettings.title")}</Text>
            <Text style={styles.rowBody}>{t("account.deviceSettings.body")}</Text>
          </View>
          <ChevronRight size={16} color={colors.inkSubtle} strokeWidth={1.75} />
        </Pressable>
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

      <SignOutEverywhere logic={logic} />

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

/**
 * Screen 21c, all four states — resting, sending, sent, and pressed again.
 *
 * The fourth decides the feature's manners. Pressing twice sends no second mail and shows
 * no error: the button becomes a countdown in place, because the first link is still the
 * valid one. The pill holds its width so the row never reflows while somebody watches it.
 */
function ConfirmRow({ logic }: { readonly logic: ReturnType<typeof useAccountLogic> }) {
  const { t } = useTranslation();
  const router = useRouter();
  const sent = logic.confirmationSentAt !== null;
  const counting = logic.confirmationCooldown > 0;

  return (
    <View style={styles.stackRow}>
      <View style={styles.stackTop}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{t("auth.email")}</Text>
          <Text style={styles.rowBody} numberOfLines={1}>
            {logic.user?.email} ·{" "}
            {sent ? t("account.confirmEmail.linkLive") : t("account.confirmEmail.notYet")}
          </Text>
        </View>
        <View style={styles.rowActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void logic.resendConfirmation()}
            disabled={counting || logic.sendingConfirmation}
            style={[styles.rowAction, (counting || logic.sendingConfirmation) && styles.dim]}
          >
            {logic.sendingConfirmation ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              <Text style={styles.rowActionText}>
                {counting
                  ? `0:${String(logic.confirmationCooldown).padStart(2, "0")}`
                  : sent
                    ? t("account.confirmEmail.sendAgain")
                    : t("account.confirmEmail.send")}
              </Text>
            )}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push("/account/email")}>
            <Text style={styles.rowLink}>{t("account.confirmEmail.change")}</Text>
          </Pressable>
        </View>
      </View>
      {/* Only after the first send, where it is advice instead of an excuse. */}
      {sent && (
        <Text style={styles.rowNote}>
          {counting ? t("account.confirmEmail.stillValid") : t("account.confirmEmail.spamHint")}
        </Text>
      )}
    </View>
  );
}

/** Screen 21g's waiting row: the address you still sign in with, and the one being awaited. */
function PendingChangeRow({ logic }: { readonly logic: ReturnType<typeof useAccountLogic> }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.stackRow}>
      <View style={styles.stackTop}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{t("auth.email")}</Text>
          <Text style={styles.rowBody} numberOfLines={1}>
            {t("account.pendingChange.stillYours", { email: logic.user?.email ?? "" })}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push("/account/email")}>
          <Text style={styles.rowLink}>{t("account.confirmEmail.change")}</Text>
        </Pressable>
      </View>
      <View style={styles.pending}>
        <Text style={styles.pendingTitle}>
          {t("account.pendingChange.waitingFor", { email: logic.pendingEmail ?? "" })}
        </Text>
        <Text style={styles.rowNote}>{t("account.pendingChange.lapses")}</Text>
        <View style={styles.pendingActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void logic.resendConfirmation()}
            disabled={logic.confirmationCooldown > 0}
          >
            <Text style={[styles.rowLink, logic.confirmationCooldown > 0 && styles.dim]}>
              {logic.confirmationCooldown > 0
                ? `0:${String(logic.confirmationCooldown).padStart(2, "0")}`
                : t("account.pendingChange.resend")}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void logic.cancelChange()}>
            <Text style={styles.rowMuted}>{t("common.cancel")}</Text>
          </Pressable>
        </View>
      </View>
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

/**
 * Ending every session, in two taps.
 *
 * Two because it reaches devices that are not in the room: a stray tap here signs out a
 * phone somebody else is holding. Not a sheet, because this app has no alert of its own and
 * one whole modal for a recoverable action would say it is graver than deleting a record.
 * The armed state forgets itself, so a row left open on a table does not stay dangerous.
 */
function SignOutEverywhere({ logic }: { readonly logic: ReturnType<typeof useAccountLogic> }) {
  const { t } = useTranslation();
  const [armed, setArmed] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <View style={styles.everywhere}>
      <Pressable
        accessibilityRole="button"
        disabled={logic.busy}
        onPress={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          setArmed(false);
          void logic.signOutEverywhere().then((ok) => setFailed(!ok));
        }}
        hitSlop={8}
      >
        <Text style={[styles.everywhereLabel, armed && styles.everywhereArmed]}>
          {armed ? t("auth.signOutEverywhereConfirm") : t("auth.signOutEverywhere")}
        </Text>
      </Pressable>
      <Text style={styles.footnote}>
        {failed ? t("auth.signOutEverywhereFailed") : t("auth.signOutEverywhereBody")}
      </Text>
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
  everywhere: { marginTop: 14, alignItems: "center", gap: 4 },
  everywhereLabel: { fontSize: 12.5, fontWeight: "600", color: colors.inkMuted },
  /** Armed reads in the accent, which is the only place this screen uses it for an action. */
  everywhereArmed: { color: colors.accent },
  delete: { marginTop: 10, alignItems: "center", padding: 6 },
  deleteText: { fontSize: 12.5, fontWeight: "500", color: colors.accentStrong },
  dim: { opacity: 0.5 },
  rowAction: {
    height: 32,
    minWidth: 84,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
  },
  rowActionText: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  stackRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    gap: 8,
  },
  stackTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowLink: { fontSize: 12.5, fontWeight: "600", color: colors.accent },
  rowMuted: { fontSize: 12.5, fontWeight: "600", color: colors.inkMuted },
  rowNote: { fontSize: 11.5, lineHeight: 17, color: colors.inkSubtle },
  pending: { backgroundColor: colors.canvas, borderRadius: 10, padding: 12, gap: 5 },
  pendingTitle: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  pendingActions: { flexDirection: "row", alignItems: "center", gap: 16, paddingTop: 4 },
});
