import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import type { NativeLocalStore } from "@/local/LocalStore";

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

  return {
    uri: asset.uri,
    contentType: asset.mimeType ?? "image/jpeg",
    byteSize: asset.fileSize ?? 0,
  };
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
