/**
 * Native MapView using @maplibre/maplibre-react-native.
 * Used on iOS and Android.
 */

import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { View, StyleSheet, Alert } from "react-native";
import MapLibreGL from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import type { MapViewProps } from "./types";
import { OSM_MAP_STYLE } from "./types";
import { MapControls } from "./MapControls";
import { markersToGeoJSON } from "./mapUtils";
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

MapLibreGL.setAccessToken(null);

function isClusterFeature(f: GeoJSON.Feature): f is GeoJSON.Feature & { properties: { cluster_id?: number; point_count?: number } } {
  const p = f.properties as Record<string, unknown> | null;
  return !!p && ("cluster_id" in p || "point_count" in p);
}

function getPointCoordinates(f: GeoJSON.Feature): [number, number] | null {
  if (f.geometry?.type !== "Point" || !("coordinates" in f.geometry)) return null;
  const c = f.geometry.coordinates;
  return Array.isArray(c) && c.length >= 2 ? [c[0], c[1]] : null;
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
  const mapRef = useRef<MapLibreGL.MapViewRef>(null);
  const cameraRef = useRef<MapLibreGL.CameraRef>(null);
  const shapeSourceRef = useRef<MapLibreGL.ShapeSourceRef>(null);
  const [locating, setLocating] = useState(false);

  const geojson = useMemo(() => markersToGeoJSON(markers), [markers]);

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
      const [mapCenter, zoomLevel] = await Promise.all([
        mapRef.current.getCenter(),
        mapRef.current.getZoom(),
      ]);
      if (mapCenter) {
        onMoveEnd({ lat: mapCenter[1], lng: mapCenter[0] }, zoomLevel);
      }
    } catch {
      // Camera may not be ready yet
    }
  }, [onMoveEnd]);

  const handleZoomIn = useCallback(async () => {
    if (!mapRef.current) return;
    try {
      const currentZoom = await mapRef.current.getZoom();
      cameraRef.current?.setCamera({
        zoomLevel: currentZoom + 1,
        animationDuration: 300,
      });
    } catch {
      // Camera may not be ready
    }
  }, []);

  const handleZoomOut = useCallback(async () => {
    if (!mapRef.current) return;
    try {
      const currentZoom = await mapRef.current.getZoom();
      cameraRef.current?.setCamera({
        zoomLevel: currentZoom - 1,
        animationDuration: 300,
      });
    } catch {
      // Camera may not be ready
    }
  }, []);

  const handleLocateMe = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      const granted = status === "granted";
      const nextStatus = granted ? status : (await Location.requestForegroundPermissionsAsync()).status;
      if (nextStatus !== "granted") {
        Alert.alert("מיקום", "נדרשת הרשאת מיקום כדי להציג את המיקום הנוכחי.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      cameraRef.current?.setCamera({
        centerCoordinate: [location.coords.longitude, location.coords.latitude],
        zoomLevel: 15,
        animationDuration: 1000,
      });
    } catch (err) {
      Alert.alert("מיקום", "שגיאה בקבלת המיקום. נסה שוב.");
      if (__DEV__ && err instanceof Error) {
        console.warn("Location error:", err.message);
      }
    } finally {
      setLocating(false);
    }
  }, [locating]);

  const handleShapePress = useCallback(
    async (event: { features: GeoJSON.Feature[]; coordinates: { longitude: number; latitude: number }; point: { x: number; y: number } }) => {
      const features = event.features;
      if (!features.length) return;

      const feature = features[0];
      if (isClusterFeature(feature)) {
        try {
          const zoomLevel = await shapeSourceRef.current?.getClusterExpansionZoom(feature);
          const coords = getPointCoordinates(feature);
          if (zoomLevel != null && coords) {
            cameraRef.current?.setCamera({
              centerCoordinate: coords,
              zoomLevel,
              animationDuration: 300,
            });
          }
        } catch {
          // Fallback: zoom in by 2
          const coords = getPointCoordinates(feature);
          if (coords) {
            const currentZoom = await mapRef.current?.getZoom().catch(() => 12);
            cameraRef.current?.setCamera({
              centerCoordinate: coords,
              zoomLevel: typeof currentZoom === "number" ? currentZoom + 2 : 14,
              animationDuration: 300,
            });
          }
        }
        return;
      }

      const props = feature.properties as { reportId?: string } | null;
      if (props?.reportId && onMarkerPress) {
        onMarkerPress(props.reportId);
      }
    },
    [onMarkerPress],
  );

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
        showsUserLocation={interactive}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [center.lng, center.lat],
            zoomLevel: zoom,
          }}
        />
        <MapLibreGL.ShapeSource
          ref={shapeSourceRef}
          id={REPORTS_SOURCE_ID}
          shape={geojson}
          cluster={true}
          clusterRadius={CLUSTER_RADIUS}
          clusterMaxZoomLevel={CLUSTER_MAX_ZOOM}
          onPress={handleShapePress}
        >
          <MapLibreGL.CircleLayer
            id={LAYER_CLUSTERS}
            style={{
              circleRadius: [
                "step",
                ["get", "point_count"],
                CLUSTER_MIN_RADIUS_PX,
                10,
                CLUSTER_MIN_RADIUS_PX + (CLUSTER_MAX_RADIUS_PX - CLUSTER_MIN_RADIUS_PX) / 2,
                100,
                CLUSTER_MAX_RADIUS_PX,
              ],
              circleColor: CLUSTER_COLOR,
              circleStrokeWidth: 2,
              circleStrokeColor: "#ffffff",
            }}
          />
          <MapLibreGL.SymbolLayer
            id={LAYER_CLUSTER_COUNT}
            style={{
              textField: ["get", "point_count_abbreviated"],
              textSize: 13,
              textColor: CLUSTER_TEXT_COLOR,
              textFont: ["Open Sans Bold", "Arial Unicode MS Bold"],
            }}
          />
          <MapLibreGL.CircleLayer
            id={LAYER_UNCLUSTERED}
            filter={["!", ["has", "point_count"]]}
            style={{
              circleRadius: 8,
              circleColor: ["coalesce", ["get", "color"], MARKER_COLOR],
              circleStrokeWidth: 2,
              circleStrokeColor: "#ffffff",
            }}
          />
        </MapLibreGL.ShapeSource>
      </MapLibreGL.MapView>
      {interactive && (
        <MapControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onLocateMe={handleLocateMe}
          locating={locating}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
