import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import {
  ArrowUpLeft,
  Clock,
  Heart,
  Plus,
  PencilLine,
  ScanBarcode,
  Search,
  SearchX,
  X,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { releaseDisambiguation } from "@/api/releases";
import { FormatThumb } from "@/components/FormatThumb";
import { ReleaseArt } from "@/components/ReleaseArt";
import type { Release, WishlistItem } from "@/domain/types";
import { FORMAT_LABELS } from "@/domain/types";
import { useAddLogic } from "@/features/add/useAddLogic";
import { colors, fonts } from "@/theme/colors";

type Logic = ReturnType<typeof useAddLogic>;

/**
 * The add flow (screens 1e, 2a, 5a, 8c).
 *
 * Dark chrome, unlike the rest of the app: this screen is a viewfinder as much as a form,
 * and the camera it opens into is dark. Flashing a paper-white sheet on the way to a scan
 * is the one place the light theme actively hurts.
 */
export function AddScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const logic = useAddLogic();
  const [permission, requestPermission] = useCameraPermissions();

  if (logic.scanning) {
    return <Scanner onScan={logic.handleScan} onCancel={logic.stopScanning} />;
  }

  const scan = async () => {
    if (permission?.granted !== true) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    logic.startScanning();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.searchBox}>
          <Search size={16} color="rgba(255,255,255,0.65)" strokeWidth={1.75} />
          <TextInput
            value={logic.term}
            onChangeText={logic.setTerm}
            onSubmitEditing={logic.submit}
            returnKeyType="search"
            placeholder={t("add.searchPlaceholder")}
            placeholderTextColor="rgba(255,255,255,0.42)"
            style={styles.searchInput}
          />
          {logic.term !== "" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("add.clearSearch")}
              onPress={() => logic.setTerm("")}
              style={styles.clear}
            >
              <X size={12} color={colors.night} strokeWidth={1.75} />
            </Pressable>
          )}
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.cancel}>{t("common.cancel")}</Text>
        </Pressable>
      </View>

      <Body logic={logic} onScan={() => void scan()} />
    </SafeAreaView>
  );
}

function Body({ logic, onScan }: { readonly logic: Logic; readonly onScan: () => void }) {
  const { t } = useTranslation();

  if (logic.searching) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.hint}>{t("add.searching")}</Text>
      </View>
    );
  }
  if (logic.failed) return <Text style={styles.hint}>{t("add.failed")}</Text>;
  if (!logic.hasSearched) return <BeforeTyping logic={logic} onScan={onScan} />;
  if (logic.results.length === 0) {
    return logic.searchedBarcode ? (
      <BarcodeNotFound logic={logic} onScan={onScan} />
    ) : (
      <Text style={styles.hint}>{t("add.noResults")}</Text>
    );
  }

  return (
    <FlatList
      data={logic.results}
      keyExtractor={(release) => release.mbid}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <ResultRow
          release={item}
          adding={logic.addingMbid === item.mbid}
          onAdd={() => logic.addRelease(item)}
          wishing={logic.wishingMbid === item.mbid}
          onWish={() => logic.wishFor(item)}
        />
      )}
    />
  );
}

