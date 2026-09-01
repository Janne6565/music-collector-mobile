import type { NativeLocalStore } from "@/local/LocalStore";
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/**
 * The long edge a stored sleeve photo is cut to.
 *
 * The largest a photo is ever drawn is the full-width hero at three times density, which is
 * about 1170px; 1600 covers that with room for a pinch. Against the 20 MB an account is
 * allowed this is the difference between six pictures and sixty-five: the picker hands back
 * a 12-megapixel original, of which nothing beyond this was ever going to be looked at.
 */
const MAX_EDGE = 1600;

/** Flat colour and small type on a sleeve survive this; below about 0.75 the spine rings. */
const JPEG_QUALITY = 0.82;

/**
 * Where a picture comes from on a phone.
 *
 * The camera is a first-class source rather than a file-picker afterthought — you are
 * usually holding the record while you are entering it.
 */
export type PhotoSource = "CAMERA" | "LIBRARY";

/** What the picker hands back, reduced to the three things a `Photo` record needs. */
export interface PickedImage {
  readonly uri: string;
  readonly contentType: string;
  readonly byteSize: number;
}

/**
 * Open the camera or the library and wait for one picture.
 *
 * `null` for a cancelled pick, which is the ordinary outcome and not an error: every
 * caller simply stops.
 */
export async function pickImage(source: PhotoSource): Promise<PickedImage | null> {
  const result =
    source === "CAMERA"
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, mediaTypes: ["images"] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ["images"] });
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (asset === undefined) return null;

  // Scaled and re-encoded before the caller ever sees it, so that what is copied into the
  // app's storage is what is uploaded and what every device eventually holds — one photo id
  // is one picture, at one size, everywhere.
  return (
    (await scaled(asset.uri)) ?? {
      uri: asset.uri,
      contentType: asset.mimeType ?? "image/jpeg",
      byteSize: asset.fileSize ?? 0,
    }
  );
}

/**
 * The picked picture at storable size, or null if the manipulator could not produce one —
 * in which case the caller keeps the original rather than losing a picture somebody chose.
 *
 * <p>Re-encoding is not only about the size. The iOS picker returns HEIC's bytes untouched
 * whatever `quality` says (the same trap {@code useProfilePictureLogic} documents), and HEIC
 * is a format the web app cannot draw — so until now a sleeve photographed on a phone was a
 * broken tile in the browser. What leaves here is always a JPEG.
 *
 * <p>It also bakes in the EXIF orientation flag every gallery applies and a canvas ignores,
 * and drops the EXIF block, which on a photo carries where it was taken.
 */
async function scaled(uri: string): Promise<PickedImage | null> {
  try {
    const context = ImageManipulator.manipulate(uri);
    const rendered = await context.renderAsync();
    const longest = Math.max(rendered.width, rendered.height);
    if (longest > MAX_EDGE) {
      context.resize(
        rendered.width >= rendered.height ? { width: MAX_EDGE } : { height: MAX_EDGE },
      );
    }
    const image = longest > MAX_EDGE ? await context.renderAsync() : rendered;
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
    const info = await FileSystem.getInfoAsync(saved.uri);
    if (!info.exists) return null;
    return { uri: saved.uri, contentType: "image/jpeg", byteSize: info.size };
  } catch {
    return null;
  }
}

/**
 * Copy a picked file into the app's own storage, under the id its `Photo` record will use.
 *
 * Copied rather than referenced where the picker left it: a cache URI can be cleared by
 * the OS at any time, taking the picture with it. The retry creates the photo directory,
 * which does not exist until the first picture on a fresh install.
 */
export async function storePhotoBytes(
  store: NativeLocalStore,
  id: string,
  from: string,
): Promise<void> {
  await FileSystem.copyAsync({ from, to: store.photoUri(id) }).catch(async () => {
    await FileSystem.makeDirectoryAsync(store.photoUri("").replace(/[^/]*$/, ""), {
      intermediates: true,
    });
    await FileSystem.copyAsync({ from, to: store.photoUri(id) });
  });
}
