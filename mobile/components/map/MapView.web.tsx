/**
 * Web MapView using react-map-gl + maplibre-gl.
 * Used when running via `npx expo start --web`.
 */

import React, { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import MapGL, {
  Source,
  Layer,
  type ViewStateChangeEvent,
  type MapRef,
} from "react-map-gl/dist/maplibre.js";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapViewProps, MapCenter } from "./types";
import { OSM_MAP_STYLE } from "./types";
import { MapControls } from "./MapControls";
import { emitEvent } from "@/utils/railwayLog";
import { markersToGeoJSON } from "./mapUtils";
import { logClusterInput, logClusterViewport, logClusterRendered, getRenderedClusterSummary } from "./clusterDebug";
import {
  CLUSTER_RADIUS,
  CLUSTER_MAX_ZOOM,
  CLUSTER_COLOR,
  CLUSTER_TEXT_COLOR,
  CLUSTER_MIN_RADIUS_PX,
  CLUSTER_MAX_RADIUS_PX,
  MARKER_COLOR,
} from "@/constants/map";

const REPORTS_SOURCE_ID = "reports";
const LAYER_CLUSTERS = "reports-clusters";
const LAYER_CLUSTER_COUNT = "reports-cluster-count";
const LAYER_UNCLUSTERED = "reports-unclustered";

class MapErrorBoundary extends React.Component<
  { children: React.ReactNode; style?: object },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // #region agent log
    emitEvent(`map_error_boundary_caught_${error.message?.slice(0, 60)}`);
    // #endregion
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={[{ backgroundColor: "#e0e0e0", justifyContent: "center", alignItems: "center" }, this.props.style]}>
          <Text style={{ color: "#666", fontSize: 12 }}>מפה לא זמינה</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function applyFlyTo(mapRef: React.RefObject<MapRef | null>, flyTo: { center: MapCenter; zoom: number } | null | undefined) {
  if (!flyTo || !mapRef.current) return;
  try {
    const map = (mapRef.current.getMap?.() ?? mapRef.current) as { flyTo?: (opts: object) => void };
    map.flyTo?.({
      center: [flyTo.center.lng, flyTo.center.lat],
      zoom: flyTo.zoom,
      duration: 1000,
    });
  } catch {
    // Map not ready
  }
}