/** Screen 5a — nothing searched yet. */
function BeforeTyping({ logic, onScan }: { readonly logic: Logic; readonly onScan: () => void }) {
  const { t } = useTranslation();

  return (
    <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
      <View style={styles.shortcuts}>
        <Pressable accessibilityRole="button" onPress={onScan} style={styles.shortcut}>
          <ScanBarcode size={20} color="#fff" strokeWidth={1.6} />
          <Text style={styles.shortcutTitle}>{t("add.scanCard.title")}</Text>
          <Text style={styles.shortcutBody}>{t("add.scanCard.body")}</Text>
        </Pressable>
        {/* Manual entry is in the deck but its form has not been designed. Shown rather
            than hidden, so the way in is discoverable before it works — disabled and
            labelled, so it never looks like a card that failed to respond. */}
        <View
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel={`${t("add.manualCard.title")} — ${t("add.manualSoon")}`}
          style={[styles.shortcut, styles.shortcutDisabled]}
        >
          <PencilLine size={20} color="rgba(255,255,255,0.55)" strokeWidth={1.6} />
          <View style={styles.shortcutTitleRow}>
            <Text style={styles.shortcutTitleDim}>{t("add.manualCard.title")}</Text>
            <Text style={styles.soon}>{t("add.soon")}</Text>
          </View>
          <Text style={styles.shortcutBody}>{t("add.manualSoon")}</Text>
        </View>
      </View>

      {logic.recentSearches.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.section}>{t("addDialog.recent")}</Text>
            <Pressable accessibilityRole="button" onPress={logic.clearRecent}>
              <Text style={styles.sectionAction}>{t("addDialog.clearRecent")}</Text>
            </Pressable>
          </View>
          {logic.recentSearches.map((term) => (
            <Pressable
              key={term}
              accessibilityRole="button"
              onPress={() => logic.repeatSearch(term)}
              style={styles.recentRow}
            >
              <Clock size={16} color="rgba(255,255,255,0.4)" strokeWidth={1.75} />
              <Text style={styles.recentText} numberOfLines={1}>
                {term}
              </Text>
              <ArrowUpLeft size={15} color="rgba(255,255,255,0.35)" strokeWidth={1.75} />
            </Pressable>
          ))}
        </>
      )}

      {logic.wishlist.length > 0 && (
        <>
          <Text style={[styles.section, styles.sectionSpaced]}>{t("add.onWishlist")}</Text>
          {logic.wishlist.map((item: WishlistItem) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => logic.searchWish(item.title, item.artistName)}
              style={styles.row}
            >
              <View style={styles.thumb}>
                <FormatThumb format={item.desiredFormat ?? "OTHER"} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowSubtitle} numberOfLines={1}>
                  {item.artistName}
                  {item.year === null ? "" : ` · ${item.year}`}
                  {item.desiredFormat === null ? "" : ` · ${FORMAT_LABELS[item.desiredFormat]}`}
                </Text>
              </View>
              <View style={styles.rowAdd}>
                <Plus size={16} color="#fff" strokeWidth={1.75} />
              </View>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

/** Screen 8c — the barcode scanned fine and matched nothing. */
function BarcodeNotFound({ logic, onScan }: { readonly logic: Logic; readonly onScan: () => void }) {
  const { t } = useTranslation();

  return (
    <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
      <View style={styles.scanned}>
        <ScanBarcode size={18} color="rgba(255,255,255,0.6)" strokeWidth={1.6} />
        <View style={styles.rowBody}>
          <Text style={styles.scannedCode}>{logic.submittedTerm}</Text>
          <Text style={styles.scannedSource}>{t("add.checkedSources")}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onScan}>
          <Text style={styles.rescan}>{t("add.rescan")}</Text>
        </Pressable>
      </View>

      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <SearchX size={26} color="rgba(255,255,255,0.55)" strokeWidth={1.5} />
        </View>
        <Text style={styles.emptyTitle}>{t("add.barcodeMissing.title")}</Text>
        <Text style={styles.emptyBody}>{t("add.barcodeMissing.body")}</Text>
      </View>

      {/* The deck makes manual entry the primary way out of here. The form does not exist
          yet, so the button is present and plainly disabled rather than missing — a dead
          end you can see is better than one you go looking for. */}
      <View
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        accessibilityLabel={`${t("add.enterManually")} — ${t("add.manualSoon")}`}
        style={[styles.primaryAction, styles.actionDisabled]}
      >
        <PencilLine size={16} color="rgba(20,19,17,0.45)" strokeWidth={1.9} />
        <Text style={styles.primaryActionText}>{t("add.enterManually")}</Text>
        <Text style={styles.soonDark}>{t("add.soon")}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => logic.setTerm("")}
        style={styles.secondaryAction}
      >
        <Search size={16} color="#fff" strokeWidth={1.9} />
        <Text style={styles.secondaryActionText}>{t("add.searchByTitle")}</Text>
      </Pressable>
    </ScrollView>
  );
}

