import type { SharedCopy } from "@/api/friends";
import { CopyTile } from "@/components/CopyTile";
import { ReleaseArt } from "@/components/ReleaseArt";
import { WishRow, wishCardStyle } from "@/components/WishRow";
import { Avatar } from "@/features/friends/Avatar";
import { useFriendProfileLogic } from "@/features/friends/useFriendsLogic";
import { useSharedCoverPhotos } from "@/features/friends/useSharedCoverPhotos";
import { colors, fonts } from "@/theme/colors";
import type { Format } from "@janne6565/music-collector-shared";
import { FORMAT_LABELS } from "@janne6565/music-collector-shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Lock, UserCheck, UserPlus } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Screens 15c and 15d — a friend's shelf, and a stranger's described rather than shown.
 *
 * One screen for both, because the difference is not a different page: it is the same
 * person with a different answer about what you may see, and the server gives the answer.
 */
export function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const logic = useFriendProfileLogic(handle ?? "");
  const [tab, setTab] = useState<"collection" | "wishlist">("collection");

  const person = logic.person;
  const name = person?.displayName ?? person?.handle ?? "";
  const showing = tab === "collection" ? person?.canSeeCollection : person?.canSeeWishlist;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <ChevronLeft size={20} color={colors.ink} strokeWidth={1.75} />
        </Pressable>
      </View>

      {logic.loading ? (
        <View style={styles.centred}>
          <ActivityIndicator color={colors.inkSubtle} />
        </View>
      ) : person === undefined ? (
        <View style={styles.centred}>
          <Text style={styles.emptyTitle}>{t("friendProfile.notFound.title")}</Text>
          <Text style={styles.emptyBody}>{t("friendProfile.notFound.body", { handle: logic.handle })}</Text>
        </View>
      ) : (
        <>
          {/*
           * Who this is, and which of their lists you are reading — outside the scroll view,
           * so it stays put. The tabs are the reason: a control that chooses what is below
           * it has to remain reachable while you are down there, or switching list means
           * scrolling all the way back up first.
           */}
          <View style={styles.pinned}>
            <View style={styles.header}>
              <Avatar name={name} size={56} />
              <View style={styles.headerText}>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.meta}>
                  @{person.handle}
                  {person.collectingSince !== undefined &&
                    ` · ${t("friendProfile.collectingSince", {
                      year: new Date(person.collectingSince).getFullYear(),
                    })}`}
                </Text>
              </View>
            </View>

            <RelationshipAction logic={logic} />

            <View style={styles.tabs}>
              <Tab active={tab === "collection"} onPress={() => setTab("collection")}>
                {t("friendProfile.tab.collection", { count: person.copyCount ?? 0 })}
              </Tab>
              <Tab active={tab === "wishlist"} onPress={() => setTab("wishlist")}>
                {t("friendProfile.tab.wishlist", { count: person.wishlistCount ?? 0 })}
              </Tab>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            refreshControl={
              <RefreshControl
                refreshing={logic.refreshing}
                onRefresh={() => void logic.refetch()}
                tintColor={colors.inkMuted}
              />
            }
          >
            {showing !== true ? (
              <LockedShelf name={name} count={person.copyCount ?? 0} />
            ) : logic.loadingLists ? (
              <View style={styles.centred}>
                <ActivityIndicator color={colors.inkSubtle} />
              </View>
            ) : tab === "collection" ? (
              <Grid copies={logic.copies} pricesVisible={person.pricesVisible === true} />
            ) : (
              <WishRows logic={logic} />
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

type Logic = ReturnType<typeof useFriendProfileLogic>;

function Tab({
  active,
  onPress,
  children,
}: { readonly active: boolean; readonly onPress: () => void; readonly children: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{children}</Text>
    </Pressable>
  );
}

function RelationshipAction({ logic }: { readonly logic: Logic }) {
  const { t } = useTranslation();
  switch (logic.person?.relationship) {
    case "SELF":
      return null;
    case "FRIENDS":
      return (
        <View style={styles.friendsChip}>
          <UserCheck size={14} color={colors.inkMuted} strokeWidth={1.75} />
          <Text style={styles.friendsChipLabel}>{t("friends.state.friends")}</Text>
        </View>
      );
    case "REQUEST_SENT":
      return <Text style={styles.requestedLabel}>{t("friends.state.requested")}</Text>;
    default:
      return (
        <Pressable
          onPress={() => logic.ask.mutate()}
          disabled={logic.ask.isPending}
          style={styles.askButton}
        >
          <UserPlus size={16} color={colors.paper} strokeWidth={1.9} />
          <Text style={styles.askLabel}>{t("friendProfile.ask")}</Text>
        </Pressable>
      );
  }
}

/** 15d: the shelf is described, not shown, and the number is the invitation. */
function LockedShelf({ name, count }: { readonly name: string; readonly count: number }) {
  const { t } = useTranslation();
  return (
    <View style={styles.locked}>
      <View style={styles.lockBadge}>
        <Lock size={17} color={colors.inkMuted} strokeWidth={1.75} />
      </View>
      <Text style={styles.lockedTitle}>{t("friendProfile.locked.title")}</Text>
      <Text style={styles.lockedBody}>{t("friendProfile.locked.body", { name, count })}</Text>
    </View>
  );
}

function Grid({
  copies,
  pricesVisible,
}: { readonly copies: readonly SharedCopy[]; readonly pricesVisible: boolean }) {
  const { t } = useTranslation();
  // The owner's own picture, where they have one and are sharing it. The server resolves
  // which that is with the same rule their own screens use, so a starred photo stands for
  // the copy here too — and it is the only picture a hand-entered copy can ever have.
  const photos = useSharedCoverPhotos(copies);
  if (copies.length === 0) {
    return <Text style={styles.emptyBody}>{t("friendProfile.emptyShelf")}</Text>;
  }
  return (
    <View style={styles.grid}>
      {copies.map((copy) => (
        <CopyTile
          key={copy.id}
          style={styles.tile}
          art={
            <ReleaseArt
              release={{ coverArtUrl: copy.coverArtUrl ?? null, format: copy.format as Format }}
              previewUri={copy.id === undefined ? null : (photos.get(copy.id) ?? null)}
            />
          }
          title={copy.title ?? "—"}
          subtitle={[
            copy.format ? FORMAT_LABELS[copy.format as Format] : undefined,
            copy.year?.toString(),
            /*
             * Only when the owner turned prices on -- sharing a shelf is not sharing what it
             * cost -- and only when there is one. `!== undefined` let a JSON null through,
             * and `null / 100` is 0, so every copy with no price recorded advertised itself
             * at nothing. A real zero is still a price somebody entered and still shows.
             */
            pricesVisible && copy.pricePaidCents != null
              ? `${(copy.pricePaidCents / 100).toFixed(0)} ${copy.currency ?? ""}`.trim()
              : undefined,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      ))}
    </View>
  );
}

function WishRows({ logic }: { readonly logic: Logic }) {
  const { t } = useTranslation();
  if (logic.wishes.length === 0) {
    return <Text style={styles.emptyBody}>{t("friendProfile.emptyWishlist")}</Text>;
  }
  return (
    <View style={styles.wishes}>
      {logic.wishes.map((wish) => (
        /*
         * The same card your own wishlist uses. It used to be a bare line of text with no
         * artwork, which made one feature look like two depending on whose list it was.
         *
         * No "added" time: when somebody else put a record on their list is not a fact
         * about you, and the deck's own rule for a shared shelf is that it shows sleeves
         * rather than a history.
         */
        <View key={wish.id} style={styles.wishCard}>
          <WishRow
            art={
              <ReleaseArt
                release={{ coverArtUrl: logic.wishCoverOf(wish) }}
                format={(wish.desiredFormat as Format | undefined) ?? "OTHER"}
              />
            }
            title={wish.title ?? "—"}
            subtitle={wish.artistName ?? ""}
            format={
              wish.desiredFormat === undefined || wish.desiredFormat === null
                ? t("wishlist.anyFormat")
                : FORMAT_LABELS[wish.desiredFormat as Format]
            }
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  wishes: { gap: 10 },
  wishCard: wishCardStyle,
  bar: { paddingHorizontal: 16, paddingVertical: 8 },
  centred: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 6 },
  pinned: {
    paddingHorizontal: 20,
    // Something has to mark where the fixed part ends, or the list slides under it with no
    // boundary and reads as one thing that scrolled halfway.
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  /* The air the list used to inherit from whatever happened to sit above it in the scroll. */
  body: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerText: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink },
  meta: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkMuted, marginTop: 3 },
  friendsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  friendsChipLabel: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkMuted },
  requestedLabel: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSubtle, marginTop: 14 },
  askButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.ink,
  },
  askLabel: { fontFamily: fonts.sans, fontSize: 13, fontWeight: "600", color: colors.paper },
  tabs: {
    flexDirection: "row",
    gap: 6,
    marginTop: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tabActive: { backgroundColor: colors.surface },
  tabLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkMuted },
  tabLabelActive: { color: colors.ink, fontWeight: "600" },
  locked: {
    alignItems: "center",
    marginTop: 28,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    gap: 8,
  },
  lockBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
  },
  lockedTitle: { fontFamily: fonts.sans, fontSize: 14.5, fontWeight: "600", color: colors.ink },
  lockedBody: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.inkMuted,
    textAlign: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 16 },
  tile: { width: "30%" },
  rowText: { flex: 1, minWidth: 0 },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  emptyBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkMuted,
    textAlign: "center",
    marginTop: 24,
  },
});
