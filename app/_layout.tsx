import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/i18n/config";
import { RestoreSession } from "@/features/auth/RestoreSession";
import { UndoProvider } from "@/features/wishlist/UndoBar";
import { StoreProvider } from "@/local/StoreProvider";
import { useReducedMotion } from "@/lib/motion";
import { store } from "@/store";

const queryClient = new QueryClient();

export default function RootLayout() {
  const reduced = useReducedMotion();

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <StoreProvider>
            {/* The session comes back from the keychain here, above the tabs: a tab is not
                mounted until it is opened, and Friends must not have to guess. */}
            <RestoreSession />
            {/* Screen 16e's line lives above the stack: the entry that leaves on its own
                does so wherever a record gets filed, which is rarely the wishlist. */}
            <UndoProvider>
              {/*
                * The platform push, untouched — 350ms slide with the interactive back-swipe
                * intact. This is the one place the web's Cross is deliberately *not*
                * mirrored: on a phone the stack is the mental model, and a cross-fade throws
                * away the swipe. Do not customise it.
                *
                * The exception is a reader who has asked for less movement, where the slide
                * goes and the screens simply replace one another.
                */}
              <Stack
                screenOptions={{ headerShown: false, animation: reduced ? "none" : "default" }}
              />
            </UndoProvider>
          </StoreProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </Provider>
  );
}
