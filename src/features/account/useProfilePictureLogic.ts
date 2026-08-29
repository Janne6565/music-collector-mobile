import {
  type AvatarCrop,
  AvatarUploadAborted,
  AvatarUploadFailed,
  removeAvatar,
  uploadAvatar,
} from "@/api/avatar";
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";

/** The server's ceiling, checked on the device so nothing is sent that cannot be accepted. */
export const MAX_PICTURE_BYTES = 15_728_640;

/** The longest edge a picture is sent at. See `asJpeg` for why it is not the original. */
const MAX_EDGE = 4096;

/** The picture the picker handed over, before anything has been decided about it. */
export interface ChosenPicture {
  readonly uri: string;
  readonly name: string;
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
  readonly contentType: string;
}

/**
 * The states of the one row that offers a picture (27a, 27d).
 *
 * The three failures are kept apart rather than folded into one "that did not work", because
 * they are three different things to do next: pick a different file, export this one smaller,
 * or come back later.
 */
export type PictureState =
  | { readonly kind: "idle" }
  | { readonly kind: "choosing" }
  | { readonly kind: "framing"; readonly picture: ChosenPicture }
  | { readonly kind: "uploading"; readonly sent: number; readonly total: number }
  | { readonly kind: "wrongType"; readonly name: string }
  | { readonly kind: "tooLarge"; readonly name: string; readonly bytes: number }
  | { readonly kind: "unavailable" };

export interface ProfilePictureLogic {
  readonly state: PictureState;
  readonly url: string | null;
  readonly justUpdated: boolean;
  /** Whether the replace/remove sheet is up. On a phone the sheet is its own confirmation. */
  readonly sheetOpen: boolean;
  readonly open: () => void;
  readonly closeSheet: () => void;
  readonly pick: () => void;
  readonly cancelFraming: () => void;
  readonly confirmFraming: (crop: AvatarCrop) => void;
  readonly remove: () => void;
  readonly retry: () => void;
  readonly cancelUpload: () => void;
}

/**
 * @param current  where the account's picture is now, from `/auth/me`
 * @param onChange told the new URL (or null) so the You header follows at once
 */
