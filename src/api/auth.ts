import { request, setAccessToken, writeRefreshToken } from "@/api/client";

export interface AccountUser {
  readonly id: string;
  readonly email: string;
  readonly createdAt: string;
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

export async function signIn(email: string, password: string): Promise<AccountUser> {
  return adopt(
    await request<SessionPayload>("/api/v1/auth/login", { method: "POST", body: { email, password }, noRetry: true }),
  );
}

export async function createAccount(email: string, password: string): Promise<AccountUser> {
  return adopt(
    await request<SessionPayload>("/api/v1/auth/register", {
      method: "POST",
      body: { email, password },
      noRetry: true,
    }),
  );
}

export async function signOut(): Promise<void> {
  // Best effort: the local session is cleared either way, so a failed call cannot strand
  // someone in a half-signed-out state.
  await request("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
  setAccessToken(null);
  await writeRefreshToken(null);
}
