import { accountStorage } from "@/api/storage";
import {
  type StorageReading,
  fillPercent,
  formatMegabytes,
  readStorage,
  tickPercent,
} from "@/features/account/storageReading";
import { colors, fonts } from "@/theme/colors";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

/**
 * The allowance, at the top of the Storage card (design 28b), mirroring the web row one for
 * one because Account mirrors the web's sections one for one.
 *
 * The count leads and the bytes trail: "34 photos" is a number a person can picture and
 * "10.2 MB" is not. Nothing here ever changes colour, at any reading. Accent is this app's
 * deletion colour, and an allowance filling up is not a danger; full and over are carried by
 * the bar and the sentence under it, because the photo is always kept and only the upload
 * waits.
 *
 * The figure is the server's, and this is a local-first app, so "no number yet" and "could
 * not ask" are two different readings rather than one spinner. Offline says so and keeps the
 * row where it was.
 */
export function StorageMeterRow() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const query = useQuery({
    queryKey: ["accountStorage"],
    queryFn: accountStorage,
    // A photo taken on this phone changes the answer and nothing here is told about it.
    staleTime: 30_000,
  });

  const reading: StorageReading = query.isPending
    ? { kind: "loading" }
    : query.data === undefined
      ? { kind: "offline" }
      : readStorage(query.data);

  const quota = "quota" in reading ? formatMegabytes(reading.quota, locale) : "";
  const waiting = reading.kind === "loading" || reading.kind === "offline";

  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <Text style={[styles.title, waiting && styles.quiet]}>
          {reading.kind === "loading" || reading.kind === "offline"
            ? t("account.storage.photosLabel")
            : reading.kind === "empty"
              ? t("account.storage.empty.title")
              : t("account.storage.photos", { count: reading.photos })}
        </Text>
        <Text style={styles.figure}>
          {reading.kind === "loading"
            ? "···"
            : reading.kind === "offline"
              ? t("account.storage.offlineFigure")
              : reading.kind === "empty"
                ? t("account.storage.free", {
                    mb: formatMegabytes(reading.freeBytes, locale),
                  })
                : t("account.storage.ofQuota", {
                    used: formatMegabytes(reading.used, locale),
                    quota,
                  })}
        </Text>
      </View>

      <Track reading={reading} />

      {/* Loading is the one reading with no sentence: it has not said anything yet, and a
          placeholder line would be a sentence about nothing. */}
      {reading.kind !== "loading" && (
        <Text style={styles.body}>
          {reading.kind === "offline"
            ? t("account.storage.offline.body")
            : reading.kind === "empty"
              ? t("account.storage.empty.body")
              : reading.kind === "nearlyFull"
                ? t("account.storage.nearlyFull.body", { count: reading.roomForPhotos })
                : reading.kind === "full"
                  ? t("account.storage.full.body")
                  : reading.kind === "over"
                    ? t("account.storage.over.body", {
                        over: formatMegabytes(reading.overBy, locale),
                        quota,
                      })
                    : t("account.storage.sharedShort.body", { quota })}
        </Text>
      )}
    </View>
  );
}

function Track({ reading }: { readonly reading: StorageReading }) {
  // Past the allowance the scale flips: the whole width becomes what is stored and the tick
  // marks where 20 MB ended. The excess is hatched in ink rather than accent, because over
  // is a fact with a fix and not a fault.
  if (reading.kind === "over") {
    const tick: `${number}%` = `${tickPercent(reading)}%`;
    return (
      <View style={styles.overTrack}>
        <View style={[styles.overFill, { width: tick }]} />
        <View style={[styles.overHatch, { left: tick }]}>
          {/* React Native has no repeating gradient, so the hatch is drawn: five slashes
              are enough to read as "beyond the line" at this height. */}
          {[0, 1, 2, 3, 4].map((index) => (
            <View key={index} style={styles.hatchBar} />
          ))}
        </View>
        <View style={[styles.tick, { left: tick }]} />
      </View>
    );
  }

  const fill = fillPercent(reading);
  return (
    <View style={styles.track}>
      {/* Empty keeps the full track and no fill at all: a sliver would read as stalled, and
          the words carry the zero. */}
      {fill > 0 && <View style={[styles.fill, { width: `${fill}%` }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 14 },
  title: { fontFamily: fonts.sans, fontSize: 13.5, fontWeight: "600", color: colors.ink },
  quiet: { color: colors.inkMuted },
  // The design sets the figure in mono, where a measurement belongs. The app loads no mono
  // family, so this is the platform's, as ConfirmEmailScreen already does for its code.
  figure: { fontFamily: "Menlo", fontSize: 11, color: colors.inkMuted },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.line,
    marginTop: 9,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 999, backgroundColor: colors.ink },
  overTrack: { height: 6, marginTop: 11, position: "relative" },
  overFill: {
    position: "absolute",
    left: 0,
    top: 0,
    height: 6,
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
    backgroundColor: colors.ink,
  },
  overHatch: {
    position: "absolute",
    right: 0,
    top: 0,
    height: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    overflow: "hidden",
    backgroundColor: colors.inkSubtle,
  },
  hatchBar: { width: 3, height: 6, backgroundColor: colors.ink, transform: [{ skewX: "-30deg" }] },
  tick: { position: "absolute", top: -4, width: 2, height: 14, backgroundColor: colors.ink },
  body: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 17,
    color: colors.inkMuted,
    marginTop: 8,
  },
});
