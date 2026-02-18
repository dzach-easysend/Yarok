/**
 * Address geocoding: uses backend proxy when EXPO_PUBLIC_API_URL is set (avoids CORS on web),
 * otherwise falls back to OpenStreetMap Nominatim.
 */

const NOMINATIM_UA = "YarokApp/1.0 (address search; https://github.com/yarok)";

/** Allow tests to override API base without relying on env (Expo may inline env at build time). */
let apiBaseOverride: string | undefined;

export function setApiBaseOverride(url: string | undefined): void {
  apiBaseOverride = url;
}

function getApiBase(): string {
  if (apiBaseOverride !== undefined) return apiBaseOverride.trim();
  return (process.env.EXPO_PUBLIC_API_URL ?? "").trim();
}

export interface GeoResult {
  lat: number;
  lng: number;
}

export class GeocodingError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GeocodingError";
  }
}

async function geocodeViaBackend(apiBase: string, query: string): Promise<GeoResult | null> {
  const url = `${apiBase.replace(/\/$/, "")}/api/v1/geocode?${new URLSearchParams({ q: query })}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (res.status === 429) {
    throw new GeocodingError("Rate limited; try again in a moment", undefined, 429);
  }
  if (!res.ok) {
    throw new GeocodingError(`Geocoding failed: ${res.status}`, undefined, res.status);
  }
  const data = (await res.json()) as { lat: number; lng: number };
  return { lat: Number(data.lat), lng: Number(data.lng) };
}

async function geocodeViaNominatim(query: string): Promise<GeoResult | null> {
  const params = new URLSearchParams({ q: query, format: "json", limit: "1" });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { "User-Agent": NOMINATIM_UA } },
  );
  if (res.status === 429) {
    throw new GeocodingError("Rate limited; try again in a moment", undefined, 429);
  }
  if (!res.ok) {
    throw new GeocodingError(`Geocoding failed: ${res.status}`, undefined, res.status);
  }
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export async function geocodeSearch(query: string): Promise<GeoResult | null> {
  const q = query.trim();
  if (!q) return null;

  const apiBase = getApiBase();
  const useBackend = apiBase.length > 0;
  try {
    return useBackend ? await geocodeViaBackend(apiBase, q) : await geocodeViaNominatim(q);
  } catch (err) {
    if (err instanceof GeocodingError) throw err;
    throw new GeocodingError("Network request failed", err, undefined);
  }
}
