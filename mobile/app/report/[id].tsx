import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import {
  getReport,
  updateReport,
  deleteReport,
  type MediaItem,
  type ReportListItem,
} from "@/services/api";
import ScreenHeader from "@/components/ScreenHeader";
import { MapView } from "@/components/map";
import { statusLabel, STATUS_OPTIONS } from "@/utils/statusLabel";
import { railwayLog, emitEvent } from "@/utils/railwayLog";
import { colors } from "@/constants/theme";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

function getResponseStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

/** Renders a single report media tile; shows placeholder on load error (e.g. 404) so one broken image doesn't blank the screen. */
function MediaTile({ uri, style }: { uri: string; style: object }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={[style, { backgroundColor: colors.border, justifyContent: "center", alignItems: "center" }]}>
        <Text style={styles.muted}>תמונה לא זמינה</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: report, isLoading, isError, error } = useQuery({
    queryKey: ["report", id],
    queryFn: () => getReport(id!),
    enabled: !!id,
    retry: (failureCount, err) => {
      if (getResponseStatus(err) === 404) return false;
      return failureCount < 3;
    },
  });

  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const hasLoggedLoaded = useRef(false);
  const hasLoggedError = useRef(false);

  useEffect(() => {
    railwayLog("ReportDetailScreen mounted", { platform: Platform.OS, reportId: id });
    emitEvent("report_detail_mounted");
  }, [id]);

  useEffect(() => {
    if (report && !isLoading && !hasLoggedLoaded.current) {
      hasLoggedLoaded.current = true;
      railwayLog("ReportDetailScreen report loaded", { reportId: id });
    }
  }, [report, isLoading, id]);
  useEffect(() => {
    if (isError && !hasLoggedError.current) {
      hasLoggedError.current = true;
      railwayLog("ReportDetailScreen report error", { reportId: id, error: String(error) });
    }
  }, [isError, id, error]);

  const updateMutation = useMutation({
    mutationFn: (status: string) => updateReport(id!, { status }),
    onSuccess: (_data, newStatus) => {
      emitEvent("status_updated");
      railwayLog("update status onSuccess", { platform: Platform.OS, reportId: id, newStatus });
      // Update report in list caches so navigating back never shows stale status (avoids blank screen on web)
      queryClient.setQueriesData(
        { queryKey: ["my-reports"] },
        (old: ReportListItem[] | undefined) =>
          old
            ? old.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
            : old,
      );
      queryClient.setQueriesData(
        { queryKey: ["reports"] },
        (old: ReportListItem[] | undefined) =>
          old
            ? old.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
            : old,
      );
      queryClient.invalidateQueries({ queryKey: ["report", id] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["my-reports"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteReport(id!),
    onSuccess: () => {
      emitEvent("delete_success");
      railwayLog("delete onSuccess", { platform: Platform.OS, reportId: id });
      // Remove deleted report from list caches so reports screen never mounts with stale item (fixes blank screen after delete on web)
      queryClient.setQueriesData(
        { queryKey: ["my-reports"] },
        (old: ReportListItem[] | undefined) =>
          old ? old.filter((r) => r.id !== id) : old,
      );
      queryClient.setQueriesData(
        { queryKey: ["reports"] },
        (old: ReportListItem[] | undefined) =>
          old ? old.filter((r) => r.id !== id) : old,
      );
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["my-reports"] });
      railwayLog("before router.replace", { target: "/(tabs)/reports" });
      // On web, router.replace can leave the app in a blank state (Expo Router stack). Use full-page
      // navigation so the reports list always loads. Use hash (#reports) so the server only needs to
      // serve index at /; path-based /reports can 404 or fail to hydrate and cause a blank screen.
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const origin = window.location.origin;
        const base =
          window.location.pathname.split("/report")[0].replace(/\/$/, "") || "";
        const root = base ? `${origin}${base}` : origin;
        window.location.replace(`${root}/#reports`);
        return;
      }
      router.replace("/(tabs)/reports");
      railwayLog("after router.replace", {});
    },
    onError: (err) => {
      railwayLog("delete failed", { err: String(err), reportId: id }, "error");
    },
  });

  function handleDelete() {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("מחיקת דיווח\nלמחוק דיווח זה?")) {
        deleteMutation.mutate();
      }
      return;
    }
    Alert.alert("מחיקת דיווח", "למחוק דיווח זה?", [
      { text: "ביטול", style: "cancel" },
      {
        text: "מחק",
        style: "destructive",
        onPress: () => deleteMutation.mutate(),
      },
    ]);
  }

  if (isLoading && !report) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="דיווח" />
        <View style={styles.centered}>
          <Text style={styles.muted}>טוען...</Text>
        </View>
      </View>
    );
  }

  if (isError) {
    const is404 = getResponseStatus(error) === 404;
    return (
      <View style={styles.container}>
        <ScreenHeader title="דיווח" />
        <View style={styles.centered}>
          <Text style={styles.muted}>
            {is404 ? "דיווח לא נמצא" : "שגיאה בטעינת הדיווח"}
          </Text>
          <TouchableOpacity
            style={[styles.updateBtn, { marginTop: 16 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.updateBtnText}>חזרה</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="דיווח" />
        <View style={styles.centered}>
          <Text style={styles.muted}>לא נמצא</Text>
        </View>
      </View>
    );
  }

  const currentStatus = selectedStatus ?? report.status;

  return (
    <View style={styles.container} testID="screen-detail">
      <ScreenHeader title="דיווח" />
      <ScrollView testID="detail-content" style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {report.media && report.media.length > 0 ? (
          <FlatList
            data={report.media}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item: MediaItem) => item.id}
            style={styles.mediaStrip}
            contentContainerStyle={styles.mediaStripContent}
            renderItem={({ item }: { item: MediaItem }) => (
              <MediaTile
                uri={item.url.startsWith("http") ? item.url : `${API_BASE}${item.url}`}
                style={styles.mediaTile}
              />
            )}
          />
        ) : (
          <View style={styles.mediaStrip}>
            <View style={styles.mediaTileEmpty}>
              <Text style={styles.muted}>אין תמונות</Text>
            </View>
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.meta}>
            <View testID="status-badge" style={styles.statusBadge}>
              <Text style={styles.statusText}>{statusLabel(report.status)}</Text>
            </View>
            <Text style={styles.muted}>
              {report.address || "ללא כתובת"} · {report.media_count} תמונות
            </Text>
          </View>

          {report.description ? (
            <Text testID="detail-description" style={styles.description}>{report.description}</Text>
          ) : null}

          <MapView
            center={{ lat: report.lat, lng: report.lng }}
            zoom={15}
            markers={[{ id: report.id, lat: report.lat, lng: report.lng }]}
            interactive={false}
            style={styles.miniMap}
          />

          <Text style={styles.sectionLabel}>עדכון סטטוס</Text>
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.statusOption,
                  currentStatus === opt.value && styles.statusOptionActive,
                ]}
                onPress={() => setSelectedStatus(opt.value)}
              >
                <Text
                  style={[
                    styles.statusOptionText,
                    currentStatus === opt.value && styles.statusOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {selectedStatus && selectedStatus !== report.status && (
            <TouchableOpacity
              style={styles.updateBtn}
              onPress={() => updateMutation.mutate(selectedStatus)}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.updateBtnText}>עדכן סטטוס</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            testID="btn-delete-report"
            style={styles.deleteBtn}
            onPress={handleDelete}
            disabled={deleteMutation.isPending}
          >
            <Text style={styles.deleteBtnText}>
              {deleteMutation.isPending ? "מוחק..." : "מחק דיווח"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 80 },
  mediaStrip: { height: 240, backgroundColor: colors.surface },
  mediaStripContent: { gap: 8, padding: 16 },
  mediaTile: {
    width: 200,
    height: 208,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  mediaTileEmpty: {
    flex: 1,
    height: 208,
    margin: 16,
    borderRadius: 12,
    backgroundColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  body: { padding: 16 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  statusBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusText: { color: colors.primary, fontWeight: "500", fontSize: 12, textAlign: "right" },
  muted: { fontSize: 12, color: colors.muted, textAlign: "right" },
  description: { fontSize: 15, color: colors.text, lineHeight: 22, marginBottom: 16, textAlign: "right" },
  miniMap: { height: 180, borderRadius: 12, overflow: "hidden", marginBottom: 16 },
  sectionLabel: { fontSize: 11, color: colors.muted, marginBottom: 8, textAlign: "right" },
  statusRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  statusOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusOptionActive: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderColor: colors.primary,
  },
  statusOptionText: { fontSize: 13, color: colors.muted, textAlign: "right" },
  statusOptionTextActive: { color: colors.primary, fontWeight: "600", textAlign: "right" },
  updateBtn: {
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  updateBtnText: { color: colors.white, fontWeight: "600", fontSize: 15, textAlign: "right" },
  deleteBtn: {
    height: 44,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  deleteBtnText: { color: colors.error, fontWeight: "600", fontSize: 15, textAlign: "right" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
});
