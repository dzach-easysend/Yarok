/**
 * In-tree overlay for login/register so the create report form state is preserved.
 * Uses KeyboardAvoidingView so the form stays visible when the keyboard opens.
 */

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { authStyles } from "@/constants/authStyles";
import { colors, spacing, radii } from "@/constants/theme";

interface Props {
  visible: boolean;
  onSuccess: () => void;
  onDismiss: () => void;
}

type Tab = "login" | "register";

export default function AuthPromptOverlay({ visible, onSuccess, onDismiss }: Props) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      onSuccess();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string }; status?: number } })?.response?.data
          ?.detail ||
        (e as Error)?.message ||
        "שגיאה בהתחברות";
      setError(typeof msg === "string" ? msg : "שגיאה בהתחברות");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError(null);
    setLoading(true);
    try {
      await register(email, password, displayName || null);
      onSuccess();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error)?.message ||
        "שגיאה בהרשמה";
      setError(typeof msg === "string" ? msg : "שגיאה בהרשמה");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (tab === "login") handleLogin();
    else handleRegister();
  };

  if (!visible) return null;

  const behavior = Platform.OS === "ios" ? "padding" : "height";

  return (
    <View style={styles.root}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onDismiss}
        accessibilityLabel="סגור"
      />
      <KeyboardAvoidingView
        style={styles.panel}
        behavior={behavior}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === "login" && styles.tabActive]}
            onPress={() => setTab("login")}
          >
            <Text style={[styles.tabText, tab === "login" && styles.tabTextActive]}>התחבר</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === "register" && styles.tabActive]}
            onPress={() => setTab("register")}
          >
            <Text style={[styles.tabText, tab === "register" && styles.tabTextActive]}>הירשם</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TextInput
            style={authStyles.input}
            placeholder="אימייל"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={authStyles.input}
            placeholder="סיסמה"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {tab === "register" ? (
            <TextInput
              style={authStyles.input}
              placeholder="שם (אופציונלי)"
              placeholderTextColor={colors.muted}
              value={displayName}
              onChangeText={setDisplayName}
            />
          ) : null}
          {error ? <Text style={authStyles.errorText}>{error}</Text> : null}
          <TouchableOpacity
            style={[authStyles.primaryBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={authStyles.primaryBtnText}>
                {tab === "login" ? "התחבר" : "הירשם"}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity style={styles.dismissLink} onPress={onDismiss}>
          <Text style={styles.dismissText}>המשך אנונימי</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + 24,
    maxHeight: "85%",
  },
  tabRow: {
    flexDirection: "row",
    marginBottom: spacing.lg,
    backgroundColor: colors.border,
    borderRadius: radii.full,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.full,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: { fontSize: 14, fontWeight: "500", color: colors.muted, textAlign: "center" },
  tabTextActive: { color: colors.primary, fontWeight: "700" },
  scroll: { maxHeight: 320 },
  scrollContent: { gap: 12, paddingBottom: 8 },
  dismissLink: { alignItems: "center", marginTop: spacing.lg },
  dismissText: { fontSize: 14, color: colors.primary, textAlign: "center" },
});
