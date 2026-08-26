import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Pencil, Star, Trash2, X } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ReleaseArt } from "@/components/ReleaseArt";
import { useCopySwipe } from "@/features/detail/useCopySwipe";
import type { Copy, DetailChrome, Release } from "@janne6565/music-collector-shared";
import {
  CONDITION_LABELS,
  CONDITION_SHORT,
  FORMAT_LABELS,
  chromeFor,
  copyFormat,
  copyPreviewSrc,
} from "@janne6565/music-collector-shared";
import { CopyEditor } from "@/features/detail/CopyEditor";
import { useCoverWash } from "@/features/detail/useCoverWash";
import { useDetailLogic } from "@/features/detail/useDetailLogic";
import { PhotoStrip } from "@/features/photos/PhotoStrip";
import { usePhotoStripLogic } from "@/features/photos/usePhotoStripLogic";
import { fonts } from "@/theme/colors";

/**
 * A copy's page (screens 1j, 3a and 3b).
 *
 * `startEditing` is how adding a record lands here: the copy exists but says nothing
 * about itself yet, so the page opens on its editor rather than on a page of blanks with
 * an Edit button. Saving or cancelling leaves it in the ordinary read state — the flag
 * only decides where the page starts, never where it stays.
 */
export function DetailScreen({
  copyId,
  startEditing = false,
}: {
  readonly copyId: string;
  readonly startEditing?: boolean;
}) {
  const { t } = useTranslation();
  const logic = useDetailLogic(copyId);
  const photos = usePhotoStripLogic(copyId);
  const [editing, setEditing] = useState(startEditing);
  const wash = useCoverWash(logic.data?.release?.coverTheme ?? null);

  if (logic.loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }
  if (logic.data === null) {
    return (
      <SafeAreaView style={styles.loading}>
        <Text>{t("detail.notFound")}</Text>
      </SafeAreaView>
    );
  }

  const { copy, release, otherCopies } = logic.data;

  /*
   * The screen is drawn in its destination chrome from the first frame; the paper it may
   * be arriving from is a layer on top of the background, and the words it is arriving
   * from are a second copy of this body fading out over 100ms. See `useCoverWash`.
   */
  return (
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: wash.chrome.background }]} />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: PAPER, opacity: wash.paper }]}
      />
      <DetailBody
        chrome={wash.chrome}
        accent={wash.accent}
        copy={copy}
        release={release}
        otherCopies={otherCopies}
        logic={logic}
        photos={photos}
        editing={editing}
        setEditing={setEditing}
      />
      {wash.outgoing !== null && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: wash.outgoingOpacity }]}
        >
          <DetailBody
            chrome={wash.outgoing}
            accent={wash.accent}
            copy={copy}
            release={release}
            otherCopies={otherCopies}
            logic={logic}
            photos={photos}
            editing={editing}
            setEditing={setEditing}
          />
        </Animated.View>
      )}
      <StatusBar style={wash.barStyle} />
    </View>
  );
}

/** The paper the screen washes away from, and the only colour that is not the chrome's. */
const PAPER = chromeFor(null).background;

interface DetailBodyProps {
  readonly chrome: DetailChrome;
  readonly accent: Animated.Value;
  readonly copy: Copy;
  readonly release: Release | undefined;
  readonly otherCopies: readonly { copy: Copy; release: Release | undefined }[];
  readonly logic: ReturnType<typeof useDetailLogic>;
  readonly photos: ReturnType<typeof usePhotoStripLogic>;
  readonly editing: boolean;
  readonly setEditing: (editing: boolean) => void;
}

/**
 * Everything on the page, as a function of the chrome it is drawn in.
 *
 * Presentational on purpose: both hooks it needs are held by the screen above and handed
 * down, so rendering a second copy during a wash costs a second tree and no second
 * database read, no second photo list and no second scroll position to keep in step.
 */
