import { request } from "@/api/client";
import type { Copy } from "@/domain/types";

export interface SyncPage {
  readonly copies: Copy[];
  readonly cursor: number;
  readonly hasMore: boolean;
}

interface SyncPayload {
  copies?: unknown[];
  cursor?: number;
  hasMore?: boolean;
}

/** Validates at the boundary: a malformed record is dropped, never written to the store. */
function toCopy(raw: unknown): Copy | null {
  const dto = raw as Partial<Copy> | null;
  if (
    dto === null ||
    dto.id === undefined ||
    dto.releaseMbid === undefined ||
    dto.currency === undefined ||
    dto.createdAt === undefined ||
    dto.fieldClocks === undefined
  ) {
    return null;
  }
  return {
    id: dto.id,
    releaseMbid: dto.releaseMbid,
    condition: dto.condition ?? null,
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

function toPage(payload: SyncPayload): SyncPage {
  return {
    copies: (payload.copies ?? []).map(toCopy).filter((copy): copy is Copy => copy !== null),
    cursor: payload.cursor ?? 0,
    hasMore: payload.hasMore === true,
  };
}

export async function pullChanges(since: number): Promise<SyncPage> {
  return toPage(await request<SyncPayload>(`/api/v1/sync?since=${since}`));
}

export async function pushChanges(copies: readonly Copy[]): Promise<SyncPage> {
  return toPage(await request<SyncPayload>("/api/v1/sync", { method: "POST", body: { copies } }));
}
