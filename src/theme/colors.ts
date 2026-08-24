/**
 * Design tokens from the Claude Design deck (project a1b6280a…).
 *
 * This mirrors `src/styles.css` in music-collector-frontend. The two apps are meant to
 * read as one product — change a token here and change it there in the same commit.
 */
export const colors = {
  canvas: "#efece6",
  paper: "#faf8f5",
  surface: "#ffffff",
  ink: "#191713",
  inkMuted: "rgba(25,23,19,0.55)",
  inkSubtle: "rgba(25,23,19,0.42)",
  line: "rgba(25,23,19,0.09)",
  accent: "#a2573a",
  accentHover: "#7d3f27",
  /** The darker accent the deck reserves for destructive wording ("Delete account"). */
  accentStrong: "#8c4530",

  /** Dark chrome — used by the cover-derived theme on item detail screens. */
  night: "#141311",
  nightRaised: "#191713",
  nightInk: "#ffffff",
  nightMuted: "rgba(255,255,255,0.55)",
  nightLine: "rgba(255,255,255,0.09)",
  accentNight: "#d08a5f",
} as const;

export const fonts = {
  sans: "Manrope",
  serif: "Newsreader",
} as const;

/**
 * The cover-theming rule from turn 3 of the deck: a sleeve whose dominant tone is darker
 * than this picks the dark chrome, anything lighter picks the light one. The threshold is
 * WCAG relative luminance, which the backend computes at import and returns with the release.
 */
export const DARK_CHROME_LUMINANCE_THRESHOLD = 0.55;
