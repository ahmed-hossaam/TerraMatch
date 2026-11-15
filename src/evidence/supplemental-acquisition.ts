export interface SupplementalChemistryRecord {
  sourceId: string;
  sampleLabel: string;
  parameter: string;
  value: number;
  unit: string;
  measurementInterpretation?: string;
}

export interface MeteorMountChemistry {
  mount: string;
  values: Record<string, number>;
}

export function groupMeteorCraterMountChemistry(records: SupplementalChemistryRecord[]): MeteorMountChemistry[] {
  const mounts = new Map<string, Record<string, number>>();
  for (const record of records) {
    if (record.sourceId !== "usgs-publications") continue;
    if (!Number.isFinite(record.value) || record.unit !== "wt%") continue;
    const values = mounts.get(record.sampleLabel) ?? {};
    values[record.parameter] = record.value;
    mounts.set(record.sampleLabel, values);
  }
  return [...mounts.entries()]
    .map(([mount, values]) => ({ mount, values }))
    .sort((a, b) => a.mount.localeCompare(b.mount, undefined, { numeric: true }));
}
