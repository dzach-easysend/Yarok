import { View, StyleSheet, TouchableOpacity, Platform, type ViewStyle } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocateMe: () => void;
  /** When true, locate button is disabled (e.g. while getting location). */
  locating?: boolean;
  style?: ViewStyle;
}

export function MapControls({ onZoomIn, onZoomOut, onLocateMe, locating = false, style }: MapControlsProps) {
  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[styles.button, locating && styles.buttonDisabled]}
        onPress={onLocateMe}
        activeOpacity={0.7}
        disabled={locating}
      >
        <MaterialIcons name="my-location" size={24} color={locating ? colors.border : colors.muted} />
      </TouchableOpacity>

      <View style={styles.zoomContainer}>
        <TouchableOpacity style={styles.zoomButton} onPress={onZoomIn} activeOpacity={0.7}>
          <MaterialIcons name="add" size={24} color={colors.muted} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.zoomButton} onPress={onZoomOut} activeOpacity={0.7}>
          <MaterialIcons name="remove" size={24} color={colors.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    bottom: 32,
    alignItems: "center",
    gap: 12,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0px 2px 4px rgba(0,0,0,0.15)",
      },
    }),
  },
  zoomContainer: {
    width: 44,
    borderRadius: 8,
    backgroundColor: colors.white,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0px 2px 4px rgba(0,0,0,0.15)",
      },
    }),
  },
  zoomButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    width: "100%",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
