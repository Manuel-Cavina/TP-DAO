import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { http } from "../../core/http";
import { DEFAULT_LOCATIONS } from "../../shared/components/AppShell";
import { useAuth } from "../auth/AuthProvider";

const STORAGE_KEY = "stocky.sede";
const SedeContext = createContext(null);

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const num = Number(raw);
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}

function mapUbicacionToOption(u) {
  const isCD = u.tipo === "CD";
  const numId = Number(u.id);
  return {
    value: numId,
    id: numId,
    label: isCD ? `${u.nombre} (Casa Matriz)` : `${u.nombre} (Minorista)`,
    scope: isCD ? "CD" : "Local",
    tipo: u.tipo,
    icon: isCD ? "warehouse" : "store",
    direccion: u.direccion,
    telefono: u.telefono || "",
    activo: Boolean(u.activo),
    description: isCD
      ? "Habilita compras a proveedor y despacho mayorista"
      : "Habilita facturación POS y recepción de bultos",
  };
}

export function SedeProvider({ children }) {
  const { user } = useAuth();
  const [sedes, setSedes] = useState(DEFAULT_LOCATIONS);
  const [sedeId, setSedeIdState] = useState(() => readStored());

  const reloadSedes = useCallback(async () => {
    if (!user) { setSedes([]); setSedeIdState(null); return; }
    try {
      let resp;
      try {
        resp = await http.get("/api/ubicaciones", { params: { solo_activas: true } });
      } catch {
        resp = await http.get("/api/stock/ubicaciones", { params: { activas: true } });
      }
      const items = Array.isArray(resp) ? resp : resp?.data || [];
      {
        const mapped = items.map(mapUbicacionToOption);
        setSedes(mapped);
        setSedeIdState((curr) => {
          if (mapped.some((s) => s.value === curr)) return curr;
          const stored = readStored();
          if (stored && mapped.some((s) => s.value === stored)) return stored;
          return mapped[0]?.value ?? null;
        });
      }
    } catch {
      setSedes([]);
      setSedeIdState(null);
    }
  }, [user]);

  useEffect(() => {
    reloadSedes();
  }, [reloadSedes]);

  const setSedeId = useCallback((id) => {
    const numId = Number(id) || id;
    setSedeIdState(numId);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(numId));
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  const currentSede = useMemo(() => {
    return sedes.find((s) => s.value === sedeId || String(s.value) === String(sedeId)) || sedes[0];
  }, [sedes, sedeId]);

  const value = useMemo(
    () => ({
      sedes,
      sedeId,
      sede: currentSede,
      setSedeId,
      reloadSedes,
    }),
    [sedes, sedeId, currentSede, setSedeId, reloadSedes]
  );

  return <SedeContext.Provider value={value}>{children}</SedeContext.Provider>;
}

export function useSede() {
  const ctx = useContext(SedeContext);
  if (!ctx) throw new Error("useSede debe usarse dentro de SedeProvider");
  return ctx;
}
