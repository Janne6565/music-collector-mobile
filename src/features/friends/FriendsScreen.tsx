import { Avatar } from "@/features/friends/Avatar";
import { ActivityList } from "@/features/friends/ActivityList";
import { ClaimHandlePanel } from "@/features/friends/ClaimHandlePanel";
import { useFriendsLogic } from "@/features/friends/useFriendsLogic";
import { colors, fonts } from "@/theme/colors";
import type { ProfileSummary } from "@/api/friends";
import type { RecentCollector } from "@/local/settings";
import { formatRelativeTime } from "@/domain/relativeTime";
import { useRouter } from "expo-router";
import { ChevronRight, Lock, Search, X } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Screens 15a and 15b — one tab holding activity and people.
 *
 * Two panels behind a segmented control rather than two tabs of their own: they are the
 * same subject looked at two ways, and the phone's tab bar already has four things in it.
 */
export function FriendsScreen() {
  const { t } = useTranslation();
  const logic = useFriendsLogic();
  const [panel, setPanel] = useState<"activity" | "people">("activity");
  const [searching, setSearching] = useState(false);
  // Only with the field open and nothing typed: once there is a query the results are the
  // answer, and a list of old ones underneath would be competing with it.
  const showRecent = searching && logic.query.trim() === "";

  if (!logic.signedIn) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.centred}>
          <Text style={styles.emptyTitle}>{t("friends.signedOut.title")}</Text>
          <Text style={styles.emptyBody}>{t("friends.signedOut.body")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Waiting rather than guessing: flashing the claim form at somebody who already has a
  // handle is worse than a moment of nothing.
  if (logic.needsHandle === undefined) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.centred}>
          <ActivityIndicator color={colors.inkSubtle} />
        </View>
      </SafeAreaView>
    );
  }

  if (logic.needsHandle) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <ClaimHandlePanel />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("friends.title")}</Text>
        <View style={styles.searchField}>
          <Search size={15} color={colors.inkSubtle} strokeWidth={1.75} />
          <TextInput
            value={logic.query}
            onChangeText={(next) => {
              logic.setQuery(next);
              // Typing is a request to look at people, whichever panel was open.
              if (next.trim().length > 0) setPanel("people");
            }}
            placeholder={t("friends.searchPlaceholder")}
            placeholderTextColor={colors.inkSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setSearching(true)}
            onBlur={() => setSearching(false)}
            style={styles.searchInput}
          />
        </View>
      </View>

      {showRecent && (
        <View style={styles.recent}>
          <View style={styles.recentHead}>
            {/* The shared label carries a top margin for separating sections inside the
                body; here it sits directly under the field it belongs to. */}
            <Text style={[styles.sectionLabel, styles.recentLabel]}>{t("friends.recent")}</Text>
            {logic.recent.length > 0 && (
              <Pressable accessibilityRole="button" onPress={() => void logic.forget()} hitSlop={8}>
                <Text style={styles.recentClear}>{t("friends.recentClear")}</Text>
              </Pressable>
            )}
          </View>

          {logic.recent.length === 0 ? (
            /*
             * Nothing has been visited, so there is nothing to offer — and nothing is
             * invented. The field explains what it wants and what will collect here.
             */
            <View style={styles.recentEmpty}>
              <Text style={styles.recentEmptyTitle}>{t("friends.recentEmpty.title")}</Text>
              <Text style={styles.recentEmptyBody}>{t("friends.recentEmpty.body")}</Text>
            </View>
          ) : (
            logic.recent.map((entry) => (
              <RecentRow key={entry.handle} entry={entry} logic={logic} />
            ))
          )}
        </View>
      )}

      <View style={styles.segments}>
        <Segment active={panel === "activity"} onPress={() => setPanel("activity")}>
          {t("friends.activity")}
        </Segment>
        <Segment active={panel === "people"} onPress={() => setPanel("people")}>
          {t("friends.people", { count: logic.friends.length })}
        </Segment>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {logic.incoming.map((invite) => (
          <RequestCard
            key={invite.id}
            name={invite.from?.displayName ?? invite.from?.handle ?? ""}
            handle={invite.from?.handle ?? ""}
            mutual={invite.mutualFriends ?? 0}
            busy={logic.accept.isPending || logic.decline.isPending}
            onAccept={() => logic.accept.mutate(invite.id ?? "")}
            onDecline={() => logic.decline.mutate(invite.id ?? "")}
          />
        ))}

        {panel === "activity" ? (
          <ActivityList entries={logic.entries} loading={logic.loading} />
        ) : (
          <PeoplePanel logic={logic} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type Logic = ReturnType<typeof useFriendsLogic>;

function Segment({
  active,
  onPress,
  children,
}: { readonly active: boolean; readonly onPress: () => void; readonly children: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.segment, active && styles.segmentActive]}>
      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{children}</Text>
    </Pressable>
  );
}

