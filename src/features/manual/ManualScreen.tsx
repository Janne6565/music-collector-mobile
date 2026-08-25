import { useRouter } from "expo-router";
import { LibraryBig, ScanBarcode } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Format } from "@janne6565/music-collector-shared";
import { FORMATS, FORMAT_LABELS } from "@janne6565/music-collector-shared";
import { useManualEntryLogic } from "@/features/manual/useManualEntryLogic";
import { colors } from "@/theme/colors";

/**
 * Screen 14a — entering a copy no database has.
 *
 * One column, artist first, and everything below it optional. A record that is not in an
 * archive is usually one you know very little about, and a form that insisted on a
 * catalogue number would simply not get filled in. Saving lands on the copy with its
 * editor open, which is where the condition, the price and the shop belong.
 */
export function ManualScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const logic = useManualEntryLogic();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.cancel}>{t("common.cancel")}</Text>
          </Pressable>
          <Text style={styles.heading}>{t("manual.heading")}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !logic.canSave || logic.saving }}
            onPress={logic.save}
            disabled={!logic.canSave || logic.saving}
            hitSlop={10}
          >
            {logic.saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={logic.canSave ? styles.save : styles.saveOff}>{t("manual.save")}</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topRow}>
            {/* The deck's cover well. A picture of the copy is added on the copy itself,
                where the whole photo strip lives — one place to manage images rather than
                two that can disagree about which one is the preview. */}
            <View style={styles.coverWell}>
              <Text style={styles.coverLabel}>{t("manual.cover")}</Text>
            </View>

            <View style={styles.fill}>
              <Text style={styles.eyebrow}>{t("manual.artist")}</Text>
              <TextInput
                value={logic.fields.artist}
                onChangeText={(value) => logic.set("artist", value)}
                placeholder={t("manual.artistPlaceholder")}
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoFocus
                style={[styles.input, styles.inputLead]}
              />
              {logic.artistHint !== null && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => logic.set("artist", logic.artistHint?.name ?? "")}
                  style={styles.shelfRow}
                >
                  <LibraryBig size={13} color="rgba(255,255,255,0.4)" strokeWidth={1.75} />
                  <Text style={styles.shelfText} numberOfLines={1}>
                    {t("manual.onShelf", {
                      artist: logic.artistHint.name,
                      count: logic.artistHint.count,
                    })}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.eyebrow}>{t("manual.title")}</Text>
            <TextInput
              value={logic.fields.title}
              onChangeText={(value) => logic.set("title", value)}
              placeholder={t("manual.titlePlaceholder")}
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={styles.input}
            />
          </View>

          <View style={styles.pairRow}>
            <View style={styles.yearField}>
              <Text style={styles.eyebrow}>{t("manual.year")}</Text>
              <TextInput
                value={logic.fields.year}
                onChangeText={(value) => logic.set("year", value)}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="————"
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={styles.input}
              />
            </View>
            <View style={styles.fill}>
              <Text style={styles.eyebrow}>{t("manual.labelAndCatalog")}</Text>
              <TextInput
                value={logic.fields.label}
                onChangeText={(value) => logic.set("label", value)}
                placeholder={t("manual.labelPlaceholder")}
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.formatBlock}>
            <Text style={styles.eyebrow}>{t("manual.format")}</Text>
            <View style={styles.chips}>
              {FORMATS.map((format) => (
                <FormatChip
                  key={format}
                  format={format}
                  selected={logic.fields.format === format}
                  onPress={() => logic.set("format", format)}
                />
              ))}
            </View>
          </View>

          {/* What the copy is like is the next screen's question, not this one's — saving
              opens the editor on the copy this creates. */}
          <View style={styles.laterRow}>
            <Text style={styles.laterLabel}>{t("manual.later")}</Text>
            <Text style={styles.laterAction}>{t("manual.laterAction")}</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <ScanBarcode size={17} color="rgba(255,255,255,0.45)" strokeWidth={1.6} />
          <Text style={styles.footerText}>{t("manual.nothingLookedUp")}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormatChip({
  format,
  selected,
  onPress,
}: {
  readonly format: Format;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
    >
      <Text style={selected ? styles.chipTextOn : styles.chipTextOff}>{FORMAT_LABELS[format]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.night },
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
  },
  cancel: { fontSize: 13.5, fontWeight: "500", color: "rgba(255,255,255,0.6)" },
  heading: { fontSize: 14, fontWeight: "600", color: "#fff" },
  save: { fontSize: 13.5, fontWeight: "600", color: "#fff" },
  saveOff: { fontSize: 13.5, fontWeight: "600", color: "rgba(255,255,255,0.28)" },
  body: { paddingHorizontal: 18, paddingBottom: 28 },
  topRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  coverWell: {
    width: 84,
    height: 84,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverLabel: {
    fontSize: 8.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.45)",
  },
  eyebrow: {
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.4)",
  },
  input: {
    marginTop: 5,
    paddingBottom: 9,
    fontSize: 16,
    color: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.16)",
  },
  /** The field the screen opens on gets the solid rule the deck draws under it. */
  inputLead: { fontSize: 17, fontWeight: "500", borderBottomWidth: 1.5, borderBottomColor: "#fff" },
  shelfRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 9 },
  shelfText: { flex: 1, fontSize: 11.5, color: "rgba(255,255,255,0.5)" },
  field: { marginTop: 20 },
  pairRow: { flexDirection: "row", gap: 16, marginTop: 18 },
  yearField: { width: 88 },
  formatBlock: { marginTop: 22 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 9 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999 },
  chipOn: { backgroundColor: "#fff" },
  chipOff: { borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.18)" },
  chipTextOn: { fontSize: 12.5, fontWeight: "600", color: colors.night },
  chipTextOff: { fontSize: 12.5, fontWeight: "500", color: "rgba(255,255,255,0.65)" },
  laterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  laterLabel: { fontSize: 13.5, fontWeight: "500", color: "rgba(255,255,255,0.85)" },
  laterAction: { fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.45)" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  footerText: { flex: 1, fontSize: 11.5, lineHeight: 16, color: "rgba(255,255,255,0.45)" },
});
