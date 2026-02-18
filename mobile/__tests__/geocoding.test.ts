import { geocodeSearch, GeocodingError, setApiBaseOverride } from "../services/geocoding";

// Mock global fetch
global.fetch = jest.fn();

describe("geocodeSearch", () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    process.env.EXPO_PUBLIC_API_URL = ""; // use Nominatim path so fetch mocks apply
  });

  it("returns null for empty query", async () => {
    const result = await geocodeSearch("");
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns null for whitespace-only query", async () => {
    const result = await geocodeSearch("   ");
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns coordinates for a successful search", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: "31.7683", lon: "35.2137" }],
    });

    const result = await geocodeSearch("Jerusalem");
    expect(result).toEqual({ lat: 31.7683, lng: 35.2137 });
  });

  it("returns null when no results found", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const result = await geocodeSearch("NonexistentPlace12345");
    expect(result).toBeNull();
  });

  it("throws GeocodingError on HTTP error", async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(geocodeSearch("fail")).rejects.toThrow(GeocodingError);
    await expect(geocodeSearch("fail")).rejects.toThrow("Geocoding failed: 500");
  });

  it("throws GeocodingError with status 429 on rate limit", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429 });
    const err = await geocodeSearch("rate").catch((e) => e);
    expect(err).toBeInstanceOf(GeocodingError);
    expect((err as GeocodingError).status).toBe(429);
  });
});

describe("geocodeSearch contract for map search", () => {
  it("returns { lat, lng } so map can center and show a pin", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: "32.0853", lon: "34.7818" }],
    });
    const result = await geocodeSearch("Tel Aviv");
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("lat", 32.0853);
    expect(result).toHaveProperty("lng", 34.7818);
    // Map screen uses result to set flyTo({ center: result, zoom: 15 }) and
    // searchPin with lat/lng from result; both require numeric lat/lng.
    expect(typeof (result as { lat: number; lng: number }).lat).toBe("number");
    expect(typeof (result as { lat: number; lng: number }).lng).toBe("number");
  });
});

describe("geocodeSearch via backend", () => {
  const backendBase = "http://localhost:8000";

  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    setApiBaseOverride(backendBase);
  });

  afterEach(() => {
    setApiBaseOverride(undefined);
  });

  it("uses backend and returns lat/lng on 200", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ lat: 32.0853, lng: 34.7818 }),
    });
    const result = await geocodeSearch("Tel Aviv");
    expect(result).toEqual({ lat: 32.0853, lng: 34.7818 });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/geocode?"));
  });

  it("returns null on 404", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await geocodeSearch("Nowhere");
    expect(result).toBeNull();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/geocode?"));
  });

  it("throws GeocodingError with status 429 on rate limit", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429 });
    const err = await geocodeSearch("Paris").catch((e) => e);
    expect(err).toBeInstanceOf(GeocodingError);
    expect((err as GeocodingError).status).toBe(429);
  });
});
