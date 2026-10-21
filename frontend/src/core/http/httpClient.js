import { env } from "../config/env.js";
import { mapHttpError, mapNetworkError } from "./errorMapper.js";

let currentCsrfToken = null;

export function setCsrfToken(token) {
  currentCsrfToken = token || null;
}

export function getCsrfToken() {
  return currentCsrfToken;
}

let unauthorizedListeners = [];

export function onUnauthorized(callback) {
  unauthorizedListeners.push(callback);
  return () => {
    unauthorizedListeners = unauthorizedListeners.filter((cb) => cb !== callback);
  };
}

function notifyUnauthorized(payload) {
  unauthorizedListeners.forEach((callback) => {
    try {
      callback(payload);
    } catch {
      // Ignorar errores de observadores
    }
  });
}

function buildUrl(path, params) {
  const url = new URL(`${env.API_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

async function parseBody(response) {
  if (response.status === 204) return null;
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) return response.json();
  const text = await response.text();
  if (text) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return null;
}

async function request(method, path, { body, params, headers: customHeaders, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });

  const upperMethod = method.toUpperCase();
  const headers = { ...(customHeaders || {}) };
  if (body !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(upperMethod);
  if (isMutating && currentCsrfToken && !headers["X-CSRF-Token"]) {
    headers["X-CSRF-Token"] = currentCsrfToken;
  }

  let response;
  try {
    response = await fetch(buildUrl(path, params), {
      method: upperMethod,
      credentials: "include",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    throw mapNetworkError(error);
  } finally {
    clearTimeout(timer);
  }

  const newCsrfHeader = response.headers.get("x-csrf-token") || response.headers.get("X-CSRF-Token");
  if (newCsrfHeader) {
    setCsrfToken(newCsrfHeader);
  }

  const payload = await parseBody(response).catch(() => null);

  if (payload && typeof payload === "object" && payload.csrf_token) {
    setCsrfToken(payload.csrf_token);
  }

  if (response.status === 401) {
    notifyUnauthorized(payload);
  }

  if (!response.ok) {
    throw mapHttpError(response.status, payload);
  }

  return payload;
}

export const http = {
  get: (path, options) => request("GET", path, options),
  post: (path, body, options) => request("POST", path, { ...options, body: body ?? {} }),
  put: (path, body, options) => request("PUT", path, { ...options, body }),
  patch: (path, body, options) => request("PATCH", path, { ...options, body }),
  del: (path, options) => request("DELETE", path, options),
};

export const httpClient = http;
