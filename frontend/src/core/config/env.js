const raw = import.meta.env || {};

function resolveApiUrl() {
  const configured = (raw.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location?.hostname) {
    try {
      const url = new URL(configured);
      if (
        (window.location.hostname === "127.0.0.1" && url.hostname === "localhost") ||
        (window.location.hostname === "localhost" && url.hostname === "127.0.0.1")
      ) {
        url.hostname = window.location.hostname;
        return url.origin;
      }
    } catch {
      // conservar configured si no parsea como URL absoluta
    }
  }
  return configured;
}

export const env = Object.freeze({
  API_URL: resolveApiUrl(),
  TIMEOUT_MS: Number(raw.VITE_API_TIMEOUT_MS) || 15000,
  USE_MOCK_REPORTES: raw.VITE_USE_MOCK_REPORTES === "true",
});
