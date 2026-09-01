import { type Tracklist, fetchTracklist } from "@/api/tracklist";
import { isManualReleaseId } from "@janne6565/rekordo-shared";
import { useQuery } from "@tanstack/react-query";

/**
 * The tracklist for one release, asked for when its screen opens.
 *
 * Mirrors the web hook: cached for the session and never refetched, because both answers —
 * the titles, and "there will never be titles" — are settled facts the server has already
 * written down. A hand-entered copy is answered without a request at all.
 */

const HAND_ENTERED: Tracklist = {
  trackCount: null,
  discCount: null,
  media: [],
  absence: "HAND_ENTERED",
};

export interface TracklistState {
  readonly tracklist: Tracklist | undefined;
  readonly loading: boolean;
  /** The one failure worth a button: the request itself did not get through. */
  readonly unreachable: boolean;
  readonly retry: () => void;
}

export function useTracklistLogic(releaseId: string | undefined): TracklistState {
  const manual = releaseId !== undefined && isManualReleaseId(releaseId);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["tracklist", releaseId],
    queryFn: () => fetchTracklist(releaseId as string),
    enabled: releaseId !== undefined && !manual,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });

  if (manual) {
    return { tracklist: HAND_ENTERED, loading: false, unreachable: false, retry: () => {} };
  }
  return {
    tracklist: data,
    loading: releaseId !== undefined && isPending && !isError,
    unreachable: isError,
    retry: () => void refetch(),
  };
}
