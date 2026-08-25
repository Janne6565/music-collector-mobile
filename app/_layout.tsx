import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/i18n/config";
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
          </StoreProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </Provider>
  );
}
