import { Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { Condition, Copy, CopyPatch, DetailChrome, Format } from "@janne6565/music-collector-shared";
import {
  CONDITIONS,
  CONDITION_SHORT,
  FORMATS,
  FORMAT_LABELS,
  useCopyEditorLogic,
} from "@janne6565/music-collector-shared";
interface CopyEditorProps {
  readonly copy: Copy;
  readonly chrome: DetailChrome;
  readonly saving: boolean;
  readonly onSave: (patch: CopyPatch) => void;
  readonly onCancel: () => void;
}

/** Editing a copy — what you paid, its condition, where it came from. */
export function CopyEditor({ copy, chrome, saving, onSave, onCancel }: CopyEditorProps) {
  const { t } = useTranslation();
  const editor = useCopyEditorLogic(copy, onSave);

  return (
    <View style={styles.root}>
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
          <Labelled label={t("manual.labelAndCatalog")} chrome={chrome}>
            <TextInput
              value={editor.fields.label}
              onChangeText={(value) => editor.set("label", value)}
              placeholder={t("manual.labelPlaceholder")}
              placeholderTextColor={chrome.muted}
              style={[styles.input, { color: chrome.ink }]}
            />
          </Labelled>
          <Text style={[styles.legend, { color: chrome.muted }]}>{t("manual.format")}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {FORMATS.map((format) => (
              <Chip
                key={format}
                label={FORMAT_LABELS[format]}
                active={editor.fields.format === format}
                chrome={chrome}
                onPress={() => editor.set("format", format as Format)}
              />
            ))}
          </ScrollView>
        </>
      )}

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
                color={star <= (editor.fields.rating ?? 0) ? chrome.accent : chrome.line}
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

      <View style={styles.actions}>
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
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            editor.reset();
            onCancel();
          }}
          style={[styles.secondary, { backgroundColor: chrome.surface }]}
        >
          <Text style={[styles.secondaryText, { color: chrome.muted }]}>{t("common.cancel")}</Text>
        </Pressable>
      </View>
    </View>
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
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
      <Text style={[styles.chipText, { color: active ? chrome.background : chrome.muted }]}>{label}</Text>
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
  root: { marginTop: 24, gap: 10 },
  legend: { fontSize: 9.5, letterSpacing: 0.9, textTransform: "uppercase", fontWeight: "500" },
  chips: { flexDirection: "row", gap: 7, paddingVertical: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: "600" },
  card: { borderRadius: 10, padding: 14, gap: 6 },
  input: { fontSize: 15, fontWeight: "600", padding: 0 },
  multiline: { fontWeight: "400", minHeight: 66, textAlignVertical: "top" },
  stars: { flexDirection: "row", gap: 6, paddingTop: 2 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  primary: { flex: 1, height: 46, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  primaryText: { fontSize: 14, fontWeight: "600" },
  secondary: { paddingHorizontal: 20, height: 46, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontSize: 14, fontWeight: "600" },
  dim: { opacity: 0.6 },
});
