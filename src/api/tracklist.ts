import { API_BASE } from "@/api/config";
import type { Tracklist, TracklistPayload } from "@/api/tracklistPayload";
import { toTracklist } from "@/api/tracklistPayload";

/**
 * The request. The shapes and the mapper are next door in `tracklistPayload`, which stays
 * free of `@/api/config` so the hand-written mapping can be tested without Expo.
 */
export type {
  Track,
  TrackMedium,
  Tracklist,
  TracklistAbsence,
} from "@/api/tracklistPayload";
export { toTracklist } from "@/api/tracklistPayload";

export async function fetchTracklist(releaseId: string): Promise<Tracklist> {
  const path = `/api/v1/metadata/releases/${encodeURIComponent(releaseId)}/tracks`;
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`${response.status} from ${path}`);
  }
  return toTracklist((await response.json()) as TracklistPayload);
}
