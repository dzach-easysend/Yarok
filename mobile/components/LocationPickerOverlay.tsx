/**
 * Full-screen location picker rendered as an in-tree overlay.
 * Avoids all navigation stack issues that arise from pushing modals
 * on top of modals. The map moves freely; the pin stays centered.
 */

import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { MapView, type MapCenter } from "@/components/map";
import { geocodeSearch } from "@/services/geocoding";
import MapSearchBar from "@/components/MapSearchBar";
import { colors, spacing, radii } from "@/constants/theme";

// The pin graphic: circle (32px) + tip (10px) − 2px overlap = 40px total.
// Lift by half so the tip point sits exactly on the map center coordinate.
const PIN_LIFT = 20;

interface Props {
  visible: boolean;
  initialCenter: MapCenter;
  onConfirm: (location: MapCenter) => void;
  onCancel: () => void;
}

export default function LocationPickerOverlay({
  visible,
  initialCenter,
  onConfirm,
  onCancel,
}: Props) {
  const [mapCenter, setMapCenter] = useState<MapCenter>(initialCenter);
  // Ref mirrors state so handleConfirm always reads the latest center,
  // even if the user taps confirm before the pan state update has re-rendered.
  const mapCenterRef = useRef<MapCenter>(initialCenter);

  const [flyTo, setFlyTo] = useState<{ center: MapCenter; zoom: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const handleMoveEnd = useCallback((center: MapCenter) => {
    mapCenterRef.current = center;
    setMapCenter(center);
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(mapCenterRef.current);
  }, [onConfirm]);

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const result = await geocodeSearch(q);
      if (result) {
        mapCenterRef.current = result;
        setMapCenter(result);
        setFlyTo({ center: result, zoom: 16 });
      }
    } catch {
      // User can pan manually
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  if (!visible) return null;

  return (
    <View style={styles.root}>
      {/* Map fills the overlay */}
      <MapView
        center={initialCenter}
        zoom={15}
        markers={[]}
        onMoveEnd={handleMoveEnd}
        flyTo={flyTo}
        style={styles.map}
      />

      {/* Top bar: search + cancel */}
      <View style={styles.topBar}>
        <View style={styles.searchRow}>
          <MapSearchBar
            style={styles.searchBox}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={handleSearch}
            loading={searching}
            placeholder="חיפוש אזור או כתובת"
          />
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onCancel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.cancelText}>ביטול</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Fixed centered pin — pointerEvents none so map panning works */}
      <View style={[styles.pinOverlay, { pointerEvents: "none" }]}>
        <View style={[styles.pinContainer, { transform: [{ translateY: -PIN_LIFT }] }]}>
          <View style={styles.pinCircle} />
          <View style={styles.pinTip} />
          <View style={styles.pinShadow} />
        </View>
      </View>

      {/* Bottom bar: instruction + confirm */}
      <View style={styles.bottomBar}>
        <Text style={styles.instruction}>
          גרור את המפה כדי למקם את הסיכה על הפסולת
        </Text>
        <TouchableOpacity
          testID="pick-location-confirm"
          style={styles.confirmBtn}
          onPress={handleConfirm}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmText}>אשר מיקום</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  map: { flex: 1 },

  // Top bar
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === "ios" ? 56 : 16,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    zIndex: 10001,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  searchBox: {
    flex: 1,
  },
  cancelBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cancelText: { fontSize: 14, color: colors.text, fontWeight: "500" },

  // Pin
  pinOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10000,
  },
  pinContainer: { alignItems: "center" },
  pinCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
  },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.primary,
    alignSelf: "center",
    marginTop: -2,
  },
  pinShadow: {
    width: 8,
    height: 4,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.18)",
    marginTop: 4,
    alignSelf: "center",
  },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10001,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === "ios" ? 36 : spacing.lg,
    gap: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  instruction: { fontSize: 13, color: colors.muted, textAlign: "center" },
  confirmBtn: {
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmText: { fontSize: 16, fontWeight: "700", color: colors.white },
});
