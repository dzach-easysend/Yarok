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

function applyFlyTo(mapRef: React.RefObject<MapRef | null>, flyTo: { center: MapCenter; zoom: number } | null) {
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
  // A real HTMLDivElement ref — guaranteed to have addEventListener, unlike a
  // React Native View ref which may not expose the DOM element in all RN Web versions.
  const containerRef = useRef<HTMLDivElement>(null);
  const flyToRef = useRef(flyTo);
  flyToRef.current = flyTo;

  useEffect(() => {
    applyFlyTo(mapRef, flyTo);
  }, [flyTo]);

  // Block the browser's native page scroll when the user wheels over the map.
  // { passive: false } is mandatory — React 17+ attaches synthetic onWheel as
  // passive by default, making preventDefault() a no-op there.
  // MapLibre's own scrollZoom handler fires on the canvas (a child element) before
  // this bubble-phase listener runs, so the map zooms correctly first.
  useEffect(() => {
    const el = containerRef.current;
    if (__DEV__) console.log("[MapView.web] containerRef el:", el?.tagName ?? "NULL");
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (interactive) e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [interactive]);

  const handleLoad = useCallback((evt: { target?: unknown }) => {
    applyFlyTo(mapRef, flyToRef.current);
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
  }, []);

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
    // RN Web renders View as `position: relative` by default, so the inner div's
    // `position: absolute; inset: 0` correctly fills the full container area.
    <View style={[styles.container, style]}>
      <div ref={containerRef} style={styles.innerContainer}>
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
      </div>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Cast to `any` because StyleSheet doesn't have a type for the CSS `inset`
  // shorthand, but React Native Web forwards it to the DOM unchanged.
  innerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  } as any,
});
