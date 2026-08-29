import { useRouter, useRootNavigationState } from "expo-router";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { friendsApi } from "@/api/friends";
import { canStillAskForPush } from "@/features/notifications/push";
import { claimPushPriming } from "@/local/settings";
import { useStore } from "@/local/StoreProvider";
import { useAppSelector } from "@/store/hooks";

/**
 * Offers 22b once on launch to somebody who already has a friend.
 *
 * The board hangs the priming screen off accepting a request, which leaves out exactly the
 * half of every friendship that did not accept anything: you send the request, somebody else
 * taps Accept, and nothing on your phone ever asks. That is the common case, and it left the
 * device list empty with no route to filling it.
 *
 * The gate 22b actually cares about is kept intact, and it is not "never at launch" but
 * "never on a hypothetical": there has to be a friendship, iOS has to still be askable, and
 * the showing is spent once per device — the same claim the accept path takes, so whichever
 * comes first is the only one. And nothing here opens the system dialog. It opens the screen
 * that explains it; only the dark button on that screen asks iOS anything.
 *
 * Renders nothing, and sits above the tabs: a tab is not mounted until it is opened, so a
 * cold launch into the shelf would never reach this.
 */
export function PushInvite() {
  const router = useRouter();
  const { store } = useStore();
  const signedIn = useAppSelector((state) => state.auth.status === "signedIn");
  // Navigating before the root navigator exists is dropped on the floor, and a cold launch
  // is exactly when that happens.
  const navigation = useRootNavigationState();
  const ready = navigation?.key !== undefined;

  const people = useQuery({
    queryKey: ["friends", "overview"],
    queryFn: friendsApi.overview,
    enabled: signedIn,
  });
  const hasFriend = (people.data?.friends ?? []).length > 0;

  const tried = useRef(false);

  useEffect(() => {
    if (!ready || !signedIn || !hasFriend || tried.current) return;
    tried.current = true;
    void (async () => {
      if (!(await canStillAskForPush())) return;
      if (!(await claimPushPriming(store))) return;
      router.push({ pathname: "/notifications/priming", params: { occasion: "existing" } });
    })();
  }, [ready, signedIn, hasFriend, router, store]);

  return null;
}
