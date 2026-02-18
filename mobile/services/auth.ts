/**
 * Auth service: login, register, token management.
 * Uses expo-secure-store on native, falls back to localStorage on web.
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api, setAuthToken } from "./api";

const TOKEN_KEY = "yarok_token";
const REFRESH_KEY = "yarok_refresh";

interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
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

export async function login(email: string, password: string): Promise<TokenPair> {
  const { data } = await api.post<TokenPair>("/api/v1/auth/login", { email, password });
  await setItem(TOKEN_KEY, data.access_token);
  await setItem(REFRESH_KEY, data.refresh_token);
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
  setAuthToken(data.access_token);
  return data;
}

export async function logout(): Promise<void> {
  await removeItem(TOKEN_KEY);
  await removeItem(REFRESH_KEY);
  setAuthToken(null);
}

export async function restoreAuth(): Promise<boolean> {
  const token = await getItem(TOKEN_KEY);
  if (token) {
    setAuthToken(token);
    return true;
  }
  return false;
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getItem(TOKEN_KEY);
  return !!token;
}
