import type { ActivityEntry } from "@/api/friends";
import { ReleaseArt } from "@/components/ReleaseArt";
import { Skeleton } from "@/components/Skeleton";
import { formatRelativeTime } from "@/domain/relativeTime";
import { Avatar } from "@/features/friends/Avatar";
import { colors, fonts } from "@/theme/colors";
import type { Format } from "@janne6565/rekordo-shared";
import { FORMAT_LABELS } from "@janne6565/rekordo-shared";
import { useRouter } from "expo-router";
import i18n from "i18next";
import { Trans, useTranslation } from "react-i18next";
import { EmptyPanel } from "@/features/friends/EmptyPanel";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * The activity panel of 15a.
 *
 * Grouped under day headings rather than shown as one stream: a feed of a dozen records is
 * read as "what happened yesterday", not as a timeline.
 */
export function ActivityList({
  entries,
  loading,
}: { readonly entries: readonly ActivityEntry[]; readonly loading: boolean }) {
  const { t, i18n } = useTranslation();

  if (loading) {
    return (
      <View style={styles.list}>
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} style={styles.skeleton} />
        ))}
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyPanel title={t("friends.feedEmpty.title")} body={t("friends.feedEmpty.body")} />
    );
  }

  return (
    <View style={styles.list}>
      {groupByDay(entries, i18n.language).map(([label, rows]) => (
        <View key={label}>
          <Text style={styles.dayLabel}>{label}</Text>
          {rows.map((entry) => (
            <Entry key={entry.id} entry={entry} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Entry({ entry }: { readonly entry: ActivityEntry }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const name = entry.actor?.displayName ?? entry.actor?.handle ?? "";
  const count = entry.copyCount ?? 1;
  const handle = entry.actor?.handle ?? null;

  return (
    <View style={styles.entry}>
      {/* Never a bare image: four covers in ten are a 404 at the archive, so this falls
          back to the format silhouette like every other tile in the app. */}
      <ReleaseArt
        release={{ coverArtUrl: entry.coverArtUrl ?? null, format: entry.format as Format }}
        style={{ width: 48, height: 40, borderRadius: 6 }}
      />
      <Avatar name={name} size={24} />
      <View style={styles.entryText}>
        <Text style={styles.line}>
          <Sentence entry={entry} name={name} count={count} />
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[
            entry.artistName,
            entry.format ? FORMAT_LABELS[entry.format as Format] : undefined,
            entry.year?.toString(),
            entry.occurredAt
              ? formatRelativeTime(new Date(entry.occurredAt).getTime(), i18n.language)
              : undefined,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        {/*
         * The burst's way in. The feed carries a few sleeves from a collapsed line and no
         * copy ids, so there is nothing to open that is exactly these eight — but their
         * shelf is sorted newest first, which puts them at the top of it. Only where there
         * is a handle to go to: a line whose actor has not claimed one has no destination,
         * and accent-coloured text that does nothing is what this is fixing.
         */}
        {count > 1 && handle !== null && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/profiles/[handle]", params: { handle } })}
            hitSlop={6}
          >
            <Text style={styles.seeAll}>{t("friends.seeAll", { count })}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * The line itself, written with Trans rather than assembled from fragments — German has to
 * be free to put the name, the verb and the title in German order.
 */
function Sentence({
  entry,
  name,
  count,
}: { readonly entry: ActivityEntry; readonly name: string; readonly count: number }) {
  const person = <Text style={styles.strong}>{name}</Text>;
  const title = <Text style={styles.strong}>{entry.title}</Text>;

  if (count > 1) {
    return (
      <Trans
        i18nKey="friends.line.addedMany"
        values={{ name, count }}
        components={{ person, title: <Text /> }}
      />
    );
  }
  const key =
    entry.type === "WISH_ADDED"
      ? "friends.line.wishAdded"
      : entry.type === "WISH_FULFILLED"
        ? "friends.line.wishFulfilled"
        : entry.type === "FRIENDSHIP_ACCEPTED"
          ? "friends.line.accepted"
          : "friends.line.added";
  return (
    <Trans i18nKey={key} values={{ name, title: entry.title }} components={{ person, title }} />
  );
}

/**
 * Day buckets from the reader's own clock.
 *
 * Deliberately not computed on the server: "today" depends on where the person reading is,
 * and a feed bucketed in UTC puts a European's evening into tomorrow.
 */
function groupByDay(
  entries: readonly ActivityEntry[],
  language: string,
): [string, ActivityEntry[]][] {
  const days = new Map<string, ActivityEntry[]>();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();

  for (const entry of entries) {
    const when = entry.occurredAt ? new Date(entry.occurredAt) : new Date();
    const stamp = when.toDateString();
    const label =
      stamp === today
        ? relativeDay(0, language)
        : stamp === yesterday
          ? relativeDay(-1, language)
          : when.toLocaleDateString(language, { day: "numeric", month: "long" });
    days.set(label, [...(days.get(label) ?? []), entry]);
  }
  return [...days.entries()];
}

/**
 * Translated rather than derived from `Intl.RelativeTimeFormat`, which Hermes does not
 * implement — see `@/domain/relativeTime`. Two words are not worth a polyfill.
 */
function relativeDay(offset: number, language: string): string {
  return i18n.t(offset === 0 ? "time.today" : "time.yesterday", { lng: language });
}

const styles = StyleSheet.create({
  list: { gap: 4 },
  skeleton: { height: 56, borderRadius: 14, marginBottom: 8 },
  dayLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.inkSubtle,
    marginTop: 16,
    marginBottom: 6,
  },
  entry: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  entryText: { flex: 1, minWidth: 0 },
  line: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19, color: colors.ink },
  strong: { fontWeight: "700" },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  seeAll: { fontFamily: fonts.sans, fontSize: 12, fontWeight: "600", color: colors.accent, marginTop: 4 },
});
