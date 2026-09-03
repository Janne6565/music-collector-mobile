import type { Release } from "@janne6565/rekordo-shared";

/** How many pressings the confirm card lists before it offers the full picker. */
export const SHOWN_PRESSINGS = 3;

/**
 * The rows the card lists, always including the one that is picked.
 *
 * The list is the catalogue's first three, which is right until somebody opens the full
 * picker and chooses the seventh. The card then came back showing rows one to three with
 * the check on none of them, so the choice just made was invisible and the card looked
 * like it had ignored it.
 *
 * A pick from further down takes the last of the three. The top row stays the catalogue's
 * first answer, because that is what the sentence above the list is about, and the rows
 * above the pick stay the ones a scanner is most likely to want.
 */
export function shownPressings(
  pressings: readonly Release[],
  picked: Release | null,
): readonly Release[] {
  const first = pressings.slice(0, SHOWN_PRESSINGS);
  if (picked === null || first.some((release) => release.id === picked.id)) return first;
  return [...first.slice(0, SHOWN_PRESSINGS - 1), picked];
}

/**
 * How many pressings the card is not showing.
 *
 * Counted against what is on screen rather than subtracted from the list length: once a
 * pick from further down has displaced a row, the displaced one is hidden too, and
 * "show 9 more" would be one short of what the picker then opens on.
 */
export function hiddenPressings(pressings: readonly Release[], shown: readonly Release[]): number {
  return pressings.filter((release) => !shown.some((row) => row.id === release.id)).length;
}
