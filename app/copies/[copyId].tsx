import { useLocalSearchParams } from "expo-router";
import { DetailScreen } from "@/features/detail/DetailScreen";

export default function CopyDetailRoute() {
  const { copyId } = useLocalSearchParams<{ copyId: string }>();
  return <DetailScreen copyId={copyId} />;
}
