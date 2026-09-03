# The app's two typefaces

Manrope for everything the app says, Newsreader for the titles. The same pair the web
frontend loads from Google Fonts, so the two clients read as one product.

These files were never here before. `src/theme/colors.ts` has named them since the first
turn of the deck, but nothing ever shipped them: on iOS an unknown `fontFamily` falls back
to San Francisco without a word, so every screen in every build, including the ones in the
App Store, was drawn in the system font. Reported 2026-09-03, from a screenshot.

## Where they came from

Both are the canonical Google Fonts originals, which are variable fonts:

- `ofl/manrope/Manrope[wght].ttf` (wght 200..800)
- `ofl/newsreader/Newsreader[opsz,wght].ttf` (wght 200..800, opsz 6..72)

React Native picks a face, not an axis position, so each one here is a static instance cut
from those files with `fonttools varLib.instancer`. The weights are the ones the app
actually asks for and no others; a face nothing references is a megabyte in the binary for
nothing.

| File | Instanced at |
| --- | --- |
| `Manrope-Regular.ttf` | wght 400 |
| `Manrope-Medium.ttf` | wght 500 |
| `Manrope-SemiBold.ttf` | wght 600 |
| `Manrope-Bold.ttf` | wght 700 |
| `Newsreader-Regular.ttf` | wght 400, opsz 24 |

Newsreader is a title face here and nothing else, used between 17 and 34pt with a median of
24, so it is pinned at optical size 24. The web leaves opsz to the browser, which is a
luxury a static instance does not have; 24 is the middle of what this app asks for rather
than the font's own default of 18.

## Adding a weight

Add the `fontWeight` to a style and the app will silently fall back to the nearest face
that is here. To cut a new one: download the variable font from `google/fonts`, then

```
pip install fonttools
python -c "
from fontTools.varLib import instancer
from fontTools.ttLib import TTFont
instancer.instantiateVariableFont(TTFont('Manrope[wght].ttf'), {'wght': 800},
                                  updateFontNames=True).save('Manrope-ExtraBold.ttf')"
```

and list the file in the `expo-font` plugin block in `app.json`. The plugin embeds them at
build time, which is why there is no `useFonts` call anywhere and no frame of fallback text
on launch.

Both families are licensed under the SIL Open Font License; see `OFL-Manrope.txt` and
`OFL-Newsreader.txt`.
