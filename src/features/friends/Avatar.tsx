import { fonts } from "@/theme/colors";
import { StyleSheet, Text, View } from "react-native";

/**
 * A person, drawn from their initials.
 *
 * Nobody uploads a picture of themselves in this app and nothing asks them to, so the
 * alternative is the same grey circle for everybody. The tint comes from the name, which
 * makes a list of twelve friends scannable without anybody choosing a colour.
 */
export function Avatar({ name, size = 38 }: { readonly name: string; readonly size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const hue = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 360;

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          // Low saturation, high lightness: these sit beside cover art, and a wall of vivid
          // circles would compete with the sleeves.
          backgroundColor: `hsl(${hue}, 32%, 86%)`,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>{initials || "?"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  initials: { fontFamily: fonts.sans, fontWeight: "600", color: "rgba(25,23,19,0.7)" },
});
