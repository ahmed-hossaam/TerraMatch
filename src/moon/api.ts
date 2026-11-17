import { getDestination } from "../destinations/registry.js";
import { MOON_DATASETS, MOON_REGISTRY_VERSION } from "./registry/dataset-registry.js";
import { validateMoonDatasetRegistry } from "./validation/registry.js";
import { buildMoonMapLayers, getRenderableMoonLayers } from "./map-layers.js";
import lolaPreview from "../../data/processed/moon/lola/ldem_4_relative-height-preview.json" with { type: "json" };
import northPolarPreview from "../../data/processed/moon/lola/ldem_4_north-polar-preview.json" with { type: "json" };
import southPolarPreview from "../../data/processed/moon/lola/ldem_4_south-polar-preview.json" with { type: "json" };

export interface MoonApiResult { status: number; body: Record<string, unknown>; }
const layers = buildMoonMapLayers(MOON_DATASETS);
const renderableLayers = getRenderableMoonLayers(layers);
const registryErrors = validateMoonDatasetRegistry(MOON_DATASETS);
const lifecycleCount = (state: string, key: "acquisition" | "inspection" | "decoding" | "processing" | "validation" | "mapDelivery") => MOON_DATASETS.filter((dataset) => dataset.lifecycle[key] === state).length;
const coverageState = (dataset: typeof MOON_DATASETS[number]) => ({
  datasetId: dataset.datasetId,
  classification: dataset.spatialSupport.coverageClass,
  nominalProductFootprint: dataset.spatialSupport.description,
  nominalResolution: dataset.spatialSupport.nominalResolution,
  effectiveResolution: dataset.spatialSupport.effectiveResolution,
  observedDataCoverage: null,
  validDataCoverage: null,
  interpolatedOrDerivedCoverage: null,
  nodataOrUnobservedCoverage: null,
  coverageMeasurementStatus: "unknown",
  productMetadataCoverageStatus: dataset.spatialSupport.validCoverage,
  limitation: "Coverage fractions have not been calculated from acquired product files.",
});

function paginated<T>(items: T[], query: URLSearchParams): { status: number; body: Record<string, unknown> } {
  const rawOffset = query.get("offset") ?? "0", rawLimit = query.get("limit") ?? String(items.length || 1);
  if (!/^\d+$/.test(rawOffset) || !/^\d+$/.test(rawLimit)) return error(400, "INVALID_QUERY", "offset and limit must be non-negative integers.");
  const offset = Number(rawOffset), limit = Number(rawLimit);
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(limit) || limit < 1 || limit > 13) return error(400, "INVALID_QUERY", "offset must be safe and limit must be between 1 and 13.");
  return { status: 200, body: { schemaVersion: "1.0.0", items: items.slice(offset, offset + limit), pagination: { offset, limit, total: items.length, nextOffset: offset + limit < items.length ? offset + limit : null } } };
}
function error(status: number, code: string, message: string): MoonApiResult { return { status, body: { error: message, code } }; }

