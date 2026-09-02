import { CHOOSABLE_FORMATS } from "@/domain/formats";
import { CoverSheet } from "@/features/detail/CoverSheet";
import { fonts } from "@/theme/colors";
import type {
  Condition,
  Copy,
  CopyPatch,
  DetailChrome,
  Format,
  Release,
} from "@janne6565/rekordo-shared";
import {
  CONDITIONS,
  CONDITION_SHORT,
  FORMAT_LABELS,
  useCopyEditorLogic,
} from "@janne6565/rekordo-shared";
import { Eye, EyeOff, Star } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface CopyEditorProps {
  readonly copy: Copy;
  readonly release: Release | undefined;
  /** The sleeve, which the frame keeps as a band above the form. */
  readonly art: ReactNode;
  readonly chrome: DetailChrome;
  readonly saving: boolean;
  readonly onSave: (patch: CopyPatch) => void;
  readonly onCancel: () => void;
}

/**
 * Editing a copy — what you paid, its condition, where it came from. Turn 2a.
 *
 * A mode with its own frame rather than a block that unfolds inside the read page. The
 * page it replaces is a record being read: a sleeve the size of the screen, the facts, the
 * photographs, the tracklist, the way to throw it away. None of that is being edited, and
 * leaving it on screen under the form made the two Save buttons at the bottom look like
 * the end of the page rather than the end of the mode.
 *
 * So the sleeve is parked at the band it collapses to anyway, the record is named once in
 * a line, and Save and Cancel are pinned where they can be reached from any field.
 *
 * It owns `useCopyEditorLogic`, and therefore mounts only while editing: the fields are
 * seeded from the copy once, so a form kept alive behind a read page would be editing
 * whatever the copy was when the page opened.
 *
 * There is no swipe to a neighbouring copy here. On the read page that gesture is how you
 * move along the shelf; over a form with unsaved changes it is how you lose them.
 */
export function CopyEditor({
  copy,
  release,
  art,
  chrome,
  saving,
  onSave,
  onCancel,
}: CopyEditorProps) {
  const { t } = useTranslation();
  const editor = useCopyEditorLogic(copy, onSave, release?.format);

  const leave = () => {
    editor.reset();
    onCancel();
  };

  return (
    <CoverSheet
      parked
      art={art}
      chrome={chrome}
      onClose={leave}
      footer={
        // Cancel on the left, where the way out has been all along — the X above it is in
        // the same column. Save takes the rest of the bar because it is the one you mean.
        <SafeAreaView
          edges={["bottom"]}
          style={[styles.bar, { backgroundColor: chrome.background, borderTopColor: chrome.line }]}
        >
          <View style={styles.barRow}>
            <CopyEditorActions editor={editor} chrome={chrome} saving={saving} onCancel={leave} />
          </View>
        </SafeAreaView>
      }
    >
      <View style={styles.root}>
        {/* The record, named once and on one line. The read page gives it a serif line of
            its own over a sleeve the size of the screen; here it is a caption on a form. */}
        <View style={styles.heading}>
          <Text style={[styles.headingTitle, { color: chrome.ink }]} numberOfLines={1}>
            {release?.title ?? t("conflict.untitled")}
          </Text>
          <Text style={[styles.headingMeta, { color: chrome.muted }]} numberOfLines={1}>
            {release?.artistName}
            {release?.year == null ? "" : ` · ${release.year}`}
          </Text>
        </View>

        <CopyEditorFields
          editor={editor}
          copy={copy}
          chrome={chrome}
          saving={saving}
          onSave={onSave}
        />
      </View>
    </CoverSheet>
  );
}

/**
 * The same form without a frame — the add flow's run through the copies it just saved,
 * which supplies its own header, its own position counter and its own way to skip.
 *
 * Keeps the buttons in the body, because there they are the end of one record's form and
 * the way on to the next, not the end of a mode.
 */
export function InlineCopyEditor({
  copy,
  catalogFormat,
  chrome,
  saving,
  onSave,
  onCancel,
}: {
  readonly copy: Copy;
  /** What the archive says this pressing is, so the chips start where it stands. */
  readonly catalogFormat?: Format;
  readonly chrome: DetailChrome;
  readonly saving: boolean;
  readonly onSave: (patch: CopyPatch) => void;
  readonly onCancel: () => void;
}) {
  const editor = useCopyEditorLogic(copy, onSave, catalogFormat);

  return (
    <View style={styles.inlineRoot}>
      <CopyEditorFields
        editor={editor}
        copy={copy}
        chrome={chrome}
        saving={saving}
        onSave={onSave}
      />
      <View style={styles.inlineActions}>
        <CopyEditorActions
          editor={editor}
          chrome={chrome}
          saving={saving}
          onCancel={() => {
            editor.reset();
            onCancel();
          }}
        />
      </View>
    </View>
  );
}

type Editor = ReturnType<typeof useCopyEditorLogic>;

