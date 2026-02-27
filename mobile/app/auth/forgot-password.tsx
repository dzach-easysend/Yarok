import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import ScreenHeader from "@/components/ScreenHeader";
import { requestPasswordReset } from "@/services/auth";
import { authStyles as styles } from "@/constants/authStyles";
import { colors } from "@/constants/theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string }; status?: number } })?.response?.data
          ?.detail ||
        (e as Error)?.message ||
        "שגיאה בשליחת בקשת איפוס";
      setError(typeof msg === "string" ? msg : "שגיאה בשליחת בקשת איפוס");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container} testID="screen-forgot-password">
      <ScreenHeader title="שכחתי סיסמה" />
      <View style={styles.form}>
        {sent ? (
          <>
            <Text style={styles.successText} testID="forgot-password-success">
              אם קיים חשבון עם המייל שהזנת, נשלח אליו קישור לאיפוס הסיסמה. בדוק את תיבת הדואר.
            </Text>
            <TouchableOpacity
              testID="link-back-to-login"
              onPress={() => router.replace("/auth/login")}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>חזרה להתחברות</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.hintText}>
              הזן את כתובת המייל שלך ונשלח אליך קישור לאיפוס הסיסמה.
            </Text>
            <TextInput
              testID="input-forgot-email"
              style={styles.input}
              placeholder="אימייל"
              placeholderTextColor="#8b9cb8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            {error ? (
              <Text testID="forgot-password-error" style={styles.errorText}>
                {error}
              </Text>
            ) : null}
            <TouchableOpacity
              testID="btn-forgot-submit"
              style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryBtnText}>שלח קישור לאיפוס</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity testID="link-back-to-login" onPress={() => router.replace("/auth/login")}>
              <Text style={styles.link}>חזרה להתחברות</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}