/** Metadata-only read API. It performs no storage access, acquisition, or database initialization. */
export function moonApiResponse(pathname: string, query = new URLSearchParams(), method = "GET"): MoonApiResult | null {
  if (pathname !== "/api/moon" && !pathname.startsWith("/api/moon/")) return null;
  if (method !== "GET") return error(405, "METHOD_NOT_ALLOWED", "Moon catalog endpoints support GET only.");
  if (registryErrors.length) return error(503, "MOON_REGISTRY_INVALID", "Moon dataset catalog validation failed.");
  const destination = getDestination("moon");
  if (pathname === "/api/moon/summary") {
    const bodies = MOON_DATASETS;
    const acquired = lifecycleCount("acquired", "acquisition");
    const renderable = renderableLayers.length;
    return { status: 200, body: {
      schemaVersion: "1.0.0", registryVersion: MOON_REGISTRY_VERSION, destination,
      globalScope: "The registry covers whole-Moon, near-global, regional, polar, and targeted product families; nominal scope does not imply uniform resolution or valid observations.",
      counts: { registered: bodies.length, productSelected: bodies.filter((item) => item.lifecycle.productSelection === "completed").length, metadataPartiallyVerified: bodies.filter((item) => item.metadataStatus === "partial").length, acquired, inspected: lifecycleCount("completed", "inspection"), decoded: lifecycleCount("completed", "decoding"), processed: lifecycleCount("completed", "processing"), validated: lifecycleCount("completed", "validation"), renderable, researchPreviews: 3 },
      readiness: renderable ? "map_layers_available" : "unvalidated_research_preview_available",
      knownGaps: [
        acquired ? "The LOLA LDEM_4 source is checksum-verified and processed to a NoData-masked Float32 relative-height array; spatial georeferencing and product validation remain incomplete." : "No lunar product artifacts have been acquired.",
        "LOLA LDEM_4 has a NoData-masked Float32 relative-height array; it has not been scientifically validated or georeferenced.", "No lunar raster/vector tile delivery is configured.", "Observed, geographic valid, interpolated, and unobserved coverage fractions are not computed.",
      ],
    } };
  }
  if (pathname === "/api/moon/lola/preview") {
    return { status: 200, body: {
      schemaVersion: "1.0.0", previewStatus: "unvalidated_research_preview", artifactId: lolaPreview.artifactId,
      datasetId: lolaPreview.input.productId === "LDEM_4" ? "moon-lola-global-topography" : null,
      product: { id: lolaPreview.input.productId, version: lolaPreview.input.version, dataSetId: "LRO-L-LOLA-4-GDR-V1.0" },
      sourceUrl: lolaPreview.provenance.sourceUrl, attribution: "NASA Planetary Data System Geosciences Node / LRO LOLA team",
      image: { format: lolaPreview.output.format, width: lolaPreview.output.width, height: lolaPreview.output.height, byteSize: lolaPreview.output.byteSize, sha256: lolaPreview.output.sha256 },
      input: { sha256: lolaPreview.input.sha256, dimensionsLinesSamples: lolaPreview.input.dimensionsLinesSamples, dtype: lolaPreview.input.dtype, units: lolaPreview.input.units },
      display: lolaPreview.display, coordinateReference: lolaPreview.coordinateReference,
      scientificStatus: lolaPreview.scientificStatus, limitations: lolaPreview.limitations,
      dataPathExposed: false,
    } };
  }
  if (pathname === "/api/moon/lola/polar-previews") {
    const polar = [northPolarPreview, southPolarPreview].map((item) => ({
      artifactId: item.artifactId,
      hemisphere: item.projection.hemisphere,
      image: { format: item.output.format, width: item.output.width, height: item.output.height, pixelSizeM: item.output.pixelSizeM, byteSize: item.output.byteSize, sha256: item.output.sha256 },
      projection: item.projection,
      display: item.display,
      scientificStatus: item.scientificStatus,
      provenance: { sourceDataset: item.provenance.sourceDataset, sourceProduct: item.provenance.sourceProduct, sourceUrl: item.provenance.sourceUrl, renderingScript: item.provenance.renderingScript },
      limitations: item.limitations,
    }));
    return { status: 200, body: { schemaVersion: "1.0.0", previewStatus: "unvalidated_research_preview", projections: polar, dataPathExposed: false } };
  }
  if (pathname === "/api/moon/datasets") return paginated([...MOON_DATASETS], query);
  if (pathname === "/api/moon/coverage") return { status: 200, body: { schemaVersion: "1.0.0", coverageSemantics: { nominalFootprint: "Source product's declared footprint/scope, not measured valid coverage.", observedDataCoverage: "Calculated observation support; currently unknown.", validDataCoverage: "Valid pixels/features after QC and nodata filtering; currently unknown.", interpolatedOrDerivedCoverage: "Interpolated or derived area; currently unknown.", nodataOrUnobservedCoverage: "Nodata or unobserved area; currently unknown." }, datasets: MOON_DATASETS.map(coverageState) } };
  if (pathname === "/api/moon/layers") {
    const page = paginated(layers, query);
    if (page.status !== 200) return page;
    const paged = page.body.items as typeof layers;
    return { status: 200, body: { schemaVersion: "1.0.0", renderableLayers: paged.filter((layer) => layer.availability === "renderable"), registeredButUnavailableLayers: paged.filter((layer) => layer.availability !== "renderable"), pagination: page.body.pagination } };
  }
  if (pathname === "/api/moon/map-config") return { status: 200, body: { schemaVersion: "1.0.0", destinationId: destination.id, displayName: destination.displayName, coordinateReference: destination.canonicalCoordinateReference, coordinateReferenceStatus: destination.coordinateReferenceStatus, projection: destination.mapConfiguration.projection, supportedProjections: destination.supportedProjections, center: destination.mapConfiguration.center, zoom: destination.mapConfiguration.zoom, referenceRadiusM: destination.bodyGeometry.referenceRadiusM, basemapId: null, tileService: null, prototype: true, prototypeNotice: "The Moon view is a coordinate prototype with a separate unvalidated LDEM_4 display preview; no lunar tile service or validated scientific layer is served.", longitudeWrapping: "The map uses the registry's positive-east −180° to 180° convention." } };
  const detailMatch = pathname.match(/^\/api\/moon\/datasets\/([^/]+)$/);
  if (detailMatch) {
    let datasetId: string;
    try { datasetId = decodeURIComponent(detailMatch[1]); } catch { return error(400, "INVALID_DATASET_ID", "Dataset ID encoding is invalid."); }
    if (!/^[a-z0-9-]{1,100}$/.test(datasetId)) return error(400, "INVALID_DATASET_ID", "Dataset ID is invalid.");
    const dataset = MOON_DATASETS.find((item) => item.datasetId === datasetId);
    if (!dataset) return error(404, "UNKNOWN_DATASET", "No Moon dataset is registered with that ID.");
    return { status: 200, body: { schemaVersion: "1.0.0", dataset, mapLayer: layers.find((layer) => layer.datasetId === datasetId) ?? null, statusExplanation: "This record describes a registered source family. It does not assert that product files were acquired or contain valid coverage." } };
  }
  return error(404, "UNKNOWN_MOON_ENDPOINT", "Moon API endpoint was not found.");
}
