export type DestinationId = "earth" | "mars" | "moon";
export type CoordinateBody = DestinationId;
export type LatitudeType = "geodetic" | "planetocentric" | "unknown";
export type LongitudeDirection = "positive_east" | "positive_west" | "unknown";
export type LongitudeDomain = "-180_180" | "0_360" | "unknown";
export type MapProjection = "geographic" | "lunar_spherical_mercator" | "earth_web_mercator" | "equirectangular" | "cylindrical_equirectangular" | "simple_cylindrical" | "polar_stereographic" | "planetary_equirectangular" | "unknown";

export interface CoordinateReference {
  targetBody: CoordinateBody;
  referenceFrame: string | null;
  latitudeType: LatitudeType;
  longitudeDirection: LongitudeDirection;
  longitudeDomain: LongitudeDomain;
  referenceRadiusM: number | null;
  semiMajorAxisM: number | null;
  semiMinorAxisM: number | null;
  coordinateEpoch: string | null;
  projection: MapProjection;
  coordinateUnits: "degrees" | "meters" | "unknown";
}

export interface DestinationDefinition {
  id: DestinationId;
  displayName: string;
  bodyType: "terrestrial_planet" | "natural_satellite";
  bodyGeometry: { referenceRadiusM: number | null; description: string };
  canonicalCoordinateReference: CoordinateReference;
  coordinateReferenceStatus: "verified" | "provisional" | "unresolved";
  supportedCoordinateFrames: string[];
  supportedProjections: MapProjection[];
  datasetIds: string[];
  missionProfiles: string[];
  apiNamespace: string;
  mapConfiguration: {
    projection: MapProjection;
    basemapId: string | null;
    center: { longitude: number; latitude: number };
    zoom: number;
    layerIds: string[];
  };
}
