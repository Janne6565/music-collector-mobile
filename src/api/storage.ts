import { request } from "@/api/client";

/**
 * The storage allowance, as the server counts it (design 28a).
 *
 * Hand-written like the rest of this app's client, and split rather than summed on purpose:
 * the photos can be deleted one by one, the profile picture can only be replaced. A screen
 * with one total could say "you are full" without being able to say what would help.
 */
export interface StorageUsage {
  readonly photoBytes: number;
  readonly photoCount: number;
  readonly avatarBytes: number;
  /** The two above added up, by the server, so the meter agrees with the refusal. */
  readonly usedBytes: number;
  readonly quotaBytes: number;
}

export async function accountStorage(): Promise<StorageUsage> {
  return request<StorageUsage>("/api/v1/account/storage");
}
