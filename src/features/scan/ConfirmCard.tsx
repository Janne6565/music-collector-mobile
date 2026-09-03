import { releaseDisambiguation } from "@/api/releases";
import { ReleaseArt } from "@/components/ReleaseArt";
import { hiddenPressings, shownPressings } from "@/features/scan/shownPressings";
import { SCAN_FORMATS, type useScannerLogic } from "@/features/scan/useScannerLogic";
import { useAppSelector } from "@/store/hooks";
import { colors, fonts } from "@/theme/colors";
import type { Format, Release } from "@janne6565/rekordo-shared";
import { CONDITION_LABELS, FORMAT_LABELS, formatBarcode } from "@janne6565/rekordo-shared";
import {
  Check,
  CopyPlus,
  Disc3,
  Heart,
  Layers,
  LibraryBig,
  PencilLine,
  Search,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Logic = ReturnType<typeof useScannerLogic>;

/**
 * The one question a resolved scan asks, and its two equal answers.
 *
 * Shelf and Wishlist carry the same weight because in a shop half of what you scan is a
 * record you covet rather than one you have bought, and a flow that assumes the first
 * makes the second a correction. The camera window stays live above the card, so the next
 * sleeve is a glance away rather than a dismissal away.
 *
 * Turn 28 of the deck, screens 2a through 2e.
 */
export function ConfirmCard({ logic }: { readonly logic: Logic }) {
  const card = logic.card;
  if (card === null) return null;

  if (logic.picking) return <PressingPicker logic={logic} />;

  return (
    <View style={styles.card}>
      {/*
       * The card scrolls and its answers do not.
       *
       * Three pressings under a question under a camera window is taller than a small
       * phone, and the card used to be laid out as if the screen were always tall enough:
       * everything below the fold was simply off the bottom edge, unscrollable. Somebody
       * scanning a CD could pick a pressing and then had no way to say where it should go.
       * So the part that varies scrolls, and the part you press stays where the thumb is.
       */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {card.kind === "MATCH" && <Match logic={logic} />}
        {card.kind === "PRESSINGS" && <Pressings logic={logic} />}
        {card.kind === "DUPLICATE" && <Duplicate logic={logic} />}
        {card.kind === "MISSING" && <Missing logic={logic} />}
        {card.kind === "OFFLINE" && <Offline logic={logic} />}
      </ScrollView>

      <Actions logic={logic} />
    </View>
  );
}

/**
 * What this card can be answered with, pinned under the part that scrolls.
 *
 * Every kind ends in the same place — one or two ways on — so they are gathered here
 * rather than left at the bottom of five different bodies where a long one can push them
 * out of reach.
 */
function Actions({ logic }: { readonly logic: Logic }) {
  const { t } = useTranslation();
  const card = logic.card;
  if (card === null) return null;

  return (
    <View style={styles.actions}>
      {(card.kind === "MATCH" || card.kind === "PRESSINGS" || card.kind === "OFFLINE") && (
        <Destinations logic={logic} />
      )}
      {card.kind === "DUPLICATE" && card.owned !== null && (
        <DuplicateActions logic={logic} ownedId={card.owned.id} />
      )}
      {card.kind === "MISSING" && <MissingActions logic={logic} barcode={card.barcode} />}

      {(card.kind === "MATCH" || card.kind === "DUPLICATE") && (
        <Pressable accessibilityRole="button" onPress={logic.dismiss}>
          <Text style={styles.skip}>{t("scan.skip")}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Screen 2a: one release, the barcode readable back, both destinations. */
function Match({ logic }: { readonly logic: Logic }) {
  const { t } = useTranslation();
  const card = logic.card;
  if (card?.picked == null) return null;
  const others = (logic.pressingCount ?? 1) - 1;

  return (
    <>
      <View style={styles.eyebrow}>
        <Text style={styles.eyebrowText}>{t("scan.foundIn")}</Text>
        <View style={styles.rule} />
        {logic.pressingCount !== null && (
          <Text style={styles.eyebrowText}>
            {t("scan.pressingOf", { count: logic.pressingCount })}
          </Text>
        )}
      </View>

      <ReleaseHead release={card.picked} format={card.format} />
      <FormatChips logic={logic} others={others} />
    </>
  );
}

/** Screen 2b: several pressings share the barcode, so one has to be picked. */
function Pressings({ logic }: { readonly logic: Logic }) {
  const { t } = useTranslation();
  const card = logic.card;
  if (card === null) return null;

  const shown = shownPressings(logic.pressings, card.picked);
  const hidden = hiddenPressings(logic.pressings, shown);

  return (
    <>
      <View style={styles.pressingHead}>
        <Text style={styles.serif}>{t("scan.whichPressing")}</Text>
        <Text style={styles.eyebrowText}>
          {t("scan.shareBarcode", { count: logic.pressings.length })}
        </Text>
      </View>
      <Text style={styles.body}>{t("scan.reissuesReuse")}</Text>

      <View style={styles.pressingList}>
        {shown.map((release) => (
          <PressingRow
            key={release.id}
            release={release}
            picked={card.picked?.id === release.id}
            onPress={() => logic.pick(release)}
          />
        ))}
      </View>
      {hidden > 0 && (
        <Pressable accessibilityRole="button" onPress={logic.openPicker}>
          <Text style={styles.moreLink}>{t("scan.showMore", { count: hidden })}</Text>
        </Pressable>
      )}
    </>
  );
}

/** Screen 2c: already on the shelf. A fact, not an error. */
function Duplicate({ logic }: { readonly logic: Logic }) {
  const { t } = useTranslation();
  const card = logic.card;
  if (card?.picked == null || card.owned === null) return null;
  const owned = card.owned;

  return (
    <>
      <View style={styles.eyebrow}>
        <LibraryBig size={13} color={colors.accentStrong} strokeWidth={2} />
        <Text style={[styles.eyebrowText, styles.eyebrowStrong]}>{t("scan.alreadyOwned")}</Text>
      </View>

      <ReleaseHead
        release={card.picked}
        format={card.format}
        note={[
          t("scan.addedOn", { date: new Date(owned.createdAt).toLocaleDateString() }),
          owned.condition === null
            ? null
            : owned.sleeveCondition === null
              ? CONDITION_LABELS[owned.condition]
              : `${CONDITION_LABELS[owned.condition]} / ${CONDITION_LABELS[owned.sleeveCondition]}`,
        ]
          .filter((part): part is string => part !== null)
          .join(" · ")}
      />

      <View style={styles.aside}>
        <Text style={styles.asideText}>{t("scan.copiesCountSeparately")}</Text>
      </View>
    </>
  );
}

/** Add another of the same, or go and look at the one already on the shelf. */
function DuplicateActions({ logic, ownedId }: { readonly logic: Logic; readonly ownedId: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.stack}>
      <Pressable
        accessibilityRole="button"
        onPress={() => logic.keep("SHELF")}
        style={styles.primary}
      >
        <CopyPlus size={16} color="#ffffff" strokeWidth={2} />
        <Text style={styles.primaryText}>{t("scan.addSecondCopy")}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => logic.openOwned(ownedId)}
        style={styles.secondary}
      >
        <Text style={styles.secondaryText}>{t("scan.openTheOneIHave")}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Screen 2d: the read was clean and no catalogue has the number.
 *
 * The deck also drew a near-miss suggestion under this. Neither Discogs nor MusicBrainz
 * offers a fuzzy barcode search, so there is nothing honest to put there — the two ways
 * out are the whole card, and the digits carry into both of them.
 */
function Missing({ logic }: { readonly logic: Logic }) {
  const { t } = useTranslation();
  const card = logic.card;
  if (card === null) return null;

  return (
    <>
      <Text style={styles.serif}>{t("scan.noRelease.title")}</Text>
      <Text style={styles.body}>{t("scan.noRelease.body")}</Text>
    </>
  );
}

/** The two ways out of a barcode nothing has heard of, with the digits carried into both. */
function MissingActions({ logic, barcode }: { readonly logic: Logic; readonly barcode: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.pair}>
      <Pressable
        accessibilityRole="button"
        onPress={() => logic.enterManually(barcode)}
        style={[styles.primary, styles.half]}
      >
        <PencilLine size={16} color="#ffffff" strokeWidth={2} />
        <Text style={styles.primaryText}>{t("scan.enterManually")}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={logic.dismiss}
        style={[styles.secondary, styles.half]}
      >
        <Search size={16} color="rgba(25,23,19,0.75)" strokeWidth={2} />
        <Text style={styles.secondaryText}>{t("scan.searchTitle")}</Text>
      </Pressable>
    </View>
  );
}

/** Screen 2e: scanning is local, lookups are not. Both destinations still work. */
function Offline({ logic }: { readonly logic: Logic }) {
  const { t } = useTranslation();
  const card = logic.card;
  const waiting = useAppSelector(
    (state) => state.scan.kept.filter((scan) => scan.release === null).length,
  );
  const ready = useAppSelector(
    (state) => state.scan.kept.filter((scan) => scan.release !== null).length,
  );
  if (card === null) return null;

  return (
    <>
      <View style={styles.eyebrow}>
        <Disc3 size={13} color={colors.inkSubtle} strokeWidth={2} />
        <Text style={styles.eyebrowText}>{t("scan.notYetIdentified")}</Text>
      </View>

      <View style={styles.head}>
        <View style={styles.pendingArt}>
          <Disc3 size={24} color="rgba(25,23,19,0.3)" strokeWidth={1.6} />
        </View>
        <View style={styles.headText}>
          <Text style={styles.digits}>{formatBarcode(card.barcode)}</Text>
          <Text style={styles.body}>{t("scan.fillsInLater")}</Text>
        </View>
      </View>

      <FormatChips logic={logic} hint={t("scan.setItNow")} />

      {waiting + ready > 0 && (
        <View style={styles.waitingLine}>
          <Layers size={14} color={colors.inkMuted} strokeWidth={1.8} />
          <Text style={styles.waitingText}>{t("scan.waitingAndReady", { waiting, ready })}</Text>
        </View>
      )}
    </>
  );
}

function ReleaseHead({
  release,
  format,
  note,
}: {
  readonly release: Release;
  readonly format: Format | null;
  readonly note?: string;
}) {
  const line = releaseDisambiguation(release);
  return (
    <View style={styles.head}>
      <ReleaseArt release={release} format={format ?? release.format} style={styles.headArt} />
      <View style={styles.headText}>
        <Text style={styles.serif}>{release.title}</Text>
        <Text style={styles.headMeta}>
          {[
            release.artistName,
            release.year === null ? null : String(release.year),
            FORMAT_LABELS[format ?? release.format],
          ]
            .filter((part) => part !== null)
            .join(" · ")}
        </Text>
        {(note ?? line) !== "" && <Text style={styles.headMono}>{note ?? line}</Text>}
      </View>
    </View>
  );
}

/**
 * The format chips, editable on the card.
 *
 * They are inferred from the release and still editable, because the catalogue is
 * describing a pressing and you are holding an object — a tape of a record catalogued as
 * vinyl is a normal thing to own, and correcting it here costs one tap instead of an edit
 * after the fact.
 */
function FormatChips({
  logic,
  others = 0,
  hint,
}: {
  readonly logic: Logic;
  readonly others?: number;
  readonly hint?: string;
}) {
  const { t } = useTranslation();
  const card = logic.card;
  if (card === null) return null;

  return (
    <View style={styles.chips}>
      {SCAN_FORMATS.filter((format) => format !== "DIGITAL" || card.format === "DIGITAL").map(
        (format) => (
          <Pressable
            key={format}
            accessibilityRole="button"
            onPress={() => logic.setFormat(format)}
            style={[styles.chip, card.format === format && styles.chipOn]}
          >
            <Text style={[styles.chipText, card.format === format && styles.chipTextOn]}>
              {FORMAT_LABELS[format]}
            </Text>
          </Pressable>
        ),
      )}
      <View style={styles.spacer} />
      {hint !== undefined && <Text style={styles.chipHint}>{hint}</Text>}
      {others > 0 && (
        <Pressable accessibilityRole="button" onPress={logic.openPicker}>
          <Text style={styles.othersLink}>{t("scan.others", { count: others })}</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Wishlist left, Shelf right, equal in size and weight.
 *
 * The order is the deck's standing rule wherever both destinations appear, so the hand
 * learns one position rather than two.
 */
function Destinations({ logic }: { readonly logic: Logic }) {
  const { t } = useTranslation();
  return (
    <View style={styles.pair}>
      <Pressable
        accessibilityRole="button"
        onPress={() => logic.keep("WISHLIST")}
        style={[styles.primary, styles.half, styles.tall]}
      >
        <Heart size={17} color="#ffffff" strokeWidth={1.8} />
        <Text style={styles.primaryText}>{t("scan.wishlist")}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => logic.keep("SHELF")}
        style={[styles.primary, styles.half, styles.tall]}
      >
        <LibraryBig size={17} color="#ffffff" strokeWidth={1.8} />
        <Text style={styles.primaryText}>{t("scan.shelf")}</Text>
      </Pressable>
    </View>
  );
}

/**
 * One pressing in the list.
 *
 * The first row used to carry a "best guess" badge, which was a claim nobody had made:
 * `pickPressing` with no format to go on returns `releases[0]`, so the label meant "first
 * in whatever order the catalogue answered in" and dressed it up as a judgement. The rule
 * it needed is already in the paragraph above the list, in words, and which row is
 * selected is already said by the border and the check.
 */
function PressingRow({
  release,
  picked,
  onPress,
}: {
  readonly release: Release;
  readonly picked: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.pressingRow, picked && styles.pressingRowOn]}
    >
      <ReleaseArt release={release} format={release.format} style={styles.pressingArt} />
      <View style={styles.headText}>
        <View style={styles.pressingTitleRow}>
          <Text style={styles.pressingTitle}>
            {[FORMAT_LABELS[release.format], release.year === null ? null : String(release.year)]
              .filter((part) => part !== null)
              .join(" · ")}
          </Text>
        </View>
        <Text style={styles.pressingMeta}>{releaseDisambiguation(release)}</Text>
      </View>
      {picked && <Check size={17} color={colors.ink} strokeWidth={2.2} />}
    </Pressable>
  );
}

/** Every pressing, when three rows on the card are not enough. */
function PressingPicker({ logic }: { readonly logic: Logic }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.pressingHead}>
        <Text style={styles.serif}>{t("scan.whichPressing")}</Text>
        <Pressable accessibilityRole="button" onPress={logic.closePicker}>
          <Text style={styles.moreLink}>{t("common.cancel")}</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.pickerList}>
        {logic.pressings.map((release) => (
          <PressingRow
            key={release.id}
            release={release}
            picked={logic.card?.picked?.id === release.id}
            onPress={() => logic.pick(release)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const MONO = "ui-monospace";

const styles = StyleSheet.create({
  card: {
    // Shrinks rather than overflowing: the spacer above it has a zero basis, so when the
    // window, the card and the safe area do not fit, this is the box that gives.
    flexShrink: 1,
    marginHorizontal: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(25,23,19,0.09)",
    borderBottomWidth: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 20,
  },

  scroll: { flexShrink: 1 },
  actions: { flexShrink: 0 },

  eyebrow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyebrowText: {
    fontFamily: MONO,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.inkSubtle,
  },
  eyebrowStrong: { color: colors.accentStrong },
  rule: { flex: 1, height: 1, backgroundColor: "rgba(25,23,19,0.1)" },

  head: { flexDirection: "row", gap: 14, marginTop: 14 },
  headArt: { width: 89, height: 74 },
  headText: { flex: 1, minWidth: 0 },
  headMeta: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkMuted, marginTop: 4 },
  headMono: { fontFamily: MONO, fontSize: 10.5, color: colors.inkSubtle, marginTop: 4 },
  serif: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 26, color: colors.ink },
  body: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.inkMuted,
    marginTop: 6,
  },
  digits: { fontFamily: MONO, fontSize: 15, color: colors.ink },

  pendingArt: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#eae6de",
    alignItems: "center",
    justifyContent: "center",
  },

  chips: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 15, flexWrap: "wrap" },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: "rgba(25,23,19,0.12)",
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.sans, fontSize: 12, fontWeight: "500", color: colors.inkMuted },
  chipTextOn: { color: "#ffffff", fontWeight: "600" },
  chipHint: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkSubtle },
  spacer: { flex: 1 },
  othersLink: { fontFamily: fonts.sans, fontSize: 12, fontWeight: "500", color: colors.accent },

  pair: { flexDirection: "row", gap: 10, marginTop: 16 },
  half: { flex: 1 },
  tall: { height: 52 },
  stack: { gap: 9, marginTop: 16 },
  primary: {
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { fontFamily: fonts.sans, fontSize: 14.5, fontWeight: "600", color: "#ffffff" },
  secondary: {
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: "rgba(25,23,19,0.14)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryText: {
    fontFamily: fonts.sans,
    fontSize: 14.5,
    fontWeight: "600",
    color: "rgba(25,23,19,0.75)",
  },
  skip: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: "500",
    color: colors.inkMuted,
    textAlign: "center",
    marginTop: 13,
  },

  aside: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: "rgba(25,23,19,0.09)",
  },
  asideText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    lineHeight: 19,
    color: "rgba(25,23,19,0.65)",
  },

  pressingHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  pressingList: { marginTop: 13, gap: 8 },
  // Bounded twice: the design's height, and whatever the screen actually has left.
  pickerList: { marginTop: 13, maxHeight: 340, flexShrink: 1 },
  pressingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 11,
    borderRadius: 12,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: "rgba(25,23,19,0.1)",
    marginBottom: 8,
  },
  pressingRowOn: { borderWidth: 1.5, borderColor: colors.ink },
  pressingArt: { width: 60, height: 50 },
  pressingTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  pressingTitle: { fontFamily: fonts.sans, fontSize: 13.5, fontWeight: "600", color: colors.ink },
  pressingMeta: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  moreLink: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: "500",
    color: colors.accent,
    textAlign: "center",
    marginTop: 11,
  },

  waitingLine: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 14 },
  waitingText: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkMuted },
});
