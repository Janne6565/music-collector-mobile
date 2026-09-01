import { AddScreen } from "@/features/add/AddScreen";
import { useLocalSearchParams } from "expo-router";

export default function AddRoute() {
  /**
   * Screen 16b hands the wish's own search over as `wish`; `to` says which list the tab
   * that opened this is about.
   *
   * The add screen is one screen with two callers. Opened from the library it is about
   * records you have, opened from the wishlist it is about records you want, and the sheet
   * it raises should lead with the answer the caller already implied. Both buttons stay on
   * the sheet either way, so a wrong guess costs one tap rather than an undo.
   *
   * `wish` deliberately does not imply the wishlist: it arrives from "I found a copy",
   * which is the moment a wish stops being one.
   */
  const { wish, to } = useLocalSearchParams<{ wish?: string; to?: string }>();
  return <AddScreen seedTerm={wish ?? ""} destination={to === "WISHLIST" ? "WISHLIST" : "SHELF"} />;
}
