import type { LocationRecord } from "../types/location.js";

export interface StudyArea { id: string; label: string; boundingBox: { minLatitude: number; minLongitude: number; maxLatitude: number; maxLongitude: number }; spacingDegrees: number; maxCandidates: number; referenceExclusionKm: number; }
export interface GridPoint { candidateId: string; latitude: number; longitude: number; row: number; column: number; cellSpacingDegrees: number; }
const coordinateValid = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
export function validateStudyArea(area: StudyArea): string[] {
  const errors: string[] = [];
  const b = area.boundingBox;
  if (!area.id.trim() || !area.label.trim()) errors.push("study area id and label are required");
  if (![b.minLatitude,b.minLongitude,b.maxLatitude,b.maxLongitude].every(Number.isFinite)) errors.push("bounding box coordinates must be finite");
  if (b.minLatitude < -90 || b.maxLatitude > 90 || b.minLongitude < -180 || b.maxLongitude > 180 || b.minLatitude >= b.maxLatitude || b.minLongitude >= b.maxLongitude) errors.push("bounding box must be ordered and within geographic bounds");
  if (!Number.isFinite(area.spacingDegrees) || area.spacingDegrees <= 0 || area.spacingDegrees > 5) errors.push("spacingDegrees must be in (0, 5]");
  if (!Number.isInteger(area.maxCandidates) || area.maxCandidates < 1 || area.maxCandidates > 100) errors.push("maxCandidates must be an integer from 1 to 100");
  if (!Number.isFinite(area.referenceExclusionKm) || area.referenceExclusionKm < 0 || area.referenceExclusionKm > 500) errors.push("referenceExclusionKm must be in [0, 500]");
  return errors;
}
function stableCandidateId(areaId: string, row: number, column: number, lat: number, lon: number) {
  const slug = areaId.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 12) || "AREA";
  return `CAND-${slug}-${String(row).padStart(3,"0")}-${String(column).padStart(3,"0")}-${lat.toFixed(4).replace("-","S")}-${lon.toFixed(4).replace("-","W")}`;
}
export function generateGrid(area: StudyArea): GridPoint[] {
  const errors = validateStudyArea(area); if (errors.length) throw new Error(errors.join("; "));
  const { minLatitude, minLongitude, maxLatitude, maxLongitude } = area.boundingBox;
  const rows = Math.ceil((maxLatitude-minLatitude)/area.spacingDegrees-1e-10), cols = Math.ceil((maxLongitude-minLongitude)/area.spacingDegrees-1e-10);
  const all: GridPoint[] = [];
  for (let row=0; row<rows; row++) for (let column=0; column<cols; column++) {
    const latitudeStart=minLatitude+row*area.spacingDegrees, longitudeStart=minLongitude+column*area.spacingDegrees;
    const latitudeEnd=Math.min(latitudeStart+area.spacingDegrees,maxLatitude), longitudeEnd=Math.min(longitudeStart+area.spacingDegrees,maxLongitude);
    const latitude=Number(((latitudeStart+latitudeEnd)/2).toFixed(10)), longitude=Number(((longitudeStart+longitudeEnd)/2).toFixed(10));
    if (!coordinateValid(latitude,longitude)) continue;
    all.push({ candidateId: stableCandidateId(area.id,row,column,latitude,longitude), latitude, longitude, row, column, cellSpacingDegrees: area.spacingDegrees });
  }
  if (all.length <= area.maxCandidates) return all;
  // Select evenly over the full row-major grid, rather than biasing the first rows.
  const selected = Array.from({ length: area.maxCandidates }, (_, index) => Math.floor((index + 0.5) * all.length / area.maxCandidates));
  return [...new Set(selected)].map(index => all[index]);
}
export function haversineKm(a: {latitude:number;longitude:number}, b: {latitude:number;longitude:number}): number {
  const rad=(d:number)=>d*Math.PI/180, dLat=rad(b.latitude-a.latitude), dLon=rad(b.longitude-a.longitude);
  const h=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;
  return 6371.0088*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function excludeReferenceOverlap(points: GridPoint[], references: LocationRecord[], radiusKm: number) {
  const pointReferences=references.filter(r=>r.recordType==="known_analog"&&r.latitude!==null&&r.longitude!==null);
  const invalidReferenceIds=pointReferences.filter(r=>!coordinateValid(r.latitude!,r.longitude!)).map(r=>r.id);
  const usable = pointReferences.filter(r=>coordinateValid(r.latitude!,r.longitude!)) as (LocationRecord & {latitude:number;longitude:number})[];
  const unmaskedRegionReferenceIds=references.filter(r=>r.recordType==="known_analog"&&(r.latitude===null||r.longitude===null)).map(r=>r.id);
  const retained: GridPoint[] = [], excluded: Array<{point:GridPoint;nearestReferenceId:string;distanceKm:number;cellHalfDiagonalKm:number;edgeDistanceKm:number}> = [];
  for (const point of points) {
    const nearest = usable.map(ref=>({id:ref.id,distanceKm:haversineKm(point,ref)})).sort((a,b)=>a.distanceKm-b.distanceKm)[0];
    const half=point.cellSpacingDegrees/2;
    const cellHalfDiagonalKm=Math.max(...[-1,1].flatMap(latSign=>[-1,1].map(lonSign=>haversineKm(point,{latitude:Math.max(-90,Math.min(90,point.latitude+latSign*half)),longitude:Math.max(-180,Math.min(180,point.longitude+lonSign*half))}))));
    const edgeDistanceKm=nearest?Math.max(0,nearest.distanceKm-cellHalfDiagonalKm):Number.POSITIVE_INFINITY;
    if (nearest && edgeDistanceKm <= radiusKm) excluded.push({point,nearestReferenceId:nearest.id,distanceKm:Number(nearest.distanceKm.toFixed(3)),cellHalfDiagonalKm:Number(cellHalfDiagonalKm.toFixed(3)),edgeDistanceKm:Number(edgeDistanceKm.toFixed(3))});
    else retained.push(point);
  }
  return {retained,excluded,referenceCoordinatesUsed:usable.length,unmaskedRegionReferenceIds,invalidReferenceIds};
}
