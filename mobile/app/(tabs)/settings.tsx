import { View, Text, StyleSheet, TouchableOpacity, Switch } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { colors } from "@/constants/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const { isLoggedIn, logout } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(true);

  const handleAuthRow = async () => {
    if (isLoggedIn) {
      await logout();
    } else {
      router.push("/auth/login");
    }
  };

  return (
    <View style={styles.container} testID="screen-settings">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>חשבון</Text>
        <View style={styles.row}>
          <Text style={styles.rowText}>פרופיל</Text>
          <Text style={styles.muted} testID="profile-status">{isLoggedIn ? "מחובר" : "לא מחובר"}</Text>
        </View>
        <TouchableOpacity testID="auth-row" style={styles.row} onPress={handleAuthRow}>
          <Text style={styles.rowText} testID="auth-row-label">
            {isLoggedIn ? "התנתקות" : "התחברות / הרשמה"}
          </Text>
          {!isLoggedIn && <Text style={styles.muted}>אופציונלי</Text>}
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>התראות</Text>
        <View style={styles.row}>
          <Text style={styles.rowText}>התראות Push</Text>
          <Switch
            value={pushEnabled}
            onValueChange={setPushEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowText}>רדיוס התראה</Text>
          <Text style={styles.muted}>5 ק״מ</Text>
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>אודות</Text>
        <TouchableOpacity style={styles.row}>
          <Text style={styles.rowText}>מדיניות פרטיות</Text>
        </TouchableOpacity>
        <View style={styles.row}>
          <Text style={styles.rowText}>גרסה</Text>
          <Text style={styles.muted}>1.0.0</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16, paddingBottom: 80 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.muted,
    marginBottom: 8,
    paddingRight: 4,
    textAlign: "right",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: 4,
  },
  rowText: { fontSize: 15, color: colors.text, textAlign: "right" },
  muted: { fontSize: 13, color: colors.muted, textAlign: "right" },
});
