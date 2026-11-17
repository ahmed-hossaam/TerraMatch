import type { CoordinateReference, MapProjection } from "../../destinations/types.js";
import type { MetadataState } from "../products/contracts.js";

/** A portable, secret-free record for an immutable raw product kept outside Git. */
export interface MoonAcquisitionManifestV1 {
  schemaVersion: "1.0.0";
  datasetId: string;
  productId: string;
  productVersion: string;
  release: string | null;
  provider: string;
  instrument: string | null;
  sourceUrl: string;
  /** Null when the original download time cannot be established. */
  retrievedAt: string | null;
  /** Time the local artifact was independently rechecked against its declared digest. */
  verifiedAt: string;
  originalFilename: string;
  artifactId: string;
  storage: "external_local_cache" | "private_object_storage";
  format: string;
  byteSize: number;
  checksum: { algorithm: "SHA-256"; value: string; officialValue: string | null; status: MetadataState };
  coordinateReference: CoordinateReference;
  companionArtifacts?: Array<{
    sourceUrl: string; originalFilename: string; artifactId: string; format: string; byteSize: number;
    checksum: { algorithm: "SHA-256"; value: string; officialValue: string | null; status: MetadataState };
  }>;
  variables: Array<{ name: string; units: string | null; semantics: string }>;
  nodata: string | null;
  qualityMetadata: string[];
  license: { status: MetadataState; terms: string | null; redistribution: string | null };
  attribution: { citation: string | null; url: string | null };
  limitations: string[];
  acquisitionResult: "acquired" | "verified_existing";
}

const metadataStates = new Set<MetadataState>(["verified", "partial", "unverified", "unknown"]);
const pathOrSecret = /(?:[A-Za-z]:\\|\/Users\/|\/home\/|DATABASE_URL|BLOB_READ_WRITE_TOKEN|password\s*=|token\s*=)/i;
const validCoordinateReference = (value: CoordinateReference) => value?.targetBody === "moon"
  && typeof value.referenceFrame === "string" && value.referenceFrame.length > 0
  && ["planetocentric", "geodetic", "unknown"].includes(value.latitudeType)
  && ["positive_east", "positive_west"].includes(value.longitudeDirection)
  && ["-180_180", "0_360"].includes(value.longitudeDomain)
  && Number.isFinite(value.referenceRadiusM) && Number(value.referenceRadiusM) > 0
  && typeof value.projection === "string" && value.projection !== "unknown"
  && typeof value.coordinateUnits === "string" && value.coordinateUnits !== "unknown";

