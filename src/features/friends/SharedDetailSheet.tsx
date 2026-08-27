import { useTranslation } from "react-i18next";
import { Animated, Modal, PanResponder, StyleSheet, Text, View } from "react-native";
import { useMemo, useRef } from "react";
import type { Format } from "@janne6565/music-collector-shared";
import { CONDITION_SHORT, FORMAT_LABELS, chromeFor } from "@janne6565/music-collector-shared";
import type { SharedCopy, SharedWish } from "@/api/friends";
import { ReleaseArt } from "@/components/ReleaseArt";
import { CoverSheet } from "@/features/detail/CoverSheet";
import { formatMoney } from "@/domain/currency";
import { colors, fonts } from "@/theme/colors";

interface Fact {
  readonly label: string;
  readonly value: string;
}

/**
 * Screen 23e — a record on somebody else's shelf, read only.
 *
 * The phone's form of the same component the web centres on the page: a sheet from the
 * bottom, the sleeve at full width, and the facts in two columns beneath it. A grabber and
 * a close rather than arrows, because flipping here is a swipe.
 *
 * Nothing in it is actionable except closing and flipping. It is somebody else's copy: the
 * things you can do to your own — edit, photograph, rate, delete — are not merely disabled
 * here, they are absent, which is a different statement.
 *
 * Absent facts close the grid up rather than leaving holes, so a hand-entered copy with no
 * year, no grade and no price reads as the same layout with less in it.
 */
export function SharedDetailSheet({
  copy,
  wish,
  coverArtUrl,
  pricesVisible,
  previewUri,
  onClose,
  onPrev,
  onNext,
}: {
  readonly copy?: SharedCopy;
  readonly wish?: SharedWish;
  /**
   * The sleeve, already resolved by the caller.
   *
   * It used to be read off the copy, which meant a wish never had one: a wish carries an
   * album and a pressing id, not a cover, and the list resolves it through the catalogue
   * lookups the profile already holds. The sheet asking the copy for it left every
   * wishlist entry with no picture -- and so with the silhouette that stands in for one.
   */
  readonly coverArtUrl: string | null;
  readonly pricesVisible: boolean;
  readonly previewUri: string | null;
  readonly onClose: () => void;
  readonly onPrev?: () => void;
  readonly onNext?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const subject = copy ?? wish;

  const moves = useRef({ onPrev, onNext });
  moves.current = { onPrev, onNext };

  /*
   * Only clearly horizontal gestures, and the same cross-fade the library's sheet uses.
   *
   * The first version also claimed anything dragged more than 48 points downwards, to close
   * — which took every scroll away from the list underneath it. Closing that way is the
   * modal's own gesture and always was; claiming it here only broke reading.
   */
  const fade = useRef(new Animated.Value(1)).current;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
        onPanResponderRelease: (_event, gesture) => {
          const committed = Math.abs(gesture.dx) > 80 || Math.abs(gesture.vx) > 0.4;
          const go = gesture.dx < 0 ? moves.current.onNext : moves.current.onPrev;
          // At the ends nothing happens. A shelf that wraps has no last record.
          if (!committed || go === undefined) return;
          Animated.timing(fade, { toValue: 0, duration: 110, useNativeDriver: true }).start(
            ({ finished }) => {
              if (!finished) return;
              go();
              Animated.timing(fade, { toValue: 1, duration: 190, useNativeDriver: true }).start();
            },
          );
        },
      }),
    [fade],
  );

  const format = copy?.format ?? wish?.desiredFormat;
  const facts: Fact[] = [];
  const add = (label: string, value: string | undefined | null) => {
    if (value !== undefined && value !== null && value !== "") facts.push({ label, value });
  };

  add(t("sharedDetail.year"), subject?.year?.toString());
  add(
    t(wish === undefined ? "sharedDetail.format" : "sharedDetail.wanted"),
    format === undefined ? undefined : FORMAT_LABELS[format as Format],
  );
  if (copy !== undefined) {
    // 23e: two columns hold four cells, so the two grades share a line.
    const grades = [copy.condition, copy.sleeveCondition]
      .filter((code): code is string => code !== undefined && code !== null)
      .map((code) => CONDITION_SHORT[code as keyof typeof CONDITION_SHORT] ?? code)
      .join(" · ");
    add(t("sharedDetail.mediaSleeve"), grades);
    add(
      t("sharedDetail.paid"),
      // Only when the owner shares prices, and only when there is one: a JSON null is not
      // a price of nothing.
      pricesVisible && copy.pricePaidCents != null && copy.currency != null
        ? formatMoney(copy.pricePaidCents, copy.currency, i18n.language)
        : undefined,
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.screen}>
        <CoverSheet
          chrome={CHROME}
          onClose={onClose}
          fade={fade}
          handlers={responder.panHandlers}
          art={
            <ReleaseArt
              release={{ coverArtUrl }}
              format={(format as Format | undefined) ?? "OTHER"}
              previewUri={previewUri}
              variant="bleed"
              /*
               * No silhouette up here. The grid directly below names the format in words --
               * "Vinyl", or "Wanted: Vinyl" -- so a record drawn the width of the sheet only
               * repeats it as furniture, and on a record with no picture that furniture is
               * the whole header.
               */
              placeholder="plain"
            />
          }
        >
          <View style={styles.body}>
            <Text style={styles.title}>{subject?.title ?? "—"}</Text>
            <Text style={styles.artist}>{subject?.artistName ?? ""}</Text>

            {facts.length > 0 && (
              <View style={styles.facts}>
                {facts.map((fact) => (
                  <View key={fact.label} style={styles.fact}>
                    <Text style={styles.factLabel}>{fact.label}</Text>
                    <Text style={styles.factValue}>{fact.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </CoverSheet>
      </View>
    </Modal>
  );
}

/*
 * Paper, always. The library's version takes its chrome from the cover's own palette,
 * which is sampled from the release the *owner* holds — a viewer has no business being
 * repainted by somebody else's shelf, and a sheet that changed colour per record on a
 * stranger's page would read as a different app each time.
 */
const CHROME = chromeFor(null);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink, marginTop: 16 },
  artist: { fontFamily: fonts.sans, fontSize: 14, color: colors.inkMuted, marginTop: 3 },
  // Two columns, and an absent fact closes the grid up rather than leaving a hole.
  facts: { flexDirection: "row", flexWrap: "wrap", marginTop: 20 },
  fact: { width: "50%", paddingBottom: 16 },
  factLabel: {
    fontFamily: fonts.sans,
    fontSize: 9.5,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.inkSubtle,
  },
  factValue: { fontFamily: fonts.sans, fontSize: 14, fontWeight: "600", color: colors.ink, marginTop: 4 },
});
