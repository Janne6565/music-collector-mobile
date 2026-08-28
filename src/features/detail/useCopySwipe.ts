import { useRouter } from "expo-router";
import { neighboursOf } from "@/features/library/copyOrder";
import { usePageFlip } from "@/features/detail/usePageFlip";

/**
 * Swiping left and right between the copies the shelf was showing.
 *
 * The gesture itself is `usePageFlip`, shared with a friend's sheet. What is particular
 * here is where the neighbours come from — the order the shelf was in — and that flipping
 * changes the route's parameter rather than navigating. `replace` on a modal route tore
 * the sheet down and presented a new one, the whole thing closing and reopening to show
 * the record next to it, while `setParams` leaves the sheet standing and swaps what is
 * inside it, keeping the URL honest about which copy that is.
 */
export function useCopySwipe(copyId: string) {
  const router = useRouter();
  const neighbours = neighboursOf(copyId);

  const flip = usePageFlip({
    onPrev:
      neighbours.previous === null
        ? undefined
        : () => router.setParams({ copyId: neighbours.previous ?? undefined }),
    onNext:
      neighbours.next === null
        ? undefined
        : () => router.setParams({ copyId: neighbours.next ?? undefined }),
  });

  return {
    handlers: flip.handlers,
    fade: flip.fade,
    /** Whether there is anywhere to go, so a screen can say so if it ever wants to. */
    hasNeighbours: neighbours.previous !== null || neighbours.next !== null,
  };
}
