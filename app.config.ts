import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * app.json stays the source of truth for the app's identity, plugins and assets.
 *
 * This file exists for exactly one value that must not live in the repo: the Firebase
 * client config Android needs before FCM will mint a push token. On EAS it arrives as
 * the `GOOGLE_SERVICES_JSON` file secret, whose value is a path on the worker; locally
 * it is a gitignored `google-services.json` in the repo root. Without either, an Android
 * build still succeeds and push is silently dead -- which is how it was until now.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Rekordo",
  slug: config.slug ?? "music-collector",
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
  },
});
