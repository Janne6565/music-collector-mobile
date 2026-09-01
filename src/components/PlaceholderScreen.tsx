import { colors, fonts } from "@/theme/colors";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

interface PlaceholderScreenProps {
  readonly title: string;
  readonly subtitle: string;
}

/** Scaffold-phase stand-in. Each tab replaces this with its real screen in phase 2. */
export function PlaceholderScreen({ title, subtitle }: PlaceholderScreenProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  body: { flex: 1, paddingHorizontal: 18, paddingTop: 24, gap: 6 },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.ink },
  subtitle: { fontSize: 13, color: colors.inkMuted },
});
