import type { DestinationDefinition, DestinationId } from "./types.js";

/** Registry metadata only; it does not imply that a map or product is available. */
export const DESTINATIONS: readonly DestinationDefinition[] = [
  {
    id: "earth", displayName: "Earth", bodyType: "terrestrial_planet",
    bodyGeometry: { referenceRadiusM: 6371008.8, description: "Mean Earth radius used for generic spherical display only; source products retain their declared datum." },
    canonicalCoordinateReference: { targetBody: "earth", referenceFrame: "WGS 84", latitudeType: "geodetic", longitudeDirection: "positive_east", longitudeDomain: "-180_180", referenceRadiusM: null, semiMajorAxisM: 6378137, semiMinorAxisM: 6356752.314245, coordinateEpoch: null, projection: "earth_web_mercator", coordinateUnits: "degrees" }, coordinateReferenceStatus: "verified",
    supportedCoordinateFrames: ["WGS 84"], supportedProjections: ["geographic", "earth_web_mercator"], datasetIds: ["earth-reference-archive"],
    missionProfiles: ["mars-surface-analog-requirements"], apiNamespace: "/api", mapConfiguration: { projection: "earth_web_mercator", basemapId: "earth-imagery", center: { longitude: 0, latitude: 10 }, zoom: 1.05, layerIds: ["earth-imagery", "earth-reference-markers", "earth-candidate-cells"] },
  },
  {
    id: "mars", displayName: "Mars", bodyType: "terrestrial_planet",
    bodyGeometry: { referenceRadiusM: null, description: "Reference geometry varies by source product; not established as one universal value in the current Mars profile." },
    canonicalCoordinateReference: { targetBody: "mars", referenceFrame: null, latitudeType: "unknown", longitudeDirection: "unknown", longitudeDomain: "unknown", referenceRadiusM: null, semiMajorAxisM: null, semiMinorAxisM: null, coordinateEpoch: null, projection: "unknown", coordinateUnits: "unknown" }, coordinateReferenceStatus: "unresolved",
    supportedCoordinateFrames: [], supportedProjections: [], datasetIds: ["mars-rems-modrdr"], missionProfiles: ["mars-surface-analog-requirements"],
    apiNamespace: "/api/mars-evidence", mapConfiguration: { projection: "unknown", basemapId: null, center: { longitude: 0, latitude: 0 }, zoom: 0, layerIds: [] },
  },
  {
    id: "moon", displayName: "Moon", bodyType: "natural_satellite",
    bodyGeometry: { referenceRadiusM: 1737400, description: "USGS Unified Geologic Map declared spherical radius; product-specific coordinate references remain authoritative." },
    canonicalCoordinateReference: { targetBody: "moon", referenceFrame: "Mean Earth / Polar Axis (ME), provisional application reference", latitudeType: "planetocentric", longitudeDirection: "positive_east", longitudeDomain: "-180_180", referenceRadiusM: 1737400, semiMajorAxisM: null, semiMinorAxisM: null, coordinateEpoch: null, projection: "geographic", coordinateUnits: "degrees" }, coordinateReferenceStatus: "provisional",
    supportedCoordinateFrames: ["Mean Earth / Polar Axis (ME)"], supportedProjections: ["geographic", "lunar_spherical_mercator"], datasetIds: [], missionProfiles: [],
    apiNamespace: "/api/moon", mapConfiguration: { projection: "geographic", basemapId: null, center: { longitude: 0, latitude: 0 }, zoom: 0, layerIds: ["moon-lola-global-topography", "moon-kaguya-lalt-global-topography", "moon-lro-diviner-thermal", "moon-lroc-wac-imaging", "moon-lroc-nac-imaging", "moon-chandrayaan1-m3-reflectance", "moon-clementine-uvvis", "moon-lro-illumination", "moon-permanently-shadowed-regions", "moon-lro-lend-hydrogen", "moon-grail-gravity-models", "moon-lro-minirf-radar", "moon-usgs-unified-geology"] },
  },
] as const;

export function getDestination(id: DestinationId): DestinationDefinition {
  const destination = DESTINATIONS.find((item) => item.id === id);
  if (!destination) throw new Error(`Unknown destination: ${id}`);
  return destination;
}
