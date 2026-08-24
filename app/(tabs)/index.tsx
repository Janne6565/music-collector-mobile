import { useTranslation } from "react-i18next";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function LibraryScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t("nav.library")} subtitle={t("scaffold.comingInPhaseTwo")} />;
}
