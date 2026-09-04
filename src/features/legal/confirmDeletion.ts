/**
 * The words that are accepted before the account goes.
 *
 * The screen asks for the one in the interface's own language — DELETE in English,
 * LÖSCHEN in German — because a word you have to read before you can copy it is the whole
 * mechanism, and a foreign one is just a shape to be pattern-matched. All of them are
 * accepted whatever the language, so switching languages mid-dialogue cannot lock somebody
 * out of deleting their own account, and the umlaut-free spelling stands in for a keyboard
 * without an Ö.
 *
 * Its own module rather than a helper beside the sheet: this is the rule the confirmation
 * rests on, and it should be testable without dragging React Native into the test runner.
 */
const CONFIRM_WORDS = ["delete", "löschen", "loeschen"];

export function isDeletionConfirmed(typed: string): boolean {
  return CONFIRM_WORDS.includes(typed.trim().toLowerCase());
}
