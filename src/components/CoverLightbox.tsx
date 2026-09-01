import { StatusBar } from "expo-status-bar";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * One picture, as large as the glass allows.
 *
 * A sleeve at thumbnail size is an identifier; at full size it is the thing itself — the
 * pressing's artwork, or your own photograph of the record you are hunting for. So a tap
 * on the cover gets out of the way of everything else rather than opening another page:
 * no chrome, no facts, a black ground, and the picture whole.
 *
 * `contain` rather than `cover`: a sleeve is square but a photograph of one rarely is, and
 * cropping the edges off the very thing somebody asked to look at closely is the one
 * thing this must not do.
 *
 * Tapping anywhere closes it. The X is there because a picture that fills the screen gives
 * no hint that it is dismissible, not because the backdrop needs help — top left, where
 * the way back out of every other screen in the app already is.
 */
export function CoverLightbox({
  uri,
  onClose,
}: {
  readonly uri: string;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation();
  /*
   * The inset read from the provider around the app rather than from a `SafeAreaView`
   * inside the modal. A safe-area view mounted in a modal gets its frame measured after
   * the modal has already appeared, and until it does the inset is zero — which put the
   * close button in the same row as the clock.
   */
  const insets = useSafeAreaInsets();

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <StatusBar style="light" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.close")}
        onPress={onClose}
        style={styles.root}
      >
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
      </Pressable>
      <View style={styles.chrome} pointerEvents="box-none">
        <View style={[styles.chromeRow, { paddingTop: insets.top + 10 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            onPress={onClose}
            hitSlop={12}
            style={styles.close}
          >
            <X size={18} color="#fff" strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
  chrome: { position: "absolute", top: 0, left: 0, right: 0 },
  chromeRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
});
