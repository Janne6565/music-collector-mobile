import { ConfirmCard } from "@/features/scan/ConfirmCard";
import { TrayRow } from "@/features/scan/TrayRow";
import { useScannerLogic } from "@/features/scan/useScannerLogic";
import { countByDestination } from "@/store/scanSlice";
import { colors, fonts } from "@/theme/colors";
import { formatBarcode } from "@janne6565/rekordo-shared";
import { CameraView } from "expo-camera";
import {
  CloudOff,
  Flashlight,
  MoveDiagonal,
  PencilLine,
  ScanBarcode,
  X,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * The camera as a window in the app's own page, not a dark room the app switches into.
 *
 * The old scanner took the whole screen black, which made adding a record feel like
 * leaving the app to use a tool. Here the paper tone of the library stays, the feed is a
 * rounded window inside it, and everything the flow says — the advice, the card, the tray
 * — is said on the paper around it. Adding is part of the shelf, not a detour from it.
 *
 * Turn 28 of the deck, screens 1a and 1b.
 */
export function ScannerScreen() {
  const { t } = useTranslation();
  const logic = useScannerLogic();
  const counts = countByDestination(logic.kept);

  if (logic.permission !== null && !logic.permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.permission}>
          <Text style={styles.permissionTitle}>{t("scan.permission.title")}</Text>
          <Text style={styles.permissionBody}>{t("scan.permission.body")}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void logic.requestPermission()}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>{t("scan.permission.allow")}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => logic.enterManually()}>
            <Text style={styles.quiet}>{t("scan.enterManually")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          onPress={logic.close}
          style={styles.round}
        >
          <X size={16} color={colors.inkMuted} strokeWidth={1.9} />
        </Pressable>
        {/* The offline note sits between the two, where it explains the flow rather than
            interrupting it: scanning still works, only the naming is postponed. */}
        {logic.card?.kind === "OFFLINE" && (
          <View style={styles.offlineNote}>
            <CloudOff size={13} color={colors.inkMuted} strokeWidth={1.8} />
            <Text style={styles.offlineNoteText}>{t("scan.offlineKept")}</Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => logic.enterManually()}
          style={styles.manualLink}
        >
          <PencilLine size={14} color={colors.accent} strokeWidth={1.8} />
          <Text style={styles.manualLinkText}>
            {logic.card?.kind === "OFFLINE" ? t("scan.manual") : t("scan.enterManually")}
          </Text>
        </Pressable>
      </View>

      <View style={styles.window}>
        <CameraView
          style={StyleSheet.absoluteFill}
          enableTorch={logic.torch}
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
          }}
          onBarcodeScanned={({ data }) => logic.handleScan(data)}
        />
        {/* Hidden while a card is up: the question on screen is the one being answered,
            and a scan zone under it would invite pointing the phone somewhere else. */}
        {logic.card === null && <ScanZone />}
        <Text style={styles.feedLabel}>{t("scan.feed")}</Text>

        {logic.advising && (
          <View style={styles.advice}>
            <MoveDiagonal size={13} color="rgba(255,255,255,0.9)" strokeWidth={1.8} />
            <Text style={styles.adviceText}>{t("scan.advice")}</Text>
          </View>
        )}

        {logic.card !== null && (
          <View style={styles.readBadge}>
            <ScanBarcode size={12} color="rgba(255,255,255,0.85)" strokeWidth={2.2} />
            <Text style={styles.readBadgeText}>{formatBarcode(logic.card.barcode)}</Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("scan.torch")}
          onPress={logic.toggleTorch}
          style={[styles.torch, logic.torch && styles.torchOn]}
        >
          <Flashlight
            size={18}
            color={logic.torch ? colors.night : "#ffffff"}
            strokeWidth={logic.torch ? 1.9 : 1.8}
          />
        </Pressable>
      </View>

      {logic.card === null ? (
        logic.kept.length === 0 ? (
          <View style={styles.prompt}>
            <Text style={styles.promptTitle}>{t("scan.prompt.title")}</Text>
            <Text style={styles.promptBody}>{t("scan.prompt.body")}</Text>
          </View>
        ) : (
          <ScrollView style={styles.tray} contentContainerStyle={styles.trayContent}>
            <View style={styles.trayHead}>
              <Text style={styles.trayLabel}>{t("scan.keptThisSession")}</Text>
              <Text style={styles.trayCount}>
                {t("scan.destinationCount", {
                  shelf: counts.shelf,
                  wishlist: counts.wishlist,
                })}
              </Text>
            </View>
            {logic.kept.map((scan, index) => (
              <TrayRow key={scan.key} scan={scan} last={index === logic.kept.length - 1} />
            ))}
          </ScrollView>
        )
      ) : (
        <View style={styles.cardSpacer} />
      )}

      {logic.card === null ? (
        <View style={styles.trayBar}>
          <Pressable
            accessibilityRole="button"
            disabled={logic.kept.length === 0}
            onPress={logic.openReview}
            style={[styles.review, logic.kept.length === 0 && styles.reviewEmpty]}
          >
            <Text style={[styles.reviewText, logic.kept.length === 0 && styles.reviewTextEmpty]}>
              {t("scan.review", { count: logic.kept.length })}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ConfirmCard logic={logic} />
      )}
    </SafeAreaView>
  );
}

