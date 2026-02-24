/**
 * Instrumentation for debugging map clustering.
 * Logs input markers, viewport, and what MapLibre actually renders.
 * Use EXPO_PUBLIC_DEBUG_LOGS=1 and backend DEBUG_CLIENT_LOGS=true for railwayLog.
 * In __DEV__, summaries are also written to console.
 */

import { railwayLog, emitEvent } from "@/utils/railwayLog";
import type { MapMarker } from "./types";
import { CLUSTER_MAX_ZOOM, CLUSTER_RADIUS } from "@/constants/map";

const LAYER_CLUSTERS = "reports-clusters";
const LAYER_UNCLUSTERED = "reports-unclustered";

export interface ClusterDebugMarkers {
  count: number;
  positions: { id: string; lat: number; lng: number }[];
}

export interface ClusterDebugViewport {
  center: { lat: number; lng: number };
  zoom: number;
  bounds?: { sw: [number, number]; ne: [number, number] };
  /** Approx. km width at center (for scale). */
  widthKm?: number;
  /** Cluster config in use (for debugging wrong-calculation). */
  clusterMaxZoom?: number;
  clusterRadiusPx?: number;
}

export interface ClusterDebugRendered {
  clusters: { point_count: number; center: [number, number] }[];
  points: { reportId: string; coordinates: [number, number] }[];
}

/**
 * Log what markers are being passed to the cluster source.
 * Call when the markers/geojson input changes.
 */
export function logClusterInput(markers: MapMarker[]): void {
  const positions = markers.map((m) => ({ id: m.id, lat: m.lat, lng: m.lng }));
  const payload: ClusterDebugMarkers = { count: markers.length, positions };
  railwayLog("cluster_debug_input", payload);
  emitEvent("cluster_debug_input");
  if (__DEV__) {
    console.log("[cluster debug] input:", payload.count, "markers", positions);
  }
}

/**
 * Log viewport (center, zoom, bounds) after move end.
 */
export function logClusterViewport(viewport: ClusterDebugViewport): void {
  railwayLog("cluster_debug_viewport", viewport as Record<string, unknown>);
  emitEvent("cluster_debug_viewport");
  if (__DEV__) {
    console.log("[cluster debug] viewport:", viewport.zoom, viewport.center, viewport.bounds, viewport.widthKm != null ? `~${viewport.widthKm.toFixed(1)}km wide` : "");
  }
}

/**
 * Log what MapLibre is actually rendering (clusters + unclustered points).
 * Call after move end with the map instance.
 */
export function logClusterRendered(rendered: ClusterDebugRendered): void {
  railwayLog("cluster_debug_rendered", rendered as Record<string, unknown>);
  emitEvent("cluster_debug_rendered");
  if (__DEV__) {
    console.log("[cluster debug] rendered:", rendered.clusters.length, "clusters", rendered.clusters, rendered.points.length, "points", rendered.points);
  }
}

function latLng(obj: { lat?: number | (() => number); lng?: number | (() => number) }): { lat: number; lng: number } {
  const lat = typeof obj.lat === "function" ? obj.lat() : obj.lat;
  const lng = typeof obj.lng === "function" ? obj.lng() : obj.lng;
  return { lat: Number(lat), lng: Number(lng) };
}

/** Map-like object from MapLibre (getMap() or evt.target). */
type MapLike = {
  getBounds?: () => { getSouthWest: () => unknown; getNorthEast: () => unknown };
  getCenter?: () => unknown;
  getZoom?: () => number;
  queryRenderedFeatures?: (geometry?: unknown, options?: { layers?: string[] }) => {
    geometry?: { type: string; coordinates?: number[] };
    properties?: Record<string, unknown>;
  }[];
  getContainer?: () => { offsetWidth: number; offsetHeight: number };
};

/**
 * From a MapLibre map, collect all rendered report clusters and points in the viewport.
 * Call after the map has moved (e.g. in move end). Returns summary for logging.
 */
export function getRenderedClusterSummary(map: MapLike): { viewport: ClusterDebugViewport; rendered: ClusterDebugRendered } | null {
  try {
    const bounds = map.getBounds?.();
    const centerRaw = map.getCenter?.();
    const zoom = typeof map.getZoom === "function" ? map.getZoom() : undefined;
    if (!bounds || !centerRaw || typeof zoom !== "number") return null;

    const sw = latLng(bounds.getSouthWest() as { lat: number; lng: number });
    const ne = latLng(bounds.getNorthEast() as { lat: number; lng: number });
    const center = latLng(centerRaw as { lat: number; lng: number });
    const viewport: ClusterDebugViewport = {
      center: { lat: center.lat, lng: center.lng },
      zoom,
      bounds: {
        sw: [sw.lng, sw.lat],
        ne: [ne.lng, ne.lat],
      },
      widthKm: approximateWidthKm(sw.lat, sw.lng, ne.lng),
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      clusterRadiusPx: CLUSTER_RADIUS,
    };

    const container = map.getContainer?.();
    const w = container?.offsetWidth ?? 0;
    const h = container?.offsetHeight ?? 0;
    const layers = [LAYER_CLUSTERS, LAYER_UNCLUSTERED];
    const features =
      typeof map.queryRenderedFeatures === "function"
        ? map.queryRenderedFeatures(
            [
              [0, 0],
              [w, h],
            ],
            { layers },
          )
        : [];

    const clusters: ClusterDebugRendered["clusters"] = [];
    const points: ClusterDebugRendered["points"] = [];
    for (const f of features) {
      const props = f.properties ?? {};
      const coords = f.geometry?.type === "Point" && Array.isArray(f.geometry.coordinates)
        ? (f.geometry.coordinates as [number, number])
        : null;
      if (props.cluster && typeof props.point_count === "number" && coords) {
        clusters.push({ point_count: props.point_count, center: coords });
      } else if (typeof props.reportId === "string" && coords) {
        points.push({ reportId: props.reportId, coordinates: coords });
      }
    }

    return { viewport, rendered: { clusters, points } };
  } catch (e) {
    if (__DEV__) console.warn("[cluster debug] getRenderedClusterSummary error", e);
    return null;
  }
}

/** Rough width in km of the viewport at the given latitude (for log scale). */
function approximateWidthKm(lat: number, lngWest: number, lngEast: number): number {
  const degToKm = 111.32 * Math.cos((lat * Math.PI) / 180);
  return Math.abs(lngEast - lngWest) * degToKm;
}
