import { useAccountLogic } from "@/features/auth/useAccountLogic";
import { LegalScreen } from "@/features/legal/LegalScreen";

export default function Legal() {
  // Only for whether to show the consent dates and the delete row: the documents themselves
  // are readable with no account at all, which is most of what this screen is.
  const { user } = useAccountLogic();
  return <LegalScreen signedIn={user !== null} />;
}
