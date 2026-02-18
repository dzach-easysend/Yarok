/**
 * Native MapView using @maplibre/maplibre-react-native.
 * Used on iOS and Android.
 */

import { useRef, useCallback, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import MapLibreGL from "@maplibre/maplibre-react-native";
import type { MapViewProps } from "./types";
import { OSM_MAP_STYLE } from "./types";

MapLibreGL.setAccessToken(null);

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
  const mapRef = useRef<MapLibreGL.MapViewRef>(null);
  const cameraRef = useRef<MapLibreGL.CameraRef>(null);

  useEffect(() => {
    if (flyTo && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [flyTo.center.lng, flyTo.center.lat],
        zoomLevel: flyTo.zoom,
        animationDuration: 1000,
      });
    }
  }, [flyTo]);

  const handleRegionDidChange = useCallback(async () => {
    if (!onMoveEnd || !mapRef.current) return;
    try {
      const mapCenter = await mapRef.current.getCenter();
      if (mapCenter) {
        onMoveEnd({ lat: mapCenter[1], lng: mapCenter[0] });
      }
    } catch {
      // Camera may not be ready yet
    }
  }, [onMoveEnd]);

  return (
    <View style={[styles.container, style]}>
      <MapLibreGL.MapView
        ref={mapRef}
        style={styles.map}
        mapStyle={OSM_MAP_STYLE}
        scrollEnabled={interactive}
        pitchEnabled={false}
        rotateEnabled={false}
        zoomEnabled={interactive}
        onRegionDidChange={handleRegionDidChange}
        attributionEnabled={false}
        logoEnabled={false}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [center.lng, center.lat],
            zoomLevel: zoom,
          }}
        />
        {markers.map((m) => (
          <MapLibreGL.PointAnnotation
            key={m.id}
            id={m.id}
            coordinate={[m.lng, m.lat]}
            onSelected={() => onMarkerPress?.(m.id)}
          >
            <View
              style={[
                styles.marker,
                m.color ? { backgroundColor: m.color } : undefined,
              ]}
            />
          </MapLibreGL.PointAnnotation>
        ))}
      </MapLibreGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#1a73e8",
    borderWidth: 2,
    borderColor: "#fff",
  },
});
