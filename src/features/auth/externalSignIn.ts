import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { API_BASE } from "@/api/config";
import { type AccountUser, completeExternalSignIn } from "@/api/auth";

/**
 * Where the server sends the phone once a provider has finished with it.
 *
 * Hard-coded rather than derived from `Linking.createURL`, because the server has to know
 * this value up front to put it in a redirect: it is configuration shared by both sides,
 * not something either can invent. Keep it in step with `mobile-redirect-uri` in the
 * backend's application.yml and with `scheme` in app.json.
 */
const REDIRECT_URI = "musiccollector://auth/callback";

export type ExternalSignInResult =
  | { readonly outcome: "SIGNED_IN"; readonly user: AccountUser }
  /** The person closed the browser. Not an error, and nothing should be said about it. */
  | { readonly outcome: "CANCELLED" }
  | { readonly outcome: "FAILED" };

/**
 * Signing in with Google or Apple.
 *
 * The provider is met in the system browser rather than a webview — providers refuse
 * embedded webviews outright, and the browser is where any session the person already has
 * lives. `openAuthSessionAsync` is what makes the round trip work: it hands control back
 * as soon as the server redirects to our own scheme, so the browser closes itself and the
 * app learns the outcome. Plain `Linking.openURL` cannot, which is why this used to end
 * with somebody signed into the website and nothing changed in the app.
 *
 * What comes back is a one-time code, never a token. It is exchanged for the session over
 * the app's own connection in {@link completeExternalSignIn}.
 */
export async function signInWithProvider(providerId: string): Promise<ExternalSignInResult> {
  const authorize = `${API_BASE}/api/v1/auth/oauth/${providerId}/authorize?client=mobile`;

  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(authorize, REDIRECT_URI);
  } catch {
    return { outcome: "FAILED" };
  }

  if (result.type !== "success") {
    return { outcome: "CANCELLED" };
  }

  const { code, error } = Linking.parse(result.url).queryParams ?? {};
  if (typeof code !== "string" || error !== undefined) {
    return { outcome: "FAILED" };
  }

  try {
    return { outcome: "SIGNED_IN", user: await completeExternalSignIn(code) };
  } catch {
    return { outcome: "FAILED" };
  }
}
