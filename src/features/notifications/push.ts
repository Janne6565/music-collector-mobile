import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { registerDevice } from "@/api/devices";
import type { LocalStore } from "@janne6565/rekordo-shared";

/**
 * Everything that touches the OS permission, in one place.
 *
 * The rule the whole file exists to keep: **nothing here asks iOS anything unless somebody
 * pressed the button that does** (design 22b). The system prompt is offered once and a "no"
 * is close to permanent, so it is never spent on launch, on sign-in, or after a record is
 * added — only from the priming screen, and only after a friendship exists.
 */

/** True when the OS has already been asked and said yes. Never asks anything itself. */
export async function pushAlreadyGranted(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

/**
 * Whether the prompt is still worth offering.
 *
 * `canAskAgain` is false once somebody has declined at the OS level; from then on the only
 * way back is iOS Settings, which is what 22e's "we cannot ask again from in here" says.
 */
export async function canStillAskForPush(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return status !== "granted" && canAskAgain;
}

/** Opens the OS dialog. Only ever called from the priming screen's dark button. */
export async function askForPush(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/**
 * Hands the server this device's Expo token, if the OS has granted permission.
 *
 * Silent when it cannot: a simulator, a denied permission, or no network are all ordinary
 * states, not errors to report at somebody looking at their shelf.
 */
export async function syncPushRegistration(store: LocalStore): Promise<boolean> {
  if (!(await pushAlreadyGranted())) return false;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (typeof projectId !== "string") return false;

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await registerDevice(
      await store.deviceId(),
      token,
      Platform.OS.toUpperCase(),
      Device.modelName ?? null,
    );
    return true;
  } catch {
    // Offline, signed out, or Expo could not mint a token. All ordinary.
    return false;
  }
}

/**
 * What the OS would do if asked, in one word.
 *
 * The screens need three answers, not two: a phone that has never been asked gets a button
 * that asks, a phone that already said no gets one that opens iOS Settings, and a simulator
 * gets nothing at all. Asks the OS nothing itself.
 */
export type PushPermission = "granted" | "askable" | "blocked" | "unsupported";

export async function pushPermissionState(): Promise<PushPermission> {
  if (!Device.isDevice) return "unsupported";
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "granted";
  return canAskAgain ? "askable" : "blocked";
}
