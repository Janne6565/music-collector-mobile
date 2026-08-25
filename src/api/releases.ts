import { API_BASE } from "@/api/config";
import type { Album, Artist, CoverTheme, Format, Release } from "@janne6565/music-collector-shared";
import { FORMATS } from "@janne6565/music-collector-shared";
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
  releaseDate?: string;
  trackCount?: number;
  discCount?: number;
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
    releaseDate: payload.releaseDate ?? null,
    trackCount: payload.trackCount ?? null,
    discCount: payload.discCount ?? null,
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

interface ArtistPayload {
  mbid?: string;
  name?: string;
  disambiguation?: string;
  type?: string;
  country?: string;
  beganIn?: string;
  endedIn?: string;
  score?: number;
}

interface AlbumPayload {
  albumId?: string;
  title?: string;
  artistName?: string;
  year?: number;
  primaryType?: string;
  coverArtUrl?: string;
}

function toArtist(payload: ArtistPayload): Artist | null {
  // Without these two there is nothing to show and nothing to open a discography with.
  if (payload.mbid === undefined || payload.name === undefined) return null;
  return {
    mbid: payload.mbid,
    name: payload.name,
    disambiguation: payload.disambiguation ?? "",
    type: payload.type ?? null,
    country: payload.country ?? null,
    beganIn: payload.beganIn ?? null,
    endedIn: payload.endedIn ?? null,
    score: payload.score ?? null,
  };
}

function toAlbum(payload: AlbumPayload): Album | null {
  if (payload.albumId === undefined || payload.title === undefined) return null;
  return {
    albumId: payload.albumId,
    title: payload.title,
    artistName: payload.artistName ?? "",
    year: payload.year ?? null,
    primaryType: payload.primaryType ?? null,
    coverArtUrl: payload.coverArtUrl ?? null,
  };
}

export async function findArtists(query: string, limit = 5): Promise<Artist[]> {
  const payloads = await getJson<ArtistPayload[]>(
    `/api/v1/metadata/artists?q=${encodeURIComponent(query)}&limit=${limit}`,
  );
  return payloads.map(toArtist).filter((artist): artist is Artist => artist !== null);
}

/**
 * One artist's portrait, or null when they have none.
 *
 * Null is a real answer here rather than a failure — plenty of artists have no picture in
 * Discogs at all — so the caller draws the initial and does not retry.
 */
export async function findArtistImage(mbid: string): Promise<string | null> {
  const payload = await getJson<{ imageUrl?: string | null }>(
    `/api/v1/metadata/artists/${mbid}/image`,
  );
  return payload.imageUrl ?? null;
}

export interface Discography {
  readonly albums: Album[];
  /**
   * How many the query matched upstream, not how many arrived. A chip reading "Albums 51"
   * is telling the truth on a page of 25.
   */
  readonly total: number;
}

export async function lookupDiscography(
  artistMbid: string,
  primaryType: string | null,
  limit = 25,
): Promise<Discography> {
  const type = primaryType === null ? "" : `type=${encodeURIComponent(primaryType)}&`;
  const payload = await getJson<{ albums?: AlbumPayload[]; total?: number }>(
    `/api/v1/metadata/artists/${artistMbid}/albums?${type}limit=${limit}`,
  );
  return {
    albums: (payload.albums ?? []).map(toAlbum).filter((album): album is Album => album !== null),
    total: payload.total ?? 0,
  };
}

/** Every pressing of one album. Bitches Brew has 47, so this is paged, not exhaustive. */
export async function lookupPressings(albumId: string, limit = 25): Promise<Release[]> {
  const payloads = await getJson<ReleasePayload[]>(
    `/api/v1/metadata/albums/${encodeURIComponent(albumId)}/releases?limit=${limit}`,
  );
  const now = Date.now();
  return payloads.map((p) => toRelease(p, now)).filter((r): r is Release => r !== null);
}
