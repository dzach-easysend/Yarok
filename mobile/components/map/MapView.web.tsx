/**
 * Web MapView using react-map-gl + maplibre-gl.
 * Used when running via `npx expo start --web`.
 */

import { useRef, useCallback, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import MapGL, { Marker, type ViewStateChangeEvent, type MapRef } from "react-map-gl/dist/maplibre.js";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapViewProps, MapCenter } from "./types";
import { OSM_MAP_STYLE } from "./types";

function applyFlyTo(mapRef: React.RefObject<MapRef | null>, flyTo: { center: MapCenter; zoom: number } | null | undefined) {
  if (!flyTo || !mapRef.current) return;
  try {
    // getMap() returns the underlying maplibre-gl Map instance.
    // Fall back to the ref itself for environments where getMap is unavailable.
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

  const handleLoad = useCallback((evt: { target?: unknown }) => {
    applyFlyTo(mapRef, flyToRef.current);

    // Prevent page scroll when wheeling over the map so MapLibre's scrollZoom works.
    const mapInstance = mapRef.current?.getMap?.();
    const container = mapInstance?.getContainer?.() as HTMLElement | undefined;
    if (container) {
      const handler = (e: WheelEvent) => {
        if (interactive) e.preventDefault();
      };
      container.addEventListener("wheel", handler, { passive: false });
      wheelCleanupRef.current = () => container.removeEventListener("wheel", handler);
    }

    if (__DEV__) {
      const map = (evt?.target as { getZoom?: () => number; on?: (e: string, cb: () => void) => void }) ?? null;
      if (map?.getZoom) {
        map.on?.("zoomend", () => console.log("[MapView.web] zoom:", map.getZoom?.()));
        (window as any).__yarokMap = map;
        console.log("[MapView.web] map exposed, initial zoom:", map.getZoom?.());
      } else {
        console.log("[MapView.web] onLoad evt.target has no getZoom:", typeof map);
      }
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

  return (
    // Outer View keeps React Native style compatibility (flex, external style prop).
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
