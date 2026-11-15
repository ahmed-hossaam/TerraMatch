export const NASA_POWER_ENDPOINT = "https://power.larc.nasa.gov/api/temporal/daily/point";
export const NASA_POWER_COMMUNITY = "AG";
export const DEFAULT_OBSERVATION_PERIOD = { start: "2001-01-01", end: "2020-12-31" } as const;

export interface ParameterDefinition { id: string; unit: string; description: string; }
export const NASA_POWER_PARAMETERS = {
  T2M: { id: "T2M", unit: "°C", description: "Daily mean temperature at 2 meters" },
  T2M_MAX: { id: "T2M_MAX", unit: "°C", description: "Daily maximum temperature at 2 meters" },
  T2M_MIN: { id: "T2M_MIN", unit: "°C", description: "Daily minimum temperature at 2 meters" },
  RH2M: { id: "RH2M", unit: "%", description: "Relative humidity at 2 meters" },
  PRECTOTCORR: { id: "PRECTOTCORR", unit: "mm/day", description: "Bias-corrected precipitation" },
  WS10M: { id: "WS10M", unit: "m/s", description: "Wind speed at 10 meters" },
  ALLSKY_SFC_SW_DWN: { id: "ALLSKY_SFC_SW_DWN", unit: "MJ/m²/day", description: "All-sky surface shortwave downward irradiance; this is solar radiation, not UV" }
} satisfies Record<string, ParameterDefinition>;
export type NasaPowerParameterId = keyof typeof NASA_POWER_PARAMETERS;
export const DEFAULT_PARAMETERS = Object.keys(NASA_POWER_PARAMETERS) as NasaPowerParameterId[];
