import type { DestinationDefinition } from "./types.js";
import { DESTINATIONS } from "./registry.js";

export function validateDestinationRegistry(value: unknown = DESTINATIONS): string[] {
  if (!Array.isArray(value)) return ["Destination registry must be an array."];
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const [index, raw] of value.entries()) {
    const item = raw as DestinationDefinition;
    if (!item || !["earth", "mars", "moon"].includes(item.id) || ids.has(item.id)) errors.push(`destinations[${index}] has an invalid or duplicate destination ID.`); else ids.add(item.id);
    if (item?.canonicalCoordinateReference?.targetBody !== item?.id) errors.push(`destinations[${index}] canonical coordinate target body does not match destination ID.`);
    if (!item?.coordinateReferenceStatus || !["verified", "provisional", "unresolved"].includes(item.coordinateReferenceStatus)) errors.push(`destinations[${index}] coordinate reference status is required.`);
    if (!item?.apiNamespace?.startsWith("/api")) errors.push(`destinations[${index}] API namespace must be same-origin /api.`);
    if (!Array.isArray(item?.supportedProjections) || (item.mapConfiguration?.basemapId !== null && !item.supportedProjections.includes(item.mapConfiguration?.projection))) errors.push(`destinations[${index}] active map projection is not declared as supported.`);
  }
  for (const id of ["earth", "mars", "moon"]) if (!ids.has(id)) errors.push(`Destination ${id} is missing.`);
  return errors;
}
