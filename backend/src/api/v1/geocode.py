"""Geocoding proxy to OpenStreetMap Nominatim (avoids CORS on web, centralizes rate limiting)."""

import httpx
from fastapi import APIRouter, HTTPException, Query, status

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_UA = "YarokBackend/1.0 (geocode proxy; https://github.com/yarok)"

router = APIRouter(prefix="/geocode", tags=["geocode"])


@router.get("")
async def geocode(q: str = Query(..., min_length=1, max_length=500)):
    """Proxy geocode query to Nominatim. Returns first result as { lat, lng } or 404."""
    query = q.strip()
    if not query:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty query")

    params = {"q": query, "format": "json", "limit": "1"}
    headers = {"User-Agent": NOMINATIM_UA}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(NOMINATIM_URL, params=params, headers=headers)
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Geocoding service unavailable",
        ) from e

    if resp.status_code == 429:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limited; try again in a moment",
        )
    if not resp.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Geocoding service error",
        )

    data = resp.json()
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No results")

    first = data[0]
    try:
        lat = float(first["lat"])
        lon = float(first["lon"])
    except (KeyError, TypeError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid geocoding response",
        ) from e

    return {"lat": lat, "lng": lon}
