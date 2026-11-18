import type { MapProjection } from "../../destinations/types.js";
import type { MoonDatasetEntry, ProductVariable, ScientificEvidenceClass } from "../products/contracts.js";

export const MOON_REGISTRY_VERSION = "2.0.0" as const;
export const MOON_ACQUISITION_ADAPTER_ID = "moon-bounded-http-v1";
export const MOON_VALIDATION_ADAPTER_ID = "moon-product-metadata-v1";

function variable(id: string, name: string, unit: string | null, semantics: string, evidenceClass: ScientificEvidenceClass): ProductVariable {
  return { id, name, unit, semantics, evidenceClass };
}
type EntryInput = Pick<MoonDatasetEntry, "datasetId" | "name" | "category" | "provider" | "mission" | "instrument" | "sourceArchiveId" | "sourceUrl" | "productId" | "productVersion" | "release" | "fileFormats" | "acquisitionDate" | "processingLevel" | "sourceProductRelationships" | "coordinateReference" | "spatialSupport" | "temporalSupport" | "variables" | "nodata" | "quality" | "calibration" | "limitations"> & { downloadUrl?: string | null; selected: boolean; metadataVerified: boolean; attributionCitation: string; attributionUrl: string; lifecycleOverrides: Partial<MoonDatasetEntry["lifecycle"]>; checksumOverride: MoonDatasetEntry["checksum"] };
function entry(input: EntryInput): MoonDatasetEntry {
  return {
    ...input,
    downloadUrl: input.downloadUrl ?? null,
    advertisedPackageSizeBytes: null,
    metadataStatus: "partial",
    processingHistory: [], checksum: input.checksumOverride ?? { algorithm: "SHA-256", value: null, status: "unknown" },
    license: { status: "unverified", terms: null, redistribution: null },
    attribution: { status: "partial", citation: input.attributionCitation, url: input.attributionUrl },
    lifecycle: {
      registration: "completed", productSelection: input.selected ? "completed" : "not_started",
      metadataVerification: input.metadataVerified ? "completed" : "implemented",
      acquisitionAdapter: "implemented", acquisition: "not_acquired", inspection: "not_started", decoding: "not_started", processing: "not_started", validation: "implemented", mapDelivery: "not_started",
      ...input.lifecycleOverrides,
    },
    acquisitionAdapterId: MOON_ACQUISITION_ADAPTER_ID, validationAdapterId: MOON_VALIDATION_ADAPTER_ID,
  };
}
/** Active catalog: every entry must correspond to acquired, integrity-verified data. */
export const MOON_DATASETS: readonly MoonDatasetEntry[] = [
  entry({
    datasetId: "moon-lola-global-topography", name: "LRO LOLA gridded topography", category: "topography", provider: "NASA Planetary Data System",
    mission: "Lunar Reconnaissance Orbiter", instrument: "Lunar Orbiter Laser Altimeter (LOLA)", sourceArchiveId: "LRO-L-LOLA-4-GDR-V1.0", sourceUrl: "https://pds-geosciences.wustl.edu/missions/lro/lola_faq.htm", downloadUrl: "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/ldem_4.jp2",
    productId: "LDEM_4", productVersion: "V3.0", release: null, fileFormats: ["JPEG2000 (JP2) with detached PDS3 label"], acquisitionDate: null,
    processingLevel: "LDEM_4 source pixels processed to a Float32 relative surface-height array; not georeferenced or scientifically validated", sourceProductRelationships: ["Derived from LOLA RDR products"],
    coordinateReference: {
      targetBody: "moon", referenceFrame: "MEAN EARTH/POLAR AXIS OF DE421", latitudeType: "planetocentric", longitudeDirection: "positive_east", longitudeDomain: "-180_180",
      referenceRadiusM: 1_737_400, semiMajorAxisM: null, semiMinorAxisM: null, coordinateEpoch: null, projection: "simple_cylindrical", coordinateUnits: "degrees",
    },
    spatialSupport: {
      coverageClass: "global", description: "PDS LDEM_4 label declares −90° to +90° latitude and −180° to +180° positive-east longitude. This describes the grid bounds, not verified valid pixel coverage.",
      nominalResolution: "4 pixels/degree; the label reports 0.25° row spacing and 7.580837606 km/pixel map scale.", effectiveResolution: null, validCoverage: "unknown", interpolatedCoverage: "unknown",
    },
    temporalSupport: { start: "2009-07-13T17:33:17.246", end: "2016-11-29T05:48:19", cadence: null, accumulation: "Product source-data time span from detached label; cell-level temporal support is not provided.", status: "partial" },
    variables: [variable("relative_surface_height", "LDEM_4 relative surface height", "m", "Processed value is raw JP2 DN × 0.5 using the companion AUX Scale=0.5 and Offset=0. The 1,737,400 m reference radius is retained as metadata and is not added to this relative-height array. Planetary radius would require DN × 0.5 + 1,737,400 m and is not the output variable.", "derived_product")],
    nodata: "Companion AUX XML NoDataValue -32768 is represented as NaN in the Float32 output.", quality: { status: "partial", nodataEncoding: "AUX NoDataValue -32768 converted to Float32 NaN; no other quality mask applied.", qualityLayers: [], uncertaintyDescription: null }, calibration: "AUX scale 0.5 applied to valid raw DNs for relative surface height in meters; AUX offset 0 applied. The PDS reference radius 1,737,400 m is metadata only and was not added to output.",
    limitations: [
      "JP2 and label source digests and AUX metadata are recorded in the processed sidecar. The NPY is a processed sample array, not a georeferenced raster.",
      "The detached PDS label has no MISSING_CONSTANT or MISSING_VALUE; the companion AUX XML supplies -32768 as NoData. No independent quality mask is applied.",
      "The LOLA RDR SIS defines LRO LOLA body-fixed coordinates as planetocentric. PDS GDRDEM documentation defines values at cell centers; the LDEM_4 label offsets yield longitude=(column−719.5)/4 and latitude=(359.5−row)/4 for zero-based indices.",
      "The PDS label uses shape-map (radius) wording while naming the image object HEIGHT; this processed array follows the specified relative-height formula and does not represent absolute planetary radius.",
      "The processed NPY is an array with a source-documented Moon coordinate transform; no standard lunar CRS GeoTIFF or independent point cross-check exists yet.",
      "The label notes possible 45° latitude-band edge artifacts and use of surface interpolation to compensate for incomplete coverage.",
      "The NoData-filtered sample count is not geographic valid-data coverage; whole-body grid bounds do not prove complete observation coverage.",
      "LOLA and Kaguya LALT grids remain distinct products and have not been reconciled.",
    ],
    selected: true, metadataVerified: true, attributionCitation: "LRO LOLA GDR product LDEM_4, PDS dataset LRO-L-LOLA-4-GDR-V1.0, product version V3.0.", attributionUrl: "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/ldem_4.jp2",
    checksumOverride: { algorithm: "SHA-256", value: "9193828f6fc311e858a9f30ca8a29f91948805993a1475c6d2165e290f167fe3", status: "verified" },
    lifecycleOverrides: { acquisition: "acquired", inspection: "completed", decoding: "completed", processing: "completed", validation: "blocked" },
  }),
] as const;


export function getMoonDataset(datasetId: string): MoonDatasetEntry | undefined { return MOON_DATASETS.find((item) => item.datasetId === datasetId); }
export function supportedMoonProjection(projection: MapProjection): boolean { return projection === "geographic" || projection === "lunar_spherical_mercator"; }
