import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ScreenHeader from "@/components/ScreenHeader";
import PasswordInput from "@/components/PasswordInput";
import { authStyles as styles } from "@/constants/authStyles";
import { colors } from "@/constants/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/(tabs)/settings");
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "שגיאה בהתחברות";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container} testID="screen-login">
      <ScreenHeader title="התחברות" />
      <View style={styles.form}>
        <TextInput
          testID="input-login-email"
          style={styles.input}
          placeholder="אימייל"
          placeholderTextColor="#8b9cb8"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <PasswordInput
          testID="input-login-password"
          placeholder="סיסמה"
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text testID="login-error" style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity
          testID="btn-login-submit"
          style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>התחבר</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          testID="link-forgot-password"
          onPress={() => router.push("/auth/forgot-password")}
        >
          <Text style={styles.link}>שכחתי סיסמה?</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="link-goto-register" onPress={() => router.replace("/auth/register")}>
          <Text style={styles.link}>אין חשבון? הירשם</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
