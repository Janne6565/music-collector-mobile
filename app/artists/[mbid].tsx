import { useLocalSearchParams } from "expo-router";
import type { Artist } from "@janne6565/rekordo-shared";
import { ArtistScreen } from "@/features/artists/ArtistScreen";

/**
 * Screen 10c, reached from an artist row in the search results.
 *
 * The artist travels in the route's own params rather than being looked up again on
 * arrival. Everything the header shows was already on the row that was tapped, and asking
 * MusicBrainz to repeat it would cost a paced request to draw a screen that could have
 * been drawn immediately. The mbid is all the discography queries need.
 *
 * Params are strings on the way through a URL, so an absent fact arrives as "" and is
 * mapped back to the null the domain uses.
 */
export default function ArtistRoute() {
  const params = useLocalSearchParams<{
    mbid: string;
    name?: string;
    disambiguation?: string;
    type?: string;
    country?: string;
    beganIn?: string;
    endedIn?: string;
    fromQuery?: string;
  }>();

  const orNull = (value: string | undefined) =>
    value === undefined || value === "" ? null : value;

  const artist: Artist = {
    mbid: params.mbid,
    name: params.name ?? "",
    disambiguation: params.disambiguation ?? "",
    type: orNull(params.type),
    country: orNull(params.country),
    beganIn: orNull(params.beganIn),
    endedIn: orNull(params.endedIn),
    // Only ever used to rank a list of results, which this screen is not.
    score: null,
  };

  return <ArtistScreen artist={artist} fromQuery={params.fromQuery ?? ""} />;
}
