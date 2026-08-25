import { lookupAlbumCovers } from "@/api/releases";
import { ReleaseArt } from "@/components/ReleaseArt";
import { useStore } from "@/local/StoreProvider";
import { colors, fonts } from "@/theme/colors";
import type { Release, WishFormat, WishlistItem } from "@janne6565/music-collector-shared";
import {
  FORMAT_LABELS,
  applyWishPatch,
  asWishFormat,
  createWishlistItem,
  isManualReleaseId,
  manualReleaseId,
} from "@janne6565/music-collector-shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Heart } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

/** The four chips of screen 16c: the three formats you hunt for, then "any". */
const CHIPS: readonly (WishFormat | null)[] = ["VINYL", "CD", "CASSETTE", null];

interface WishSheetProps {
  readonly onClose: () => void;
  /** The release a heart was pressed on — a search result, a discography row, a shelf. */
  readonly release?: Release | null;
  /**
   * An existing entry, reopened to change the format or the note.
   *
   * Neither a release nor an entry means hand entry — the record no archive has. That is
   * the absence itself rather than a flag, because a flag could disagree with it.
   */
  readonly entry?: WishlistItem | null;
}

/**
 * Screen 16c — the sheet every way onto the wishlist lands in.
 *
 * The four doors differ only in what they already know: a search result knows the release,
 * an edit knows the entry, hand entry knows nothing yet. What they ask is the same two
 * questions, which is what makes "adding it twice just reopens this sheet" true.
 */
