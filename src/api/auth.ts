import { request, setAccessToken, writeRefreshToken } from "@/api/client";

export interface AccountUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly createdAt: string;
}

export interface AuthProvider {
  readonly id: string;
  readonly displayName: string;
}

interface SessionPayload {
  accessToken?: string;
  refreshToken?: string;
  user?: AccountUser;
}

async function adopt(session: SessionPayload): Promise<AccountUser> {
  if (session.accessToken === undefined || session.user === undefined) {
    throw new Error("The server did not return a session");
  }
  setAccessToken(session.accessToken);
  if (session.refreshToken !== undefined) await writeRefreshToken(session.refreshToken);
  return session.user;
}

export async function signIn(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<AccountUser> {
  return adopt(
    await request<SessionPayload>("/api/v1/auth/login", {
      method: "POST",
      body: { email, password, rememberMe },
      noRetry: true,
    }),
  );
}

/**
 * The two consent ticks travel with the registration (design turn 17).
 *
 * The server refuses without them and stamps its own record of which documents, in which
 * version, were accepted -- so what is sent here is only *that* the boxes were ticked.
 */
export async function createAccount(
  email: string,
  password: string,
  displayName: string,
  acceptedTerms: boolean,
  confirmedAge: boolean,
): Promise<AccountUser> {
  return adopt(
    await request<SessionPayload>("/api/v1/auth/register", {
      method: "POST",
      body: { email, password, displayName, acceptedTerms, confirmedAge },
      noRetry: true,
    }),
  );
}

export interface ConsentRecord {
  readonly document: "TERMS" | "PRIVACY" | "AGE";
  readonly version: string;
  readonly acceptedAt: string;
}

/** What the Legal & privacy screen prints under a document: "accepted 4 Mar 2026". */
export async function accountConsents(): Promise<ConsentRecord[]> {
  return request<ConsentRecord[]>("/api/v1/account/consents");
}

/** The Art. 15 / Art. 20 answer for what the server holds. Only meaningful with an account. */
export async function accountExport(): Promise<unknown> {
  return request<unknown>("/api/v1/account/export");
}

/** Only providers the server can actually complete a flow with. */
export async function authProviders(): Promise<AuthProvider[]> {
  return request<AuthProvider[]>("/api/v1/auth/providers", { noRetry: true }).catch(() => []);
}

/**
 * Finishes an external sign-in by redeeming the one-time code the callback deep-linked
 * back with.
 *
 * The code is not a credential on its own — it only becomes a session here, over the app's
 * own connection, which is why it is safe for it to have travelled through a URL.
 */
export async function completeExternalSignIn(code: string): Promise<AccountUser> {
  return adopt(
    await request<SessionPayload>("/api/v1/auth/oauth/exchange", {
      method: "POST",
      body: { code },
      noRetry: true,
    }),
  );
}

/** Always resolves: a different answer for a registered address would leak who has one. */
export async function requestPasswordReset(email: string): Promise<void> {
  await request("/api/v1/auth/forgot-password", {
    method: "POST",
    body: { email },
    noRetry: true,
  }).catch(() => undefined);
}

/**
 * Renames the account.
 *
 * Returns the account as the server now reads it rather than echoing what was sent: the
 * server trims the name and turns a blank one back into "no name", and the screen should
 * show what was actually stored.
 */
export async function updateDisplayName(displayName: string): Promise<AccountUser> {
  return request<AccountUser>("/api/v1/auth/me", { method: "PATCH", body: { displayName } });
}

export async function signOut(): Promise<void> {
  // Best effort: the local session is cleared either way, so a failed call cannot strand
  // someone in a half-signed-out state.
  await request("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
  setAccessToken(null);
  await writeRefreshToken(null);
}

/**
 * Deletes the account and everything synced to it.
 *
 * The local collection is deliberately untouched — it belongs to the device, not the
 * account, and the app goes on working without one.
 */
export async function deleteAccount(): Promise<void> {
  await request("/api/v1/auth/me", { method: "DELETE" });
  setAccessToken(null);
  await writeRefreshToken(null);
}
