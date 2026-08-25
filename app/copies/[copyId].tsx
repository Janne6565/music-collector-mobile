import { useLocalSearchParams } from "expo-router";
import { DetailScreen } from "@/features/detail/DetailScreen";

export default function CopyDetailRoute() {
  const { copyId, fresh } = useLocalSearchParams<{ copyId: string; fresh?: string }>();
  return <DetailScreen copyId={copyId} startEditing={fresh === "1"} />;
}
