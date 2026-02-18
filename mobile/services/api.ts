/**
 * API client for Yarok backend.
 * Set EXPO_PUBLIC_API_URL in .env (e.g. http://localhost:8000)
 */

import axios, { type AxiosInstance } from "axios";

const baseURL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export const api: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

export interface MediaItem {
  id: string;
  media_type: string;
  url: string;
}

export interface ReportListItem {
  id: string;
  lat: number;
  lng: number;
  address: string | null;
  description: string | null;
  status: string;
  created_at: string;
  media_count: number;
  media: MediaItem[];
}

export interface ReportCreatePayload {
  lat: number;
  lng: number;
  description?: string | null;
  contact_info?: string | null;
}

interface ReportQueryParams {
  lat: number;
  lng: number;
  radius_km?: number;
  page?: number;
  limit?: number;
}

export async function getReports(params: ReportQueryParams): Promise<ReportListItem[]> {
  const { data } = await api.get<ReportListItem[]>("/api/v1/reports", { params });
  return data;
}

export async function getReport(id: string): Promise<ReportListItem> {
  const { data } = await api.get<ReportListItem>(`/api/v1/reports/${id}`);
  return data;
}

export async function createReport(payload: ReportCreatePayload): Promise<ReportListItem> {
  const { data } = await api.post<ReportListItem>("/api/v1/reports", payload);
  return data;
}

export async function updateReport(
  id: string,
  payload: { status: string },
): Promise<ReportListItem> {
  const { data } = await api.patch<ReportListItem>(`/api/v1/reports/${id}`, payload);
  return data;
}

export async function deleteReport(id: string): Promise<void> {
  await api.delete(`/api/v1/reports/${id}`);
}

export async function health(): Promise<{ status: string }> {
  const { data } = await api.get<{ status: string }>("/health");
  return data;
}

export async function uploadMedia(reportId: string, uri: string, file?: File): Promise<MediaItem> {
  const formData = new FormData();

  if (file) {
    formData.append("file", file, file.name);
  } else {
    const filename = uri.split("/").pop() || "photo.jpg";
    const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      mp4: "video/mp4",
      mov: "video/quicktime",
      webm: "video/webm",
    };
    const mimeType = mimeMap[ext] || "image/jpeg";
    formData.append("file", {
      uri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);
  }

  const { data } = await api.post<MediaItem>(
    `/api/v1/reports/${reportId}/media`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export function setAuthToken(token: string | null): void {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
