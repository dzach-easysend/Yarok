import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ScreenHeader from "@/components/ScreenHeader";
import PasswordInput from "@/components/PasswordInput";
import { authStyles as styles } from "@/constants/authStyles";
import { colors } from "@/constants/theme";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError(null);
    if (password !== passwordConfirm) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, displayName || null);
      router.replace("/(tabs)/settings");
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "שגיאה בהרשמה";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container} testID="screen-register">
      <ScreenHeader title="הרשמה" />
      <View style={styles.form}>
        <TextInput
          testID="input-register-email"
          style={styles.input}
          placeholder="אימייל"
          placeholderTextColor="#8b9cb8"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <PasswordInput
          testID="input-register-password"
          placeholder="סיסמה"
          value={password}
          onChangeText={setPassword}
        />
        <PasswordInput
          testID="input-register-password-confirm"
          placeholder="הקלד שוב לאימות"
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
        />
        <TextInput
          testID="input-register-name"
          style={styles.input}
          placeholder="שם (אופציונלי)"
          placeholderTextColor="#8b9cb8"
          value={displayName}
          onChangeText={setDisplayName}
        />
        {error ? <Text testID="register-error" style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity
          testID="btn-register-submit"
          style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>הירשם</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity testID="link-goto-login" onPress={() => router.replace("/auth/login")}>
          <Text style={styles.link}>כבר יש חשבון? התחבר</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
