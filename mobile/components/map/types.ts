/**
 * Shared types for the cross-platform MapView component.
 * Both MapView.tsx (native) and MapView.web.tsx import from here.
 */

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  color?: string;
}

export interface MapCenter {
  lat: number;
  lng: number;
}

export interface MapViewProps {
  /** Initial map center coordinates */
  center: MapCenter;
  /** Zoom level (0-20, Leaflet/MapLibre style) */
  zoom: number;
  /** Markers to display on the map */
  markers?: MapMarker[];
  /** Called when a marker is tapped/clicked */
  onMarkerPress?: (id: string) => void;
  /** Called when the map stops moving; provides new center */
  onMoveEnd?: (center: MapCenter) => void;
  /** Whether the map is interactive (pan/zoom). Default true. */
  interactive?: boolean;
  /** When changed, the map flies to this center + zoom */
  flyTo?: { center: MapCenter; zoom: number } | null;
  /** Optional style overrides */
  style?: object;
}

/**
 * OpenStreetMap raster tiles via MapLibre style.
 * Free, no API key. See https://operations.osmfoundation.org/policies/tiles/
 */
export const OSM_MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};
