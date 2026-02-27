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
  deleteMedia,
  uploadMedia,
  type MediaItem,
  type ReportListItem,
} from "@/services/api";
import * as ImagePicker from "expo-image-picker";
import ScreenHeader from "@/components/ScreenHeader";
import HorizontalDragScrollView from "@/components/HorizontalDragScrollView";
import { MapView } from "@/components/map";
import { statusLabel, STATUS_OPTIONS } from "@/utils/statusLabel";
import { railwayLog, emitEvent } from "@/utils/railwayLog";
import { colors } from "@/constants/theme";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

function getResponseStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

type CarouselItem =
  | { type: "map" }
  | { type: "media"; item: MediaItem }
  | { type: "add" };

/** Renders a single report media tile; optional delete overlay for owner. */
function MediaTile({
  uri,
  style,
  onDelete,
}: {
  uri: string;
  style: object;
  onDelete?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={[style, { backgroundColor: colors.border, justifyContent: "center", alignItems: "center" }]}>
        <Text style={[styles.muted, { textAlign: "right" }]}>תמונה לא זמינה</Text>
      </View>
    );
  }
  return (
    <View style={[style, { position: "relative" }]}>
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
      {onDelete ? (
        <TouchableOpacity
          onPress={onDelete}
          style={styles.mediaDeleteBtn}
          accessibilityLabel="מחק תמונה"
        >
          <Text style={styles.mediaDeleteBtnText}>🗑</Text>
        </TouchableOpacity>
      ) : null}
    </View>
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
    onSuccess: (data, newStatus) => {
      // #region agent log
      emitEvent("dbg_onSuccess_entry");
      railwayLog("dbg_onSuccess_entry", { dataMedia: data?.media?.length, dataStatus: data?.status, newStatus, reportId: id, cacheMediaLen: (queryClient.getQueryData(["report", id]) as ReportListItem | undefined)?.media?.length });
      // #endregion
      emitEvent("status_updated");
      railwayLog("update status onSuccess", { platform: Platform.OS, reportId: id, newStatus });
      try {
        queryClient.setQueryData(["report", id], (old: ReportListItem | undefined) =>
          old ? { ...old, status: data.status } : data,
        );
        // #region agent log
        emitEvent("dbg_setQueryData_ok");
        // #endregion
      } catch (e) {
        // #region agent log
        railwayLog("dbg_setQueryData_CRASH", { err: String(e), stack: (e as Error)?.stack?.slice(0, 500) }, "error");
        emitEvent("dbg_setQueryData_CRASH");
        // #endregion
      }
      // Update list caches so Reports screen (and any reports list) shows the new status without refetch
      try {
        queryClient.setQueriesData(
          { queryKey: ["my-reports"] },
          (old: ReportListItem[] | undefined) =>
            old?.map((r) => (r.id === id ? { ...r, status: data.status } : r)) ?? old,
        );
        queryClient.setQueriesData(
          { queryKey: ["reports"] },
          (old: ReportListItem[] | undefined) =>
            old?.map((r) => (r.id === id ? { ...r, status: data.status } : r)) ?? old,
        );
      } catch (e) {
        railwayLog("setQueriesData list status", { err: String(e) }, "error");
      }
      try {
        queryClient.invalidateQueries({ queryKey: ["reports"], refetchType: "none" });
        queryClient.invalidateQueries({ queryKey: ["my-reports"], refetchType: "none" });
        // #region agent log
        emitEvent("dbg_invalidate_ok");
        // #endregion
      } catch (e) {
        // #region agent log
        railwayLog("dbg_invalidateQueries_CRASH", { err: String(e), stack: (e as Error)?.stack?.slice(0, 500) }, "error");
        emitEvent("dbg_invalidateQueries_CRASH");
        // #endregion
      }
      // #region agent log
      emitEvent("dbg_onSuccess_complete");
      // #endregion
    },
    // #region agent log
    onError: (err) => {
      railwayLog("dbg_mutation_error", { err: String(err), stack: (err as Error)?.stack?.slice(0, 500) }, "error");
      emitEvent("dbg_mutation_error");
    },
    // #endregion
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

  const deleteMediaMutation = useMutation({
    mutationFn: (mediaId: string) => deleteMedia(id!, mediaId),
    onSuccess: (_, mediaId) => {
      queryClient.setQueryData(["report", id], (old: ReportListItem | undefined) => {
        if (!old) return old;
        const media = (old.media || []).filter((m) => m.id !== mediaId);
        return { ...old, media, media_count: media.length };
      });
    },
    onError: (err: unknown) => {
      const status = getResponseStatus(err);
      if (status === 400) {
        Alert.alert("לא ניתן למחוק", "לא ניתן למחוק את התמונה האחרונה.");
      } else {
        railwayLog("delete media failed", { err: String(err), reportId: id }, "error");
      }
    },
  });

  const uploadMediaMutation = useMutation({
    mutationFn: async (args: { uri: string; file?: File }) =>
      uploadMedia(id!, args.uri, args.file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report", id] });
    },
    onError: (e: Error) => {
      Alert.alert("שגיאה", e.message || "לא ניתן להוסיף תמונה");
    },
  });

  const handleDeleteMedia = (mediaId: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("למחוק תמונה זו?")) {
        deleteMediaMutation.mutate(mediaId);
      }
      return;
    }
    Alert.alert("מחיקת תמונה", "למחוק תמונה זו?", [
      { text: "ביטול", style: "cancel" },
      {
        text: "מחק",
        style: "destructive",
        onPress: () => deleteMediaMutation.mutate(mediaId),
      },
    ]);
  };

  const pickAndAddMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 0.8,
      videoMaxDuration: 10,
    });
    if (!result.canceled && result.assets.length) {
      for (const asset of result.assets) {
        const file = "file" in asset && asset.file instanceof File ? asset.file : undefined;
        await uploadMediaMutation.mutateAsync({ uri: asset.uri, file });
      }
    }
  };

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

  // #region agent log
  railwayLog("dbg_detail_render", { reportId: report.id, status: report.status, mediaLen: report.media?.length, mediaCount: report.media_count, selectedStatus, currentStatus, mutationStatus: updateMutation.status });
  // #endregion

  const mediaList = report.media ?? [];
  const carouselItems: CarouselItem[] = [
    { type: "map" },
    ...mediaList.map((item) => ({ type: "media" as const, item })),
    { type: "add" },
  ];

  const reportDate = report.created_at
    ? new Date(report.created_at).toLocaleDateString("he-IL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const renderCarouselItem = (item: CarouselItem) => {
    if (item.type === "map") {
      return (
        <View style={styles.carouselMapWrap}>
          <MapView
            key={`${report.lat},${report.lng}`}
            center={{ lat: report.lat, lng: report.lng }}
            zoom={15}
            markers={[{ id: report.id, lat: report.lat, lng: report.lng }]}
            interactive={false}
            style={styles.carouselMap}
          />
        </View>
      );
    }
    if (item.type === "media") {
      const url = item.item.url.startsWith("http") ? item.item.url : `${API_BASE}${item.item.url}`;
      const canDelete = mediaList.length > 1;
      return (
        <MediaTile
          uri={url}
          style={styles.mediaTile}
          onDelete={canDelete ? () => handleDeleteMedia(item.item.id) : undefined}
        />
      );
    }
    return (
      <TouchableOpacity
        style={styles.addMediaTile}
        onPress={pickAndAddMedia}
        disabled={uploadMediaMutation.isPending}
      >
        {uploadMediaMutation.isPending ? (
          <ActivityIndicator color={colors.muted} />
        ) : (
          <Text style={styles.addMediaTileText}>+ הוסף תמונה</Text>
        )}
      </TouchableOpacity>
    );
  };

  function carouselKey(item: CarouselItem, index: number): string {
    if (item.type === "map") return `map-${report.lat},${report.lng}`;
    if (item.type === "media") return item.item.id;
    return `add-${index}`;
  }

  return (
    <View style={styles.container} testID="screen-detail">
      <ScreenHeader title="דיווח" />
      <ScrollView testID="detail-content" style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {Platform.OS === "web" ? (
          <HorizontalDragScrollView
            style={styles.mediaStrip}
            contentContainerStyle={styles.mediaStripContent}
            testID="report-carousel"
          >
            {carouselItems.map((item, index) => (
              <View key={carouselKey(item, index)}>{renderCarouselItem(item)}</View>
            ))}
          </HorizontalDragScrollView>
        ) : (
          <FlatList
            data={carouselItems}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={carouselKey}
            style={styles.mediaStrip}
            contentContainerStyle={styles.mediaStripContent}
            renderItem={({ item }) => <View>{renderCarouselItem(item)}</View>}
          />
        )}

        <View style={styles.body}>
          <Text style={[styles.muted, { marginBottom: 4 }]} testID="report-date">
            תאריך דיווח: {reportDate}
          </Text>
          <Text style={[styles.muted, { marginBottom: 12 }]}>
            צפיות: {report.view_count ?? 0}
          </Text>
          <View style={styles.meta}>
            <View testID="status-badge" style={styles.statusBadge}>
              <Text style={styles.statusText}>{statusLabel(report.status)}</Text>
            </View>
          </View>

          {report.description ? (
            <Text testID="detail-description" style={styles.description}>{report.description}</Text>
          ) : null}

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

          {report.is_mine ? (
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
          ) : null}
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
  carouselMapWrap: { width: 320, height: 220, borderRadius: 12, overflow: "hidden", backgroundColor: colors.border },
  carouselMap: { width: 320, height: 220, borderRadius: 12 },
  mediaTile: {
    width: 200,
    height: 208,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  mediaDeleteBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  mediaDeleteBtnText: { fontSize: 16 },
  addMediaTile: {
    width: 200,
    height: 208,
    borderRadius: 12,
    backgroundColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.muted,
  },
  addMediaTileText: { fontSize: 15, color: colors.muted, textAlign: "right" },
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
