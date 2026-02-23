import { useEffect, useState } from "react";
import { View, Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import BackendBanner from "@/components/BackendBanner";
import { health } from "@/services/api";
import { railwayLog, emitEvent } from "@/utils/railwayLog";

const queryClient = new QueryClient();

export default function RootLayout() {
  const [backendOnline, setBackendOnline] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    emitEvent("app_mounted");
    railwayLog("RootLayout mounted", { platform: Platform.OS });
  }, []);

  // #region agent log
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onError = (event: ErrorEvent) => {
      railwayLog("UNCAUGHT_ERROR", { message: event.message, filename: event.filename, lineno: event.lineno, colno: event.colno, stack: event.error?.stack?.slice(0, 500) }, "error");
      emitEvent(`crash_${event.message?.slice(0, 80)}`);
      if (event.message?.includes("_loaded")) {
        event.preventDefault();
        emitEvent("maplibre_error_suppressed");
      }
    };
    const onUnhandled = (event: PromiseRejectionEvent) => {
      railwayLog("UNHANDLED_REJECTION", { reason: String(event.reason), stack: (event.reason as Error)?.stack?.slice(0, 500) }, "error");
      emitEvent(`rejection_${String(event.reason).slice(0, 80)}`);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);
  // #endregion

  useEffect(() => {
    health()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
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
