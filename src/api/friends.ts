import { request } from "@/api/client";

/**
 * The social half of the API.
 *
 * Hand-written like the rest of this app's client — the phone has no Orval — and typed
 * against what the server actually promises. Every field is optional on the wire because
 * springdoc says so, so nothing here assumes one is present.
 */

export type Relationship =
  | "ANONYMOUS"
  | "SELF"
  | "NONE"
  | "REQUEST_SENT"
  | "REQUEST_RECEIVED"
  | "FRIENDS";

export type Visibility = "ONLY_ME" | "FRIENDS" | "PUBLIC";

export type ActivityType = "COPY_ADDED" | "WISH_ADDED" | "WISH_FULFILLED" | "FRIENDSHIP_ACCEPTED";

export interface ProfileSummary {
  id?: string;
  handle?: string;
  displayName?: string;
  /** Absent when the shelf is closed to the viewer — the count is itself about a collection. */
  copyCount?: number;
  relationship?: Relationship;
  collectionPrivate?: boolean;
}

export interface Profile {
  id?: string;
  handle?: string;
  displayName?: string;
  relationship?: Relationship;
  canSeeCollection?: boolean;
  canSeeWishlist?: boolean;
  pricesVisible?: boolean;
  copyCount?: number;
  wishlistCount?: number;
  collectingSince?: string;
}

export interface FriendRequest {
  id?: string;
  from?: ProfileSummary;
  createdAt?: string;
  mutualFriends?: number;
}

export interface FriendsOverview {
  friends?: ProfileSummary[];
  incoming?: FriendRequest[];
  outgoing?: ProfileSummary[];
}

export interface ActivityEntry {
  id?: string;
  type?: ActivityType;
  actor?: { id?: string; handle?: string; displayName?: string };
  title?: string;
  artistName?: string;
  releaseId?: string;
  format?: string;
  year?: number;
  coverArtUrl?: string;
  occurredAt?: string;
  copyCount?: number;
  collapsedCovers?: string[];
}

export interface SharedCopy {
  id?: string;
  releaseId?: string;
  title?: string;
  artistName?: string;
  year?: number;
  format?: string;
  coverArtUrl?: string;
  condition?: string;
  pricePaidCents?: number;
  currency?: string;
}

export interface SharedWish {
  id?: string;
  title?: string;
  artistName?: string;
  desiredFormat?: string;
}

export interface SharingSettings {
  handle?: string;
  findable?: boolean;
  collectionVisibility?: Visibility;
  wishlistVisibility?: Visibility;
  pricesPublic?: boolean;
  handleChangesRemaining?: number;
}

export interface HandleAvailability {
  handle?: string;
  available?: boolean;
  reason?: "OK" | "MALFORMED" | "TAKEN" | "RESERVED";
}

export const friendsApi = {
  overview: () => request<FriendsOverview>("/api/v1/friends"),

  activity: () => request<{ entries?: ActivityEntry[] }>("/api/v1/friends/activity"),

  ask: (handle: string) =>
    request<void>("/api/v1/friends/requests", { method: "POST", body: { handle } }),

  accept: (id: string) => request<void>(`/api/v1/friends/requests/${id}/accept`, { method: "POST" }),

  decline: (id: string) =>
    request<void>(`/api/v1/friends/requests/${id}/decline`, { method: "POST" }),

  unfriend: (userId: string) => request<void>(`/api/v1/friends/${userId}`, { method: "DELETE" }),

  /** Prefix search over handles. Three characters minimum, twenty results, per-IP quota. */
  search: (query: string) =>
    request<ProfileSummary[]>(`/api/v1/profiles?q=${encodeURIComponent(query)}`),

  profile: (handle: string) => request<Profile>(`/api/v1/profiles/${encodeURIComponent(handle)}`),

  collection: (handle: string) =>
    request<{ copies?: SharedCopy[]; truncated?: boolean }>(
      `/api/v1/profiles/${encodeURIComponent(handle)}/collection`,
    ),

  wishlist: (handle: string) =>
    request<{ wishes?: SharedWish[] }>(`/api/v1/profiles/${encodeURIComponent(handle)}/wishlist`),

  sharing: () => request<SharingSettings>("/api/v1/sharing"),

  updateSharing: (settings: Required<Pick<SharingSettings, "collectionVisibility" | "wishlistVisibility" | "pricesPublic" | "findable">>) =>
    request<SharingSettings>("/api/v1/sharing", { method: "PUT", body: settings }),

  handleAvailability: (handle: string) =>
    request<HandleAvailability>(`/api/v1/handles/availability?handle=${encodeURIComponent(handle)}`),

  claimHandle: (handle: string) =>
    request<SharingSettings>("/api/v1/handles", { method: "POST", body: { handle } }),
};
