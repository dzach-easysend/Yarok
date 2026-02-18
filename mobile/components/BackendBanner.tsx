/**
 * Banner displayed when the backend is unreachable.
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors } from "@/constants/theme";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

interface BackendBannerProps {
  onDismiss: () => void;
}

export default function BackendBanner({ onDismiss }: BackendBannerProps) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        ⚠️ Backend לא זמין — בדוק שהשרת רץ על {API_BASE}
      </Text>
      <TouchableOpacity onPress={onDismiss} style={styles.close}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239, 68, 68, 0.3)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  text: { color: colors.error, fontSize: 13, flex: 1, textAlign: "right" },
  close: { padding: 4 },
  closeText: { color: colors.error, fontSize: 18 },
});
