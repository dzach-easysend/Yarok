# Critique: Map Clustering & Location Bug Plan

**Plan Reviewed:** `yarok-03-map-clustering-location-bug.md`
**Reviewer Role:** Senior Full Stack Engineer

## 1. Requirements Alignment
- **Location Bug**: ✅ Correctly identifies the likely root cause (cached permission/state) and proposes a solid fix.
- **Clustering**: ✅ Correctly proposes `cluster: true` on GeoJSON source.
- **Visuals**: ✅ Mentions "Israel Hiking Map" style (circles splitting into points).

## 2. Technical Concerns & Risks

### 📱 Native Performance (iOS/Android)
The plan proposes using `@maplibre/maplibre-react-native` with `ShapeSource` + `CircleLayer`.
**Critique:**
- This is the correct, performant approach for native maps.
- **Risk:** Layer ordering (z-index). The clusters must sit *above* the map tiles but *below* any UI overlays (like the "Locate Me" button).
- In MapLibre Native, layer order is determined by render order. Ensure the `CircleLayer` is added *after* the base map style loads.

### 🕸️ Web Compatibility
The plan proposes `react-map-gl` + `maplibre-gl` for web clustering.
**Critique:**
- Solid approach. Native clustering support in maplibre-gl-js is efficient.
- **Watch out:** Ensure the `clusterRadius` and `clusterMaxZoom` parameters are tuned identically on both Web and Native to provide a consistent experience.
- The `onClick` handler logic for expanding clusters must be robust—calculating the bounds of the cluster to zoom to requires calling `getClusterExpansionZoom`, which is async in some implementations.

## 3. Revised Recommendations
1.  **Standardize Cluster Config:** Define cluster constants (`RADIUS`, `MAX_ZOOM`, `COLORS`) in a shared `constants/map.ts` file to ensure visual consistency across platforms.
2.  **Handle Z-Index Explicitly:** Verify layer ordering on native.
3.  **Implement Cluster Click-to-Zoom:** Ensure clicking a cluster smoothly zooms to fit its children (`camera.fitBounds` on native, `map.easeTo` on web).
