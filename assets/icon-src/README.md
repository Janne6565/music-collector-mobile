# App icon sources

The app icon is the record mark the web app also uses as its favicon
(`music-collector-frontend/public/favicon.svg`) — the placeholder sleeve with its disc
glyph, and a CD leaning out from behind it on the right, in `ink`/`canvas` from the design
deck. Change it here and change it there in the same commit, the way `src/theme/colors.ts`
mirrors `src/styles.css`.

The `.svg` files are the source; the `.png` siblings in `assets/` are what Expo consumes
and are checked in. Regenerate them with any SVG rasteriser that keeps the alpha channel
(macOS `qlmanage` does **not** — it flattens transparency onto white):

    pip install cairosvg
    python -c "import cairosvg; cairosvg.svg2png(url='icon.svg', write_to='../icon.png', output_width=1024, output_height=1024)"

Sizes: `icon` 1024 (opaque — iOS rejects an alpha channel), `android-icon-foreground` and
`android-icon-background` 512, `android-icon-monochrome` 432, `splash-icon` 1024,
`notification-icon` 96.

Two constraints shape the geometry, and both are why the mark is not simply the deck
artwork dropped in at full bleed:

- The mark is wider than it is tall, so what bounds it on Android is its **diagonal**, not
  its width. Foreground, monochrome and notification art is scaled until that diagonal sits
  inside the 66/108 safe-zone circle, which is what keeps the disc from being sliced off
  under a round mask.
- `cairosvg` silently ignores `<mask>` — it emits a solid rectangle rather than failing, so
  the damage looks like a rendering choice rather than a bug. The single-colour sources
  (`android-icon-monochrome`, `notification-icon`) therefore carry no mask at all: the disc
  glyph is punched out of the sleeve by `fill-rule="evenodd"` on one compound path, and the
  CD is drawn as the segment of itself that clears the sleeve's right edge. Keep it that
  way, or check the alpha channel of the output before trusting it.

`splash-icon.png` **is** wired up, through the `expo-splash-screen` plugin in `app.json`.
It differs from `icon.png` in one way that matters: the mark sits on a rounded ink tile
with transparency around it, because it is drawn *on* the launch background (`paper`,
`#faf8f5`) rather than filling the screen. `imageWidth` is the tile's width in points, not
the file's pixels. Changing it needs a native build — a splash is compiled into the
launch storyboard, so an over-the-air update cannot carry it.
