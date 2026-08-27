import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors } from "@/theme/colors";

/**
 * One record in a grid of them — your shelf, and a friend's.
 *
 * The artwork arrives as an element rather than as data, because the two callers resolve it
 * in genuinely different ways: your own shelf has the release, the copy's own photos and
 * its catalogue-art flag to weigh up, while a friend's has one URL the server decided on.
 * Sharing the resolution would mean inventing a shape that fits neither; sharing the tile
 * shares what was actually duplicated — the geometry, the type and the truncation.
 *
 * `style` is the caller's, because the containers differ for a good reason: the shelf is a
 * FlatList that has to window thousands of rows, and a friend's is a short wrapping column
 * inside a ScrollView, where a nested list would be worse than the duplication.
 */
export function CopyTile({
  art,
  title,
  subtitle,
  onPress,
  style,
}: {
  readonly art: ReactNode;
  readonly title: string;
  readonly subtitle: string;
  readonly onPress?: () => void;
  readonly style?: ViewStyle;
}) {
  const content = (
    <>
      {art}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {subtitle}
      </Text>
    </>
  );

  // Optional because a tile with nowhere to go should not answer to a press — a control
  // that does nothing is worse than no control.
  return onPress === undefined ? (
    <View style={style}>{content}</View>
  ) : (
    <Pressable accessibilityRole="button" onPress={onPress} style={style}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 11.5, fontWeight: "600", marginTop: 6, color: colors.ink },
  subtitle: { fontSize: 10.5, color: colors.inkMuted },
});
