import * as FileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import type { CollectionStats, Copy, Format, Photo, Release, WishlistItem } from "@janne6565/music-collector-shared";
import {
  FORMATS,
  isManualReleaseId,
  manualRelease,
  manualReleaseCopyId,
} from "@janne6565/music-collector-shared";
import type { LibraryFilter, LocalStore } from "@/local/LocalStore";

const DATABASE = "music-collector.db";
const PHOTO_DIR = `${FileSystem.documentDirectory}photos/`;

function photoPath(id: string): string {
  return `${PHOTO_DIR}${id}`;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** React Native has no btoa/atob for binary, so the two conversions are explicit. */
function encodeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i] as number) << 16 | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += BASE64[(chunk >> 18) & 63];
    out += BASE64[(chunk >> 12) & 63];
    out += i + 1 < bytes.length ? BASE64[(chunk >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? BASE64[chunk & 63] : "=";
  }
  return out;
}

function decodeBase64(value: string): Uint8Array {
  const clean = value.replace(/=+$/, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let out = 0;
  for (const char of clean) {
    buffer = (buffer << 6) | BASE64.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[out++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}
const DEVICE_ID_KEY = "deviceId";
const CLOCK_KEY = "clock";
const CURSOR_KEY = "syncCursor";
const PENDING_KEY = "pendingIds";
/** Namespaced, so a preference can never collide with the sync bookkeeping above. */
const SETTING_PREFIX = "setting:";

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
        releaseId     TEXT NOT NULL,
        manualTitle     TEXT,
        manualArtist    TEXT,
        manualYear      INTEGER,
        manualLabel     TEXT,
        manualCatalogNumber TEXT,
        manualFormat    TEXT,
        condition       TEXT,
        sleeveCondition TEXT,
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
      CREATE INDEX IF NOT EXISTS copies_release_idx ON copies (releaseId);
      CREATE INDEX IF NOT EXISTS copies_alive_idx ON copies (deletedAt);

      CREATE TABLE IF NOT EXISTS releases (
        id               TEXT PRIMARY KEY NOT NULL,
        albumId TEXT NOT NULL,
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
      CREATE INDEX IF NOT EXISTS releases_group_idx ON releases (albumId);

      CREATE TABLE IF NOT EXISTS wishlist (
        id               TEXT PRIMARY KEY NOT NULL,
        albumId TEXT NOT NULL,
        title            TEXT NOT NULL,
        artistName       TEXT NOT NULL,
        year             INTEGER,
        desiredFormat    TEXT,
        note             TEXT,
        createdAt        INTEGER NOT NULL,
        deletedAt        INTEGER,
        fieldClocks      TEXT NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS wishlist_group_idx ON wishlist (albumId);

      CREATE TABLE IF NOT EXISTS photos (
        id            TEXT PRIMARY KEY NOT NULL,
        copyId        TEXT NOT NULL,
        storageKey    TEXT,
        contentType   TEXT NOT NULL,
        byteSize      INTEGER NOT NULL,
        sortIndex     INTEGER NOT NULL,
        createdAt     INTEGER NOT NULL,
        deletedAt     INTEGER,
        fieldClocks   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS photos_copy_idx ON photos (copyId);

      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    // `CREATE TABLE IF NOT EXISTS` leaves an existing database on its old shape, so a column
    // added later has to be added explicitly. PRAGMA rather than a version number: it asks
    // the database what it actually has, which cannot drift the way a stored version can.
    const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(copies)");
    if (!columns.some((column) => column.name === "sleeveCondition")) {
      await db.execAsync("ALTER TABLE copies ADD COLUMN sleeveCondition TEXT");
    }
    // The pressing a hand-entered copy describes itself (14a). Columns rather than a blob
    // so the library's filter, search and sort can keep being one SQL statement.
    if (!columns.some((column) => column.name === "manualTitle")) {
      await db.execAsync(`
        ALTER TABLE copies ADD COLUMN manualTitle TEXT;
        ALTER TABLE copies ADD COLUMN manualArtist TEXT;
        ALTER TABLE copies ADD COLUMN manualYear INTEGER;
        ALTER TABLE copies ADD COLUMN manualLabel TEXT;
        ALTER TABLE copies ADD COLUMN manualCatalogNumber TEXT;
        ALTER TABLE copies ADD COLUMN manualFormat TEXT;
      `);
    }
    await this.qualifyIds(db, columns);
    this.db = db;
  }

  /**
   * Ids become source-qualified, because the app now reads two catalogues.
   *
   * Every id written before today came from MusicBrainz, so prefixing is exactly right and
   * nothing is lost. SQLite can rename a column in place, primary key included, which is
   * why this is three statements rather than a table rebuild.
   *
   * The field clocks are keyed by field name, so a clock left under the old key would read
   * as never-set — losing every edit that field has ever won in a merge.
   */
  private async qualifyIds(
    db: SQLite.SQLiteDatabase,
    copyColumns: readonly { name: string }[],
  ): Promise<void> {
    if (!copyColumns.some((column) => column.name === "releaseMbid")) {
      return;
    }
    await db.execAsync(`
      ALTER TABLE copies   RENAME COLUMN releaseMbid TO releaseId;
      ALTER TABLE releases RENAME COLUMN mbid TO id;
      ALTER TABLE releases RENAME COLUMN releaseGroupMbid TO albumId;
      ALTER TABLE wishlist RENAME COLUMN releaseGroupMbid TO albumId;

      UPDATE copies   SET releaseId = 'musicbrainz:' || releaseId WHERE releaseId NOT LIKE '%:%';
      UPDATE releases SET id        = 'musicbrainz:' || id        WHERE id        NOT LIKE '%:%';
      UPDATE releases SET albumId   = 'musicbrainz:' || albumId   WHERE albumId   NOT LIKE '%:%';
      UPDATE wishlist SET albumId   = 'musicbrainz:' || albumId   WHERE albumId   NOT LIKE '%:%';

      UPDATE copies
         SET fieldClocks = replace(fieldClocks, '"releaseMbid"', '"releaseId"')
       WHERE fieldClocks LIKE '%"releaseMbid"%';
      UPDATE wishlist
         SET fieldClocks = replace(fieldClocks, '"releaseGroupMbid"', '"albumId"')
       WHERE fieldClocks LIKE '%"releaseGroupMbid"%';
    `);
  }

  async listCopies(filter: LibraryFilter = {}): Promise<Copy[]> {
    const clauses = ["c.deletedAt IS NULL"];
    const params: (string | number)[] = [];

    // A hand-entered copy joins to no release row — it *is* its release — so every
    // reference to the archive's columns falls back to the copy's own.
    const title = "COALESCE(r.title, c.manualTitle)";
    const artist = "COALESCE(r.artistName, c.manualArtist)";

    if (filter.format !== undefined && filter.format !== "ALL") {
      // The copy's own format first: it overrides the archive's where it is set.
      clauses.push("COALESCE(c.manualFormat, r.format) = ?");
      params.push(filter.format);
    }
    const term = filter.search?.trim();
    if (term !== undefined && term !== "") {
      clauses.push(
        `(${title} LIKE ? OR ${artist} LIKE ? OR COALESCE(r.catalogNumber, c.manualCatalogNumber) LIKE ? OR c.notes LIKE ?)`,
      );
      const like = `%${term}%`;
      params.push(like, like, like, like);
    }

    const order =
      filter.sort === "ARTIST_ASC"
        ? `${artist} COLLATE NOCASE ASC`
        : filter.sort === "YEAR_DESC"
          ? "COALESCE(r.year, c.manualYear) DESC"
          : "c.createdAt DESC";

    const rows = await this.handle().getAllAsync<CopyRow>(
      `SELECT c.* FROM copies c LEFT JOIN releases r ON r.id = c.releaseId
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

  async listCopiesInReleaseGroup(albumId: string): Promise<Copy[]> {
    // A hand-entered pressing is its own album, under its own copy's id, so it is found
    // directly rather than through a `releases` row it does not have.
    const manualCopyId = manualReleaseCopyId(albumId);
    if (manualCopyId !== null) {
      const row = await this.handle().getFirstAsync<CopyRow>(
        "SELECT * FROM copies WHERE id = ? AND deletedAt IS NULL",
        [manualCopyId],
      );
      return row === null ? [] : [toCopy(row)];
    }
    const rows = await this.handle().getAllAsync<CopyRow>(
      `SELECT c.* FROM copies c JOIN releases r ON r.id = c.releaseId
       WHERE r.albumId = ? AND c.deletedAt IS NULL`,
      [albumId],
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
        (id, releaseId, manualTitle, manualArtist, manualYear, manualLabel,
         manualCatalogNumber, manualFormat, condition, sleeveCondition, pricePaidCents,
         currency, purchasedOn, purchasedAt, notes, notesConflict, rating, createdAt,
         deletedAt, fieldClocks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        copy.id,
        copy.releaseId,
        copy.manualTitle,
        copy.manualArtist,
        copy.manualYear,
        copy.manualLabel,
        copy.manualCatalogNumber,
        copy.manualFormat,
        copy.condition,
        copy.sleeveCondition,
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
            (id, albumId, title, artistName, year, format, label, catalogNumber,
             country, barcode, coverArtUrl, coverTheme, cachedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            release.id,
            release.albumId,
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

  async getRelease(releaseId: string): Promise<Release | undefined> {
    // A manual release is never cached: it is derived from the copy that describes it, so
    // that a device which pulled the copy resolves it with no cache row at all.
    const copyId = manualReleaseCopyId(releaseId);
    if (copyId !== null) {
      const row = await this.handle().getFirstAsync<CopyRow>("SELECT * FROM copies WHERE id = ?", [
        copyId,
      ]);
      return row === null ? undefined : manualRelease(toCopy(row));
    }
    const row = await this.handle().getFirstAsync<ReleaseRow>("SELECT * FROM releases WHERE id = ?", [releaseId]);
    return row === null ? undefined : toRelease(row);
  }

  async getReleases(releaseIds: readonly string[]): Promise<Map<string, Release>> {
    const unique = [...new Set(releaseIds)];
    if (unique.length === 0) return new Map();
    const found = new Map<string, Release>();

    const manualCopyIds = unique
      .map(manualReleaseCopyId)
      .filter((id): id is string => id !== null);
    if (manualCopyIds.length > 0) {
      const copies = await this.handle().getAllAsync<CopyRow>(
        `SELECT * FROM copies WHERE id IN (${manualCopyIds.map(() => "?").join(",")})`,
        manualCopyIds,
      );
      for (const row of copies) {
        const copy = toCopy(row);
        found.set(copy.releaseId, manualRelease(copy));
      }
    }

    const cachedIds = unique.filter((id) => !isManualReleaseId(id));
    if (cachedIds.length > 0) {
      const rows = await this.handle().getAllAsync<ReleaseRow>(
        `SELECT * FROM releases WHERE id IN (${cachedIds.map(() => "?").join(",")})`,
        cachedIds,
      );
      for (const row of rows) found.set(row.id, toRelease(row));
    }
    return found;
  }

  async listPhotos(copyId: string): Promise<Photo[]> {
    const rows = await this.handle().getAllAsync<PhotoRow>(
      "SELECT * FROM photos WHERE copyId = ? AND deletedAt IS NULL ORDER BY sortIndex ASC",
      [copyId],
    );
    return rows.map(toPhoto);
  }

  async listCoverPhotos(copyIds: readonly string[]): Promise<Map<string, Photo>> {
    // An IN () with nothing in it is a syntax error, and the callers hit it on first paint.
    if (copyIds.length === 0) return new Map();
    const rows = await this.handle().getAllAsync<PhotoRow>(
      `SELECT * FROM photos WHERE deletedAt IS NULL AND copyId IN (${copyIds.map(() => "?").join(",")}) ORDER BY sortIndex ASC`,
      copyIds as string[],
    );

    const first = new Map<string, Photo>();
    // Ordered by sortIndex, so the first row seen for a copy is the one the strip shows
    // first — the same picture on the shelf as on the detail screen.
    for (const row of rows) {
      if (!first.has(row.copyId)) first.set(row.copyId, toPhoto(row));
    }
    return first;
  }

  async getPhotoIncludingDeleted(id: string): Promise<Photo | undefined> {
    const row = await this.handle().getFirstAsync<PhotoRow>("SELECT * FROM photos WHERE id = ?", [id]);
    return row === null ? undefined : toPhoto(row);
  }

  async listPhotosAwaitingUpload(): Promise<Photo[]> {
    const rows = await this.handle().getAllAsync<PhotoRow>(
      "SELECT * FROM photos WHERE storageKey IS NULL AND deletedAt IS NULL",
    );
    // Only those whose bytes are actually on this device; a photo pulled from elsewhere
    // has nothing to upload and retrying it forever would be pointless.
    const withBytes: Photo[] = [];
    for (const row of rows) {
      const info = await FileSystem.getInfoAsync(photoPath(row.id));
      if (info.exists) withBytes.push(toPhoto(row));
    }
    return withBytes;
  }

  async putPhoto(photo: Photo): Promise<void> {
    await this.writePhoto(photo);
    await this.markPending(photo.id);
  }

  async adoptPhoto(photo: Photo): Promise<void> {
    await this.writePhoto(photo);
  }

  private async writePhoto(photo: Photo): Promise<void> {
    await this.handle().runAsync(
      `INSERT OR REPLACE INTO photos
        (id, copyId, storageKey, contentType, byteSize, sortIndex, createdAt, deletedAt, fieldClocks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        photo.id,
        photo.copyId,
        photo.storageKey,
        photo.contentType,
        photo.byteSize,
        photo.sortIndex,
        photo.createdAt,
        photo.deletedAt,
        JSON.stringify(photo.fieldClocks),
      ],
    );
  }

  /**
   * Image bytes go to the filesystem, not into SQLite: a few megabytes per row would
   * bloat the database and slow down every unrelated query that walks it.
   */
  async putPhotoBytes(id: string, buffer: ArrayBuffer, _contentType: string): Promise<void> {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true }).catch(() => undefined);
    await FileSystem.writeAsStringAsync(photoPath(id), encodeBase64(buffer), {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  async getPhotoBytes(id: string): Promise<Blob | undefined> {
    const info = await FileSystem.getInfoAsync(photoPath(id));
    if (!info.exists) return undefined;
    const base64 = await FileSystem.readAsStringAsync(photoPath(id), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return new Blob([decodeBase64(base64).buffer as ArrayBuffer]);
  }

  /** The on-device file URI, which is what an Image component renders from. */
  photoUri(id: string): string {
    return photoPath(id);
  }

  async deletePhotoBytes(id: string): Promise<void> {
    await FileSystem.deleteAsync(photoPath(id), { idempotent: true }).catch(() => undefined);
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

  async wishlistHas(albumId: string): Promise<boolean> {
    const row = await this.handle().getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM wishlist WHERE albumId = ? AND deletedAt IS NULL",
      [albumId],
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
        (id, albumId, title, artistName, year, desiredFormat, note, createdAt, deletedAt, fieldClocks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.albumId,
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
      // LEFT JOIN, and a hand-entered copy counts as its own album: an inner join drops
      // every manual copy out of the count, so a shelf of nothing but bootlegs would
      // report zero releases.
      `SELECT COUNT(DISTINCT COALESCE(r.albumId, c.releaseId)) AS releaseGroupCount
       FROM copies c LEFT JOIN releases r ON r.id = c.releaseId WHERE c.deletedAt IS NULL`,
    );
    const perFormat = await db.getAllAsync<{ format: string; n: number }>(
      `SELECT COALESCE(c.manualFormat, r.format) AS format, COUNT(*) AS n
       FROM copies c LEFT JOIN releases r ON r.id = c.releaseId
       WHERE c.deletedAt IS NULL GROUP BY COALESCE(c.manualFormat, r.format)`,
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

  async readSetting(key: string): Promise<string | undefined> {
    return (await this.readMeta(`${SETTING_PREFIX}${key}`)) ?? undefined;
  }

  async writeSetting(key: string, value: string): Promise<void> {
    await this.writeMeta(`${SETTING_PREFIX}${key}`, value);
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

type PhotoRow = Omit<Photo, "fieldClocks"> & { fieldClocks: string };

type WishRow = Omit<WishlistItem, "desiredFormat" | "fieldClocks"> & {
  desiredFormat: string | null;
  fieldClocks: string;
};

function toCopy(row: CopyRow): Copy {
  return { ...row, fieldClocks: JSON.parse(row.fieldClocks) as Copy["fieldClocks"] };
}

function toPhoto(row: PhotoRow): Photo {
  return { ...row, fieldClocks: JSON.parse(row.fieldClocks) as Photo["fieldClocks"] };
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
