import { friendsApi, type SharedWish } from "@/api/friends";
import { lookupAlbumCovers, lookupPressingCovers } from "@/api/releases";
import { isManualReleaseId } from "@janne6565/music-collector-shared";
import { canStillAskForPush } from "@/features/notifications/push";
import {
  type RecentCollector,
  claimPushPriming,
  forgetCollectors,
  readRecentCollectors,
  rememberCollector,
} from "@/local/settings";
import { useStore } from "@/local/StoreProvider";
import { useAppSelector } from "@/store/hooks";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";

/** Shorter and the server returns nothing, so asking would only make the field flicker. */
const MIN_QUERY = 3;

/**
 * The Friends tab: activity, people, and the search behind both.
 *
 * Everything here needs an account — a request nobody can look the sender up by is a
 * request nobody can answer — so the queries are gated rather than fired to collect 401s.
 */
export function useFriendsLogic() {
  const signedIn = useAppSelector((state) => state.auth.status === "signedIn");
  const queryClient = useQueryClient();
  const router = useRouter();
  const { store } = useStore();
  const [query, setQuery] = useState("");

  const sharing = useQuery({
    queryKey: ["sharing"],
    queryFn: friendsApi.sharing,
    enabled: signedIn,
  });

  const people = useQuery({
    queryKey: ["friends", "overview"],
    queryFn: friendsApi.overview,
    enabled: signedIn,
  });

  const feed = useQuery({
    queryKey: ["friends", "activity"],
    queryFn: friendsApi.activity,
    enabled: signedIn,
  });

  const trimmed = query.trim().replace(/^@/, "");
  const results = useQuery({
    queryKey: ["friends", "search", trimmed],
    queryFn: () => friendsApi.search(trimmed),
    enabled: signedIn && trimmed.length >= MIN_QUERY,
    // The list belongs to the previous keystroke until the next answer lands, or the
    // results empty out between every letter and read as "no matches" over and over.
    placeholderData: keepPreviousData,
  });

  /**
   * Anything that changes the graph refreshes both panels.
   *
   * Accepting moves a person from one list to the other *and* puts a line in the feed, so
   * refreshing one would leave the other a step behind on the same screen.
   */
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["friends"] });
  }, [queryClient]);

  /**
   * The collectors this device has looked at, for the field to offer when it is empty.
   *
   * The people rather than the words that found them: handing back what was typed saves a
   * few characters, handing back who it led to is one tap to their shelf.
   */
  const recent = useQuery({
    queryKey: ["recentCollectors"],
    queryFn: () => readRecentCollectors(store),
  });

  const remember = useCallback(
    async (entry: RecentCollector) => {
      await rememberCollector(store, entry);
      await queryClient.invalidateQueries({ queryKey: ["recentCollectors"] });
    },
    [store, queryClient],
  );

  const forget = useCallback(async () => {
    await forgetCollectors(store);
    await queryClient.invalidateQueries({ queryKey: ["recentCollectors"] });
  }, [store, queryClient]);

  const ask = useMutation({ mutationFn: friendsApi.ask, onSuccess: refresh });
  const accept = useMutation({
    mutationFn: friendsApi.accept,
    onSuccess: async (_answer, id) => {
      await refresh();
      // 22b: the moment the prompt is earned, and the only moment it is offered. Never at
      // launch, never on sign-in -- iOS asks once, and spending it on a hypothetical is how
      // an app ends up unable to say anything ever again. Gated three ways: a friendship
      // has to exist, the OS has to still be askable, and this device gets one showing.
      const asked = people.data?.incoming?.find((request) => request.id === id)?.from;
      if (!(await canStillAskForPush())) return;
      if (!(await claimPushPriming(store))) return;
      router.push({
        pathname: "/notifications/priming",
        params: { friend: asked?.displayName ?? asked?.handle ?? "" },
      });
    },
  });
  const decline = useMutation({ mutationFn: friendsApi.decline, onSuccess: refresh });

  return {
    signedIn,
    /**
     * Whether the handle screen comes first. Undefined while the settings load, so the tab
     * waits rather than flashing the claim form at somebody who already has one.
     */
    needsHandle: sharing.data === undefined ? undefined : !sharing.data.handle,
    sharing: sharing.data,
    friends: people.data?.friends ?? [],
    incoming: people.data?.incoming ?? [],
    entries: feed.data?.entries ?? [],
    loading: people.isLoading || feed.isLoading,
    query,
    setQuery,
    /** Empty until the query is long enough — never the start of a directory. */
    results: trimmed.length >= MIN_QUERY ? (results.data ?? []) : [],
    searching: results.isFetching,
    ask,
    accept,
    decline,
    recent: recent.data ?? [],
    remember,
    forget,
  };
}

