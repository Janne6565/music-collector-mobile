import { API_BASE } from "@/api/config";
import type { CoverTheme, Format, Release } from "@/domain/types";
import { FORMATS } from "@/domain/types";

/**
 * Thin client over the metadata proxy.
 *
 * Mirrors the boundary in music-collector-frontend/src/api/releases.ts: the server types
 * every field optional, so payloads are validated here and unusable rows dropped rather
 * than letting the optionality leak into the screens.
 */

interface ReleasePayload {
  mbid?: string;
  albumId?: string;
  title?: string;
  artistName?: string;
  year?: number;
  format?: string;
  label?: string;
  catalogNumber?: string;
  country?: string;
  barcode?: string;
  coverArtUrl?: string;
  coverTheme?: {
    dominantColor?: string;
    accentColor?: string;
    lightness?: number;
    dark?: boolean;
  };
}

function toCoverTheme(payload: ReleasePayload["coverTheme"]): CoverTheme | null {
  if (
    payload?.dominantColor === undefined ||
    payload.accentColor === undefined ||
    payload.lightness === undefined ||
    payload.dark === undefined
  ) {
    return null;
  }
  return {
    dominantColor: payload.dominantColor,
    accentColor: payload.accentColor,
    lightness: payload.lightness,
    dark: payload.dark,
  };
}

export function toRelease(payload: ReleasePayload, now: number): Release | null {
  if (
    payload.mbid === undefined ||
    payload.albumId === undefined ||
    payload.title === undefined ||
    payload.artistName === undefined
  ) {
    return null;
  }
  return {
    id: payload.mbid,
    albumId: payload.albumId,
    title: payload.title,
    artistName: payload.artistName,
    year: payload.year ?? null,
    format: (FORMATS as readonly string[]).includes(payload.format ?? "")
      ? (payload.format as Format)
      : "OTHER",
    label: payload.label ?? null,
    catalogNumber: payload.catalogNumber ?? null,
    country: payload.country ?? null,
    barcode: payload.barcode ?? null,
    coverArtUrl: payload.coverArtUrl ?? null,
    coverTheme: toCoverTheme(payload.coverTheme),
    cachedAt: now,
  };
}

export function releaseDisambiguation(release: Release): string {
  return [release.label, release.catalogNumber, release.country]
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join(" · ");
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`${response.status} from ${path}`);
  }
  return (await response.json()) as T;
}

export async function searchReleases(query: string, limit = 25): Promise<Release[]> {
  const payloads = await getJson<ReleasePayload[]>(
    `/api/v1/metadata/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  );
  const now = Date.now();
  return payloads.map((p) => toRelease(p, now)).filter((r): r is Release => r !== null);
}

export async function lookupByBarcode(barcode: string): Promise<Release[]> {
  const payloads = await getJson<ReleasePayload[]>(`/api/v1/metadata/barcode/${barcode}`);
  const now = Date.now();
  return payloads.map((p) => toRelease(p, now)).filter((r): r is Release => r !== null);
}

export async function lookupRelease(mbid: string): Promise<Release | null> {
  return toRelease(await getJson<ReleasePayload>(`/api/v1/metadata/releases/${mbid}`), Date.now());
}
