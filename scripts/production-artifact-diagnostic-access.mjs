/**
 * The TerraMatch project has no application-level user/session auth. This
 * endpoint is therefore allowed only on the unique deployment hostname; the
 * existing Vercel project SSO protection must authenticate that host before a
 * request reaches the function. Custom domains are deliberately rejected.
 */
export const PRODUCTION_ARTIFACT_DIAGNOSTIC_PATH = "/api/diagnostics/production-artifact-store";

export function isProtectedProductionDiagnosticRequest({ method, url, headers, environment = process.env } = {}) {
  if (method !== "GET" || !(url instanceof URL)) return false;
  if ((environment.VERCEL !== "1" && environment.VERCEL !== "true")
      || environment.VERCEL_ENV !== "production"
      || environment.VERCEL_PROJECT_NAME !== "terramatch"
      || !environment.VERCEL_DEPLOYMENT_ID
      || !environment.VERCEL_URL) return false;
  if (url.protocol !== "https:") return false;
  const deploymentHost = String(environment.VERCEL_URL).toLowerCase().replace(/:\d+$/, "");
  const requestHost = String(headers?.host ?? url.host).toLowerCase().replace(/:\d+$/, "");
  return requestHost === deploymentHost && url.hostname.toLowerCase() === deploymentHost;
}
