import * as SecureStore from "expo-secure-store";
import { API_BASE } from "@/api/config";

/**
 * The app's HTTP client.
 *
 * Native clients have no cookie jar worth relying on, so the app asks the server for
 * `X-Token-Mode: direct` and keeps the refresh token in the platform keychain via
 * expo-secure-store. The short-lived access token stays in memory only.
 */
const REFRESH_KEY = "mc.refreshToken";

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function readRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function writeRefreshToken(token: string | null): Promise<void> {
  if (token === null) {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    return;
  }
  await SecureStore.setItemAsync(REFRESH_KEY, token);
}

export class HttpError extends Error {
  constructor(readonly status: number, path: string) {
    super(`${status} from ${path}`);
  }
}

interface RequestOptions {
  readonly method?: string;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  /** Set on the refresh call itself, so a failing refresh cannot trigger another one. */
  readonly noRetry?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (token: string | null) => {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "X-Token-Mode": "direct",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return response;
  };

  let response = await send(accessToken);

  if (response.status === 401 && options.noRetry !== true) {
    const refreshed = await refreshSession();
    if (refreshed !== null) {
      response = await send(refreshed);
    }
  }

  if (!response.ok) {
    throw new HttpError(response.status, path);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

/** Exchanges the stored refresh token for a new pair. Returns null when there is no session. */
export async function refreshSession(): Promise<string | null> {
  const stored = await readRefreshToken();
  if (stored === null) return null;
  try {
    const session = await request<{ accessToken?: string; refreshToken?: string }>("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "X-Refresh-Token": stored },
      noRetry: true,
    });
    if (session.accessToken === undefined) return null;
    setAccessToken(session.accessToken);
    // The server rotates the refresh token on every exchange, so store the new one or the
    // session dies at the old token's expiry.
    if (session.refreshToken !== undefined) await writeRefreshToken(session.refreshToken);
    return session.accessToken;
  } catch {
    await writeRefreshToken(null);
    return null;
  }
}
