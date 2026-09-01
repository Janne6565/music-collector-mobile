import { router } from "expo-router";
import { useEffect } from "react";

/**
 * Where the provider's redirect lands on Android, and nowhere else.
 *
 * `signInWithProvider` waits on `WebBrowser.openAuthSessionAsync`, and on iOS that is the
 * whole story: the session intercepts `musiccollector://auth/callback` itself, closes the
 * sheet, and the URL never reaches the system. Android has no such thing. The redirect
 * leaves Chrome as an ordinary intent, the OS hands it to the app, and expo-router — which
 * is also listening — tries to open a route for the path. Without this file that route does
 * not exist, and the person who just signed in with Google is looking at "Unmatched Route"
 * while the sign-in they completed succeeds invisibly behind it.
 *
 * So this screen exists to be left immediately. It draws nothing and steps back to the
 * screen underneath, which is the sign-in screen still holding the promise that is about to
 * resolve. The code in the URL is deliberately ignored here: it is already being exchanged
 * over the app's own connection by `signInWithProvider`, and reading it twice would race
 * with a one-time credential.
 */
export function OAuthCallbackScreen() {
  useEffect(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Cold start: the intent woke a process that had no sign-in screen to return to.
      router.replace("/");
    }
  }, []);

  return null;
}
