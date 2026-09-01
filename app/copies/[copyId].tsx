import { DetailScreen } from "@/features/detail/DetailScreen";
import { useLocalSearchParams } from "expo-router";

export default function CopyDetailRoute() {
  const { copyId, fresh } = useLocalSearchParams<{ copyId: string; fresh?: string }>();
  return <DetailScreen copyId={copyId} startEditing={fresh === "1"} />;
}
