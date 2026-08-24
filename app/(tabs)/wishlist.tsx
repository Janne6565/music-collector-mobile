import { useTranslation } from "react-i18next";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function WishlistScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t("nav.wishlist")} subtitle={t("scaffold.comingInPhaseTwo")} />;
}
