/**
 * Auth service: login, register, token management.
 * Uses expo-secure-store on native, falls back to localStorage on web.
 *
 * Token hierarchy (highest priority wins for axios Authorization header):
 *   1. Email/password token  — user is "logged in"
 *   2. Device token          — anonymous user; set automatically on startup
 *
 * On logout the email token is removed and the device token is restored so
 * anonymous ownership (is_mine) continues to work without re-registration.
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api, setAuthToken } from "./api";

const TOKEN_KEY = "yarok_token";
const REFRESH_KEY = "yarok_refresh";
const DEVICE_TOKEN_KEY = "yarok_device_token";
const DEVICE_ID_KEY = "yarok_device_id";
const DISPLAY_NAME_KEY = "yarok_display_name";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  display_name?: string | null;
  user_id?: string;
}

export interface MeResponse {
  id: string;
  email: string | null;
  display_name: string | null;
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

function generateDeviceId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Ensure this device has a valid device-scoped JWT.
 * - Restores an existing device token from storage if present.
 * - Otherwise generates a stable device UUID, registers with the backend,
 *   and stores the resulting token.
 * Sets the axios Authorization header to the device token.
 * Non-fatal: network errors are swallowed so the app still works offline.
 */
export async function ensureDeviceAuth(): Promise<void> {
  const existing = await getItem(DEVICE_TOKEN_KEY);
  if (existing) {
    setAuthToken(existing);
    return;
  }

  let deviceId = await getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = generateDeviceId();
    await setItem(DEVICE_ID_KEY, deviceId);
  }

  try {
    const { data } = await api.post<TokenPair>("/api/v1/auth/device", {
      device_id: deviceId,
    });
    await setItem(DEVICE_TOKEN_KEY, data.access_token);
    setAuthToken(data.access_token);
  } catch {
    // Non-fatal: app works without a device token; ownership tracking
    // and the delete button just won't be available.
  }
}

/**
 * Fetch current user profile (GET /auth/me). Used on startup when restoring auth.
 */
export async function getMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>("/api/v1/auth/me");
  return data;
}

export async function login(email: string, password: string): Promise<TokenPair> {
  const { data } = await api.post<TokenPair>("/api/v1/auth/login", { email, password });
  await setItem(TOKEN_KEY, data.access_token);
  await setItem(REFRESH_KEY, data.refresh_token);
  const name = data.display_name ?? "";
  if (name) await setItem(DISPLAY_NAME_KEY, name);
  setAuthToken(data.access_token);
  return data;
}

export async function register(
  email: string,
  password: string,
  displayName?: string | null,
): Promise<TokenPair> {
  const { data } = await api.post<TokenPair>("/api/v1/auth/register", {
    email,
    password,
    display_name: displayName || null,
  });
  await setItem(TOKEN_KEY, data.access_token);
  await setItem(REFRESH_KEY, data.refresh_token);
  const name = data.display_name ?? displayName ?? "";
  if (name) await setItem(DISPLAY_NAME_KEY, name);
  setAuthToken(data.access_token);
  return data;
}

export async function logout(): Promise<void> {
  await removeItem(TOKEN_KEY);
  await removeItem(REFRESH_KEY);
  await removeItem(DISPLAY_NAME_KEY);
  const deviceToken = await getItem(DEVICE_TOKEN_KEY);
  if (deviceToken) {
    setAuthToken(deviceToken);
  } else {
    setAuthToken(null);
    await ensureDeviceAuth();
  }
}

/**
 * Clear email auth but keep device token (for "report anonymously" from create screen).
 */
export async function switchToAnonymous(): Promise<void> {
  await removeItem(TOKEN_KEY);
  await removeItem(REFRESH_KEY);
  await removeItem(DISPLAY_NAME_KEY);
  const deviceToken = await getItem(DEVICE_TOKEN_KEY);
  if (deviceToken) {
    setAuthToken(deviceToken);
  } else {
    setAuthToken(null);
    await ensureDeviceAuth();
  }
}

export interface RestoreAuthResult {
  isLoggedIn: boolean;
  displayName: string | null;
}

/**
 * Called on app startup.
 * Returns { isLoggedIn, displayName }. If token exists, tries getMe() to load display_name;
 * on network failure falls back to cached display_name so user stays logged in.
 */
export async function restoreAuth(): Promise<RestoreAuthResult> {
  const token = await getItem(TOKEN_KEY);
  if (token) {
    setAuthToken(token);
    ensureDeviceAuth().catch(() => {});
    let displayName: string | null = null;
    try {
      const me = await getMe();
      displayName = me.display_name ?? null;
      if (displayName) await setItem(DISPLAY_NAME_KEY, displayName);
    } catch {
      const cached = await getItem(DISPLAY_NAME_KEY);
      displayName = cached || null;
    }
    return { isLoggedIn: true, displayName };
  }
  await ensureDeviceAuth();
  return { isLoggedIn: false, displayName: null };
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getItem(TOKEN_KEY);
  return !!token;
}

/**
 * Request a password reset link sent to the given email.
 * Backend always returns 200 with a generic message (no email enumeration).
 * Throws on 503 (feature not configured) or network error.
 */
export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>("/api/v1/auth/forgot-password", {
    email,
  });
  return data;
}

/**
 * Set a new password using the token from the reset email link.
 * Throws on 400 (invalid/expired token) or network error.
 */
export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>("/api/v1/auth/reset-password", {
    token,
    new_password: newPassword,
  });
  return data;
}
