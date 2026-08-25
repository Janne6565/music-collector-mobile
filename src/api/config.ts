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

/**
 * An explicit build-time override, set per EAS build profile in `eas.json`.
 *
 * It has to be read as a literal `process.env.EXPO_PUBLIC_*` member expression: the Expo
 * bundler substitutes the value by matching the source text, so a computed lookup would
 * survive the build as `undefined`. Absent from the `development` and `production`
 * profiles, where the fallbacks below are already right; `preview` sets it to staging so
 * a QA build cannot write test copies into the real collection.
 */
const OVERRIDE = process.env.EXPO_PUBLIC_API_BASE;

export const API_BASE =
  OVERRIDE !== undefined && OVERRIDE !== ""
    ? OVERRIDE
    : __DEV__
      ? (developmentBase() ?? STAGING)
      : PRODUCTION;