/** One row per release *and* format, as screen 2a lists them. */
function ResultRow({
  release,
  adding,
  onAdd,
  wishing,
  onWish,
}: {
  readonly release: Release;
  readonly adding: boolean;
  readonly onAdd: () => void;
  readonly wishing: boolean;
  readonly onWish: () => void;
}) {
  const { t } = useTranslation();
  const subtitle = releaseDisambiguation(release);

  return (
    <View style={styles.row}>
      {/* The real cover, not just the format silhouette. Picking between four pressings of
          the same album is largely a visual job, and the sleeve is the thing people
          recognise. The format is still named in the line below, and ReleaseArt falls back
          to the silhouette whenever the archive has nothing. */}
      <View style={styles.thumb}>
        <ReleaseArt release={release} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {release.title}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {release.artistName}
          {release.year === null ? "" : ` · ${release.year}`}
          {` · ${FORMAT_LABELS[release.format]}`}
        </Text>
        {subtitle !== "" && (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("wishlist.addToWishlist")}
        onPress={onWish}
        disabled={wishing}
        style={styles.rowAdd}
      >
        {wishing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Heart size={15} color="rgba(255,255,255,0.7)" strokeWidth={1.75} />
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("add.add")}
        onPress={onAdd}
        disabled={adding}
        style={styles.rowAdd}
      >
        {adding ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Plus size={16} color="#fff" strokeWidth={1.75} />
        )}
      </Pressable>
    </View>
  );
}

function Scanner({
  onScan,
  onCancel,
}: {
  readonly onScan: (code: string) => void;
  readonly onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.scanner}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
        onBarcodeScanned={(result) => onScan(result.data)}
      />
      <SafeAreaView style={styles.scannerOverlay} edges={["top", "bottom"]}>
        <Pressable onPress={onCancel} accessibilityRole="button" style={styles.scannerClose}>
          <X size={20} color="#fff" strokeWidth={1.75} />
        </Pressable>
        <View style={styles.scannerFrame} />
        <Text style={styles.scannerHint}>{t("add.scanHint")}</Text>
      </SafeAreaView>
    </View>
  );
}

const RAISED = "rgba(255,255,255,0.07)";
const HAIRLINE = "rgba(255,255,255,0.09)";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.night },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingTop: 8 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    height: 44,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.24)",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#fff" },
  clear: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancel: { fontSize: 13.5, fontWeight: "500", color: "rgba(255,255,255,0.6)" },
  centered: { alignItems: "center", paddingTop: 32, gap: 10 },
  hint: { fontSize: 13, color: "rgba(255,255,255,0.5)", padding: 18 },
  list: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28 },
  shortcuts: { flexDirection: "row", gap: 10 },
  shortcut: { flex: 1, gap: 9, padding: 14, borderRadius: 12, backgroundColor: RAISED },
  shortcutDisabled: { opacity: 0.6 },
  shortcutTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  shortcutTitle: { fontSize: 13, fontWeight: "600", color: "#fff" },
  shortcutTitleDim: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  soon: {
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  soonDark: {
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "rgba(20,19,17,0.45)",
    backgroundColor: "rgba(20,19,17,0.08)",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  shortcutBody: { fontSize: 11, lineHeight: 16, color: "rgba(255,255,255,0.45)" },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 26,
  },
  section: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.4)",
  },
  sectionSpaced: { marginTop: 26 },
  sectionAction: { fontSize: 11.5, fontWeight: "500", color: "rgba(255,255,255,0.45)" },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
  },
  recentText: { flex: 1, fontSize: 14, color: "#fff" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
  },
  thumb: { width: 46, height: 46 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 13.5, fontWeight: "600", color: "#fff" },
  rowSubtitle: { fontSize: 11.5, color: "rgba(255,255,255,0.55)" },
  rowMeta: { fontSize: 10, color: "rgba(255,255,255,0.38)" },
  rowAdd: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanned: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 13,
    borderRadius: 12,
    backgroundColor: RAISED,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  scannedCode: { fontSize: 12, fontVariant: ["tabular-nums"], color: "#fff" },
  scannedSource: { fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 },
  rescan: { fontSize: 11.5, fontWeight: "500", color: "rgba(255,255,255,0.55)" },
  emptyState: { alignItems: "center", marginTop: 34, gap: 8 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 24, color: "#fff", textAlign: "center" },
  emptyBody: {
    fontSize: 13,
    lineHeight: 21,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    marginTop: 26,
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  primaryActionText: { fontSize: 14, fontWeight: "600", color: "rgba(20,19,17,0.45)" },
  actionDisabled: { opacity: 0.55 },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
  },
  secondaryActionText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  scanner: { flex: 1, backgroundColor: "#000" },
  scannerOverlay: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  scannerClose: { position: "absolute", top: 12, left: 18, padding: 8 },
  scannerFrame: {
    width: 230,
    height: 230,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.28)",
  },
  scannerHint: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: "#fff",
    textAlign: "center",
    paddingHorizontal: 30,
  },
});