export function validateMoonAcquisitionManifest(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["Acquisition manifest must be an object."];
  const manifest = value as Partial<MoonAcquisitionManifestV1>;
  if (manifest.schemaVersion !== "1.0.0") errors.push("schemaVersion must be 1.0.0.");
  for (const key of ["datasetId", "productId", "productVersion", "provider", "originalFilename", "artifactId", "format"] as const) {
    if (typeof manifest[key] !== "string" || !manifest[key]!.trim()) errors.push(`${key} is required.`);
    else if (pathOrSecret.test(manifest[key]!)) errors.push(`${key} must not expose a local path or secret-like value.`);
  }
  if (manifest.release !== null && manifest.release !== undefined && typeof manifest.release !== "string") errors.push("release must be a string or null.");
  if (manifest.instrument !== null && manifest.instrument !== undefined && typeof manifest.instrument !== "string") errors.push("instrument must be a string or null.");
  if (typeof manifest.sourceUrl !== "string" || !/^https:\/\//i.test(manifest.sourceUrl)) errors.push("sourceUrl must be HTTPS.");
  if (!("retrievedAt" in manifest) || (manifest.retrievedAt !== null && (typeof manifest.retrievedAt !== "string" || !Number.isFinite(Date.parse(manifest.retrievedAt))))) errors.push("retrievedAt must be a valid timestamp or explicitly null when unknown.");
  if (typeof manifest.verifiedAt !== "string" || !Number.isFinite(Date.parse(manifest.verifiedAt))) errors.push("verifiedAt must be a valid timestamp.");
  if (!Number.isSafeInteger(manifest.byteSize) || Number(manifest.byteSize) < 1) errors.push("byteSize must be a positive safe integer.");
  if (manifest.storage !== "external_local_cache" && manifest.storage !== "private_object_storage") errors.push("storage must identify a supported non-Git storage location.");
  if (!manifest.checksum || manifest.checksum.algorithm !== "SHA-256" || !/^[a-f0-9]{64}$/i.test(manifest.checksum.value ?? "") || !metadataStates.has(manifest.checksum.status)) errors.push("checksum must contain a valid SHA-256 and metadata status.");
  if (manifest.checksum?.officialValue !== null && manifest.checksum?.officialValue !== undefined && !/^[a-f0-9]{64}$/i.test(manifest.checksum.officialValue)) errors.push("official checksum must be a SHA-256 or null.");
  if (!validCoordinateReference(manifest.coordinateReference as CoordinateReference)) errors.push("coordinateReference must describe a known Moon CRS.");
  if (!Array.isArray(manifest.variables) || manifest.variables.length < 1 || manifest.variables.some((v) => !v || typeof v.name !== "string" || !v.name.trim() || typeof v.semantics !== "string" || !v.semantics.trim() || (v.units !== null && typeof v.units !== "string"))) errors.push("variables must preserve names, units, and semantics.");
  if (manifest.nodata !== null && manifest.nodata !== undefined && typeof manifest.nodata !== "string") errors.push("nodata must be a string or null.");
  if (!Array.isArray(manifest.qualityMetadata) || manifest.qualityMetadata.some((item) => typeof item !== "string" || !item.trim())) errors.push("qualityMetadata must be an array of explicit descriptions.");
  if (!manifest.license || !metadataStates.has(manifest.license.status) || (manifest.license.terms !== null && typeof manifest.license.terms !== "string") || (manifest.license.redistribution !== null && typeof manifest.license.redistribution !== "string")) errors.push("license status and terms must be explicit.");
  if (!manifest.attribution || (manifest.attribution.citation !== null && typeof manifest.attribution.citation !== "string") || (manifest.attribution.url !== null && (typeof manifest.attribution.url !== "string" || !/^https:\/\//i.test(manifest.attribution.url)))) errors.push("attribution must use a traceable citation and HTTPS URL or null.");
  if (!Array.isArray(manifest.limitations) || manifest.limitations.length < 1 || manifest.limitations.some((item) => typeof item !== "string" || !item.trim())) errors.push("at least one explicit limitation is required.");
  if (manifest.acquisitionResult !== "acquired" && manifest.acquisitionResult !== "verified_existing") errors.push("acquisitionResult is invalid.");
  if (manifest.companionArtifacts !== undefined && (!Array.isArray(manifest.companionArtifacts) || manifest.companionArtifacts.some((artifact) => !artifact || typeof artifact.sourceUrl !== "string" || !/^https:\/\//i.test(artifact.sourceUrl) || typeof artifact.originalFilename !== "string" || typeof artifact.artifactId !== "string" || !artifact.artifactId.trim() || typeof artifact.format !== "string" || !Number.isSafeInteger(artifact.byteSize) || artifact.byteSize < 1 || artifact.checksum?.algorithm !== "SHA-256" || !/^[a-f0-9]{64}$/i.test(artifact.checksum.value ?? "") || !metadataStates.has(artifact.checksum.status)))) errors.push("companionArtifacts must have HTTPS provenance, byte sizes, and SHA-256 metadata.");
  if (JSON.stringify(manifest).match(pathOrSecret)) errors.push("manifest must not contain a local path or secret-like value.");
  return [...new Set(errors)];
}

export function isSupportedMoonProjection(projection: MapProjection): boolean {
  return projection === "geographic" || projection === "lunar_spherical_mercator";
}
