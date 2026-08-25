import { request } from "@/api/client";
import type { Copy, Photo, SyncPage, WishlistItem } from "@janne6565/music-collector-shared";


interface SyncPayload {
  copies?: unknown[];
  wishes?: unknown[];
  photos?: unknown[];
  cursor?: number;
  hasMore?: boolean;
}

/** Validates at the boundary: a malformed record is dropped, never written to the store. */
function toCopy(raw: unknown): Copy | null {
  const dto = raw as Partial<Copy> | null;
  if (
    dto === null ||
    dto.id === undefined ||
    dto.releaseId === undefined ||
    dto.currency === undefined ||
    dto.createdAt === undefined ||
    dto.fieldClocks === undefined
  ) {
    return null;
  }
  return {
    id: dto.id,
    releaseId: dto.releaseId,
    condition: dto.condition ?? null,
    sleeveCondition: dto.sleeveCondition ?? null,
    // Absent means a server older than the field, which is the same as not preferring it.
    catalogArt: dto.catalogArt ?? "AUTO",
    pricePaidCents: dto.pricePaidCents ?? null,
    currency: dto.currency,
    purchasedOn: dto.purchasedOn ?? null,
    purchasedAt: dto.purchasedAt ?? null,
    notes: dto.notes ?? null,
    notesConflict: dto.notesConflict ?? null,
    rating: dto.rating ?? null,
    createdAt: dto.createdAt,
    deletedAt: dto.deletedAt ?? null,
    fieldClocks: dto.fieldClocks,
  };
}

function toWish(raw: unknown): WishlistItem | null {
  const dto = raw as Partial<WishlistItem> | null;
  if (
    dto === null ||
    dto.id === undefined ||
    dto.albumId === undefined ||
    dto.title === undefined ||
    dto.artistName === undefined ||
    dto.createdAt === undefined ||
    dto.fieldClocks === undefined
  ) {
    return null;
  }
  return {
    id: dto.id,
    albumId: dto.albumId,
    title: dto.title,
    artistName: dto.artistName,
    year: dto.year ?? null,
    desiredFormat: dto.desiredFormat ?? null,
    note: dto.note ?? null,
    createdAt: dto.createdAt,
    deletedAt: dto.deletedAt ?? null,
    fieldClocks: dto.fieldClocks,
  };
}

function toPhoto(raw: unknown): Photo | null {
  const dto = raw as Partial<Photo> | null;
  if (
    dto === null ||
    dto.id === undefined ||
    dto.copyId === undefined ||
    dto.createdAt === undefined ||
    dto.fieldClocks === undefined
  ) {
    return null;
  }
  return {
    id: dto.id,
    copyId: dto.copyId,
    storageKey: dto.storageKey ?? null,
    contentType: dto.contentType ?? "image/jpeg",
    byteSize: dto.byteSize ?? 0,
    sortIndex: dto.sortIndex ?? 0,
    createdAt: dto.createdAt,
    deletedAt: dto.deletedAt ?? null,
    fieldClocks: dto.fieldClocks,
  };
}

function toPage(payload: SyncPayload): SyncPage {
  return {
    copies: (payload.copies ?? []).map(toCopy).filter((copy): copy is Copy => copy !== null),
    wishes: (payload.wishes ?? []).map(toWish).filter((wish): wish is WishlistItem => wish !== null),
    photos: (payload.photos ?? []).map(toPhoto).filter((photo): photo is Photo => photo !== null),
    cursor: payload.cursor ?? 0,
    hasMore: payload.hasMore === true,
  };
}

export async function pullChanges(since: number): Promise<SyncPage> {
  return toPage(await request<SyncPayload>(`/api/v1/sync?since=${since}`));
}

export async function pushChanges(
  copies: readonly Copy[],
  wishes: readonly WishlistItem[],
  photos: readonly Photo[],
): Promise<SyncPage> {
  return toPage(
    await request<SyncPayload>("/api/v1/sync", { method: "POST", body: { copies, wishes, photos } }),
  );
}
