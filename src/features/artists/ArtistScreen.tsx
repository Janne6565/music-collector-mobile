import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { releaseDisambiguation } from "@/api/releases";
import { ReleaseArt } from "@/components/ReleaseArt";
import { Skeleton } from "@/components/Skeleton";
import type { Album, Artist, Release } from "@janne6565/music-collector-shared";
import { FORMAT_LABELS } from "@janne6565/music-collector-shared";
import { ArtistAvatar } from "@/features/add/ArtistResults";
import { useAddCopy } from "@/features/add/useAddCopy";
import { PRIMARY_TYPES, useDiscographyLogic } from "@/features/artists/useDiscographyLogic";
import { colors } from "@/theme/colors";

type Logic = ReturnType<typeof useDiscographyLogic>;

interface ArtistScreenProps {
  readonly artist: Artist;
  /** The search this artist was opened from, so the header can name what "back" means. */
  readonly fromQuery: string;
}

/**
 * Screen 10c — an artist's discography.
 *
 * A route rather than the web's in-modal pane (10d), because a phone has nowhere to put a
 * pane. That works here for the reason it would not on the web: the add screen is itself a
 * route, it stays mounted underneath, and going back lands on the search exactly as it was
 * left — which is the thing the web version uses a pane to protect.
 *
 * Dark chrome throughout, like the add screen it is reached from. Nothing about opening an
 * artist should feel like leaving the flow of adding a record.
 */
