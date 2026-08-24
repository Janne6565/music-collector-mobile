import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import type { CollectionStats, Copy, Format, Release, WishlistItem } from "@/domain/types";
import { FORMATS } from "@/domain/types";
import type { LibraryFilter, LocalStore } from "@/local/LocalStore";

const DATABASE = "music-collector.db";
const DEVICE_ID_KEY = "deviceId";
const CLOCK_KEY = "clock";
const CURSOR_KEY = "syncCursor";
const PENDING_KEY = "pendingIds";

/**
 * SQLite-backed store for the mobile app — the same interface the web app implements over
 * IndexedDB, so a screen written against LocalStore ports between them unchanged.
 *
 * Rows are stored with the JSON-ish columns the app actually filters on promoted to real
 * columns, and the rest kept as-is. Filtering happens in SQL rather than in JS because a
 * phone should not deserialise a whole collection to render one filtered grid.
 */
export class SqliteLocalStore implements LocalStore {
  private db: SQLite.SQLiteDatabase | null = null;

  private handle(): SQLite.SQLiteDatabase {
    if (this.db === null) {
      throw new Error("LocalStore used before open()");
    }
    return this.db;
  }

  async open(): Promise<void> {
    if (this.db !== null) return;
    const db = await SQLite.openDatabaseAsync(DATABASE);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS copies (
        id              TEXT PRIMARY KEY NOT NULL,
        releaseMbid     TEXT NOT NULL,
        condition       TEXT,
        pricePaidCents  INTEGER,
        currency        TEXT NOT NULL,
        purchasedOn     TEXT,
        purchasedAt     TEXT,
        notes           TEXT,
        notesConflict   TEXT,
        rating          INTEGER,
        createdAt       INTEGER NOT NULL,
        deletedAt       INTEGER,
        fieldClocks     TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS copies_release_idx ON copies (releaseMbid);
      CREATE INDEX IF NOT EXISTS copies_alive_idx ON copies (deletedAt);

      CREATE TABLE IF NOT EXISTS releases (
        mbid             TEXT PRIMARY KEY NOT NULL,
        releaseGroupMbid TEXT NOT NULL,
        title            TEXT NOT NULL,
        artistName       TEXT NOT NULL,
        year             INTEGER,
        format           TEXT NOT NULL,
        label            TEXT,
        catalogNumber    TEXT,
        country          TEXT,
        barcode          TEXT,
        coverArtUrl      TEXT,
        coverTheme       TEXT,
        cachedAt         INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS releases_group_idx ON releases (releaseGroupMbid);

      CREATE TABLE IF NOT EXISTS wishlist (
        id               TEXT PRIMARY KEY NOT NULL,
        releaseGroupMbid TEXT NOT NULL,
        title            TEXT NOT NULL,
        artistName       TEXT NOT NULL,
        year             INTEGER,
        desiredFormat    TEXT,
        note             TEXT,
        createdAt        INTEGER NOT NULL,
        deletedAt        INTEGER,
        fieldClocks      TEXT NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS wishlist_group_idx ON wishlist (releaseGroupMbid);

      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    this.db = db;
  }

  async listCopies(filter: LibraryFilter = {}): Promise<Copy[]> {
    const clauses = ["c.deletedAt IS NULL"];
    const params: (string | number)[] = [];

    if (filter.format !== undefined && filter.format !== "ALL") {
      clauses.push("r.format = ?");
      params.push(filter.format);
    }
    const term = filter.search?.trim();
    if (term !== undefined && term !== "") {
      clauses.push("(r.title LIKE ? OR r.artistName LIKE ? OR r.catalogNumber LIKE ? OR c.notes LIKE ?)");
      const like = `%${term}%`;
      params.push(like, like, like, like);
    }

    const order =
      filter.sort === "ARTIST_ASC"
        ? "r.artistName COLLATE NOCASE ASC"
        : filter.sort === "YEAR_DESC"
          ? "r.year DESC"
          : "c.createdAt DESC";

    const rows = await this.handle().getAllAsync<CopyRow>(
      `SELECT c.* FROM copies c LEFT JOIN releases r ON r.mbid = c.releaseMbid
       WHERE ${clauses.join(" AND ")} ORDER BY ${order}`,
      params,
    );
    return rows.map(toCopy);
  }

  async getCopy(id: string): Promise<Copy | undefined> {
    const row = await this.handle().getFirstAsync<CopyRow>(
      "SELECT * FROM copies WHERE id = ? AND deletedAt IS NULL",
      [id],
    );
    return row === null ? undefined : toCopy(row);
  }

  async getCopyIncludingDeleted(id: string): Promise<Copy | undefined> {
    const row = await this.handle().getFirstAsync<CopyRow>("SELECT * FROM copies WHERE id = ?", [id]);
    return row === null ? undefined : toCopy(row);
  }

  async listCopiesInReleaseGroup(releaseGroupMbid: string): Promise<Copy[]> {
    const rows = await this.handle().getAllAsync<CopyRow>(
      `SELECT c.* FROM copies c JOIN releases r ON r.mbid = c.releaseMbid
       WHERE r.releaseGroupMbid = ? AND c.deletedAt IS NULL`,
      [releaseGroupMbid],
    );
    return rows.map(toCopy);
  }

  async putCopy(copy: Copy): Promise<void> {
    await this.write(copy);
    await this.markPending(copy.id);
  }

  async adoptCopy(copy: Copy): Promise<void> {
    // No pending mark: the client would otherwise push straight back what it just pulled.
    await this.write(copy);
  }

  private async write(copy: Copy): Promise<void> {
    await this.handle().runAsync(
      `INSERT OR REPLACE INTO copies
        (id, releaseMbid, condition, pricePaidCents, currency, purchasedOn, purchasedAt,
         notes, notesConflict, rating, createdAt, deletedAt, fieldClocks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        copy.id,
        copy.releaseMbid,
        copy.condition,
        copy.pricePaidCents,
        copy.currency,
        copy.purchasedOn,
        copy.purchasedAt,
        copy.notes,
        copy.notesConflict,
        copy.rating,
        copy.createdAt,
        copy.deletedAt,
        JSON.stringify(copy.fieldClocks),
      ],
    );
  }

  private async markPending(id: string): Promise<void> {
    const pending = new Set(await this.readPendingIds());
    if (pending.has(id)) return;
    pending.add(id);
    await this.writePendingIds([...pending]);
  }

  async cacheReleases(releases: readonly Release[]): Promise<void> {
    const db = this.handle();
    await db.withTransactionAsync(async () => {
      for (const release of releases) {
        await db.runAsync(
          `INSERT OR REPLACE INTO releases
            (mbid, releaseGroupMbid, title, artistName, year, format, label, catalogNumber,
             country, barcode, coverArtUrl, coverTheme, cachedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            release.mbid,
            release.releaseGroupMbid,
            release.title,
            release.artistName,
            release.year,
            release.format,
            release.label,
            release.catalogNumber,
            release.country,
            release.barcode,
            release.coverArtUrl,
            release.coverTheme === null ? null : JSON.stringify(release.coverTheme),
            release.cachedAt,
          ],
        );
      }
    });
  }

