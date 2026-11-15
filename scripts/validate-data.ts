import { readFile } from "node:fs/promises";
import { validateRecords } from "../src/validation/records.js";
for (const file of ["data/processed/known-sites.json", "data/processed/candidate-points.json"]) {
  const records = JSON.parse(await readFile(file, "utf8"));
  const errors = validateRecords(records);
  if (errors.length) { console.error(file, errors); process.exitCode = 1; }
  else console.log(`${file}: ${records.length} records valid`);
}
