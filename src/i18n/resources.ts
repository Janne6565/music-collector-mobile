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
    vinyl: "Vinyl",
    cd: "CD",
    cassette: "Cassette",
    digital: "Digital",
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
    vinyl: "Vinyl",
    cd: "CD",
    cassette: "Kassette",
    digital: "Digital",
  },
  scaffold: {
    comingInPhaseTwo: "Dieser Screen kommt mit dem Local-First-Kern.",
  },
};

export const defaultNS = "common";
export const resources = { en: { common: enCommon }, de: { common: deCommon } } as const;
export type AppLanguage = keyof typeof resources;