function DetailBody({
  chrome,
  accent,
  copy,
  release,
  otherCopies,
  logic,
  photos,
  editing,
  setEditing,
}: DetailBodyProps) {
  const { t } = useTranslation();
  const router = useRouter();
  // Left and right move through the order the shelf was showing. The responder sits on the
  // root rather than the ScrollView so it can watch a gesture before the scroll claims it,
  // and it only claims clearly horizontal ones.
  const swipe = useCopySwipe(copy.id);

  return (
    // No background of its own: the layers behind it own the colour, which is what
    // lets the paper one fade away on the native driver while this stays put.
    <Animated.View
      style={[styles.root, { transform: [{ translateX: swipe.dragX }] }]}
      {...swipe.handlers}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.cover}>
          <ReleaseArt
            release={release}
            format={copyFormat(copy, release)}
            style={styles.coverImage}
            variant="bleed"
            previewUri={copyPreviewSrc(copy, photos.firstUri)}
            allowCatalogArt={copy.catalogArt !== "HIDDEN"}
          />
          <SafeAreaView style={styles.backWrap} edges={["top"]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("detail.back")}
              onPress={() => router.back()}
              style={[styles.back, { backgroundColor: chrome.surface }]}
            >
              <X size={18} color={chrome.ink} strokeWidth={1.75} />
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          <View style={styles.badges}>
            {/* The copy's format, not the release's: a tape of a record listed as vinyl
                is still a tape on your shelf. */}
            <Badge chrome={chrome} strong>
              {FORMAT_LABELS[copyFormat(copy, release)]}
            </Badge>
            {copy.condition !== null && <Badge chrome={chrome}>{CONDITION_SHORT[copy.condition]}</Badge>}
          </View>

          <Text style={[styles.title, { color: chrome.ink }]}>{release?.title ?? "—"}</Text>
          <Text style={[styles.subtitle, { color: chrome.muted }]}>
            {release?.artistName}
            {release?.year == null ? "" : ` · ${release.year}`}
          </Text>

          {/*
           * The accent lands last, 120ms after the words have swapped. Until then the
           * stars are drawn in a colour that was chosen against a chrome the screen has
           * already left, so they are simply not shown yet.
           */}
          <Animated.View style={[styles.stars, { opacity: accent }]}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={15}
                strokeWidth={1.5}
                color={star <= (copy.rating ?? 0) ? chrome.accent : chrome.line}
                fill={star <= (copy.rating ?? 0) ? chrome.accent : "transparent"}
              />
            ))}
          </Animated.View>

          {editing ? (
            <CopyEditor
              copy={copy}
              catalogFormat={release?.format}
              chrome={chrome}
              saving={logic.saving}
              onSave={(patch) => {
                logic.save(patch);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => setEditing(true)}
                style={[styles.edit, { backgroundColor: chrome.ink }]}
              >
                <Pencil size={15} color={chrome.background} strokeWidth={1.75} />
                <Text style={[styles.editText, { color: chrome.background }]}>{t("detail.edit")}</Text>
              </Pressable>
              <Fields copy={copy} chrome={chrome} />
            </>
          )}

          <PhotoStrip logic={photos} chrome={chrome} />

          {/* The photo strip ends flush against whatever follows it, so the notes card
              carries the gap rather than the strip -- the strip is also used where nothing
              comes after it. */}
          <View style={[styles.card, styles.notesCard, { backgroundColor: chrome.surface }]}>
            <Text style={[styles.fieldKey, { color: chrome.muted }]}>{t("detail.notes")}</Text>
            <Text style={[styles.notes, { color: copy.notes === null ? chrome.muted : chrome.ink }]}>
              {copy.notes ?? t("detail.notesEmpty")}
            </Text>
          </View>

          {copy.notesConflict !== null && (
            <NotesConflict
              copy={copy}
              chrome={chrome}
              saving={logic.saving}
              onKeep={(notes) => logic.save({ notes })}
            />
          )}

          {otherCopies.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: chrome.ink }]}>{t("detail.otherCopies")}</Text>
              <View style={styles.otherRow}>
                {otherCopies.map(({ copy: sibling, release: siblingRelease }) => (
                  <Pressable
                    key={sibling.id}
                    onPress={() => router.push(`/copies/${sibling.id}`)}
                    style={[styles.card, styles.otherCard, { backgroundColor: chrome.surface }]}
                  >
                    <Text style={[styles.fieldKey, { color: chrome.muted }]}>
                      {siblingRelease === undefined && sibling.manualFormat === null
                        ? "—"
                        : FORMAT_LABELS[copyFormat(sibling, siblingRelease)]}
                    </Text>
                    <Text style={[styles.otherValue, { color: chrome.ink }]}>
                      {siblingRelease?.year ?? ""}
                      {sibling.condition === null ? "" : ` · ${CONDITION_SHORT[sibling.condition]}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={logic.remove}
            disabled={logic.removing}
            style={[styles.remove, { backgroundColor: chrome.surface }]}
          >
            {logic.removing ? (
              <ActivityIndicator size="small" color={chrome.muted} />
            ) : (
              <Trash2 size={15} color={chrome.muted} strokeWidth={1.75} />
            )}
            <Text style={[styles.removeText, { color: chrome.muted }]}>{t("detail.remove")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

/**
 * Another device wrote different notes, and the merge kept that version instead of
 * discarding it. Shown until the person picks one: sync can tell that two versions differ,
 * but not which of them anybody has actually read.
 */
function NotesConflict({
  copy,
  chrome,
  onKeep,
  saving,
}: {
  readonly copy: Copy;
  readonly chrome: DetailChrome;
  readonly onKeep: (notes: string) => void;
  readonly saving: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.card, styles.conflict, { backgroundColor: chrome.surface, borderColor: chrome.accent }]}>
      <Text style={[styles.fieldKey, { color: chrome.accent }]}>{t("detail.conflict.title")}</Text>
      <Text style={[styles.notes, { color: chrome.ink }]}>{copy.notesConflict}</Text>
      <View style={styles.conflictActions}>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => onKeep(copy.notesConflict as string)}
          style={[styles.conflictButton, { borderColor: chrome.line }, saving && styles.dim]}
        >
          <Text style={[styles.conflictButtonText, { color: chrome.ink }]}>
            {t("detail.conflict.keepThis")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => onKeep(copy.notes ?? "")}
          style={[styles.conflictButton, { borderColor: chrome.line }, saving && styles.dim]}
        >
          <Text style={[styles.conflictButtonText, { color: chrome.ink }]}>
            {t("detail.conflict.keepMine")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Fields({ copy, chrome }: { readonly copy: Copy; readonly chrome: DetailChrome }) {
  const { t } = useTranslation();
  const rows: readonly (readonly [string, string])[] = [
    [t("detail.mediaCondition"), copy.condition === null ? "—" : CONDITION_LABELS[copy.condition]],
    [
      t("detail.sleeveCondition"),
      copy.sleeveCondition === null ? "—" : CONDITION_LABELS[copy.sleeveCondition],
    ],
    [t("detail.paid"), formatMoney(copy.pricePaidCents, copy.currency)],
    [t("detail.bought"), copy.purchasedOn ?? "—"],
    [t("detail.where"), copy.purchasedAt ?? "—"],
  ];
  return (
    <View style={styles.fields}>
      {rows.map(([key, value]) => (
        <View key={key} style={[styles.card, styles.fieldCard, { backgroundColor: chrome.surface }]}>
          <Text style={[styles.fieldKey, { color: chrome.muted }]}>{key}</Text>
          <Text style={[styles.fieldValue, { color: chrome.ink }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function Badge({
  children,
  chrome,
  strong = false,
}: {
  readonly children: React.ReactNode;
  readonly chrome: DetailChrome;
  readonly strong?: boolean;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: chrome.surface }]}>
      <Text style={[styles.badgeText, { color: strong ? chrome.ink : chrome.muted }]}>{children}</Text>
    </View>
  );
}

/** Exported for testing. */
export function formatMoney(cents: number | null, currency: string): string {
  if (cents === null) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: 40 },
  cover: { width: "100%", aspectRatio: 1 },
  // Width only: the hero is square because `cover` is, and a percentage height here is
  // what collapsed the art to nothing.
  coverImage: { width: "100%" },
  backWrap: { position: "absolute", left: 18, top: 0 },
  back: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center", marginTop: 8 },
  body: { paddingHorizontal: 20, paddingTop: 22 },
  badges: { flexDirection: "row", gap: 8 },
  badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 5 },
  badgeText: { fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "500" },
  title: { fontFamily: fonts.serif, fontSize: 32, marginTop: 14 },
  subtitle: { fontSize: 14, marginTop: 5 },
  stars: { flexDirection: "row", gap: 3, marginTop: 14 },
  edit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 999,
    marginTop: 22,
  },
  editText: { fontSize: 14, fontWeight: "600" },
  fields: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 24 },
  card: { borderRadius: 10, padding: 14 },
  fieldCard: { width: "47%" },
  fieldKey: { fontSize: 9.5, letterSpacing: 0.9, textTransform: "uppercase", fontWeight: "500" },
  fieldValue: { fontSize: 14, fontWeight: "600", marginTop: 5 },
  notesCard: { marginTop: 14 },
  notes: { fontSize: 13.5, lineHeight: 21, marginTop: 6 },
  conflict: { marginTop: 10, borderWidth: 1 },
  conflictActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  conflictButton: { height: 32, paddingHorizontal: 12, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  conflictButtonText: { fontSize: 12, fontWeight: "600" },
  dim: { opacity: 0.5 },
  sectionTitle: { fontSize: 13, fontWeight: "600", marginTop: 22, marginBottom: 10 },
  otherRow: { flexDirection: "row", gap: 10 },
  otherCard: { flex: 1 },
  otherValue: { fontSize: 12.5, fontWeight: "600", marginTop: 6 },
  remove: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 999,
    marginTop: 28,
  },
  removeText: { fontSize: 13, fontWeight: "500" },
});
