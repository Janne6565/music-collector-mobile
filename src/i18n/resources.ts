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
  wishlist: {
    count: "{{count}} items",
    empty: "Nothing on the wishlist yet.",
    gotIt: "Got it",
    remove: "Remove from wishlist",
    collectFailed: "Could not find that release to add. Try adding it from search instead.",
    addToWishlist: "Add to wishlist",
  },
  profile: {
    collectingSince: "Collecting since {{year}}",
    copies: "{{count}} copies",
    totalSpent: "total spent",
    averagePerCopy: "average per copy",
    exportNote: "Music Collector 1.0 · your collection lives on this device",
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
    conflict: {
      title: "Also written on another device",
      keepThis: "Keep this one",
      keepMine: "Keep mine",
    },
    otherCopies: "Other copies you own",
    remove: "Remove from library",
  },
  auth: {
    signInTitle: "Sign in",
    createTitle: "Create an account",
    optional: "An account is optional. It only syncs your collection across devices — everything works without one.",
    email: "E-mail",
    password: "Password",
    signIn: "Sign in",
    create: "Create account",
    needAccount: "No account yet? Create one",
    haveAccount: "Already have an account? Sign in",
    signOut: "Sign out",
    signOutKeepsData: "Your collection stays on this device.",
    syncing: "Your collection syncs across your devices.",
    error: {
      badCredentials: "That e-mail address and password do not match.",
      emailTaken: "That e-mail address is already registered.",
      generic: "Something went wrong. Try again in a moment.",
    },
  },
  firstSync: {
    title: "You already have a collection here",
    lede: "Choose what to do before anything is synced.",
    merge: { title: "Merge them", body: "Keep everything from both." },
    keepLocal: { title: "Keep this device" },
    keepLocalShort: "Discards what is only in your account.",
    keepAccount: { title: "Keep the account" },
    keepAccountShort: "Discards what is only on this device.",
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
  wishlist: {
    count: "{{count}} Einträge",
    empty: "Noch nichts auf der Wunschliste.",
    gotIt: "Hab ich",
    remove: "Von der Wunschliste entfernen",
    collectFailed: "Die Veröffentlichung wurde nicht gefunden. Füge sie über die Suche hinzu.",
    addToWishlist: "Auf die Wunschliste",
  },
  profile: {
    collectingSince: "Sammelt seit {{year}}",
    copies: "{{count}} Exemplare",
    totalSpent: "insgesamt ausgegeben",
    averagePerCopy: "im Schnitt pro Exemplar",
    exportNote: "Music Collector 1.0 · deine Sammlung liegt auf diesem Gerät",
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
    conflict: {
      title: "Auch auf einem anderen Gerät geschrieben",
      keepThis: "Diese behalten",
      keepMine: "Meine behalten",
    },
    otherCopies: "Weitere Exemplare, die du besitzt",
    remove: "Aus der Sammlung entfernen",
  },
  auth: {
    signInTitle: "Anmelden",
    createTitle: "Konto erstellen",
    optional: "Ein Konto ist optional. Es synchronisiert nur deine Sammlung zwischen Geräten — alles funktioniert auch ohne.",
    email: "E-Mail",
    password: "Passwort",
    signIn: "Anmelden",
    create: "Konto erstellen",
    needAccount: "Noch kein Konto? Jetzt erstellen",
    haveAccount: "Schon ein Konto? Anmelden",
    signOut: "Abmelden",
    signOutKeepsData: "Deine Sammlung bleibt auf diesem Gerät.",
    syncing: "Deine Sammlung wird zwischen deinen Geräten synchronisiert.",
    error: {
      badCredentials: "E-Mail-Adresse und Passwort passen nicht zusammen.",
      emailTaken: "Diese E-Mail-Adresse ist bereits registriert.",
      generic: "Da ist etwas schiefgegangen. Versuche es gleich noch einmal.",
    },
  },
  firstSync: {
    title: "Auf diesem Gerät gibt es schon eine Sammlung",
    lede: "Wähle, was passieren soll, bevor synchronisiert wird.",
    merge: { title: "Zusammenführen", body: "Alles von beiden Seiten behalten." },
    keepLocal: { title: "Dieses Gerät behalten" },
    keepLocalShort: "Verwirft, was nur im Konto ist.",
    keepAccount: { title: "Konto behalten" },
    keepAccountShort: "Verwirft, was nur auf diesem Gerät ist.",
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
