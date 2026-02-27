import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import ScreenHeader from "@/components/ScreenHeader";
import PasswordInput from "@/components/PasswordInput";
import { resetPassword } from "@/services/auth";
import { authStyles as styles } from "@/constants/authStyles";
import { colors } from "@/constants/theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = params.token ?? "";
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const hasToken = !!token;

  const handleSubmit = async () => {
    if (!hasToken) return;
    setError(null);
    if (password !== passwordConfirm) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error)?.message ||
        "שגיאה באיפוס סיסמה";
      setError(typeof msg === "string" ? msg : "שגיאה באיפוס סיסמה");
    } finally {
      setLoading(false);
    }
  };

  if (!hasToken) {
    return (
      <View style={styles.container} testID="screen-reset-password">
        <ScreenHeader title="איפוס סיסמה" />
        <View style={styles.form}>
          <Text style={styles.errorText}>
            קישור לא תקין או שפג תוקפו. בקש קישור חדש מעמוד שכחתי סיסמה.
          </Text>
          <TouchableOpacity onPress={() => router.replace("/auth/forgot-password")}>
            <Text style={styles.link}>שכחתי סיסמה</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace("/auth/login")}>
            <Text style={styles.link}>התחברות</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (success) {
    return (
      <View style={styles.container} testID="screen-reset-password">
        <ScreenHeader title="איפוס סיסמה" />
        <View style={styles.form}>
          <Text style={styles.successText} testID="reset-password-success">
            הסיסמה עודכנה. כעת תוכל להתחבר עם הסיסמה החדשה.
          </Text>
          <TouchableOpacity
            testID="link-login-after-reset"
            style={styles.primaryBtn}
            onPress={() => router.replace("/auth/login")}
          >
            <Text style={styles.primaryBtnText}>התחבר</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="screen-reset-password">
      <ScreenHeader title="איפוס סיסמה" />
      <View style={styles.form}>
        <PasswordInput
          testID="input-reset-password"
          placeholder="סיסמה חדשה"
          value={password}
          onChangeText={setPassword}
        />
        <PasswordInput
          testID="input-reset-password-confirm"
          placeholder="הקלד שוב לאימות"
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
        />
        {error ? (
          <Text testID="reset-password-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}
        <TouchableOpacity
          testID="btn-reset-submit"
          style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>עדכן סיסמה</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace("/auth/login")}>
          <Text style={styles.link}>ביטול — חזרה להתחברות</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
