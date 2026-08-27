import { useStore } from "@/local/StoreProvider";
import { readDocumentLanguage, writeDocumentLanguage } from "@/local/settings";
import type { LegalLanguage } from "@janne6565/rekordo-shared";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Which language the legal documents are read in, on this device.
 *
 * A device preference rather than a route parameter: opening the Datenschutzerklärung
 * should land you on the version you read the last one in, and a `?lang=` on every legal
 * route would make two different links to the same document.
 */
export function useLegalLanguage() {
  const { store } = useStore();
  const { i18n } = useTranslation();
  // German until the store answers. The document is always drawn — a legal screen that
  // flashes empty while a preference loads is one somebody screenshots empty.
  const [language, setLanguage] = useState<LegalLanguage>("de");

  useEffect(() => {
    let cancelled = false;
    void readDocumentLanguage(store, i18n.language).then((stored) => {
      if (!cancelled) setLanguage(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [store, i18n.language]);

  const choose = useCallback(
    (next: LegalLanguage) => {
      // Set first, persisted after: the switch has to answer the tap, and a write to
      // SQLite that fails is not a reason to leave the reader on the other language.
      setLanguage(next);
      void writeDocumentLanguage(store, next);
    },
    [store],
  );

  return { language, choose };
}
