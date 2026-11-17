import type { CoverageSummary } from "../products/contracts.js";

/** Builds a coverage report only from supplied measured/derived fractions; never guesses coverage. */
export function createCoverageSummary(input: Omit<CoverageSummary, "units">): CoverageSummary {
  return { ...input, units: "fraction" };
}
