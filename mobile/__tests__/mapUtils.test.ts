import { markersToGeoJSON } from "../components/map/mapUtils";
import type { MapMarker } from "../components/map/types";

describe("markersToGeoJSON", () => {
  it("returns an empty FeatureCollection for empty markers", () => {
    const result = markersToGeoJSON([]);
    expect(result).toEqual({
      type: "FeatureCollection",
      features: [],
    });
  });

  it("builds a FeatureCollection with one point per marker", () => {
    const markers: MapMarker[] = [
      { id: "r1", lat: 32.0, lng: 34.8 },
      { id: "r2", lat: 32.1, lng: 34.9, color: "#16a34a" },
    ];
    const result = markersToGeoJSON(markers);
    expect(result.type).toBe("FeatureCollection");
    expect(result.features).toHaveLength(2);

    expect(result.features[0]).toMatchObject({
      type: "Feature",
      geometry: { type: "Point", coordinates: [34.8, 32.0] },
      properties: { reportId: "r1" },
    });
    expect(result.features[0].properties?.color).toBeUndefined();

    expect(result.features[1]).toMatchObject({
      type: "Feature",
      geometry: { type: "Point", coordinates: [34.9, 32.1] },
      properties: { reportId: "r2", color: "#16a34a" },
    });
  });

  it("uses [lng, lat] order in coordinates (GeoJSON spec)", () => {
    const markers: MapMarker[] = [{ id: "x", lat: 31.7683, lng: 35.2137 }];
    const result = markersToGeoJSON(markers);
    expect(result.features[0].geometry).toEqual({
      type: "Point",
      coordinates: [35.2137, 31.7683],
    });
  });
});
