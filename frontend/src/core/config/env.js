const raw = import.meta.env || {};

export const env = Object.freeze({
  API_URL: (raw.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, ""),
  TIMEOUT_MS: Number(raw.VITE_API_TIMEOUT_MS) || 15000,
  USE_MOCK_REPORTES: raw.VITE_USE_MOCK_REPORTES === "true",
});
