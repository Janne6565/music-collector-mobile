/**
 * The order the shelf was showing when somebody opened a record.
 *
 * Swiping between copies has to move through *that* order — the one with their filter and
 * their sort applied — not through some canonical one the detail screen invents. The
 * library is the only place that knows it, so it leaves it here on the way past.
 *
 * A module-level variable rather than context or state, deliberately: it is a fact about
 * the last list somebody looked at, it has to survive the navigation, and nothing should
 * re-render because of it.
 *
 * Empty after a cold start or a deep link, and that is the honest answer — a screen reached
 * without a list behind it has no neighbours, so it does not pretend to.
 */
let order: readonly string[] = [];

export function rememberCopyOrder(copyIds: readonly string[]): void {
  order = copyIds;
}

export interface CopyNeighbours {
  readonly previous: string | null;
  readonly next: string | null;
}

/** What sits either side of this copy, or nulls at the ends and when nothing is remembered. */
export function neighboursOf(copyId: string): CopyNeighbours {
  const at = order.indexOf(copyId);
  if (at === -1) return { previous: null, next: null };
  return {
    // No wrapping. A shelf that loops has no last record, and the swipe that would have
    // told you so instead quietly starts again.
    previous: at > 0 ? order[at - 1] : null,
    next: at < order.length - 1 ? order[at + 1] : null,
  };
}
