/**
 * The word that has to be typed before the account goes.
 *
 * German even in the English interface, because it is the word the screen prints and the
 * point of it is to be copied deliberately rather than recognised and dismissed. The
 * umlaut-free spelling is accepted too — a keyboard without an Ö is not a reason to be
 * unable to delete your own account.
 *
 * Its own module rather than a helper beside the sheet: this is the rule the confirmation
 * rests on, and it should be testable without dragging React Native into the test runner.
 */
const CONFIRM_WORDS = ["löschen", "loeschen"];

export function isDeletionConfirmed(typed: string): boolean {
  return CONFIRM_WORDS.includes(typed.trim().toLowerCase());
}
