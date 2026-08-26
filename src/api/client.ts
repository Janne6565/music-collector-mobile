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
  // The binary client keeps its own copy, because it bypasses this module's fetch wrapper
  // to send multipart bodies. Setting both here stops the two drifting apart.
  void import("@/api/photos").then((photos) => photos.setBinaryAccessToken(token));
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
  constructor(
    readonly status: number,
    path: string,
    /**
     * The fields a 400 named as invalid, from the RFC 7807 `errors` map.
     *
     * The server's own message is deliberately dropped: it is English, and a screen that
     * printed it would break the app's language. Which inputs were refused is the part
     * that travels; the wording is looked up where it is shown.
     */
    readonly invalidFields: readonly string[] = [],
  ) {
    super(`${status} from ${path}`);
  }
}

async function refusedFields(response: Response): Promise<readonly string[]> {
  if (response.status !== 400) return [];
  try {
    const body = (await response.json()) as { errors?: unknown };
    return typeof body.errors === "object" && body.errors !== null
      ? Object.keys(body.errors as Record<string, unknown>)
      : [];
  } catch {
    // A 400 that is not JSON says nothing useful; the caller falls back to its generic line.
    return [];
  }
}

interface RequestOptions {
  readonly method?: string;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  /** Set on the refresh call itself, so a failing refresh cannot trigger another one. */
  readonly noRetry?: boolean;
  /** Return the raw bytes rather than parsing JSON — used for image downloads. */
  readonly raw?: boolean;
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
    throw new HttpError(response.status, path, await refusedFields(response));
  }
  if (response.status === 204) return undefined as T;
  return (options.raw === true ? await response.arrayBuffer() : await response.json()) as T;
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