export function useProfilePictureLogic(
  current: string | null,
  onChange: (url: string | null) => void,
): ProfilePictureLogic {
  const [state, setState] = useState<PictureState>({ kind: "idle" });
  const [url, setUrl] = useState<string | null>(current);
  const [justUpdated, setJustUpdated] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const pending = useRef<{ picture: ChosenPicture; crop: AvatarCrop } | null>(null);
  const cancelling = useRef<(() => void) | null>(null);

  // The row follows the account whenever it is re-read, but never mid-upload: the server's
  // answer to that upload is the newer fact.
  useEffect(() => {
    if (state.kind === "idle" && pending.current === null) setUrl(current);
  }, [current, state.kind]);

  const send = useCallback(
    (picture: ChosenPicture, crop: AvatarCrop) => {
      setState({ kind: "uploading", sent: 0, total: picture.bytes });
      const upload = uploadAvatar(picture.uri, picture.contentType, crop, (sent, total) =>
        setState({ kind: "uploading", sent, total: total === 0 ? picture.bytes : total }),
      );
      cancelling.current = upload.cancel;
      void upload.promise
        .then((avatar) => {
          const next = avatar.url ?? null;
          setUrl(next);
          onChange(next);
          setJustUpdated(true);
          setState({ kind: "idle" });
          pending.current = null;
        })
        .catch((error: unknown) => {
          if (error instanceof AvatarUploadAborted) {
            setState({ kind: "idle" });
            return;
          }
          // The picture on the account is deliberately untouched: a picture service being
          // down must not read as the app being broken (27d).
          pending.current = { picture, crop };
          setState(problemOf(error, picture));
        })
        .finally(() => {
          cancelling.current = null;
        });
    },
    [onChange],
  );

  const pick = useCallback(() => {
    setSheetOpen(false);
    setState({ kind: "choosing" });
    void ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      // The framing step is the app's own (27c), so the system cropper stays out of the way.
      allowsEditing: false,
      // Uncompressed out of the picker: `asJpeg` below is what decides the format and the
      // size, and compressing twice would only cost quality. The server still crops from
      // what it is sent, so nothing here is a crop of a crop.
      quality: 1,
      exif: false,
    })
      .then(async (result) => {
        const asset = result.canceled ? undefined : result.assets[0];
        if (asset === undefined) {
          setState({ kind: "idle" });
          return;
        }
        const name = asset.fileName ?? "picture.jpg";
        const jpeg = await asJpeg(asset.uri).catch(() => null);
        if (jpeg === null) {
          setState({ kind: "wrongType", name });
          return;
        }
        if (jpeg.bytes > MAX_PICTURE_BYTES) {
          setState({ kind: "tooLarge", name, bytes: jpeg.bytes });
          return;
        }
        setState({
          kind: "framing",
          picture: {
            uri: jpeg.uri,
            name,
            bytes: jpeg.bytes,
            width: jpeg.width,
            height: jpeg.height,
            contentType: "image/jpeg",
          },
        });
      })
      .catch(() => setState({ kind: "unavailable" }));
  }, []);

  return {
    state,
    url,
    justUpdated,
    sheetOpen,
    // With no picture there is nothing to choose between, so the row goes straight to the
    // picker; with one, the sheet is where Replace and Remove live and is its own warning.
    open: () => (url === null ? pick() : setSheetOpen(true)),
    closeSheet: () => setSheetOpen(false),
    pick,
    cancelFraming: () => setState({ kind: "idle" }),
    confirmFraming: (crop) => {
      if (state.kind !== "framing") return;
      send(state.picture, crop);
    },
    remove: () => {
      setSheetOpen(false);
      void removeAvatar()
        .then(() => {
          setUrl(null);
          onChange(null);
          setJustUpdated(false);
          setState({ kind: "idle" });
          pending.current = null;
        })
        .catch(() => setState({ kind: "unavailable" }));
    },
    retry: () => {
      const again = pending.current;
      if (again !== null) send(again.picture, again.crop);
    },
    cancelUpload: () => cancelling.current?.(),
  };
}

/** Which of 27d's three sentences this was. */
function problemOf(error: unknown, picture: ChosenPicture): PictureState {
  const status = error instanceof AvatarUploadFailed ? error.status : 0;
  if (status === 415) return { kind: "wrongType", name: picture.name };
  if (status === 413) return { kind: "tooLarge", name: picture.name, bytes: picture.bytes };
  return { kind: "unavailable" };
}

/**
 * The picked file, decoded and written back out as a JPEG.
 *
 * <p>Not optional politeness: `AvatarService` decodes JPEG and PNG only, and every photo an
 * iPhone takes is HEIC. The picker does not help here — its iOS side returns HEIC's bytes
 * untouched whatever `quality` says, so the original code's assumption that "the picker
 * hands back a JPEG on both platforms" held for screenshots and failed for photographs,
 * which is the whole point of the feature.
 *
 * <p>Re-encoding is also what bakes in the EXIF orientation flag that every gallery applies
 * and `ImageIO` ignores, and what drops the EXIF block, which on a public picture carries
 * the place it was taken.
 *
 * <p>The long edge is capped. A JPEG is usually *larger* than the HEIC it came from, so a
 * 12-megapixel photo can cross the 15 MB ceiling by being converted; 4096 keeps the crop
 * above the 512 the server renders even at full zoom, and brings a phone photo to a few MB.
 */
async function asJpeg(uri: string): Promise<{
  readonly uri: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
} | null> {
  const context = ImageManipulator.manipulate(uri);
  const rendered = await context.renderAsync();
  const longest = Math.max(rendered.width, rendered.height);
  if (longest > MAX_EDGE) {
    context.resize(
      rendered.width >= rendered.height ? { width: MAX_EDGE } : { height: MAX_EDGE },
    );
  }
  const saved = await (longest > MAX_EDGE ? context.renderAsync() : Promise.resolve(rendered)).then(
    (image) => image.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 }),
  );
  const info = await FileSystem.getInfoAsync(saved.uri);
  if (!info.exists) return null;
  return { uri: saved.uri, width: saved.width, height: saved.height, bytes: info.size };
}
