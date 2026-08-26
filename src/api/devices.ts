import { request } from "@/api/client";

export interface NotificationDevice {
  readonly id: string;
  readonly platform: string;
  readonly label: string | null;
  /**
   * When this device was muted, or null while it may buzz. A timestamp because the screen
   * says "muted here since June", which a flag cannot answer.
   */
  readonly mutedAt: string | null;
  readonly createdAt: string;
  /** Whether this is the device asking — the list says "this iPhone" for exactly one row. */
  readonly current: boolean;
}

/**
 * Tells the server where this device can be reached.
 *
 * Keyed on our own device id rather than on the token: a token is reissued on reinstall and
 * after some OS updates, so keying on it would grow a row per phone per reinstall and buzz
 * the same person twice. Re-registering keeps whatever mute the device had.
 */
export async function registerDevice(
  deviceId: string,
  pushToken: string,
  platform: string,
  label: string | null,
): Promise<NotificationDevice[]> {
  return request<NotificationDevice[]>("/api/v1/notifications/devices", {
    method: "POST",
    body: { deviceId, pushToken, platform, label },
  });
}

export async function listDevices(deviceId: string): Promise<NotificationDevice[]> {
  return request<NotificationDevice[]>("/api/v1/notifications/devices", {
    headers: { "X-Device-Id": deviceId },
  });
}

export async function muteDevice(
  id: string,
  muted: boolean,
  currentDeviceId: string,
): Promise<NotificationDevice[]> {
  return request<NotificationDevice[]>(`/api/v1/notifications/devices/${id}/mute`, {
    method: "PATCH",
    body: { muted },
    headers: { "X-Device-Id": currentDeviceId },
  });
}
