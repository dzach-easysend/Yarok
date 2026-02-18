import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import BackendBanner from "@/components/BackendBanner";
import { health } from "@/services/api";

const queryClient = new QueryClient();

export default function RootLayout() {
  const [backendOnline, setBackendOnline] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    health()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <View style={{ flex: 1 }}>
          {!backendOnline && !dismissed && (
            <BackendBanner onDismiss={() => setDismissed(true)} />
          )}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="report/create" options={{ presentation: "modal" }} />
            <Stack.Screen name="report/[id]" />
            <Stack.Screen name="auth/login" />
            <Stack.Screen name="auth/register" />
          </Stack>
        </View>
        </QueryClientProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
