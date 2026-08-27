import { useStore } from "@/local/StoreProvider";
import { colors, fonts } from "@/theme/colors";
import { UNDO_HOLD, restoreWishlistItem } from "@janne6565/rekordo-shared";
import { useQueryClient } from "@tanstack/react-query";
import { HeartOff } from "lucide-react-native";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

/** A wishlist entry that has just left on its own, and the seconds in which it can come back. */
export interface WishUndo {
  readonly wishId: string;
  readonly title: string;
  readonly wantedSince: number;
}

interface UndoControls {
  readonly offer: (undo: WishUndo) => void;
}

const UndoContext = createContext<UndoControls | null>(null);

export function useUndo(): UndoControls {
  return useContext(UndoContext) ?? { offer: () => undefined };
}

/**
 * Screen 16e — the one line that stands between an automatic removal and a lost entry.
 *
 * Above the tabs rather than on the wishlist screen: the removal happens wherever a record
 * gets filed, which is usually the library or the add flow, and a message on the screen
 * nobody is looking at is not a message.
 */
export function UndoProvider({ children }: { readonly children: ReactNode }) {
  const [pending, setPending] = useState<WishUndo | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const offer = useCallback((undo: WishUndo) => {
    setPending(undo);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPending(null), UNDO_HOLD);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <UndoContext.Provider value={{ offer }}>
      {children}
      {pending !== null && (
        <UndoLine
          undo={pending}
          onDone={() => {
            clearTimeout(timer.current);
            setPending(null);
          }}
        />
      )}
    </UndoContext.Provider>
  );
}

function UndoLine({
  undo,
  onDone,
}: { readonly undo: WishUndo; readonly onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const { store, clock } = useStore();
  const queryClient = useQueryClient();

  const keepIt = async () => {
    const item = await store.getWishlistItemIncludingDeleted(undo.wishId);
    if (item === undefined) return;
    await store.putWishlistItem(restoreWishlistItem(item, clock));
    await queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    onDone();
  };

  const since = new Intl.DateTimeFormat(i18n.language, {
    month: "short",
    year: "numeric",
  }).format(undo.wantedSince);

  return (
    <View style={styles.bar} accessibilityLiveRegion="polite" pointerEvents="box-none">
      <View style={styles.card}>
        <HeartOff size={16} color={colors.nightMuted} strokeWidth={1.75} />
        <View style={styles.body}>
          <Text style={styles.title}>{t("undo.wishSatisfied")}</Text>
          <Text style={styles.since} numberOfLines={1}>
            {t("undo.wishSince", { title: undo.title, since })}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={keepIt} style={styles.action}>
          <Text style={styles.actionText}>{t("undo.keepIt")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: "absolute", left: 0, right: 0, bottom: 96, paddingHorizontal: 18 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    backgroundColor: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.sans, fontSize: 13, fontWeight: "600", color: colors.nightInk },
  since: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.nightMuted, marginTop: 1 },
  action: { borderRadius: 8, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 10, paddingVertical: 6 },
  actionText: { fontFamily: fonts.sans, fontSize: 12, fontWeight: "600", color: colors.nightInk },
});
