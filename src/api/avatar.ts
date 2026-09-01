import { readRefreshToken, refreshSession, request } from "@/api/client";
import { API_BASE } from "@/api/config";
import { binaryAccessToken } from "@/api/photos";

/**
 * The profile picture, which does not go through the JSON client.
 *
 * Uploading is a multipart form built from the file URI the picker already handed over, plus
 * the square the person framed. The server crops and renders from that, so the circle is
 * identical on every device and the phone never has to decode or re-encode a picture of its
 * own.
 *
 * Sent through {@link XMLHttpRequest} rather than {@code fetch}, which is the only reason
 * this is not three lines: React Native's fetch reports no upload progress, and 27d's row is
 * a determinate bar because a 12 MB picture on a phone connection is long enough to watch.
 */

export interface AvatarCrop {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export interface Avatar {
  readonly url?: string;
  readonly updatedAt?: string;
}

/** Thrown with the status so the row can pick which of 27d's sentences this was. */
export class AvatarUploadFailed extends Error {
  constructor(readonly status: number) {
    super(`avatar upload failed: ${status}`);
  }
}

/** Abandoned by the person, which is not a failure and has nothing to report. */
export class AvatarUploadAborted extends Error {}

export interface AvatarUpload {
  readonly promise: Promise<Avatar>;
  /** Abandoning on purpose. The picture on the account is untouched either way. */
  readonly cancel: () => void;
}

export function uploadAvatar(
  fileUri: string,
  contentType: string,
  crop: AvatarCrop,
  onProgress?: (sent: number, total: number) => void,
): AvatarUpload {
  let inFlight: XMLHttpRequest | null = null;
  const promise = (async () => {
    const first = await send(fileUri, contentType, crop, binaryAccessToken(), onProgress, (xhr) => {
      inFlight = xhr;
    });
    // One silent refresh, the same bargain the JSON client makes: an access token that
    // expired while the picker was open should not cost somebody their upload.
    if (first.status !== 401 || (await readRefreshToken()) === null) return finish(first);
    const refreshed = await refreshSession();
    if (refreshed === null) return finish(first);
    return finish(
      await send(fileUri, contentType, crop, refreshed, onProgress, (xhr) => {
        inFlight = xhr;
      }),
    );
  })();
  return { promise, cancel: () => inFlight?.abort() };
}

export async function removeAvatar(): Promise<void> {
  await request<void>("/api/v1/avatar", { method: "DELETE" });
}

interface Answer {
  readonly status: number;
  readonly body: string;
}

function finish(answer: Answer): Avatar {
  if (answer.status < 200 || answer.status >= 300) throw new AvatarUploadFailed(answer.status);
  try {
    return JSON.parse(answer.body) as Avatar;
  } catch {
    // A 200 whose body will not parse is still a picture that landed; the account is
    // re-read on the next `/auth/me` either way.
    return {};
  }
}

function send(
  fileUri: string,
  contentType: string,
  crop: AvatarCrop,
  token: string | null,
  onProgress: ((sent: number, total: number) => void) | undefined,
  hold: (xhr: XMLHttpRequest) => void,
): Promise<Answer> {
  const form = new FormData();
  // React Native's FormData takes a file descriptor rather than a Blob.
  form.append("file", { uri: fileUri, name: "avatar.jpg", type: contentType } as unknown as Blob);
  form.append("x", String(Math.round(crop.x)));
  form.append("y", String(Math.round(crop.y)));
  form.append("size", String(Math.round(crop.size)));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    hold(xhr);
    xhr.open("POST", `${API_BASE}/api/v1/avatar`);
    xhr.setRequestHeader("X-Token-Mode", "direct");
    if (token !== null) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      onProgress?.(event.loaded, event.lengthComputable ? event.total : 0);
    };
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new AvatarUploadFailed(0));
    xhr.onabort = () => reject(new AvatarUploadAborted());
    xhr.send(form);
  });
}