/** Every field a copy has, and nothing about where they are drawn. */
function CopyEditorFields({
  editor,
  copy,
  chrome,
  saving,
  onSave,
}: {
  readonly editor: Editor;
  readonly copy: Copy;
  readonly chrome: DetailChrome;
  readonly saving: boolean;
  readonly onSave: (patch: CopyPatch) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      {/* Only a hand-entered copy carries the pressing's own facts, and only it can correct
        them — no archive is ever going to fix a typo in a bootleg nobody has listed. */}
      {editor.manual && (
        <>
          <Labelled label={t("manual.artist")} chrome={chrome}>
            <TextInput
              value={editor.fields.artist}
              onChangeText={(value) => editor.set("artist", value)}
              placeholder={t("manual.artistPlaceholder")}
              placeholderTextColor={chrome.muted}
              style={[styles.input, { color: chrome.ink }]}
            />
          </Labelled>
          <Labelled label={t("manual.title")} chrome={chrome}>
            <TextInput
              value={editor.fields.title}
              onChangeText={(value) => editor.set("title", value)}
              placeholder={t("manual.titlePlaceholder")}
              placeholderTextColor={chrome.muted}
              style={[styles.input, { color: chrome.ink }]}
            />
          </Labelled>
          <Labelled label={t("manual.year")} chrome={chrome}>
            <TextInput
              value={editor.fields.year}
              onChangeText={(value) => editor.set("year", value)}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="————"
              placeholderTextColor={chrome.muted}
              style={[styles.input, { color: chrome.ink }]}
            />
          </Labelled>
          <Labelled label={t("manual.label")} chrome={chrome}>
            <TextInput
              value={editor.fields.label}
              onChangeText={(value) => editor.set("label", value)}
              placeholder={t("manual.labelPlaceholder")}
              placeholderTextColor={chrome.muted}
              style={[styles.input, { color: chrome.ink }]}
            />
          </Labelled>
        </>
      )}

      {/* Outside the block above: every copy may say what it is. The archive answers for
        the pressing, but what is on your shelf can be a tape of a record it only lists
        as vinyl — and picking the catalogue's format again puts the copy back to
        following it.

        Four chips, never five: `OTHER` is what `copyFormat` answers when nothing has said
        yet, not something to choose. A copy sitting at it lights nothing here, which reads
        as the question it is. */}
      <Text style={[styles.legend, { color: chrome.muted }]}>{t("manual.format")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {CHOOSABLE_FORMATS.map((format) => (
          <Chip
            key={format}
            label={FORMAT_LABELS[format]}
            active={editor.fields.format === format}
            chrome={chrome}
            onPress={() => editor.set("format", format as Format)}
          />
        ))}
      </ScrollView>

      <GradeRow
        label={t("detail.mediaCondition")}
        value={editor.fields.condition}
        chrome={chrome}
        onChange={(value) => editor.set("condition", value)}
      />
      {/* Two grades, not one: sellers list the record and its jacket separately, and a
        near-mint pressing in a ring-worn sleeve is a different object from a near-mint
        one in a near-mint sleeve. */}
      <GradeRow
        label={t("detail.sleeveCondition")}
        value={editor.fields.sleeveCondition}
        chrome={chrome}
        onChange={(value) => editor.set("sleeveCondition", value)}
      />

      <Labelled
        label={editor.priceInvalid ? t("editor.badPrice") : t("detail.paid")}
        error={editor.priceInvalid}
        chrome={chrome}
      >
        <TextInput
          value={editor.fields.price}
          onChangeText={(value) => editor.set("price", value)}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={chrome.muted}
          style={[styles.input, { color: chrome.ink }]}
        />
      </Labelled>

      <Labelled
        label={editor.dateInvalid ? t("editor.badDate") : t("detail.bought")}
        error={editor.dateInvalid}
        chrome={chrome}
      >
        <TextInput
          value={editor.fields.purchasedOn}
          onChangeText={(value) => editor.set("purchasedOn", value)}
          // A plain field rather than a native picker: the picker is another native
          // dependency, and this app has no dev client built yet.
          placeholder="YYYY-MM-DD"
          placeholderTextColor={chrome.muted}
          autoCapitalize="none"
          style={[styles.input, { color: chrome.ink }]}
        />
      </Labelled>

      <Labelled label={t("detail.where")} chrome={chrome}>
        <TextInput
          value={editor.fields.purchasedAt}
          onChangeText={(value) => editor.set("purchasedAt", value)}
          placeholder={t("editor.wherePlaceholder")}
          placeholderTextColor={chrome.muted}
          style={[styles.input, { color: chrome.ink }]}
        />
      </Labelled>

      <Labelled label={t("detail.rating")} chrome={chrome}>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              accessibilityRole="button"
              accessibilityLabel={t("editor.rate", { count: star })}
              // Tapping the current rating clears it, so a mis-tap is not permanent.
              onPress={() => editor.set("rating", editor.fields.rating === star ? null : star)}
            >
              <Star
                size={22}
                strokeWidth={1.5}
                // Same as the read-only row: `line` is a rule tone, not a glyph tone, and
                // a rating you cannot see the empty half of is one you cannot read.
                color={star <= (editor.fields.rating ?? 0) ? chrome.accent : chrome.muted}
                fill={star <= (editor.fields.rating ?? 0) ? chrome.accent : "transparent"}
              />
            </Pressable>
          ))}
        </View>
      </Labelled>

      <Labelled label={t("detail.notes")} chrome={chrome}>
        <TextInput
          value={editor.fields.notes}
          onChangeText={(value) => editor.set("notes", value)}
          multiline
          placeholder={t("editor.notesPlaceholder")}
          placeholderTextColor={chrome.muted}
          style={[styles.input, styles.multiline, { color: chrome.ink }]}
        />
      </Labelled>

      {/*
      Hiding is written straight through rather than waiting for Save. It is not an edit
      to the record's facts, it is a decision about who may see it, and a privacy switch
      that only takes effect once you remember to press Save is the wrong kind of switch.
    */}
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: copy.hidden }}
        onPress={() => onSave({ hidden: !copy.hidden })}
        disabled={saving}
        style={styles.hideRow}
      >
        {copy.hidden ? (
          <EyeOff size={15} color={chrome.muted} strokeWidth={1.75} />
        ) : (
          <Eye size={15} color={chrome.muted} strokeWidth={1.75} />
        )}
        <Text style={[styles.hideLabel, { color: chrome.muted }]}>
          {copy.hidden ? t("copyEditor.hidden") : t("copyEditor.hide")}
        </Text>
      </Pressable>
    </>
  );
}