export default function MapView({
  center,
  zoom,
  markers = [],
  onMarkerPress,
  onMoveEnd,
  interactive = true,
  flyTo,
  style,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const flyToRef = useRef(flyTo);
  const wheelCleanupRef = useRef<(() => void) | null>(null);
  const [locating, setLocating] = useState(false);

  flyToRef.current = flyTo;

  const geojson = useMemo(() => markersToGeoJSON(markers), [markers]);

  useEffect(() => {
    logClusterInput(markers);
  }, [markers]);

  useEffect(() => {
    applyFlyTo(mapRef, flyTo);
  }, [flyTo]);

  useEffect(() => {
    return () => {
      wheelCleanupRef.current?.();
      wheelCleanupRef.current = null;
    };
  }, []);

  const handleLoad = useCallback((evt: any) => {
    applyFlyTo(mapRef, flyToRef.current);

    const mapInstance = evt.target;
    const container = mapInstance?.getContainer?.() as HTMLElement | undefined;

    if (container) {
      const handler = (e: WheelEvent) => {
        if (interactive) e.preventDefault();
      };

      container.addEventListener("wheel", handler, { passive: false, capture: true });
      wheelCleanupRef.current = () => container.removeEventListener("wheel", handler, { capture: true });
    }
  }, [interactive]);

  const handleMoveEnd = useCallback(
    (evt: ViewStateChangeEvent) => {
      const center = { lat: evt.viewState.latitude, lng: evt.viewState.longitude };
      const zoom = evt.viewState.zoom;
      onMoveEnd?.(center, zoom);
      const map = mapRef.current?.getMap?.();
      if (map) {
        const summary = getRenderedClusterSummary(map as Parameters<typeof getRenderedClusterSummary>[0]);
        if (summary) {
          logClusterViewport(summary.viewport);
          logClusterRendered(summary.rendered);
        }
      }
    },
    [onMoveEnd],
  );

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  const handleLocateMe = useCallback(async () => {
    if (locating) return;
    if (!navigator.geolocation) {
      Alert.alert("מיקום", "הדפדפן לא תומך במיקום.");
      return;
    }
    setLocating(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 10000 },
        );
      });
      const map = mapRef.current?.getMap?.() ?? mapRef.current;
      if (map && typeof (map as { flyTo?: (opts: object) => void }).flyTo === "function") {
        (map as { flyTo: (opts: object) => void }).flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 15,
          duration: 1000,
        });
      }
    } catch (err) {
      const message =
        err instanceof GeolocationPositionError
          ? err.code === 1
            ? "נדחה גישה למיקום."
            : err.code === 2
              ? "מיקום לא זמין."
              : "פג זמן בקבלת המיקום."
          : "שגיאה בקבלת המיקום.";
      Alert.alert("מיקום", message);
    } finally {
      setLocating(false);
    }
  }, [locating]);

  const handleMapClick = useCallback(
    (evt: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) => {
      const map = mapRef.current?.getMap?.();
      if (!map || !onMarkerPress) return;

      const layers = [LAYER_CLUSTERS, LAYER_UNCLUSTERED];
      const point: [number, number] = [evt.point.x, evt.point.y];
      const features = map.queryRenderedFeatures(point, { layers });
      if (features.length === 0) return;

      const top = features[0];
      const props = top.properties as { cluster?: boolean; cluster_id?: number; reportId?: string };

      if (props.cluster) {
        const source = map.getSource(REPORTS_SOURCE_ID) as { getClusterExpansionZoom?: (id: number, cb: (e: Error | null, z?: number) => void) => void } | undefined;
        const clusterId = props.cluster_id;
        if (source?.getClusterExpansionZoom && typeof clusterId === "number" && typeof top.geometry !== "string" && "coordinates" in top.geometry) {
          const center = top.geometry.coordinates as [number, number];
          source.getClusterExpansionZoom(clusterId, (err, expansionZoom) => {
            if (err || expansionZoom == null) return;
            map.easeTo({ center, zoom: expansionZoom, duration: 300 });
          });
        }
        return;
      }

      if (props.reportId) {
        onMarkerPress(props.reportId);
      }
    },
    [onMarkerPress],
  );

  return (
    <MapErrorBoundary style={style}>
      <View style={[styles.container, style]}>
        <MapGL
          ref={mapRef}
          initialViewState={{
            latitude: center.lat,
            longitude: center.lng,
            zoom,
          }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={OSM_MAP_STYLE as import("maplibre-gl").StyleSpecification}
          onLoad={handleLoad}
          onMoveEnd={handleMoveEnd}
          onClick={handleMapClick}
          cursor={interactive ? "pointer" : "grab"}
          scrollZoom={interactive}
          dragPan={interactive}
          dragRotate={false}
          pitchWithRotate={false}
          touchZoomRotate={interactive}
          doubleClickZoom={interactive}
          attributionControl={false}
        >
          <Source
            id={REPORTS_SOURCE_ID}
            type="geojson"
            data={geojson}
            cluster={true}
            clusterMaxZoom={CLUSTER_MAX_ZOOM}
            clusterRadius={CLUSTER_RADIUS}
          >
            <Layer
              id={LAYER_CLUSTERS}
              type="circle"
              filter={["has", "point_count"]}
              paint={{
                "circle-color": CLUSTER_COLOR,
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  CLUSTER_MIN_RADIUS_PX,
                  10,
                  CLUSTER_MIN_RADIUS_PX + (CLUSTER_MAX_RADIUS_PX - CLUSTER_MIN_RADIUS_PX) / 2,
                  100,
                  CLUSTER_MAX_RADIUS_PX,
                ],
                "circle-stroke-width": 2,
                "circle-stroke-color": "#fff",
              }}
            />
            <Layer
              id={LAYER_CLUSTER_COUNT}
              type="symbol"
              filter={["has", "point_count"]}
              layout={{
                "text-field": ["get", "point_count_abbreviated"],
                "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                "text-size": 13,
              }}
              paint={{
                "text-color": CLUSTER_TEXT_COLOR,
              }}
            />
            <Layer
              id={LAYER_UNCLUSTERED}
              type="circle"
              filter={["!", ["has", "point_count"]]}
              paint={{
                "circle-color": ["coalesce", ["get", "color"], MARKER_COLOR],
                "circle-radius": 8,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#fff",
              }}
            />
          </Source>
        </MapGL>
        {interactive && (
          <MapControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onLocateMe={handleLocateMe}
            locating={locating}
          />
        )}
      </View>
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
