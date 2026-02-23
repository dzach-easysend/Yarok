import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useEffect, useRef } from "react";
import { getReports, type ReportListItem } from "@/services/api";
import { geocodeSearch, GeocodingError } from "@/services/geocoding";
import { MapView, type MapCenter, type MapMarker } from "@/components/map";
import MapSearchBar from "@/components/MapSearchBar";
import { colors } from "@/constants/theme";
import { railwayLog, emitEvent } from "@/utils/railwayLog";

const DEFAULT_CENTER: MapCenter = { lat: 31.7683, lng: 35.2137 };
const DEFAULT_ZOOM = 13;
const TOAST_DURATION_MS = 4000;

declare global {
  interface Window {
    __yarokTestHooks?: { getSearchPinCount: () => number };
  }
}

export default function MapScreen() {
  const router = useRouter();
  const [center, setCenter] = useState<MapCenter>(DEFAULT_CENTER);
  const [searchQuery, setSearchQuery] = useState("");
  const [flyTo, setFlyTo] = useState<{ center: MapCenter; zoom: number } | null>(null);
  const [searchPin, setSearchPin] = useState<MapMarker | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; text: string }>({
    visible: false,
    text: "",
  });
  const searchPinRef = useRef(searchPin);
  searchPinRef.current = searchPin;

  useEffect(() => {
    emitEvent("map_screen_mounted");
    railwayLog("MapScreen mounted", { platform: Platform.OS });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as Window).__yarokTestHooks = {
      getSearchPinCount: () => (searchPinRef.current ? 1 : 0),
    };
    return () => {
      delete (window as Window).__yarokTestHooks;
    };
  }, []);

  const { data: reports = [] } = useQuery({
    queryKey: ["reports", center.lat, center.lng],
    queryFn: () =>
      getReports({ lat: center.lat, lng: center.lng, radius_km: 50 }),
  });

  const markers: MapMarker[] = [
    ...reports.map((r: ReportListItem) => ({
      id: r.id,
      lat: r.lat,
      lng: r.lng,
      color: colors.primary,
    })),
    ...(searchPin ? [searchPin] : []),
  ];

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    try {
      const result = await geocodeSearch(searchQuery);
      if (!result) {
        setToast({ visible: true, text: "לא נמצא מיקום" });
        setTimeout(() => setToast((t) => ({ ...t, visible: false })), TOAST_DURATION_MS);
        return;
      }
      setSearchPin({
        id: "__search__",
        lat: result.lat,
        lng: result.lng,
        color: "#f57c00",
      });
      setFlyTo({ center: result, zoom: 15 });
      setToast({ visible: true, text: "המפה הוזזה למיקום המבוקש" });
      setTimeout(() => setToast((t) => ({ ...t, visible: false })), TOAST_DURATION_MS);
    } catch (err) {
      if (__DEV__ && err instanceof Error) {
        console.warn("[Map search]", err.message, err);
      }
      const message =
        err instanceof GeocodingError && err.status === 429
          ? "יותר מדי חיפושים. נסה שוב בעוד רגע."
          : "שגיאה בחיפוש. נסה שוב.";
      setToast({ visible: true, text: message });
      setTimeout(() => setToast((t) => ({ ...t, visible: false })), TOAST_DURATION_MS);
    }
  }, [searchQuery]);

  return (
    <View style={styles.container} testID="screen-map">
      <MapView
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        markers={markers}
        onMarkerPress={(id) => {
          if (id !== "__search__") router.push(`/report/${id}`);
        }}
        onMoveEnd={setCenter}
        flyTo={flyTo}
      />
      <MapSearchBar
        style={styles.searchBar}
        value={searchQuery}
        onChangeText={(text) => {
          setSearchQuery(text);
          if (searchPin) setSearchPin(null);
        }}
        onSubmit={handleSearch}
        onClear={() => {
          setSearchQuery("");
          setSearchPin(null);
        }}
        placeholder="חיפוש אזור או כתובת"
        testID="map-search-input"
        clearTestID="map-search-clear"
      />
      <TouchableOpacity
        testID="fab-create"
        style={styles.fab}
        onPress={() => router.push("/report/create")}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
      <View
        testID="toast"
        style={[styles.toast, !toast.visible && styles.toastHidden]}
        {...(Platform.OS === "web" && {
          className: toast.visible ? "" : "hidden",
        } as { className?: string })}
      >
        <Text style={styles.toastText}>{toast.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    zIndex: 1000,
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
  toast: {
    position: "absolute",
    bottom: 84,
    left: 24,
    right: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    zIndex: 1001,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  toastHidden: {
    opacity: 0,
    pointerEvents: "none",
  },
  toastText: {
    fontSize: 14,
    color: colors.text,
    textAlign: "right",
  },
});