/** Somebody else's shelf — 15c when it is open to you, 15d when it is not. */
export function useFriendProfileLogic(handle: string) {
  const queryClient = useQueryClient();
  const clean = handle.replace(/^@/, "");

  const person = useQuery({
    queryKey: ["profile", clean],
    queryFn: () => friendsApi.profile(clean),
    retry: false,
  });

  // Asked for only once the profile has said they are visible: 15d is a screen the design
  // deliberately draws, not a 403 to be rescued from.
  const copies = useQuery({
    queryKey: ["profile", clean, "collection"],
    queryFn: () => friendsApi.collection(clean),
    enabled: person.data?.canSeeCollection === true,
  });

  const wishes = useQuery({
    queryKey: ["profile", clean, "wishlist"],
    queryFn: () => friendsApi.wishlist(clean),
    enabled: person.data?.canSeeWishlist === true,
  });

  /*
   * Sleeves for their wishlist, resolved exactly the way your own list resolves them: the
   * pressing they picked if they picked one, the album otherwise. A wish names an album,
   * and an album has no cover of its own -- so this cannot be read off the entry and has to
   * be asked for. Their own uploaded pictures are not in it and never were.
   */
  const wishItems = wishes.data?.wishes ?? [];
  const wishReleaseIds = useMemo(
    () =>
      [...new Set(wishItems.map((wish) => wish.releaseId).filter((id): id is string => id != null))]
        .filter((id) => !isManualReleaseId(id))
        .sort(),
    [wishItems],
  );
  const wishAlbumIds = useMemo(
    () =>
      [...new Set(wishItems.map((wish) => wish.albumId).filter((id): id is string => id != null))]
        .filter((id) => !isManualReleaseId(id))
        .sort(),
    [wishItems],
  );

  const wishPressingCovers = useQuery({
    queryKey: ["pressingCovers", wishReleaseIds],
    enabled: wishReleaseIds.length > 0,
    staleTime: 60 * 60 * 1000,
    queryFn: () => lookupPressingCovers(wishReleaseIds),
  });
  const wishAlbumCovers = useQuery({
    queryKey: ["albumCovers", wishAlbumIds],
    enabled: wishAlbumIds.length > 0,
    staleTime: 60 * 60 * 1000,
    queryFn: () => lookupAlbumCovers(wishAlbumIds),
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["profile", clean] });
    await queryClient.invalidateQueries({ queryKey: ["friends"] });
  }, [queryClient, clean]);

  /**
   * Pull-to-refresh, which here means *refetch* rather than sync.
   *
   * Your own lists are read out of the local store, so pulling them has to run a sync or it
   * can only redraw what the last one wrote. None of this is stored locally -- a friend's
   * shelf is read from the server every time, exactly so that closing it takes effect at
   * once -- so asking again is the whole of it.
   */
  const [refreshing, setRefreshing] = useState(false);
  const refetch = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([person.refetch(), copies.refetch(), wishes.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [person, copies, wishes]);

  const ask = useMutation({ mutationFn: () => friendsApi.ask(clean), onSuccess: refresh });
  const unfriend = useMutation({
    mutationFn: (userId: string) => friendsApi.unfriend(userId),
    onSuccess: refresh,
  });

  return {
    handle: clean,
    person: person.data,
    loading: person.isLoading,
    failed: person.isError,
    copies: copies.data?.copies ?? [],
    /*
     * Whether the cap cut the shelf short. The server says it out loud precisely because
     * the client derives the format counts under the grid from what it was handed — and
     * counts taken from a truncated list, presented as the collection, would be wrong.
     */
    truncated: copies.data?.truncated === true,
    wishes: wishItems,
    refreshing,
    refetch,
    /** The sleeve for one of their wishes, or null while it is on its way or absent. */
    wishCoverOf: (wish: SharedWish): string | null =>
      (wish.releaseId == null ? undefined : wishPressingCovers.data?.get(wish.releaseId)) ??
      (wish.albumId == null ? null : (wishAlbumCovers.data?.get(wish.albumId) ?? null)),
    loadingLists: copies.isLoading || wishes.isLoading,
    ask,
    unfriend,
  };
}