function PeoplePanel({ logic }: { readonly logic: Logic }) {
  const { t } = useTranslation();
  return (
    <View>
      {logic.results.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>{t("friends.results")}</Text>
          {logic.results.map((person) => (
            <PersonRow key={person.id} person={person} logic={logic} />
          ))}
        </>
      )}

      <Text style={styles.sectionLabel}>{t("friends.yourFriends", { count: logic.friends.length })}</Text>
      {logic.friends.length === 0 ? (
        <Text style={styles.emptyBody}>{t("friends.noneYet")}</Text>
      ) : (
        logic.friends.map((person) => <PersonRow key={person.id} person={person} logic={logic} />)
      )}
    </View>
  );
}

/**
 * One collector this device has been to see.
 *
 * Their name, their handle, and what was there when you looked — a shelf's size and how
 * long ago, which together are the reason to go back rather than merely the fact that you
 * once did. Both halves are optional: a shelf closed to you has no count to report, and
 * rows written before this list said anything simply say less.
 */
function RecentRow({
  entry,
  logic,
}: { readonly entry: RecentCollector; readonly logic: Logic }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const name = entry.displayName ?? entry.handle;

  const parts: string[] = [];
  if (entry.copyCount !== undefined) parts.push(t("friends.copies", { count: entry.copyCount }));
  if (entry.seenAt !== undefined) {
    parts.push(t("friends.recentSeen", { when: formatRelativeTime(entry.seenAt, i18n.language) }));
  }
  const meta = parts.join(" · ");

  return (
    <View style={styles.recentRow}>
      <Pressable
        accessibilityRole="button"
        // onPressIn, because the blur that closes this list fires first on a plain press
        // and takes the row out from under the finger.
        onPressIn={() =>
          router.push({ pathname: "/profiles/[handle]", params: { handle: entry.handle } })
        }
        style={styles.recentTap}
      >
        <Avatar name={name} size={44} />
        <View style={styles.rowText}>
          <Text style={styles.recentName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.recentHandle} numberOfLines={1}>
            @{entry.handle}
          </Text>
          {meta !== "" && (
            <Text style={styles.recentMeta} numberOfLines={1}>
              {meta}
            </Text>
          )}
        </View>
      </Pressable>

      {/* Forgets this one. Clearing the lot is the header's job; a list you can only empty
          wholesale makes one wrong visit permanent until you throw the rest away too. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("friends.recentForget", { name })}
        onPressIn={() => void logic.forgetOne(entry.handle)}
        hitSlop={8}
        style={styles.recentForget}
      >
        <X size={13} color={colors.inkSubtle} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

function PersonRow({ person, logic }: { readonly person: ProfileSummary; readonly logic: Logic }) {
  const { t } = useTranslation();
  const router = useRouter();
  const name = person.displayName ?? person.handle ?? "";

  return (
    <Pressable
      style={styles.row}
      onPress={() => {
        // Recorded on the way in, not on the way out of a search: what makes somebody worth
        // offering again is that you went to look at them.
        void logic.remember({
          handle: person.handle ?? "",
          displayName: person.displayName ?? null,
          // What their shelf held when you went; absent when it is closed to you, which is
          // the same reason the row above it has no count either.
          copyCount: person.copyCount,
        });
        router.push({ pathname: "/profiles/[handle]", params: { handle: person.handle ?? "" } });
      }}
      accessibilityRole="button"
    >
      <Avatar name={name} size={38} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.rowMetaLine}>
          {person.collectionPrivate === true && (
            <Lock size={11} color={colors.inkSubtle} strokeWidth={2} />
          )}
          <Text style={styles.rowMeta} numberOfLines={1}>
            @{person.handle}
            {person.copyCount !== undefined && ` · ${t("friends.copies", { count: person.copyCount })}`}
          </Text>
        </View>
      </View>
      <RelationshipButton person={person} logic={logic} />
    </Pressable>
  );
}

/**
 * One control with four states, driven entirely by the server's verdict. The client works
 * out none of them — who two accounts are to each other is a fact about the accounts.
 */
function RelationshipButton({
  person,
  logic,
}: { readonly person: ProfileSummary; readonly logic: Logic }) {
  const { t } = useTranslation();

  switch (person.relationship) {
    case "FRIENDS":
      return <Text style={styles.flatState}>{t("friends.state.friends")}</Text>;
    case "REQUEST_SENT":
      return <Text style={styles.flatState}>{t("friends.state.requested")}</Text>;
    case "SELF":
      return <Text style={styles.flatState}>{t("friends.state.you")}</Text>;
    case "REQUEST_RECEIVED":
      return <ChevronRight size={16} color={colors.inkSubtle} strokeWidth={1.75} />;
    default:
      return (
        <Pressable
          onPress={() => logic.ask.mutate(person.handle ?? "")}
          disabled={logic.ask.isPending}
          style={styles.addButton}
        >
          <Text style={styles.addLabel}>{t("friends.state.add")}</Text>
        </Pressable>
      );
  }
}

interface RequestCardProps {
  readonly name: string;
  readonly handle: string;
  readonly mutual: number;
  readonly busy: boolean;
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}

/** Pinned above the feed: a person waiting for an answer outranks any record. */
function RequestCard({ name, handle, mutual, busy, onAccept, onDecline }: RequestCardProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.requestCard}>
      <Avatar name={name} size={38} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          @{handle}
          {mutual > 0 ? ` · ${t("friends.mutual", { count: mutual })}` : ` · ${t("friends.wants")}`}
        </Text>
      </View>
      <Pressable onPress={onDecline} disabled={busy} style={styles.declineButton}>
        <Text style={styles.declineLabel}>{t("friends.decline")}</Text>
      </Pressable>
      <Pressable onPress={onAccept} disabled={busy} style={styles.acceptButton}>
        <Text style={styles.acceptLabel}>{t("friends.accept")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  centred: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, gap: 12 },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.ink, padding: 0 },
  // The last row needs air under it before the segments start; the rows only carry
  // their own vertical padding, which reads as a gap between them, not as an end.
  recent: { paddingHorizontal: 20, paddingBottom: 12 },
  recentLabel: { marginTop: 0 },
  recentHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 6,
  },
  recentClear: { fontFamily: fonts.sans, fontSize: 11.5, fontWeight: "600", color: colors.accent },
  /*
   * A rule above each row rather than between them: the first row then separates itself
   * from the header it sits under, which is where the list actually needs the line.
   */
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  recentTap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  recentName: { fontFamily: fonts.sans, fontSize: 13.5, fontWeight: "600", color: colors.ink },
  recentHandle: { fontFamily: "Menlo", fontSize: 11, color: colors.inkMuted, marginTop: 2 },
  recentMeta: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkSubtle, marginTop: 2 },
  recentForget: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(25,23,19,0.05)",
  },
  recentEmpty: { paddingTop: 6, paddingBottom: 4 },
  recentEmptyTitle: { fontFamily: fonts.sans, fontSize: 13.5, fontWeight: "600", color: colors.ink },
  recentEmptyBody: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkMuted,
    marginTop: 4,
  },
  segments: { flexDirection: "row", gap: 6, paddingHorizontal: 20, paddingBottom: 8 },
  segment: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  segmentActive: { backgroundColor: colors.surface },
  segmentLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkMuted },
  segmentLabelActive: { color: colors.ink, fontWeight: "600" },
  body: { paddingHorizontal: 20, paddingBottom: 32, gap: 4 },
  sectionLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.inkSubtle,
    marginTop: 16,
    marginBottom: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: fonts.sans, fontSize: 14, fontWeight: "600", color: colors.ink },
  rowMetaLine: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  rowMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkMuted, flexShrink: 1 },
  flatState: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkSubtle },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.ink,
  },
  addLabel: { fontFamily: fonts.sans, fontSize: 12, fontWeight: "600", color: colors.paper },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(162,87,58,0.25)",
    backgroundColor: "rgba(162,87,58,0.06)",
  },
  declineButton: { paddingHorizontal: 8, paddingVertical: 6 },
  declineLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkMuted },
  acceptButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.ink,
  },
  acceptLabel: { fontFamily: fonts.sans, fontSize: 12, fontWeight: "600", color: colors.paper },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink, textAlign: "center" },
  emptyBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkMuted,
    textAlign: "center",
  },
});
