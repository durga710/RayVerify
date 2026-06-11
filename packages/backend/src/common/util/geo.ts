export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_008.8; // mean Earth radius (meters)

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two points (Haversine), in meters.
 * Used by GPS geofencing and the impossible-travel detector.
 */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Implied travel speed (km/h) to cover a distance in a time delta. */
export function speedKmh(distanceMeters: number, deltaMs: number): number {
  if (deltaMs <= 0) return Infinity;
  const hours = deltaMs / 3_600_000;
  return distanceMeters / 1000 / hours;
}
