import { friendsApi } from "@/api/friends";
import { canStillAskForPush } from "@/features/notifications/push";
import { claimPushPriming } from "@/local/settings";
import { useStore } from "@/local/StoreProvider";
import { useAppSelector } from "@/store/hooks";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";

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

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["profile", clean] });
    await queryClient.invalidateQueries({ queryKey: ["friends"] });
  }, [queryClient, clean]);

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
    wishes: wishes.data?.wishes ?? [],
    loadingLists: copies.isLoading || wishes.isLoading,
    ask,
    unfriend,
  };
}
