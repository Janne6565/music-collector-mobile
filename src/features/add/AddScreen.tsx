import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Heart, Plus, ScanBarcode, Search, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { releaseDisambiguation } from "@/api/releases";
import { FormatThumb } from "@/components/FormatThumb";
import type { Release } from "@/domain/types";
import { FORMAT_LABELS } from "@/domain/types";
import { useAddLogic } from "@/features/add/useAddLogic";
import { colors, fonts } from "@/theme/colors";

export function AddScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const logic = useAddLogic();
  const [permission, requestPermission] = useCameraPermissions();

  if (logic.scanning) {
    return <Scanner onScan={logic.handleScan} onCancel={logic.stopScanning} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.cancel}>{t("common.cancel")}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t("add.title")}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={16} color={colors.inkSubtle} strokeWidth={1.75} />
          <TextInput
            value={logic.term}
            onChangeText={logic.setTerm}
            onSubmitEditing={logic.submit}
            returnKeyType="search"
            placeholder={t("add.searchPlaceholder")}
            placeholderTextColor={colors.inkSubtle}
            style={styles.searchInput}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("add.scan")}
          onPress={async () => {
            if (permission?.granted !== true) {
              const result = await requestPermission();
              if (!result.granted) return;
            }
            logic.startScanning();
          }}
          style={styles.scanButton}
        >
          <ScanBarcode size={19} color={colors.paper} strokeWidth={1.75} />
        </Pressable>
      </View>

      <Results logic={logic} />
    </SafeAreaView>
  );
}

function Results({ logic }: { readonly logic: ReturnType<typeof useAddLogic> }) {
  const { t } = useTranslation();

  if (logic.searching) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.ink} />
        <Text style={styles.hint}>{t("add.searching")}</Text>
      </View>
    );
  }
  if (logic.failed) return <Text style={styles.hint}>{t("add.failed")}</Text>;
  if (!logic.hasSearched) return <Text style={styles.hint}>{t("add.hint")}</Text>;
  if (logic.results.length === 0) return <Text style={styles.hint}>{t("add.noResults")}</Text>;

  return (
    <FlatList
      data={logic.results}
      keyExtractor={(release) => release.mbid}
      contentContainerStyle={styles.list}
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
      <View style={styles.thumb}>
        <FormatThumb format={release.format} />
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
          <ActivityIndicator size="small" color={colors.ink} />
        ) : (
          <Heart size={15} color={colors.inkMuted} strokeWidth={1.75} />
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
          <ActivityIndicator size="small" color={colors.ink} />
        ) : (
          <Plus size={16} color={colors.ink} strokeWidth={1.75} />
        )}
      </Pressable>
    </View>
  );
}

function Scanner({ onScan, onCancel }: { readonly onScan: (code: string) => void; readonly onCancel: () => void }) {
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 6,
  },
  cancel: { fontSize: 13, color: colors.inkMuted },
  headerTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  headerSpacer: { width: 48 },
  searchRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingTop: 14 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    height: 44,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink },
  scanButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: { alignItems: "center", paddingTop: 32, gap: 10 },
  hint: { fontSize: 13, color: colors.inkMuted, padding: 18 },
  list: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  thumb: { width: 48 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 13.5, fontWeight: "600", color: colors.ink },
  rowSubtitle: { fontSize: 11.5, color: colors.inkMuted },
  rowMeta: { fontSize: 10, color: colors.inkSubtle },
  rowAdd: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
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
  scannerHint: { fontFamily: fonts.serif, fontSize: 20, color: "#fff", textAlign: "center", paddingHorizontal: 30 },
});
