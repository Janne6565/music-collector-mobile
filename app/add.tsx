import { useLocalSearchParams } from "expo-router";
import { AddScreen } from "@/features/add/AddScreen";

export default function AddRoute() {
  /** Screen 16b hands the wish's own search over as `wish`. */
  const { wish } = useLocalSearchParams<{ wish?: string }>();
  return <AddScreen seedTerm={wish ?? ""} />;
}
