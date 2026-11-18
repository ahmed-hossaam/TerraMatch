import type { MoonDatasetEntry } from "./products/contracts.js";

export type MoonLayerRenderingType = "raster" | "vector" | "image_footprint" | "point_track" | "derived_coverage";
export interface MoonMapConfiguration {
  destinationId: "moon"; projection: import("../destinations/types.js").MapProjection;
  coordinateReference: import("../destinations/types.js").CoordinateReference;
  coordinateReferenceStatus: "verified" | "provisional" | "unresolved";
  center: { longitude: number; latitude: number }; radiusM: number | null; basemapId: null;
  prototype: true; prototypeNotice: string;
}
export interface MoonMapLayer {
  id: string; datasetId: string; name: string; category: string; product: string | null; evidenceClass: string; units: string[];
  coordinateReference: MoonDatasetEntry["coordinateReference"]; coverage: MoonDatasetEntry["spatialSupport"];
  inspectionState: string; decodingState: string; processingState: string; mapDeliveryState: string; attribution: MoonDatasetEntry["attribution"]; limitations: string[];
  renderingType: MoonLayerRenderingType;
  availability: "renderable" | "not_acquired" | "not_inspected" | "decode_blocked" | "not_decoded" | "not_processed" | "not_validated" | "not_delivery_ready" | "unsupported";
  /** Technically displayable from a processed local artifact, but not a validated scientific layer. */
  researchDisplayAvailable: boolean;
  reason: string;
}
const supportedRenderingTypes = new Set<MoonLayerRenderingType>(["raster", "vector", "image_footprint", "point_track", "derived_coverage"]);
export function toMoonLayer(dataset: MoonDatasetEntry, renderingType: MoonLayerRenderingType = "raster"): MoonMapLayer {
  const complete = dataset.lifecycle.acquisition === "acquired" && dataset.lifecycle.inspection === "completed" && dataset.lifecycle.decoding === "completed" && dataset.lifecycle.processing === "completed"
    && dataset.lifecycle.validation === "completed" && dataset.lifecycle.mapDelivery === "completed"
    && dataset.coordinateReference.targetBody === "moon" && supportedRenderingTypes.has(renderingType);
  let availability: MoonMapLayer["availability"] = "renderable";
  let reason = "Validated lunar product is available for this renderer.";
  if (dataset.coordinateReference.targetBody !== "moon" || !supportedRenderingTypes.has(renderingType)) {
    availability = "unsupported"; reason = "Product body or rendering type is unsupported by this Moon map.";
  } else if (dataset.lifecycle.acquisition !== "acquired") {
    availability = dataset.lifecycle.acquisition === "failed" ? "not_validated" : "not_acquired"; reason = "Source product has not been acquired; there is no scientific layer to render.";
  } else if (dataset.lifecycle.inspection !== "completed") {
    availability = "not_inspected"; reason = "The acquired product has not passed file-level inspection of format, coordinates, units, and quality metadata.";
  } else if (dataset.lifecycle.decoding === "blocked") {
    availability = "decode_blocked"; reason = "JP2 container and codestream headers were inspected, but no compatible pixel decoder is available; no decoded raster values or map layer are available.";
  } else if (dataset.lifecycle.decoding !== "completed") {
    availability = "not_decoded"; reason = "The source pixels have not been decoded and validated.";
  } else if (dataset.lifecycle.processing !== "completed") {
    availability = "not_processed"; reason = "Source product has not completed processing.";
  } else if (dataset.lifecycle.validation !== "completed") {
    availability = "not_validated"; reason = "Product-specific scientific and artifact validation is incomplete.";
  } else if (dataset.lifecycle.mapDelivery !== "completed") {
    availability = "not_delivery_ready"; reason = "A validated product exists, but the configured map renderer has no verified delivery artifact.";
  }
  return {
    id: `moon-layer-${dataset.datasetId}`, datasetId: dataset.datasetId, name: dataset.name, category: dataset.category,
    product: dataset.productId ? `${dataset.productId}${dataset.productVersion ? ` · ${dataset.productVersion}` : ""}` : null,
    evidenceClass: [...new Set(dataset.variables.map((variable) => variable.evidenceClass))].join(", ") || "unknown",
    units: [...new Set(dataset.variables.flatMap((variable) => variable.unit ? [variable.unit] : []))],
    coordinateReference: dataset.coordinateReference, coverage: dataset.spatialSupport, inspectionState: dataset.lifecycle.inspection, decodingState: dataset.lifecycle.decoding, processingState: dataset.lifecycle.processing, mapDeliveryState: dataset.lifecycle.mapDelivery,
    attribution: dataset.attribution, limitations: dataset.limitations, renderingType, availability: complete ? "renderable" : availability,
    researchDisplayAvailable: dataset.datasetId === "moon-lola-global-topography" && dataset.checksum.status === "verified" && dataset.lifecycle.acquisition === "acquired" && dataset.lifecycle.decoding === "completed" && dataset.lifecycle.processing === "completed",
    reason,
  };
}
export function buildMoonMapLayers(datasets: readonly MoonDatasetEntry[]): MoonMapLayer[] {
  return datasets.map((dataset) => toMoonLayer(dataset, chooseRenderingType(dataset.category)));
}
export function getRenderableMoonLayers(layers: MoonMapLayer[]): MoonMapLayer[] { return layers.filter((layer) => layer.availability === "renderable"); }
function chooseRenderingType(category: string): MoonLayerRenderingType {
  if (category === "imaging_morphology") return "image_footprint";
  if (category === "illumination_shadow") return "derived_coverage";
  if (category === "geology") return "vector";
  return "raster";
}
