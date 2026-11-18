/** Factors for which the current bounded Earth point-sampling pipeline has an implementation. */
export const supportedDiscoveryFactorIds = new Set([
  "air_temperature_daily_mean",
  "air_temperature_extremes",
  "daily_temperature_range",
  "relative_humidity",
  "precipitation",
  "wind_speed",
  "solar_radiation",
  "elevation_point",
  "mapped_lithology",
]);

export function unsupportedRequiredFactors(requiredFactorIds: string[]) {
  return requiredFactorIds.filter((id) => !supportedDiscoveryFactorIds.has(id));
}
