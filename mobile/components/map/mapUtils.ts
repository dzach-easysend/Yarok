/**
 * Utilities for map data used by both MapView.web and MapView (native).
 */

import type { MapMarker } from "./types";

export interface ReportPointProperties {
  reportId: string;
  color?: string;
}

/**
 * Build a GeoJSON FeatureCollection from report markers for use with
 * a clustered GeoJSON source (web and native).
 */
export function markersToGeoJSON(markers: MapMarker[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: markers.map((m) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [m.lng, m.lat],
      },
      properties: {
        reportId: m.id,
        color: m.color ?? undefined,
      } as ReportPointProperties,
    })),
  };
}
