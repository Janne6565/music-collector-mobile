const enCommon = {
  app: {
    name: "Music Collector",
  },
  nav: {
    library: "Library",
    wishlist: "Wishlist",
    you: "You",
  },
  format: {
    all: "All",
    vinyl: "Vinyl",
    cd: "CD",
    cassette: "Cassette",
    digital: "Digital",
    other: "Other",
  },
  library: {
    itemCount: "{{count}} items",
    addItem: "Add item",
    noMatches: "No items match this filter.",
    empty: {
      title: "Nothing here yet",
      body: "Scan a barcode or search to add your first record, tape, disc or download.",
    },
  },
  add: {
    title: "Add item",
    searchPlaceholder: "Search for a release or artist",
    scan: "Scan a barcode",
    scanHint: "Point the camera at the barcode on the sleeve or case.",
    hint: "Search by artist and title, or scan the barcode.",
    searching: "Searching MusicBrainz…",
    failed: "Could not reach the release database. Try again in a moment.",
    noResults: "Nothing found for that search.",
    add: "Add to library",
  },
  detail: {
    back: "Library",
    notFound: "That item is no longer in your collection.",
    condition: "Condition",
    paid: "Paid",
    bought: "Bought",
    where: "Where",
    notes: "Notes",
    notesEmpty: "No notes yet.",
    otherCopies: "Other copies you own",
    remove: "Remove from library",
  },
  common: {
    cancel: "Cancel",
    unknownYear: "Year unknown",
  },
  scaffold: {
    comingInPhaseTwo: "This screen arrives with the local-first core.",
  },
} as const;

/** Maps every leaf to `string` while preserving the nested shape. */
type DeepStringSchema<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringSchema<T[K]>;
};
type CommonSchema = DeepStringSchema<typeof enCommon>;

const deCommon: CommonSchema = {
  app: {
    name: "Music Collector",
  },
  nav: {
    library: "Sammlung",
    wishlist: "Wunschliste",
    you: "Du",
  },
  format: {
    all: "Alle",
    vinyl: "Vinyl",
    cd: "CD",
    cassette: "Kassette",
    digital: "Digital",
    other: "Sonstige",
  },
  library: {
    itemCount: "{{count}} Exemplare",
    addItem: "Hinzufügen",
    noMatches: "Keine Einträge passen zu diesem Filter.",
    empty: {
      title: "Noch nichts da",
      body: "Scanne einen Barcode oder suche, um dein erstes Exemplar hinzuzufügen.",
    },
  },
  add: {
    title: "Hinzufügen",
    searchPlaceholder: "Nach Veröffentlichung oder Künstler suchen",
    scan: "Barcode scannen",
    scanHint: "Richte die Kamera auf den Barcode auf der Hülle.",
    hint: "Nach Künstler und Titel suchen oder den Barcode scannen.",
    searching: "Suche bei MusicBrainz…",
    failed: "Die Datenbank ist gerade nicht erreichbar. Versuche es gleich noch einmal.",
    noResults: "Nichts zu dieser Suche gefunden.",
    add: "Zur Sammlung",
  },
  detail: {
    back: "Sammlung",
    notFound: "Dieses Exemplar ist nicht mehr in deiner Sammlung.",
    condition: "Zustand",
    paid: "Bezahlt",
    bought: "Gekauft",
    where: "Wo",
    notes: "Notizen",
    notesEmpty: "Noch keine Notizen.",
    otherCopies: "Weitere Exemplare, die du besitzt",
    remove: "Aus der Sammlung entfernen",
  },
  common: {
    cancel: "Abbrechen",
    unknownYear: "Jahr unbekannt",
  },
  scaffold: {
    comingInPhaseTwo: "Dieser Screen kommt mit dem Local-First-Kern.",
  },
};

export const defaultNS = "common";
export const resources = { en: { common: enCommon }, de: { common: deCommon } } as const;
export type AppLanguage = keyof typeof resources;
