import { MOON_DATASETS } from "../../../src/moon/registry/dataset-registry.js";
import { buildMoonMapLayers, getRenderableMoonLayers } from "../../../src/moon/map-layers.js";
import type { MoonMapLayer } from "../../../src/moon/map-layers.js";
export { getRenderableMoonLayers };
export function getDefaultMoonMapLayers(): MoonMapLayer[] { return buildMoonMapLayers(MOON_DATASETS); }