/**
 * Cancel and Save, in that order.
 *
 * Cancel first because the way out of this screen has been on the left since the X at the
 * top of it, and Save wide because it is the one you mean. It was the other way round.
 */
function CopyEditorActions({
  editor,
  chrome,
  saving,
  onCancel,
}: {
  readonly editor: Editor;
  readonly chrome: DetailChrome;
  readonly saving: boolean;
  readonly onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={onCancel}
        style={[styles.secondary, { backgroundColor: chrome.surface }]}
      >
        <Text style={[styles.secondaryText, { color: chrome.muted }]}>{t("common.cancel")}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={editor.submit}
        // A hand-entered copy cleared of its artist or title has nothing left to name it.
        disabled={saving || !editor.canSave}
        style={[
          styles.primary,
          { backgroundColor: chrome.ink },
          (saving || !editor.canSave) && styles.dim,
        ]}
      >
        {saving ? (
          <ActivityIndicator size="small" color={chrome.background} />
        ) : (
          <Text style={[styles.primaryText, { color: chrome.background }]}>{t("common.save")}</Text>
        )}
      </Pressable>
    </>
  );
}

function GradeRow({
  label,
  value,
  chrome,
  onChange,
}: {
  readonly label: string;
  readonly value: Condition | "";
  readonly chrome: DetailChrome;
  readonly onChange: (value: Condition | "") => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Text style={[styles.legend, { color: chrome.muted }]}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label={t("editor.unset")}
          active={value === ""}
          chrome={chrome}
          onPress={() => onChange("")}
        />
        {CONDITIONS.map((condition) => (
          <Chip
            key={condition}
            label={CONDITION_SHORT[condition]}
            active={value === condition}
            chrome={chrome}
            onPress={() => onChange(condition)}
          />
        ))}
      </ScrollView>
    </>
  );
}

function Chip({
  label,
  active,
  chrome,
  onPress,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly chrome: DetailChrome;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? chrome.ink : chrome.surface }]}
    >
      <Text style={[styles.chipText, { color: active ? chrome.background : chrome.muted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Labelled({
  label,
  chrome,
  error = false,
  children,
}: {
  readonly label: string;
  readonly chrome: DetailChrome;
  readonly error?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <View style={[styles.card, { backgroundColor: chrome.surface }]}>
      <Text style={[styles.legend, { color: error ? chrome.accent : chrome.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 24, gap: 10 },
  heading: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 10 },
  headingTitle: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 28, flexShrink: 1 },
  headingMeta: { fontSize: 12.5, flexShrink: 1 },
  inlineRoot: { marginTop: 24, gap: 10 },
  inlineActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  legend: { fontSize: 9.5, letterSpacing: 0.9, textTransform: "uppercase", fontWeight: "500" },
  chips: { flexDirection: "row", gap: 7, paddingVertical: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: "600" },
  card: { borderRadius: 10, padding: 14, gap: 6 },
  input: { fontSize: 15, fontWeight: "600", padding: 0 },
  multiline: { fontWeight: "400", minHeight: 66, textAlignVertical: "top" },
  stars: { flexDirection: "row", gap: 6, paddingTop: 2 },
  hideRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 12 },
  hideLabel: { fontFamily: fonts.sans, fontSize: 13 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  primary: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: 14, fontWeight: "600" },
  secondary: {
    paddingHorizontal: 20,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 14, fontWeight: "600" },
  dim: { opacity: 0.6 },
});
