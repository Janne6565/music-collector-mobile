import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/i18n/config";
import { StoreProvider } from "@/local/StoreProvider";
import { store } from "@/store";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <StoreProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </StoreProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </Provider>
  );
}
