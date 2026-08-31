import { useLocalSearchParams } from "expo-router";
import { SharedDetailScreen } from "@/features/friends/SharedDetailScreen";

/**
 * A record on somebody else's shelf, as its own screen.
 *
 * It is a route rather than a `<Modal>` inside the profile for the same reason the
 * library's copy is: the sheet presentation and its dismissal gesture belong to the
 * navigator, which is the only thing that can run the drag and the unmount as one motion.
 * See `app/_layout.tsx`.
 */
export default function SharedDetailRoute() {
  const { handle, open, tab } = useLocalSearchParams<{
    handle: string;
    open: string;
    tab?: string;
  }>();
  return (
    <SharedDetailScreen
      handle={handle ?? ""}
      open={open ?? ""}
      tab={tab === "wishlist" ? "wishlist" : "collection"}
    />
  );
}
