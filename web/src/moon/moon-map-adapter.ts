import { getDestination } from "../../../src/destinations/registry.js";
import { projectLunarCoordinate } from "../../../src/moon/coordinates.js";
import type { MoonMapConfiguration } from "../../../src/moon/map-layers.js";

export function createMoonMapConfiguration(): MoonMapConfiguration {
  const moon = getDestination("moon");
  if (moon.canonicalCoordinateReference.targetBody !== "moon") throw new Error("Moon map requires a lunar coordinate reference.");
  if (moon.canonicalCoordinateReference.projection !== "geographic") throw new Error("Moon prototype currently requires the registered geographic coordinate view.");
  if (moon.canonicalCoordinateReference.latitudeType === "unknown" || moon.canonicalCoordinateReference.longitudeDirection === "unknown" || moon.canonicalCoordinateReference.longitudeDomain === "unknown") {
    throw new Error("Moon map cannot initialize with incomplete coordinate conventions.");
  }
  return {
    destinationId: "moon", projection: "geographic", coordinateReference: moon.canonicalCoordinateReference,
    coordinateReferenceStatus: moon.coordinateReferenceStatus, center: moon.mapConfiguration.center,
    radiusM: moon.bodyGeometry.referenceRadiusM, basemapId: null, prototype: true,
    prototypeNotice: "Neutral lunar coordinate prototype. No acquired lunar imagery, terrain, geology, or scientific features are displayed.",
  };
}

export function toMoonMapPosition(longitude: number, latitude: number, reference = createMoonMapConfiguration().coordinateReference): { x: number; y: number } {
  const projected = projectLunarCoordinate({ longitude, latitude }, reference, "geographic");
  if (!("longitude" in projected)) throw new Error("The Moon prototype expects geographic coordinates.");
  return { x: projected.longitude, y: -projected.latitude };
}