  async getRelease(mbid: string): Promise<Release | undefined> {
    const row = await this.handle().getFirstAsync<ReleaseRow>("SELECT * FROM releases WHERE mbid = ?", [mbid]);
    return row === null ? undefined : toRelease(row);
  }

  async getReleases(mbids: readonly string[]): Promise<Map<string, Release>> {
    const unique = [...new Set(mbids)];
    if (unique.length === 0) return new Map();
    const rows = await this.handle().getAllAsync<ReleaseRow>(
      `SELECT * FROM releases WHERE mbid IN (${unique.map(() => "?").join(",")})`,
      unique,
    );
    return new Map(rows.map((row) => [row.mbid, toRelease(row)]));
  }

  async listWishlist(): Promise<WishlistItem[]> {
    const rows = await this.handle().getAllAsync<WishRow>(
      "SELECT * FROM wishlist WHERE deletedAt IS NULL ORDER BY createdAt DESC",
    );
    return rows.map(toWish);
  }

  async getWishlistItemIncludingDeleted(id: string): Promise<WishlistItem | undefined> {
    const row = await this.handle().getFirstAsync<WishRow>("SELECT * FROM wishlist WHERE id = ?", [id]);
    return row === null ? undefined : toWish(row);
  }

  async wishlistHas(releaseGroupMbid: string): Promise<boolean> {
    const row = await this.handle().getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM wishlist WHERE releaseGroupMbid = ? AND deletedAt IS NULL",
      [releaseGroupMbid],
    );
    return (row?.n ?? 0) > 0;
  }

  async putWishlistItem(item: WishlistItem): Promise<void> {
    await this.writeWish(item);
    await this.markPending(item.id);
  }

  async adoptWishlistItem(item: WishlistItem): Promise<void> {
    // No pending mark: the client would otherwise push straight back what it just pulled.
    await this.writeWish(item);
  }

  private async writeWish(item: WishlistItem): Promise<void> {
    await this.handle().runAsync(
      `INSERT OR REPLACE INTO wishlist
        (id, releaseGroupMbid, title, artistName, year, desiredFormat, note, createdAt, deletedAt, fieldClocks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.releaseGroupMbid,
        item.title,
        item.artistName,
        item.year,
        item.desiredFormat,
        item.note,
        item.createdAt,
        item.deletedAt,
        JSON.stringify(item.fieldClocks),
      ],
    );
  }

  async stats(): Promise<CollectionStats> {
    const db = this.handle();
    const totals = await db.getFirstAsync<{ copyCount: number; totalSpentCents: number | null }>(
      "SELECT COUNT(*) AS copyCount, SUM(COALESCE(pricePaidCents, 0)) AS totalSpentCents FROM copies WHERE deletedAt IS NULL",
    );
    const groups = await db.getFirstAsync<{ releaseGroupCount: number }>(
      `SELECT COUNT(DISTINCT r.releaseGroupMbid) AS releaseGroupCount
       FROM copies c JOIN releases r ON r.mbid = c.releaseMbid WHERE c.deletedAt IS NULL`,
    );
    const perFormat = await db.getAllAsync<{ format: string; n: number }>(
      `SELECT r.format AS format, COUNT(*) AS n
       FROM copies c JOIN releases r ON r.mbid = c.releaseMbid
       WHERE c.deletedAt IS NULL GROUP BY r.format`,
    );

    const byFormat = Object.fromEntries(FORMATS.map((format) => [format, 0])) as Record<Format, number>;
    for (const row of perFormat) {
      if ((FORMATS as readonly string[]).includes(row.format)) {
        byFormat[row.format as Format] = row.n;
      }
    }

    const copyCount = totals?.copyCount ?? 0;
    const totalSpentCents = totals?.totalSpentCents ?? 0;
    return {
      copyCount,
      releaseGroupCount: groups?.releaseGroupCount ?? 0,
      totalSpentCents,
      averageSpentCents: copyCount === 0 ? 0 : Math.round(totalSpentCents / copyCount),
      byFormat,
    };
  }

  async deviceId(): Promise<string> {
    const existing = await this.readMeta(DEVICE_ID_KEY);
    if (existing !== undefined) return existing;
    const generated = Crypto.randomUUID();
    await this.writeMeta(DEVICE_ID_KEY, generated);
    return generated;
  }

  async readClock(): Promise<string | undefined> {
    return this.readMeta(CLOCK_KEY);
  }

  async writeClock(encoded: string): Promise<void> {
    await this.writeMeta(CLOCK_KEY, encoded);
  }

  async readSyncCursor(): Promise<number> {
    const stored = await this.readMeta(CURSOR_KEY);
    return stored === undefined ? 0 : Number.parseInt(stored, 10);
  }

  async writeSyncCursor(cursor: number): Promise<void> {
    await this.writeMeta(CURSOR_KEY, String(cursor));
  }

  async readPendingIds(): Promise<string[]> {
    const stored = await this.readMeta(PENDING_KEY);
    return stored === undefined ? [] : (JSON.parse(stored) as string[]);
  }

  async writePendingIds(ids: readonly string[]): Promise<void> {
    await this.writeMeta(PENDING_KEY, JSON.stringify(ids));
  }

  private async readMeta(key: string): Promise<string | undefined> {
    const row = await this.handle().getFirstAsync<{ value: string }>(
      "SELECT value FROM meta WHERE key = ?",
      [key],
    );
    return row?.value;
  }

  private async writeMeta(key: string, value: string): Promise<void> {
    await this.handle().runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [key, value]);
  }
}

interface CopyRow extends Omit<Copy, "fieldClocks"> {
  fieldClocks: string;
}

interface ReleaseRow extends Omit<Release, "coverTheme"> {
  coverTheme: string | null;
}

type WishRow = Omit<WishlistItem, "desiredFormat" | "fieldClocks"> & {
  desiredFormat: string | null;
  fieldClocks: string;
};

function toCopy(row: CopyRow): Copy {
  return { ...row, fieldClocks: JSON.parse(row.fieldClocks) as Copy["fieldClocks"] };
}

function toWish(row: WishRow): WishlistItem {
  return {
    ...row,
    desiredFormat: row.desiredFormat as Format | null,
    fieldClocks: JSON.parse(row.fieldClocks) as WishlistItem["fieldClocks"],
  };
}

function toRelease(row: ReleaseRow): Release {
  return {
    ...row,
    format: row.format as Format,
    coverTheme: row.coverTheme === null ? null : (JSON.parse(row.coverTheme) as Release["coverTheme"]),
  };
}
