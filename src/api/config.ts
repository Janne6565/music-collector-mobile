import Constants from "expo-constants";

/**
 * Where the metadata proxy lives.
 *
 * A physical device cannot reach the developer's localhost, so a dev build points at the
 * Metro host's LAN address when one is available and falls back to staging otherwise.
 */
const PRODUCTION = "https://music.jannekeipert.de";
const STAGING = "https://music-staging.jannekeipert.de";

function developmentBase(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri === undefined) return null;
  const host = hostUri.split(":")[0];
  return host === undefined || host === "" ? null : `http://${host}:8080`;
}

export const API_BASE = __DEV__ ? (developmentBase() ?? STAGING) : PRODUCTION;