export function ArtistScreen({ artist, fromQuery }: ArtistScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const logic = useDiscographyLogic(artist.mbid);
  const { add, addingMbid } = useAddCopy();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("artists.backToResults", { query: fromQuery })}
          onPress={() => router.back()}
          style={styles.back}
        >
          <ChevronLeft size={18} color="#fff" strokeWidth={1.75} />
        </Pressable>
        <Text style={styles.headerCaption} numberOfLines={1}>
          {t("artists.resultsFor", { query: fromQuery })}
        </Text>
        {/* Balances the back button so the caption sits centred, as the deck draws it. */}
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <ArtistHeader artist={artist} logic={logic} />

        <View style={styles.filterBox}>
          <Search size={15} color="rgba(255,255,255,0.5)" strokeWidth={1.75} />
          <TextInput
            value={logic.filter}
            onChangeText={logic.setFilter}
            placeholder={t("artists.filterPlaceholder", { name: artist.name })}
            placeholderTextColor="rgba(255,255,255,0.42)"
            style={styles.filterInput}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <TypeChip
            label={t("artists.type.Default")}
            count={null}
            active={logic.type === null}
            onPress={() => logic.setType(null)}
          />
          {PRIMARY_TYPES.map((primaryType) => (
            <TypeChip
              key={primaryType}
              label={t(`artists.type.${primaryType}`)}
              count={logic.totals[primaryType]}
              active={logic.type === primaryType}
              onPress={() => logic.setType(primaryType)}
            />
          ))}
        </ScrollView>

        <Discography logic={logic} add={add} addingMbid={addingMbid} />

        {logic.type === null && <RestDisclosure logic={logic} />}

        {logic.settling && (
          <View style={styles.settling}>
            <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
            <Text style={styles.settlingText}>{t("artists.paced")}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ArtistHeader({ artist, logic }: { readonly artist: Artist; readonly logic: Logic }) {
  const { t } = useTranslation();
  const facts = [
    [artist.type, artist.country].filter((part) => part !== null && part !== "").join(" · "),
    artist.beganIn === null
      ? ""
      : `${artist.beganIn.slice(0, 4)} – ${artist.endedIn === null ? t("artists.present") : artist.endedIn.slice(0, 4)}`,
    // Only once the untyped query has answered. A release count that starts at the album
    // count and jumps to ten times it reads as a bug, not as loading.
    logic.releaseCount === null ? "" : t("artists.releaseCount", { count: logic.releaseCount }),
  ].filter((fact) => fact !== "");

  return (
    <View>
      <View style={styles.identity}>
        <ArtistAvatar name={artist.name} size={64} mbid={artist.mbid} />
        <View style={styles.identityBody}>
          <Text style={styles.name}>{artist.name}</Text>
          {artist.disambiguation !== "" && (
            <Text style={styles.disambiguation}>{artist.disambiguation}</Text>
          )}
        </View>
      </View>
      {facts.length > 0 && (
        <View style={styles.facts}>
          {facts.map((fact, index) => (
            <Text key={fact} style={index === 0 ? styles.factStrong : styles.fact}>
              {fact}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function TypeChip({
  label,
  count,
  active,
  onPress,
}: {
  readonly label: string;
  /** Null until that type has been fetched — the chip shows its name and nothing else. */
  readonly count: number | null;
  readonly active: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
        {count === null ? "" : ` ${count}`}
      </Text>
    </Pressable>
  );
}

function Discography({
  logic,
  add,
  addingMbid,
}: {
  readonly logic: Logic;
  readonly add: (release: Release) => void;
  readonly addingMbid: string | undefined;
}) {
  const { t } = useTranslation();

  if (logic.failed) return <Text style={styles.hint}>{t("add.failed")}</Text>;
  if (logic.loading) return <AlbumSkeletons />;
  if (logic.sections.length === 0) {
    return (
      <Text style={styles.hint}>
        {logic.filtering ? t("artists.noneMatchFilter") : t("artists.noneOfType")}
      </Text>
    );
  }

  return (
    <View>
      {logic.sections.map((section) => (
        <View key={section.type}>
          <Text style={styles.section}>{t(`artists.type.${section.type}`)}</Text>
          {section.loading ? (
            <AlbumSkeletons />
          ) : section.albums.length === 0 ? (
            <Text style={styles.hint}>{t("artists.noneOfType")}</Text>
          ) : (
            section.albums.map((album) => (
              <AlbumRow
                key={album.albumId}
                album={album}
                logic={logic}
                add={add}
                addingMbid={addingMbid}
              />
            ))
          )}
        </View>
      ))}
    </View>
  );
}

function AlbumRow({
  album,
  logic,
  add,
  addingMbid,
}: {
  readonly album: Album;
  readonly logic: Logic;
  readonly add: (release: Release) => void;
  readonly addingMbid: string | undefined;
}) {
  const { t } = useTranslation();
  const expanded = logic.expandedAlbum === album.albumId;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${album.title} — ${t("artists.pressings")}`}
        onPress={() => logic.toggleAlbum(album)}
        style={styles.row}
      >
        {/* An album's own cover, from the archive's release-group endpoint — picking one
            of its pressings' covers would be arbitrary. */}
        <View style={styles.albumThumb}>
          <ReleaseArt release={album} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {album.title}
          </Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {[album.year, album.primaryType].filter((part) => part !== null).join(" · ")}
          </Text>
        </View>
        <View style={styles.addPill}>
          <Text style={styles.addPillText}>{t("add.add")}</Text>
          {expanded ? (
            <ChevronUp size={13} color="#fff" strokeWidth={2} />
          ) : (
            <ChevronRight size={13} color="#fff" strokeWidth={2} />
          )}
        </View>
      </Pressable>

      {expanded && (
        <Pressings logic={logic} add={add} addingMbid={addingMbid} />
      )}
    </View>
  );
}

/**
 * The pressings of one album, under it.
 *
 * A list rather than the web's table (10d): the six columns that fit beside a modal do not
 * fit on a phone, and the three facts that actually separate two pressings — year, label
 * and country, catalogue number — read perfectly well stacked.
 */
function Pressings({
  logic,
  add,
  addingMbid,
}: {
  readonly logic: Logic;
  readonly add: (release: Release) => void;
  readonly addingMbid: string | undefined;
}) {
  const { t } = useTranslation();

  if (logic.pressingsLoading) {
    return (
      <View style={styles.pressings}>
        {["54%", "42%"].map((width) => (
          <View key={width} style={styles.pressingRow}>
            <View style={styles.rowBody}>
              <Skeleton style={{ height: 10, width: width as `${number}%` }} />
              <Skeleton tone="soft" style={{ height: 8, width: "38%", marginTop: 6 }} />
            </View>
          </View>
        ))}
      </View>
    );
  }
  if (logic.pressingsFailed) return <Text style={styles.pressingHint}>{t("add.failed")}</Text>;
  if (logic.pressings.length === 0) {
    return <Text style={styles.pressingHint}>{t("artists.noPressings")}</Text>;
  }

  return (
    <View style={styles.pressings}>
      {logic.pressings.map((pressing) => {
        const meta = releaseDisambiguation(pressing);
        return (
          <Pressable
            key={pressing.id}
            accessibilityRole="button"
            accessibilityLabel={`${pressing.title} — ${t("add.add")}`}
            onPress={() => add(pressing)}
            disabled={addingMbid !== undefined}
            style={styles.pressingRow}
          >
            <View style={styles.rowBody}>
              <Text style={styles.pressingTitle} numberOfLines={1}>
                {pressing.year ?? "—"} · {FORMAT_LABELS[pressing.format]}
              </Text>
              {meta !== "" && (
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {meta}
                </Text>
              )}
            </View>
            {addingMbid === pressing.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ChevronRight size={15} color="rgba(255,255,255,0.45)" strokeWidth={1.75} />
            )}
          </Pressable>
        );
      })}
      <Text style={styles.pressingHint}>{t("artists.pickLater")}</Text>
    </View>
  );
}

/** The 312 sessions, broadcasts and remixes the deck folds away on screen 10c. */
function RestDisclosure({ logic }: { readonly logic: Logic }) {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: logic.restExpanded }}
      onPress={logic.toggleRest}
      style={styles.rest}
    >
      <View style={styles.rowBody}>
        <Text style={styles.restTitle}>{t("artists.rest.title")}</Text>
        <Text style={styles.restBody}>
          {logic.restCount === null
            ? t("artists.rest.bodyUncounted")
            : t("artists.rest.body", { count: logic.restCount })}
        </Text>
      </View>
      {logic.restExpanded ? (
        <ChevronUp size={17} color="rgba(255,255,255,0.45)" strokeWidth={1.75} />
      ) : (
        <ChevronDown size={17} color="rgba(255,255,255,0.45)" strokeWidth={1.75} />
      )}
    </Pressable>
  );
}

/** The same row shape, while a section is still out (the rule from turn 9). */
function AlbumSkeletons() {
  return (
    <View>
      {(["64%", "48%", "56%"] as const).map((width) => (
        <View key={width} style={styles.row}>
          <Skeleton style={styles.albumThumbSkeleton} />
          <View style={styles.rowBody}>
            <Skeleton style={{ height: 11, width }} />
            <Skeleton tone="soft" style={{ height: 9, width: "34%", marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const HAIRLINE = "rgba(255,255,255,0.09)";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.night },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  back: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCaption: { flex: 1, textAlign: "center", fontSize: 11.5, color: "rgba(255,255,255,0.5)" },
  body: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 32 },
  identity: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  identityBody: { flex: 1, paddingTop: 2 },
  name: { fontSize: 28, lineHeight: 30, color: "#fff" },
  disambiguation: { fontSize: 12.5, lineHeight: 19, color: "rgba(255,255,255,0.62)", marginTop: 6 },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 14 },
  fact: {
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: "hidden",
  },
  factStrong: {
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: "hidden",
  },
  filterBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    height: 42,
    paddingHorizontal: 14,
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  filterInput: { flex: 1, fontSize: 13.5, color: "#fff" },
  chips: { gap: 7, paddingTop: 12, paddingBottom: 2 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  chipActive: { backgroundColor: "#fff" },
  chipText: { fontSize: 11.5, fontWeight: "500", color: "rgba(255,255,255,0.7)" },
  chipTextActive: { fontWeight: "600", color: colors.night },
  section: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.4)",
    paddingTop: 22,
    paddingBottom: 4,
  },
  hint: { fontSize: 13, color: "rgba(255,255,255,0.5)", paddingVertical: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
  },
  albumThumb: { width: 52, height: 52 },
  albumThumbSkeleton: { width: 52, height: 52, borderRadius: 5 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 13.5, fontWeight: "600", color: "#fff" },
  rowSubtitle: { fontSize: 11.5, color: "rgba(255,255,255,0.55)" },
  rowMeta: { fontSize: 10, color: "rgba(255,255,255,0.38)" },
  addPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  addPillText: { fontSize: 11.5, fontWeight: "600", color: "#fff" },
  pressings: {
    marginBottom: 4,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  pressingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  pressingTitle: { fontSize: 12.5, fontWeight: "600", color: "#fff" },
  pressingHint: {
    fontSize: 11,
    lineHeight: 16,
    color: "rgba(255,255,255,0.45)",
    paddingVertical: 10,
  },
  rest: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
    padding: 15,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  restTitle: { fontSize: 12.5, fontWeight: "600", color: "#fff" },
  restBody: { fontSize: 11.5, lineHeight: 17, color: "rgba(255,255,255,0.5)", marginTop: 3 },
  settling: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  settlingText: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.4)",
  },
});
