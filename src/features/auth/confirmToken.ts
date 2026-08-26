/**
 * How long a one-time token is: 32 random bytes, base64url, unpadded.
 *
 * Duplicated from the server's `OneTimeToken` rather than shared, because it is not a
 * contract the two clients have to agree on with each other — it is a shape this screen
 * recognises so it can tell a truncated link apart from a dead one (21e). Anything shorter
 * was never issued, so calling the server would only burn a rate limit to be told something
 * we already know.
 */
export const TOKEN_LENGTH = 43;

export function looksTruncated(token: string): boolean {
  return token.length > 0 && token.length < TOKEN_LENGTH;
}

/** `j•••@meyer.de` — enough to recognise, not enough for a stranger to learn. */
export function maskAddress(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  return `${email.slice(0, 1)}•••${email.slice(at)}`;
}
