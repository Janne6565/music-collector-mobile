import type { CurrencyCode } from "@/domain/currency";
import { useStore } from "@/local/StoreProvider";
import {
  type AppLanguage,
  clearRecentSearches,
  readAppLanguage,
  readDefaultCurrency,
  readDocumentLanguage,
  readLastSyncedAt,
  readRecentSearches,
  readSyncEnabled,
  writeAppLanguage,
  writeDefaultCurrency,
  writeDocumentLanguage,
  writeSyncEnabled,
} from "@/local/settings";
import { useAppSelector } from "@/store/hooks";
import type { LegalLanguage } from "@janne6565/rekordo-shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NativeModules, Platform } from "react-native";

/**
 * Screen 20h — Settings, a stacked route off the You tab.
 *
 * The same six preferences as the web (20a), all device-local and deliberately unsynced: a
 * preference is a statement about *this phone*, and syncing "sync is off here" would switch
 * it off everywhere — including, absurdly, disabling the sync that would carry the change
 * back. The screen says so once, in the header, rather than warning per row.
 *
 * Mirrors rekordo-frontend/src/features/settings/useSettingsLogic.ts. The two are
 * drawn very differently but must decide the same things.
 */

export type RowState = "idle" | "saved" | "failed";

/** How long "Saved" stays next to a control (20b), and "N cleared" (20c). */
const ACKNOWLEDGEMENT_MS = 4_000;

export interface SettingsValues {
  readonly appLanguage: AppLanguage;
  readonly documentLanguage: LegalLanguage;
  readonly currency: CurrencyCode;
  readonly syncEnabled: boolean;
  readonly lastSyncedAt: number | null;
  readonly recentSearches: number;
}

export function useSettingsLogic() {
  const { store } = useStore();
  const { i18n } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);

  const [values, setValues] = useState<SettingsValues | undefined>(undefined);
  const [copyCount, setCopyCount] = useState(0);
  const [states, setStates] = useState<Readonly<Record<string, RowState>>>({});
  const [cleared, setCleared] = useState<number | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const read = useCallback(async () => {
    const [appLanguage, documentLanguage, currency, syncEnabled, lastSyncedAt, searches, stats] =
      await Promise.all([
        readAppLanguage(store),
        readDocumentLanguage(store, i18n.language),
        readDefaultCurrency(store),
        readSyncEnabled(store),
        readLastSyncedAt(store),
        readRecentSearches(store),
        store.stats(),
      ]);
    setCopyCount(stats.copyCount);
    setValues({
      appLanguage,
      documentLanguage,
      currency,
      syncEnabled,
      lastSyncedAt,
      recentSearches: searches.length,
    });
  }, [store, i18n.language]);

  useEffect(() => {
    void read();
  }, [read]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, []);

  const acknowledge = useCallback((row: string, state: RowState) => {
    setStates((current) => ({ ...current, [row]: state }));
    const existing = timers.current.get(row);
    if (existing !== undefined) clearTimeout(existing);
    // A failure stays until the next attempt: it is not news that expires, it is the
    // current state of the setting.
    if (state !== "saved") return;
    timers.current.set(
      row,
      setTimeout(() => setStates((current) => ({ ...current, [row]: "idle" })), ACKNOWLEDGEMENT_MS),
    );
  }, []);

  /**
   * One save path for every row.
   *
   * Writes go to SQLite, which genuinely fails when the phone is out of space. The values
   * are re-read either way, so a failed write leaves the control showing what is actually
   * stored rather than the value that did not save.
   */
  const save = useCallback(
    async (row: string, write: () => Promise<void>) => {
      try {
        await write();
        await read();
        acknowledge(row, "saved");
      } catch {
        await read().catch(() => undefined);
        acknowledge(row, "failed");
      }
    },
    [read, acknowledge],
  );

  return {
    signedIn: user !== null,
    values,
    copyCount,
    state: (row: string): RowState => states[row] ?? "idle",
    cleared,
    setAppLanguage: (language: AppLanguage) =>
      void save("appLanguage", async () => {
        await writeAppLanguage(store, language);
        // Applied straight away rather than on the next launch: a language picker that
        // needs a restart to take effect reads as one that did not work.
        await i18n.changeLanguage(language === "system" ? systemLanguage() : language);
      }),
    setDocumentLanguage: (language: LegalLanguage) =>
      void save("documentLanguage", () => writeDocumentLanguage(store, language)),
    setCurrency: (currency: CurrencyCode) =>
      void save("currency", () => writeDefaultCurrency(store, currency)),
    setSyncEnabled: (enabled: boolean) => void save("sync", () => writeSyncEnabled(store, enabled)),
    /**
     * Clearing the searches, with the acknowledgement standing in for the button (20c).
     *
     * No confirmation: six remembered strings are not worth one, and a dialog here would
     * teach people to dismiss dialogs on this screen. The row says how many went, then
     * settles into the empty wording with no control at all — never a button that does
     * nothing.
     */
    clearSearches: () =>
      void save("searches", async () => {
        const going = (await readRecentSearches(store)).length;
        await clearRecentSearches(store);
        setCleared(going);
        setTimeout(() => setCleared(null), ACKNOWLEDGEMENT_MS);
      }),
    reload: read,
  };
}

/**
 * What "System" resolves to.
 *
 * Read from the OS rather than from i18n, which is already showing the *result* of this
 * question — asking it would answer itself. The app ships two languages; everything else
 * is German.
 */
export function systemLanguage(): "en" | "de" {
  const locale =
    Platform.OS === "ios"
      ? (NativeModules.SettingsManager?.settings?.AppleLocale ??
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ??
        "")
      : (NativeModules.I18nManager?.localeIdentifier ?? "");
  return String(locale).toLowerCase().startsWith("en") ? "en" : "de";
}
