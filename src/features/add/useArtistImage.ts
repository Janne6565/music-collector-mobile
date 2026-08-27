import { useQuery } from "@tanstack/react-query";
import { findArtistImage } from "@/api/releases";

/**
 * The portrait for one artist, fetched behind the row that is already on screen.
 *
 * Per artist rather than per list, deliberately. The server resolves an unseen artist with
 * two paced upstream calls, so a list of five would take about as long as its slowest
 * member if they were asked for together; asked for separately, each row fills in the
 * moment its own answer lands and the list is readable from the first paint. It is the
 * same reason artists are a separate request from releases one level up.
 *
 * Never retried and never refetched. The two answers are "here is the picture" and "this
 * artist has no picture", both of which are settled facts, and the server has written them
 * down — a retry would cost another pair of upstream calls to be told the same thing.
 *
 * Mirrored from rekordo-frontend/src/features/add/useArtistImage.ts.
 */
export function useArtistImage(mbid: string): string | null {
  const { data } = useQuery({
    queryKey: ["artistImage", mbid],
    queryFn: () => findArtistImage(mbid),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
  return data ?? null;
}
