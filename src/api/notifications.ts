import { request } from "@/api/client";

/** The four categories of 22a. Kept in step with the server's NotificationCategory. */
export type NotificationCategory =
  | "FRIEND_REQUEST"
  | "FRIEND_ACTIVITY"
  | "SECURITY"
  | "PRODUCT_NEWS";

export interface NotificationPreference {
  readonly category: NotificationCategory;
  readonly mail: boolean;
  readonly push: boolean;
  /**
   * Drawn as a lock where the switch would be. Sent by the server rather than inferred
   * here, so the two apps cannot disagree about which category is un-silenceable.
   */
  readonly mailLocked: boolean;
}

export interface NotificationPreferences {
  readonly categories: readonly NotificationPreference[];
  /**
   * Whether any device on this account could receive a push at all. False everywhere today:
   * there is no push transport yet, so the column says so rather than offering switches
   * that would silently do nothing.
   */
  readonly pushAvailable: boolean;
}

/**
 * What may reach this account outside the app.
 *
 * Read from the server rather than the local store, deliberately: unlike everything else
 * under Settings, this grid follows the account, so the web and this phone must read the
 * same switches without waiting for a sync round.
 */
export async function notificationPreferences(): Promise<NotificationPreferences> {
  return request<NotificationPreferences>("/api/v1/notifications/preferences");
}

/** Flips one row. The answer is the whole grid, so nothing has to be re-derived here. */
export async function updateNotificationPreference(
  category: NotificationCategory,
  mail: boolean,
  push: boolean,
): Promise<NotificationPreferences> {
  return request<NotificationPreferences>("/api/v1/notifications/preferences", {
    method: "PATCH",
    body: { category, mail, push },
  });
}
