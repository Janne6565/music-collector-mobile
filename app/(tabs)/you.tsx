import { useTranslation } from "react-i18next";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function YouScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t("nav.you")} subtitle={t("scaffold.comingInPhaseTwo")} />;
}
