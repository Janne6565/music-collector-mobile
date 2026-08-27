import { colors, fonts } from "@/theme/colors";
import { StyleSheet, Text, View } from "react-native";

/**
 * A panel with nothing in it yet.
 *
 * Shared rather than written twice, because the two panels of the Friends tab are one
 * switch apart: the feed said "Nothing yet" over a sentence, and the people list said its
 * whole piece in one muted line pinned under the control. Flipping between them changed
 * the shape of the answer as well as the answer, which reads as two different screens
 * rather than two views of one.
 *
 * A heading and a sentence: what is not here, and what will put it here.
 */
export function EmptyPanel({
  title,
  body,
}: { readonly title: string; readonly body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", paddingVertical: 40, gap: 6 },
  title: { fontFamily: fonts.sans, fontSize: 14, fontWeight: "600", color: colors.ink },
  body: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.inkMuted,
    textAlign: "center",
  },
});
