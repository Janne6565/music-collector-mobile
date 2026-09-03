/**
 * Design tokens from the Claude Design deck (project a1b6280a…).
 *
 * This mirrors `src/styles.css` in rekordo-frontend. The two apps are meant to
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

/**
 * The two families, by the name the embedded faces carry.
 *
 * Shipped in `assets/fonts` and registered through the `expo-font` plugin in `app.json`,
 * so they are in the binary before the first frame. They were named here long before they
 * were shipped, and an unknown family is not an error on either platform -- it is a silent
 * fall back to the system font, which is what every build did until 2026-09-03.
 *
 * `sans` carries weights 400, 500, 600 and 700; `serif` only 400. A `fontWeight` outside
 * that set does not fail, it just draws the nearest face that is there. See
 * `assets/fonts/README.md`.
 */
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
