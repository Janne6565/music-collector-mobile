import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

/**
 * One entry in a wishlist — yours, and a friend's.
 *
 * A friend's used to be a bare line of text with no artwork at all, which made the same
 * list look like two different features depending on whose it was. It is the same thing:
 * a record somebody is hunting.
 *
 * The artwork comes in as an element for the same reason it does on {@link CopyTile} — the
 * two sides resolve it differently and only the card is shared.
 */
export function WishRow({
  art,
  title,
  subtitle,
  note,
  format,
  trailing,
  onPress,
  onLongPress,
}: {
  readonly art: ReactNode;
  readonly title: string;
  readonly subtitle: string;
  readonly note?: string | null;
  readonly format: string;
  /** The relative time on your own list; nothing on a friend's, whose dates are not yours. */
  readonly trailing?: string;
  readonly onPress?: () => void;
  readonly onLongPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.thumb}>{art}</View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        {note !== undefined && note !== null && note !== "" && (
          <Text style={styles.note} numberOfLines={1}>
            {note}
          </Text>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.formatChip}>{format}</Text>
          {trailing !== undefined && <Text style={styles.trailing}>{trailing}</Text>}
        </View>
      </View>
    </>
  );

  return onPress === undefined && onLongPress === undefined ? (
    <View style={styles.pressable}>{content}</View>
  ) : (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      style={styles.pressable}
    >
      {content}
    </Pressable>
  );
}

/** The card the row sits in, so both lists frame it the same way. */
export const wishCardStyle = {
  borderRadius: 12,
  backgroundColor: colors.surface,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: colors.line,
} as const;

const styles = StyleSheet.create({
  pressable: { flexDirection: "row", gap: 12, padding: 12 },
  thumb: { width: 56 },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "600", color: colors.ink },
  subtitle: { fontSize: 12, color: colors.inkMuted, marginTop: 1 },
  note: { fontSize: 11.5, color: colors.inkSubtle, marginTop: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 },
  formatChip: {
    fontSize: 10,
    color: colors.inkMuted,
    backgroundColor: "rgba(25,23,19,0.06)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  trailing: { fontSize: 10, color: colors.inkSubtle },
});
