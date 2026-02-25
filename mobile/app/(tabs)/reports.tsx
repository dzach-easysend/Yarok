import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { getReports, type ReportListItem } from "@/services/api";
import { statusLabel } from "@/utils/statusLabel";
import { railwayLog, emitEvent } from "@/utils/railwayLog";
import { colors, spacing, radii } from "@/constants/theme";
import {
  REPORT_CARD_DATE_LABEL,
  REPORT_CARD_DESC_LABEL,
} from "@/constants/reportCardLabels";
import DragScrollView from "@/components/DragScrollView";
import { MapView } from "@/components/map";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_CENTER = { lat: 31.7683, lng: 35.2137 };

function EmptyState({ onCreatePress }: { onCreatePress: () => void }) {
  return (
    <View style={emptyStyles.root} testID="empty-state">
      <View style={emptyStyles.illustrationWrap}>
        <View style={emptyStyles.illustrationBg}>
          <Text style={emptyStyles.illustrationEmoji}>🌿</Text>
        </View>
        <View style={[emptyStyles.dot, emptyStyles.dotTL]} />
        <View style={[emptyStyles.dot, emptyStyles.dotBR]} />
        <View style={[emptyStyles.dotSm, emptyStyles.dotTR]} />
      </View>

      <Text style={emptyStyles.headline}>אין דיווחים עדיין</Text>
      <Text style={emptyStyles.subtext}>
        ראית פסולת בשביל או בשטח פתוח?{"\n"}
        צלם ושלח את הדיווח הראשון שלך — זה לוקח שניות.
      </Text>

      <TouchableOpacity
        testID="empty-state-cta"
        style={emptyStyles.cta}
        onPress={onCreatePress}
        activeOpacity={0.85}
      >
        <Text style={emptyStyles.ctaIcon}>+</Text>
        <Text style={emptyStyles.ctaText}>צור דיווח ראשון</Text>
      </TouchableOpacity>

      <Text style={emptyStyles.hint}>אפשר גם מהכפתור הירוק למטה</Text>
    </View>
  );
}

const SNIPPET_MAX_LENGTH = 150;

