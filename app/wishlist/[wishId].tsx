import { WishEntryScreen } from "@/features/wishlist/WishEntryScreen";
import { useLocalSearchParams } from "expo-router";

export default function WishEntryRoute() {
  const { wishId } = useLocalSearchParams<{ wishId: string }>();
  return <WishEntryScreen wishId={wishId} />;
}
