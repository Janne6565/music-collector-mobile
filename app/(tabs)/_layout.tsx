import { Tabs } from "expo-router";
import { CircleUser, Heart, LibraryBig } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { colors } from "@/theme/colors";

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.library"),
          tabBarIcon: ({ color }) => <LibraryBig size={20} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: t("nav.wishlist"),
          tabBarIcon: ({ color }) => <Heart size={20} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: t("nav.you"),
          tabBarIcon: ({ color }) => <CircleUser size={20} color={color} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
