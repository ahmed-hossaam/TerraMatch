import type { CoordinateReference, LongitudeDirection, LongitudeDomain, MapProjection } from "../destinations/types.js";

export interface GeographicCoordinate { longitude: number; latitude: number; }
export interface ProjectedCoordinate { x: number; y: number; units: "meters"; }
export type CoordinateTransformErrorCode = "INVALID_COORDINATE" | "UNKNOWN_COORDINATE_REFERENCE" | "UNSUPPORTED_PROJECTION" | "MERCATOR_POLE";
export class CoordinateTransformError extends Error {
  constructor(readonly code: CoordinateTransformErrorCode, message: string) { super(message); this.name = "CoordinateTransformError"; }
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const DEFAULT_MOON_RADIUS_M = 1_737_400;
const MAX_MERCATOR_LAT = 89.999999;
export type PolarHemisphere = "north" | "south";
export interface LunarPolarProjectedCoordinate { x: number; y: number; radiusM: number; units: "meters"; }
export interface LunarPolarGeographicCoordinate { longitude: number; latitude: number; }

/** Spherical polar stereographic display projection with true scale at the pole. */
export function projectLunarPolarCoordinate(coord: GeographicCoordinate, hemisphere: PolarHemisphere, radiusM = DEFAULT_MOON_RADIUS_M): LunarPolarProjectedCoordinate {
  validateCoordinate(coord);
  if ((hemisphere === "north" && coord.latitude < 0) || (hemisphere === "south" && coord.latitude > 0)) throw new CoordinateTransformError("INVALID_COORDINATE", `Coordinate is outside the ${hemisphere} polar hemisphere.`);
  if (!Number.isFinite(radiusM) || radiusM <= 0) throw new CoordinateTransformError("UNKNOWN_COORDINATE_REFERENCE", "A positive spherical reference radius is required.");
  const lon = wrapLongitude(coord.longitude, "-180_180") * RAD;
  const lat = Math.abs(coord.latitude) * RAD;
  const rho = 2 * radiusM * Math.tan((Math.PI / 2 - lat) / 2);
  return { x: rho * Math.sin(lon), y: hemisphere === "north" ? -rho * Math.cos(lon) : rho * Math.cos(lon), radiusM: rho, units: "meters" };
}

/** Inverse spherical polar stereographic transform; longitude at the pole is defined as 0°E. */
export function unprojectLunarPolarCoordinate(coord: { x: number; y: number }, hemisphere: PolarHemisphere, radiusM = DEFAULT_MOON_RADIUS_M): LunarPolarGeographicCoordinate {
  if (![coord.x, coord.y, radiusM].every(Number.isFinite) || radiusM <= 0) throw new CoordinateTransformError("INVALID_COORDINATE", "Polar coordinates and radius must be finite; radius must be positive.");
  const rho = Math.hypot(coord.x, coord.y);
  const angularDistance = 2 * Math.atan(rho / (2 * radiusM));
  const latitude = (90 - angularDistance * DEG) * (hemisphere === "north" ? 1 : -1);
  const longitude = rho < 1e-8 ? 0 : (hemisphere === "north" ? Math.atan2(coord.x, -coord.y) : Math.atan2(coord.x, coord.y)) * DEG;
  return { longitude: wrapLongitude(longitude, "-180_180"), latitude };
}

function validReference(reference: CoordinateReference): void {
  if (reference.targetBody !== "moon" || reference.coordinateUnits !== "degrees" || reference.latitudeType === "unknown" || reference.longitudeDirection === "unknown" || reference.longitudeDomain === "unknown") {
    throw new CoordinateTransformError("UNKNOWN_COORDINATE_REFERENCE", "Coordinate reference is incomplete for a Moon transform.");
  }
}
function validateCoordinate(coord: GeographicCoordinate): void {
  if (!Number.isFinite(coord.longitude) || !Number.isFinite(coord.latitude) || coord.latitude < -90 || coord.latitude > 90) {
    throw new CoordinateTransformError("INVALID_COORDINATE", "Longitude and latitude must be finite and latitude must be within [-90, 90].");
  }
}
export function wrapLongitude(longitude: number, domain: Exclude<LongitudeDomain, "unknown">): number {
  if (!Number.isFinite(longitude)) throw new CoordinateTransformError("INVALID_COORDINATE", "Longitude must be finite.");
  if (domain === "0_360") return ((longitude % 360) + 360) % 360;
  const wrapped = ((longitude + 180) % 360 + 360) % 360 - 180;
  // Preserve the positive boundary when it was supplied as +180.
  return wrapped === -180 && longitude > 0 ? 180 : wrapped;
}
export function toPositiveEast(coord: GeographicCoordinate, direction: LongitudeDirection, domain: Exclude<LongitudeDomain, "unknown">): GeographicCoordinate {
  validateCoordinate(coord);
  if (direction === "unknown") throw new CoordinateTransformError("UNKNOWN_COORDINATE_REFERENCE", "Longitude direction is unknown.");
  return { longitude: wrapLongitude(direction === "positive_east" ? coord.longitude : -coord.longitude, domain), latitude: coord.latitude };
}
export function fromPositiveEast(coord: GeographicCoordinate, direction: LongitudeDirection, domain: Exclude<LongitudeDomain, "unknown">): GeographicCoordinate {
  const east = { longitude: wrapLongitude(coord.longitude, domain), latitude: coord.latitude };
  validateCoordinate(east);
  if (direction === "unknown") throw new CoordinateTransformError("UNKNOWN_COORDINATE_REFERENCE", "Longitude direction is unknown.");
  return { longitude: wrapLongitude(direction === "positive_east" ? east.longitude : -east.longitude, domain), latitude: east.latitude };
}
function normalizeProjectionLon(lon: number): number { return wrapLongitude(lon, "-180_180"); }
function radiusFor(reference: CoordinateReference): number {
  const radius = reference.referenceRadiusM ?? DEFAULT_MOON_RADIUS_M;
  if (!Number.isFinite(radius) || radius <= 0) throw new CoordinateTransformError("UNKNOWN_COORDINATE_REFERENCE", "A positive spherical reference radius is required.");
  return radius;
}
function assertProjection(projection: MapProjection): asserts projection is "geographic" | "lunar_spherical_mercator" {
  if (projection !== "geographic" && projection !== "lunar_spherical_mercator") throw new CoordinateTransformError("UNSUPPORTED_PROJECTION", `Projection ${projection} is not supported by the lunar coordinate helper.`);
}

/** Spherical Mercator for lunar products. It is intentionally not Earth Web Mercator. */
export function projectLunarCoordinate(coord: GeographicCoordinate, reference: CoordinateReference, projection: MapProjection): GeographicCoordinate | ProjectedCoordinate {
  validReference(reference); validateCoordinate(coord); assertProjection(projection);
  if (reference.longitudeDomain === "unknown") throw new CoordinateTransformError("UNKNOWN_COORDINATE_REFERENCE", "Longitude domain is unknown.");
  const east = toPositiveEast(coord, reference.longitudeDirection, reference.longitudeDomain);
  if (projection === "geographic") return { longitude: east.longitude, latitude: east.latitude };
  if (Math.abs(east.latitude) >= MAX_MERCATOR_LAT) throw new CoordinateTransformError("MERCATOR_POLE", "Spherical Mercator is singular at or too near a pole; use a polar projection.");
  const radius = radiusFor(reference);
  return { x: radius * east.longitude * RAD, y: radius * Math.log(Math.tan(Math.PI / 4 + east.latitude * RAD / 2)), units: "meters" };
}

export function unprojectLunarCoordinate(coord: GeographicCoordinate | ProjectedCoordinate, reference: CoordinateReference, projection: MapProjection): GeographicCoordinate {
  validReference(reference); assertProjection(projection);
  let east: GeographicCoordinate;
  if (projection === "geographic") {
    if (!("longitude" in coord) || !("latitude" in coord)) throw new CoordinateTransformError("INVALID_COORDINATE", "Geographic coordinates require longitude and latitude.");
    validateCoordinate(coord); east = { longitude: wrapLongitude(coord.longitude, "-180_180"), latitude: coord.latitude };
  } else {
    if (!("x" in coord) || !("y" in coord) || !Number.isFinite(coord.x) || !Number.isFinite(coord.y)) throw new CoordinateTransformError("INVALID_COORDINATE", "Projected coordinates require finite x and y values.");
    const radius = radiusFor(reference);
    const latitude = (2 * Math.atan(Math.exp(coord.y / radius)) - Math.PI / 2) * DEG;
    if (Math.abs(latitude) >= MAX_MERCATOR_LAT) throw new CoordinateTransformError("MERCATOR_POLE", "Inverse Mercator coordinate is at or too near a pole.");
    east = { longitude: normalizeProjectionLon(coord.x / radius * DEG), latitude };
  }
  return fromPositiveEast(east, reference.longitudeDirection, reference.longitudeDomain as Exclude<LongitudeDomain, "unknown">);
}
