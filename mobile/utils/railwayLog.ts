/**
 * Send client-side events to the backend so they appear in Railway Deploy Logs.
 * Enable with EXPO_PUBLIC_DEBUG_LOGS=1 in the mobile app env (and DEBUG_CLIENT_LOGS=true on the backend).
 * Use for production debugging (e.g. blank screen after second delete).
 */

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const ENABLED = process.env.EXPO_PUBLIC_DEBUG_LOGS === "1" || process.env.EXPO_PUBLIC_DEBUG_LOGS === "true";

export function railwayLog(
  message: string,
  data?: Record<string, unknown>,
  level: "info" | "warn" | "error" = "info",
) {
  if (!ENABLED || !BASE) return;

  const payload = {
    level,
    message,
    data: data ?? {},
    timestamp: Date.now(),
  };

  fetch(`${BASE.replace(/\/$/, "")}/api/v1/debug/client-log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
