import { Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { Condition, Copy } from "@/domain/types";
import { CONDITIONS, CONDITION_SHORT } from "@/domain/types";
import type { DetailChrome } from "@/features/detail/theme";
import { useCopyEditorLogic } from "@/features/detail/useCopyEditorLogic";
import type { CopyDraft } from "@/local/copyWrites";

interface CopyEditorProps {
  readonly copy: Copy;
  readonly chrome: DetailChrome;
  readonly saving: boolean;
  readonly onSave: (patch: Partial<CopyDraft>) => void;
  readonly onCancel: () => void;
}

/** Editing a copy — what you paid, its condition, where it came from. */
export function CopyEditor({ copy, chrome, saving, onSave, onCancel }: CopyEditorProps) {
  const { t } = useTranslation();
  const editor = useCopyEditorLogic(copy, onSave);

  return (
    <View style={styles.root}>
      <Text style={[styles.legend, { color: chrome.muted }]}>{t("detail.condition")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip
          label={t("editor.unset")}
          active={editor.fields.condition === ""}
          chrome={chrome}
          onPress={() => editor.set("condition", "")}
        />
        {CONDITIONS.map((condition) => (
          <Chip
            key={condition}
            label={CONDITION_SHORT[condition]}
            active={editor.fields.condition === condition}
            chrome={chrome}
            onPress={() => editor.set("condition", condition as Condition)}
          />
        ))}
      </ScrollView>

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
          disabled={saving}
          style={[styles.primary, { backgroundColor: chrome.ink }, saving && styles.dim]}
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
