import { colors } from "@/theme/colors";
import { Tabs } from "expo-router";
import { CircleUser, Heart, LibraryBig, Users } from "lucide-react-native";
import { useTranslation } from "react-i18next";

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        /*
         * Turn 13i: nothing. Content swaps on the frame of the tap, and only the icon and
         * label colour move. Three local screens do not need to slide past each other, and
         * a transition here would put a wait in front of a read that has none.
         */
        animation: "none",
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
        name="friends"
        options={{
          title: t("nav.friends"),
          tabBarIcon: ({ color }) => <Users size={20} color={color} strokeWidth={1.75} />,
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
