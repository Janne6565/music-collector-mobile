import { useRouter } from "expo-router";
import { ChevronLeft, Pencil, Star, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FormatThumb } from "@/components/FormatThumb";
import type { Copy } from "@/domain/types";
import { CONDITION_LABELS, CONDITION_SHORT, FORMAT_LABELS } from "@/domain/types";
import { type DetailChrome, chromeFor } from "@/features/detail/theme";
import { CopyEditor } from "@/features/detail/CopyEditor";
import { useDetailLogic } from "@/features/detail/useDetailLogic";
import { PhotoStrip } from "@/features/photos/PhotoStrip";
import { fonts } from "@/theme/colors";

export function DetailScreen({ copyId }: { readonly copyId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const logic = useDetailLogic(copyId);
  const [editing, setEditing] = useState(false);

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
  const chrome = chromeFor(release?.coverTheme ?? null);

  return (
    <View style={[styles.root, { backgroundColor: chrome.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.cover}>
          {release?.coverArtUrl == null ? (
            <FormatThumb format={release?.format ?? "OTHER"} />
          ) : (
            <Image source={{ uri: release.coverArtUrl }} style={styles.coverImage} />
          )}
          <SafeAreaView style={styles.backWrap} edges={["top"]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("detail.back")}
              onPress={() => router.back()}
              style={[styles.back, { backgroundColor: chrome.surface }]}
            >
              <ChevronLeft size={18} color={chrome.ink} strokeWidth={1.75} />
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          <View style={styles.badges}>
            {release !== undefined && (
              <Badge chrome={chrome} strong>
                {FORMAT_LABELS[release.format]}
              </Badge>
            )}
            {copy.condition !== null && <Badge chrome={chrome}>{CONDITION_SHORT[copy.condition]}</Badge>}
          </View>

          <Text style={[styles.title, { color: chrome.ink }]}>{release?.title ?? "—"}</Text>
          <Text style={[styles.subtitle, { color: chrome.muted }]}>
            {release?.artistName}
            {release?.year == null ? "" : ` · ${release.year}`}
          </Text>

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={15}
                strokeWidth={1.5}
                color={star <= (copy.rating ?? 0) ? chrome.accent : chrome.line}
                fill={star <= (copy.rating ?? 0) ? chrome.accent : "transparent"}
              />
            ))}
          </View>

          {editing ? (
            <CopyEditor
              copy={copy}
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

          <PhotoStrip copyId={copy.id} chrome={chrome} />

          <View style={[styles.card, { backgroundColor: chrome.surface }]}>
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
                      {siblingRelease === undefined ? "—" : FORMAT_LABELS[siblingRelease.format]}
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
    </View>
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
    [t("detail.condition"), copy.condition === null ? "—" : CONDITION_LABELS[copy.condition]],
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
  coverImage: { width: "100%", height: "100%" },
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