export function WishSheet({ onClose, release = null, entry = null }: WishSheetProps) {
  const { t } = useTranslation();
  const { store, clock } = useStore();
  const queryClient = useQueryClient();

  const [format, setFormat] = useState<WishFormat | null>(
    entry !== null ? asWishFormat(entry.desiredFormat) : asWishFormat(release?.format ?? null),
  );
  const [note, setNote] = useState(entry?.note ?? "");
  const [typed, setTyped] = useState({
    title: entry?.title ?? "",
    artistName: entry?.artistName ?? "",
    year: entry?.year === undefined || entry?.year === null ? "" : String(entry.year),
  });

  const heading =
    entry !== null
      ? { title: entry.title, subtitle: `${entry.artistName}${entry.year === null ? "" : ` · ${entry.year}`}` }
      : release !== null
        ? {
            title: release.title,
            subtitle: `${release.artistName}${release.year === null ? "" : ` · ${release.year}`}${release.label === null ? "" : ` · ${release.label}`}`,
          }
        : null;

  /**
   * The album's artwork, for a sheet reopened on an entry.
   *
   * A wish knows its album and nothing about any pressing, so unlike the release door it
   * has no cover to hand. Skipped for a hand-typed album, which no catalogue can answer for.
   */
  const albumCover = useQuery({
    queryKey: ["albumCovers", entry === null ? [] : [entry.albumId]],
    enabled: entry !== null && !isManualReleaseId(entry.albumId),
    staleTime: 60 * 60 * 1000,
    queryFn: () => lookupAlbumCovers([entry?.albumId ?? ""]),
  });

  /** The picked pressing's cover, the album's as a fallback, null while neither is known. */
  const coverArtUrl =
    release?.coverArtUrl ?? (entry === null ? null : (albumCover.data?.get(entry.albumId) ?? null));

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = note.trim();
      const cleaned = trimmed === "" ? null : trimmed;

      if (entry !== null) {
        await store.putWishlistItem(
          applyWishPatch(entry, { desiredFormat: format, note: cleaned }, clock),
        );
        return;
      }

      const year = Number.parseInt(typed.year, 10);
      const subject =
        release !== null
          ? {
              albumId: release.albumId,
              title: release.title,
              artistName: release.artistName,
              year: release.year,
            }
          : {
              // `local:` for the same reason a hand-entered copy uses it (turn 14): the
              // entry makes no claim about anything in the archive, so it must never match
              // one — and an album id nothing can look up is exactly an uncatalogued album.
              albumId: manualReleaseId(Crypto.randomUUID()),
              title: typed.title.trim(),
              artistName: typed.artistName.trim(),
              year: Number.isFinite(year) ? year : null,
            };

      // One entry per release. A second heart reopens this sheet rather than adding a row,
      // checked against the live list because the entry may have synced in from elsewhere.
      const already = (await store.listWishlist()).find(
        (item) => item.albumId === subject.albumId,
      );
      if (already !== undefined) {
        await store.putWishlistItem(
          applyWishPatch(already, { desiredFormat: format, note: cleaned }, clock),
        );
        return;
      }

      await store.putWishlistItem(
        createWishlistItem(
          { ...subject, desiredFormat: format, note: cleaned },
          clock,
          Date.now(),
          Crypto.randomUUID(),
        ),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      onClose();
    },
  });

  const canSave =
    entry !== null ||
    release !== null ||
    typed.title.trim() !== "" ||
    typed.artistName.trim() !== "";

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrap}
      >
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {heading !== null ? (
              <View style={styles.subject}>
                <View style={styles.subjectThumb}>
                  {/* The format is the one the chips below are choosing, not the pressing's:
                      the tile should follow what is being asked for as it is asked for. */}
                  <ReleaseArt release={{ coverArtUrl }} format={format ?? "OTHER"} />
                </View>
                <View style={styles.subjectText}>
                  <Text style={styles.subjectTitle} numberOfLines={1}>
                    {heading.title}
                  </Text>
                  <Text style={styles.subjectSubtitle} numberOfLines={1}>
                    {heading.subtitle}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.typed}>
                <Text style={styles.label}>{t("manual.title")}</Text>
                <TextInput
                  value={typed.title}
                  onChangeText={(value) => setTyped((was) => ({ ...was, title: value }))}
                  style={styles.input}
                />
                <Text style={styles.label}>{t("manual.artist")}</Text>
                <TextInput
                  value={typed.artistName}
                  onChangeText={(value) => setTyped((was) => ({ ...was, artistName: value }))}
                  style={styles.input}
                />
                <Text style={styles.label}>{t("manual.year")}</Text>
                <TextInput
                  value={typed.year}
                  onChangeText={(value) => setTyped((was) => ({ ...was, year: value }))}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </View>
            )}

            <Text style={[styles.label, styles.spaced]}>{t("wishlist.wantedFormat")}</Text>
            <View style={styles.chips}>
              {CHIPS.map((chip) => (
                <Pressable
                  key={chip ?? "ANY"}
                  accessibilityRole="button"
                  accessibilityState={{ selected: format === chip }}
                  onPress={() => setFormat(chip)}
                  style={[styles.chip, format === chip && styles.chipOn]}
                >
                  <Text style={[styles.chipText, format === chip && styles.chipTextOn]}>
                    {chip === null ? t("wishlist.anyFormat") : FORMAT_LABELS[chip]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, styles.spaced]}>{t("wishlist.note")}</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              placeholder={t("wishlist.notePlaceholder")}
              placeholderTextColor={colors.inkSubtle}
              style={[styles.input, styles.noteInput]}
            />

            <Pressable
              accessibilityRole="button"
              onPress={() => save.mutate()}
              disabled={!canSave || save.isPending}
              style={[styles.primary, (!canSave || save.isPending) && styles.primaryOff]}
            >
              <Heart size={16} color={colors.paper} strokeWidth={2} />
              <Text style={styles.primaryText}>
                {t(entry !== null ? "common.save" : "wishlist.addToWishlist")}
              </Text>
            </Pressable>
            <Text style={styles.footnote}>{t("wishlist.oneEntryHint")}</Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(25,23,19,0.35)" },
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "88%",
  },
  grabber: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.line,
    marginTop: 10,
  },
  content: { padding: 18, paddingBottom: 34 },
  subject: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  subjectThumb: { width: 52 },
  subjectText: { flex: 1, minWidth: 0 },
  subjectTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  subjectSubtitle: { fontSize: 12, color: colors.inkMuted, marginTop: 1 },
  typed: { gap: 4 },
  label: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.inkSubtle,
    marginTop: 8,
  },
  spaced: { marginTop: 18 },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.ink,
    marginTop: 6,
  },
  noteInput: { height: 84, paddingTop: 10, textAlignVertical: "top" },
  chips: { flexDirection: "row", gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12.5, color: colors.inkMuted, fontWeight: "500" },
  chipTextOn: { color: colors.paper, fontWeight: "700" },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.ink,
    marginTop: 22,
  },
  primaryOff: { opacity: 0.5 },
  primaryText: { fontFamily: fonts.sans, fontSize: 15, fontWeight: "700", color: colors.paper },
  footnote: { fontSize: 11.5, color: colors.inkMuted, textAlign: "center", marginTop: 10 },
});
