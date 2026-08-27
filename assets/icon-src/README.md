# App icon sources

The app icon is the same record-shelf mark the web app uses as its favicon
(`rekordo-frontend/public/favicon.svg`) — three upright spines plus one leaning,
in `canvas`/`ink` from the design deck. Change it here and change it there in the same
commit, the way `src/theme/colors.ts` mirrors `src/styles.css`.

The `.svg` files are the source; the `.png` siblings in `assets/` are what Expo consumes
and are checked in. Regenerate them with any SVG rasteriser that keeps the alpha channel
(macOS `qlmanage` does **not** — it flattens transparency onto white):

    pip install cairosvg
    python -c "import cairosvg; cairosvg.svg2png(url='icon.svg', write_to='../icon.png', output_width=1024, output_height=1024)"

Sizes: `icon` 1024 (opaque — iOS rejects an alpha channel), `android-icon-foreground`
and `android-icon-background` 512, `android-icon-monochrome` 432, `splash-icon` 1024.
The Android foreground and monochrome art is scaled to stay inside the 66/108 safe-zone
circle, so nothing is clipped under a round mask.

`splash-icon.png` is not wired up — there is no `splash` key and no `expo-splash-screen`
plugin in `app.json`. It is kept in sync so it is correct if it ever is.