/**
 * The scan zone: the feed dimmed everywhere except one clear rectangle.
 *
 * Four dimming panels around a hole rather than one giant spread shadow. The deck draws it
 * as a 500px shadow spread, which is a CSS trick with no dependable equivalent here — and
 * four rectangles are exactly what the effect is, with nothing left to a shadow renderer.
 *
 * No corner brackets and no laser line: the hole says where to point, and a shop is not
 * the place to explain a viewfinder twice.
 */
function ScanZone() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.dim, styles.dimTop]} />
      <View style={[styles.dim, styles.dimBottom]} />
      <View style={[styles.dim, styles.dimLeft]} />
      <View style={[styles.dim, styles.dimRight]} />
      <View style={styles.zone} />
    </View>
  );
}

const MONO = "ui-monospace";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 10,
  },
  round: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(25,23,19,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  offlineNote: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
  offlineNoteText: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.inkMuted,
  },
  manualLink: { flexDirection: "row", alignItems: "center", gap: 6 },
  manualLinkText: { fontFamily: fonts.sans, fontSize: 13, fontWeight: "500", color: colors.accent },

  window: {
    height: 210,
    marginHorizontal: 14,
    marginTop: 16,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#23211a",
  },
  // The window is 210 tall and the zone 96, so the panels above and below are 57 each.
  dim: { position: "absolute", backgroundColor: "rgba(12,11,8,0.42)" },
  dimTop: { left: 0, right: 0, top: 0, height: 57 },
  dimBottom: { left: 0, right: 0, bottom: 0, height: 57 },
  dimLeft: { left: 0, top: 57, bottom: 57, width: 22 },
  dimRight: { right: 0, top: 57, bottom: 57, width: 22 },
  zone: {
    position: "absolute",
    left: 22,
    right: 22,
    top: 57,
    height: 96,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.6)",
  },
  feedLabel: {
    position: "absolute",
    left: 16,
    top: 14,
    fontFamily: MONO,
    fontSize: 9.5,
    letterSpacing: 0.95,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.35)",
  },
  advice: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  adviceText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: "rgba(255,255,255,0.85)",
    flexShrink: 1,
  },
  readBadge: {
    position: "absolute",
    left: 16,
    bottom: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  readBadgeText: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.6,
    color: "rgba(255,255,255,0.85)",
  },
  torch: {
    position: "absolute",
    right: 13,
    bottom: 13,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  torchOn: { backgroundColor: "#ffffff" },

  prompt: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 26 },
  promptTitle: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 27,
    color: colors.ink,
    textAlign: "center",
  },
  promptBody: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.inkMuted,
    textAlign: "center",
    marginTop: 6,
  },
  /*
   * The gap between the camera window and the card, and nothing else.
   *
   * A zero basis with no shrink of its own: it takes whatever space is spare and gives up
   * none, so a card taller than the room left shrinks and scrolls rather than running off
   * the bottom edge with its buttons on it.
   */
  cardSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 0 },

  tray: { flex: 1 },
  trayContent: { paddingHorizontal: 16, paddingTop: 18 },
  trayHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  trayLabel: {
    fontFamily: MONO,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.inkSubtle,
  },
  trayCount: { fontFamily: MONO, fontSize: 10.5, color: colors.inkSubtle },

  trayBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(25,23,19,0.1)",
  },
  review: {
    height: 46,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewEmpty: { backgroundColor: "rgba(25,23,19,0.08)" },
  reviewText: { fontFamily: fonts.sans, fontSize: 14, fontWeight: "600", color: "#ffffff" },
  reviewTextEmpty: { color: "rgba(25,23,19,0.35)" },

  permission: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  permissionTitle: {
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.ink,
    textAlign: "center",
  },
  permissionBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 20,
    color: colors.inkMuted,
    textAlign: "center",
  },
  primary: {
    height: 50,
    paddingHorizontal: 26,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryText: { fontFamily: fonts.sans, fontSize: 15, fontWeight: "600", color: "#ffffff" },
  quiet: { fontFamily: fonts.sans, fontSize: 13, fontWeight: "500", color: colors.accent },
});
