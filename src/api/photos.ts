import { API_BASE } from "@/api/config";
import { HttpError, readRefreshToken, refreshSession, request } from "@/api/client";

/**
 * The photo bytes, which do not go through the JSON client.
 *
 * Upload is a multipart form built from the file URI React Native already has; download
 * writes straight to disk, so the image never has to exist as a base64 string in memory.
 */

export interface UploadedPhoto {
  readonly storageKey: string;
  readonly contentType: string;
  readonly byteSize: number;
}

let accessTokenForBinary: string | null = null;

/** Kept in step with the JSON client so both halves use the same session. */
export function setBinaryAccessToken(token: string | null): void {
  accessTokenForBinary = token;
}

/** The same token, for the other binary endpoint: the profile picture upload. */
export function binaryAccessToken(): string | null {
  return accessTokenForBinary;
}

/** A photo pictures a copy or a wishlist entry, never both — the server rejects the pair. */
export type PhotoOwner = { readonly copyId: string } | { readonly wishId: string };

export async function uploadPhotoBytes(
  photoId: string,
  owner: PhotoOwner,
  fileUri: string,
  contentType: string,
): Promise<UploadedPhoto | null> {
  const form = new FormData();
  form.append("photoId", photoId);
  form.append(
    "copyId" in owner ? "copyId" : "wishId",
    "copyId" in owner ? owner.copyId : owner.wishId,
  );
  // React Native's FormData takes a file descriptor rather than a Blob.
  form.append("file", { uri: fileUri, name: photoId, type: contentType } as unknown as Blob);

  const send = (token: string | null) =>
    fetch(`${API_BASE}/api/v1/photos`, {
      method: "POST",
      headers: {
        "X-Token-Mode": "direct",
        ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
      },
      body: form,
    });

  let response = await send(accessTokenForBinary);
  if (response.status === 401 && (await readRefreshToken()) !== null) {
    const refreshed = await refreshSession();
    if (refreshed !== null) {
      accessTokenForBinary = refreshed;
      response = await send(refreshed);
    }
  }
  // A refusal is an answer, not an accident: the account is full (507) or this one picture
  // is too big (413), and neither resolves by trying again. Those are thrown so the sync
  // engine can remember them; everything else stays a null, which means "not now" and is
  // exactly what the ordinary failures deserve.
  if (response.status === 507 || response.status === 413) {
    throw new HttpError(response.status, "/api/v1/photos");
  }
  if (!response.ok) return null;

  const payload = (await response.json()) as Partial<UploadedPhoto>;
  if (typeof payload.storageKey !== "string") return null;
  return {
    storageKey: payload.storageKey,
    contentType: payload.contentType ?? contentType,
    byteSize: payload.byteSize ?? 0,
  };
}

/** Returns the raw bytes so the caller can write them wherever it keeps images. */
export async function downloadPhotoBytes(photoId: string): Promise<ArrayBuffer> {
  return request<ArrayBuffer>(`/api/v1/photos/${photoId}/content`, { raw: true });
}
