import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  http,
  httpClient,
  setCsrfToken,
  getCsrfToken,
  onUnauthorized,
} from "../src/core/http/index.js";

// 1. Verificar singleton y helpers CSRF
assert.equal(typeof setCsrfToken, "function", "setCsrfToken debe ser función");
assert.equal(typeof getCsrfToken, "function", "getCsrfToken debe ser función");
assert.equal(typeof onUnauthorized, "function", "onUnauthorized debe ser función");
assert.equal(http, httpClient, "httpClient debe ser alias idéntico de http");

setCsrfToken(null);
assert.equal(getCsrfToken(), null, "CSRF token inicial debe ser null");
setCsrfToken("csrf-token-abc");
assert.equal(getCsrfToken(), "csrf-token-abc", "getCsrfToken debe reflejar el valor establecido");

// 2. Mock de fetch para verificar credentials: "include" y X-CSRF-Token en mutaciones
const originalFetch = globalThis.fetch;
let capturedCalls = [];

function mockFetch(status, headers = {}, body = {}) {
  return async (url, options) => {
    capturedCalls.push({ url, options });
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: {
        get: (h) => headers[h.toLowerCase()] || headers[h] || null,
      },
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };
}

try {
  // Test GET no envía X-CSRF-Token pero sí credentials: "include"
  capturedCalls = [];
  globalThis.fetch = mockFetch(200, {}, { ok: true });
  await http.get("/api/test-get");
  assert.equal(capturedCalls.length, 1);
  assert.equal(capturedCalls[0].options.credentials, "include", "GET debe incluir credentials");
  assert.equal(capturedCalls[0].options.headers["X-CSRF-Token"], undefined, "GET no debe enviar X-CSRF-Token");

  // Test POST mutante envía X-CSRF-Token y credentials: "include"
  capturedCalls = [];
  globalThis.fetch = mockFetch(200, {}, { ok: true });
  await http.post("/api/test-post", { foo: "bar" });
  assert.equal(capturedCalls.length, 1);
  assert.equal(capturedCalls[0].options.credentials, "include", "POST debe incluir credentials");
  assert.equal(capturedCalls[0].options.headers["X-CSRF-Token"], "csrf-token-abc", "POST debe incluir X-CSRF-Token");
  assert.equal(capturedCalls[0].options.headers["Content-Type"], "application/json");

  // Test PUT mutante envía X-CSRF-Token
  capturedCalls = [];
  await http.put("/api/test-put", { id: 1 });
  assert.equal(capturedCalls[0].options.headers["X-CSRF-Token"], "csrf-token-abc", "PUT debe incluir X-CSRF-Token");

  // Test PATCH mutante envía X-CSRF-Token
  capturedCalls = [];
  await http.patch("/api/test-patch", { id: 1 });
  assert.equal(capturedCalls[0].options.headers["X-CSRF-Token"], "csrf-token-abc", "PATCH debe incluir X-CSRF-Token");

  // Test DELETE mutante envía X-CSRF-Token
  capturedCalls = [];
  await http.del("/api/test-del");
  assert.equal(capturedCalls[0].options.headers["X-CSRF-Token"], "csrf-token-abc", "DELETE debe incluir X-CSRF-Token");

  // Test actualización de CSRF token desde encabezado
  capturedCalls = [];
  globalThis.fetch = mockFetch(200, { "x-csrf-token": "nuevo-token-header" }, { ok: true });
  await http.get("/api/test-token-header");
  assert.equal(getCsrfToken(), "nuevo-token-header", "Debe actualizar CSRF token desde el encabezado x-csrf-token");

  // Test actualización de CSRF token desde payload JSON
  capturedCalls = [];
  globalThis.fetch = mockFetch(200, {}, { csrf_token: "nuevo-token-body" });
  await http.get("/api/test-token-body");
  assert.equal(getCsrfToken(), "nuevo-token-body", "Debe actualizar CSRF token desde propiedad csrf_token del cuerpo");

  // Test listener 401
  let unauthorizedNotified = false;
  let unauthorizedPayload = null;
  const unsubscribe = onUnauthorized((payload) => {
    unauthorizedNotified = true;
    unauthorizedPayload = payload;
  });

  globalThis.fetch = mockFetch(401, {}, { detail: "Sesion expirada" });
  try {
    await http.get("/api/test-unauthorized");
  } catch {
    // se espera rechazo HTTP 401
  }
  assert.equal(unauthorizedNotified, true, "onUnauthorized debe dispararse ante 401");
  assert.equal(unauthorizedPayload?.detail, "Sesion expirada");

  // Test unsubscribe
  unauthorizedNotified = false;
  unsubscribe();
  try {
    await http.get("/api/test-unauthorized-2");
  } catch {
    // se espera rechazo HTTP 401
  }
  assert.equal(unauthorizedNotified, false, "Listener desuscripto no debe volver a dispararse");
} finally {
  globalThis.fetch = originalFetch;
}

// 3. Verificación estática de AuthProvider, ProtectedRoute, LoginPage y router
const authProviderSrc = readFileSync(new URL("../src/app/auth/AuthProvider.jsx", import.meta.url), "utf8");
assert.match(authProviderSrc, /export function AuthProvider/, "AuthProvider debe exportar el componente AuthProvider");
assert.match(authProviderSrc, /export function useAuth/, "AuthProvider debe exportar hook useAuth");
assert.match(authProviderSrc, /\/api\/seguridad\/me/, "AuthProvider debe consultar /api/seguridad/me al montar");
assert.match(authProviderSrc, /\/api\/seguridad\/login/, "AuthProvider debe consumir /api/seguridad/login");
assert.match(authProviderSrc, /\/api\/seguridad\/logout/, "AuthProvider debe consumir /api/seguridad/logout");

const protectedRouteSrc = readFileSync(new URL("../src/app/auth/ProtectedRoute.jsx", import.meta.url), "utf8");
assert.match(protectedRouteSrc, /export function ProtectedRoute/, "ProtectedRoute debe exportarse");
assert.match(protectedRouteSrc, /requiredRole/, "ProtectedRoute debe contemplar requiredRole");
assert.match(protectedRouteSrc, /to="\/login"/, "ProtectedRoute debe redirigir a /login");
assert.match(protectedRouteSrc, /stocky-loading-screen/, "ProtectedRoute debe mostrar pantalla de carga");

const loginPageSrc = readFileSync(new URL("../src/app/auth/LoginPage.jsx", import.meta.url), "utf8");
assert.match(loginPageSrc, /useAuth\(\)/, "LoginPage debe usar useAuth()");
assert.match(loginPageSrc, /await login\(/, "LoginPage debe invocar login() en handleSubmit");

const appSrc = readFileSync(new URL("../src/app/App.jsx", import.meta.url), "utf8");
assert.match(appSrc, /<AuthProvider>/, "App.jsx debe envolver con AuthProvider");

const routerSrc = readFileSync(new URL("../src/app/router.jsx", import.meta.url), "utf8");
assert.match(routerSrc, /<ProtectedRoute requiredRole="OPERADOR">/, "router.jsx debe proteger /operador");
assert.match(routerSrc, /ProtectedRoute requiredRole="ADMIN"/, "router.jsx debe proteger el layout de administracion");

console.log("Autenticación y protección CSRF validadas exitosamente.");
