import { useLocalSearchParams } from "expo-router";
import { ManualScreen } from "@/features/manual/ManualScreen";

export default function ManualRoute() {
  /** Screen 2d hands over the digits its lookup failed on, so nobody retypes them. */
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();
  return <ManualScreen barcode={barcode ?? ""} />;
}
