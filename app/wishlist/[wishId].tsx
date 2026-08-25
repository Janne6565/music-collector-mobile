import { useLocalSearchParams } from "expo-router";
import { WishEntryScreen } from "@/features/wishlist/WishEntryScreen";

export default function WishEntryRoute() {
  const { wishId } = useLocalSearchParams<{ wishId: string }>();
  return <WishEntryScreen wishId={wishId} />;
}
