/**
 * Web MapView using react-map-gl + maplibre-gl.
 * Used when running via `npx expo start --web`.
 */

import React, { useRef, useCallback, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import MapGL, { Marker, type ViewStateChangeEvent, type MapRef } from "react-map-gl/dist/maplibre.js";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapViewProps, MapCenter } from "./types";
import { OSM_MAP_STYLE } from "./types";
import { MapControls } from "./MapControls";
import { emitEvent } from "@/utils/railwayLog";

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

  flyToRef.current = flyTo;

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
      if (!onMoveEnd) return;
      onMoveEnd({
        lat: evt.viewState.latitude,
        lng: evt.viewState.longitude,
      });
    },
    [onMoveEnd],
  );

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  const handleLocateMe = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          mapRef.current?.flyTo({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: 15,
          });
        },
        (error) => {
          console.warn("Error getting location:", error);
        }
      );
    } else {
      console.warn("Geolocation not supported");
    }
  }, []);

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
          mapStyle={OSM_MAP_STYLE}
          onLoad={handleLoad}
          onMoveEnd={handleMoveEnd}
          scrollZoom={interactive}
          dragPan={interactive}
          dragRotate={false}
          pitchWithRotate={false}
          touchZoomRotate={interactive}
          doubleClickZoom={interactive}
          attributionControl={false}
        >
          {markers.map((m) => (
            <Marker
              key={m.id}
              latitude={m.lat}
              longitude={m.lng}
              onClick={() => onMarkerPress?.(m.id)}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: m.color || "#1a73e8",
                  border: "2px solid #fff",
                  cursor: "pointer",
                }}
              />
            </Marker>
          ))}
        </MapGL>
        {interactive && (
          <MapControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onLocateMe={handleLocateMe}
          />
        )}
      </View>
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
