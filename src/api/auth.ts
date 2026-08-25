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

export async function createAccount(
  email: string,
  password: string,
  displayName: string,
): Promise<AccountUser> {
  return adopt(
    await request<SessionPayload>("/api/v1/auth/register", {
      method: "POST",
      body: { email, password, displayName },
      noRetry: true,
    }),
  );
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
