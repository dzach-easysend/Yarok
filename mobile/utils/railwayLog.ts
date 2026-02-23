/**
 * Send client-side events to the backend so they appear in Railway Deploy Logs.
 * - emitEvent(name): GET /api/v1/debug/event?e=name — always sent when API base is set.
 *   Shows in API HTTP log and [EVENT] stdout. Use for hard data (create, status update, screen mount).
 * - railwayLog(...): POST /api/v1/debug/client-log — only when EXPO_PUBLIC_DEBUG_LOGS=1 and
 *   DEBUG_CLIENT_LOGS=true. Rich payload for deeper debugging.
 */

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const ENABLED = process.env.EXPO_PUBLIC_DEBUG_LOGS === "1" || process.env.EXPO_PUBLIC_DEBUG_LOGS === "true";

/** Fire a GET to the debug event endpoint so the action appears in Railway API logs (no env flag). */
export function emitEvent(eventName: string): void {
  if (!BASE) return;
  const base = BASE.replace(/\/$/, "");
  const q = encodeURIComponent(eventName);
  fetch(`${base}/api/v1/debug/event?e=${q}`).catch(() => {});
}

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
