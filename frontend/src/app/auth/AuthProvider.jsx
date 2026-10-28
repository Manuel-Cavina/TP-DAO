import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { http, onUnauthorized, setCsrfToken } from "../../core/http";

export const AuthContext = createContext(null);

function normalizeUser(rawUser) {
  if (!rawUser) return null;
  return {
    id: rawUser.id,
    displayName: rawUser.displayName || rawUser.name || rawUser.login,
    name: rawUser.name || rawUser.displayName || rawUser.login,
    login: rawUser.login,
    role: String(rawUser.role || "").toUpperCase(),
    activo: rawUser.activo !== undefined ? rawUser.activo : true,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [scope, setScope] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCurrent = true;

    async function restoreSession() {
      try {
        setIsLoading(true);
        const data = await http.get("/api/seguridad/me");
        if (!isCurrent) return;
        if (data?.user) {
          setUser(normalizeUser(data.user));
          setScope(data.scope || null);
          if (data.csrf_token) {
            setCsrfToken(data.csrf_token);
          }
        } else {
          setUser(null);
          setScope(null);
          setCsrfToken(null);
        }
      } catch {
        if (!isCurrent) return;
        setUser(null);
        setScope(null);
        setCsrfToken(null);
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    const unsubscribe = onUnauthorized(() => {
      if (isCurrent) {
        setUser(null);
        setScope(null);
        setCsrfToken(null);
      }
    });

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (loginIdentifier, password) => {
    setError(null);
    try {
      const data = await http.post("/api/seguridad/login", {
        login: String(loginIdentifier || "").trim(),
        password,
      });

      const normalized = normalizeUser(data.user);
      setUser(normalized);
      setScope(data.scope || null);
      if (data.csrf_token) {
        setCsrfToken(data.csrf_token);
      }
      return normalized;
    } catch (err) {
      const message = err?.message || "Error al iniciar sesión.";
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await http.post("/api/seguridad/logout");
    } catch {
      // Ignorar errores de red al cerrar sesión
    } finally {
      setUser(null);
      setScope(null);
      setError(null);
      setCsrfToken(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      scope,
      isAuthenticated: Boolean(user),
      isLoading,
      error,
      login,
      logout,
    }),
    [user, scope, isLoading, error, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
}

export default AuthProvider;