function truncateText(text: string | null | undefined, maxLength: number): string | null {
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\u2026`;
}

function formatCreationDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


function AuthorLabel({ item }: { item: ReportListItem }) {
  if (item.is_mine) {
    return <Text style={styles.authorMine}>הדיווח שלי</Text>;
  }
  const name = item.author_display ?? "אנונימי";
  return <Text style={styles.authorOther}>{name}</Text>;
}

function ReportCard({ item, onPress }: { item: ReportListItem; onPress: () => void }) {
  const snippet = truncateText(item.description, SNIPPET_MAX_LENGTH);

  return (
    <TouchableOpacity
      testID="report-card"
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.thumb, { pointerEvents: "none" }]}>
        <MapView
          key={`${item.id}-${item.lat}-${item.lng}`}
          center={{ lat: item.lat, lng: item.lng }}
          zoom={13}
          markers={[{ id: item.id, lat: item.lat, lng: item.lng }]}
          interactive={false}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.cardBody}>
        {snippet ? (
          <Text testID="report-card-desc" style={styles.snippet}>
            {REPORT_CARD_DESC_LABEL}
            {snippet}
          </Text>
        ) : null}
        <View style={styles.metaContainer}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{statusLabel(item.status)}</Text>
          </View>
          <Text testID="report-card-date" style={styles.meta}>
            {REPORT_CARD_DATE_LABEL}
            {formatCreationDate(item.created_at)}
          </Text>
        </View>
        <AuthorLabel item={item} />
      </View>
    </TouchableOpacity>
  );
}

export default function MyReportsScreen() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [userLocation, setUserLocation] = useState(DEFAULT_CENTER);
  const [showMine, setShowMine] = useState(isLoggedIn);

  // Keep showMine in sync when auth state changes (e.g. on logout)
  useEffect(() => {
    if (!isLoggedIn) setShowMine(false);
  }, [isLoggedIn]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  const { data: reports = [], isLoading, isError } = useQuery({
    queryKey: ["my-reports", userLocation.lat, userLocation.lng, showMine],
    queryFn: () =>
      getReports({
        lat: userLocation.lat,
        lng: userLocation.lng,
        radius_km: 500,
        mine: showMine,
      }),
  });

  const isEmpty = !isLoading && reports.length === 0;

  useEffect(() => {
    emitEvent("reports_screen_mounted");
    railwayLog("MyReportsScreen mounted", { platform: Platform.OS });
  }, []);

  function renderContent(): React.ReactNode {
    let branch: string;
    if (isLoading) branch = "loading";
    else if (isEmpty) branch = "empty";
    else branch = "list";
    railwayLog("renderContent", {
      isLoading,
      isEmpty,
      reportsLength: reports.length,
      isError,
      branch,
    });
    if (isLoading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    if (isEmpty) {
      return <EmptyState onCreatePress={() => router.push("/report/create")} />;
    }
    if (Platform.OS === "web") {
      return (
        <DragScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.list}
          testID="reports-list"
        >
          {reports.map((item) => (
            <ReportCard
              key={item.id}
              item={item}
              onPress={() => {
                emitEvent("navigating_to_report");
                railwayLog("navigating to report", { reportId: item.id });
                router.push(`/report/${item.id}`);
              }}
            />
          ))}
        </DragScrollView>
      );
    }
    return (
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        style={styles.listScroll}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ReportCard
            item={item}
            onPress={() => {
              emitEvent("navigating_to_report");
              railwayLog("navigating to report", { reportId: item.id });
              router.push(`/report/${item.id}`);
            }}
          />
        )}
      />
    );
  }

  return (
    <View style={styles.container} testID="screen-reports">
      {isLoggedIn ? (
        <View style={styles.toggleBar}>
          <TouchableOpacity
            testID="toggle-mine"
            style={[styles.toggleBtn, showMine && styles.toggleBtnActive]}
            onPress={() => setShowMine(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, showMine && styles.toggleTextActive]}>
              הדיווחים שלי
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="toggle-all"
            style={[styles.toggleBtn, !showMine && styles.toggleBtnActive]}
            onPress={() => setShowMine(false)}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, !showMine && styles.toggleTextActive]}>
              כל הדיווחים
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {renderContent()}
      <TouchableOpacity
        testID="fab-create"
        style={styles.fab}
        onPress={() => router.push("/report/create")}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  toggleBar: {
    flexDirection: "row",
    margin: 12,
    marginBottom: 0,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    padding: 3,
    alignSelf: "stretch",
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.full,
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
    textAlign: "center",
    writingDirection: "rtl",
  },
  toggleTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  listScroll: { flex: 1, minHeight: 0 },
  list: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    // Card shadow: iOS + Android + web
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }
      : {}),
  },
  thumb: { height: 180, overflow: "hidden" },
  cardBody: {
    padding: 12,
    alignItems: "flex-end",
    direction: "rtl",
  },
  snippet: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 8,
    textAlign: "right",
    alignSelf: "stretch",
    writingDirection: "rtl",
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  statusBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  statusText: {
    color: colors.primary,
    fontWeight: "500",
    fontSize: 12,
    textAlign: "right",
  },
  meta: { fontSize: 12, color: colors.muted, textAlign: "right" },
  authorMine: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600",
    textAlign: "right",
    alignSelf: "stretch",
    marginTop: 4,
    writingDirection: "rtl",
  },
  authorOther: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "right",
    alignSelf: "stretch",
    marginTop: 4,
    writingDirection: "rtl",
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  fabText: { fontSize: 28, color: colors.white, lineHeight: 32 },
});

const emptyStyles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl * 1.5,
    paddingBottom: 80,
  },
  illustrationWrap: {
    width: 140,
    height: 140,
    marginBottom: spacing.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  illustrationBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${colors.primary}14`,
    borderWidth: 2,
    borderColor: `${colors.primary}28`,
    justifyContent: "center",
    alignItems: "center",
  },
  illustrationEmoji: {
    fontSize: 52,
  },
  dot: {
    position: "absolute",
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    opacity: 0.25,
  },
  dotSm: {
    position: "absolute",
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    opacity: 0.15,
  },
  dotTL: { width: 14, height: 14, top: 8, left: 8 },
  dotBR: { width: 18, height: 18, bottom: 4, right: 4 },
  dotTR: { width: 10, height: 10, top: 14, right: 14 },
  headline: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtext: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radii.full,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: spacing.md,
  },
  ctaIcon: {
    fontSize: 22,
    color: colors.white,
    lineHeight: 26,
    fontWeight: "300",
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.white,
  },
  hint: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    opacity: 0.7,
  },
});
