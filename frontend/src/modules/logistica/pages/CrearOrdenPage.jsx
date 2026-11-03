import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Alert } from "../../../shared/components/Feedback";
import { useSede } from "../../../app/providers/SedeProvider";
import { useUbicaciones } from "../../ubicaciones_stock/hooks/useUbicaciones";
import { useNecesidades } from "../hooks/useNecesidades";
import { useProductos } from "../../catalogo/hooks/useProductos";
import { useCategorias } from "../../catalogo/hooks/useCategorias";
import { stockService } from "../../ubicaciones_stock/services/stockService";
import { useToast } from "../../../shared/feedback/ToastContext";
import { logisticaService } from "../services";
import { CrearOrdenPaso1 } from "../components/CrearOrdenPaso1";
import { CrearOrdenPaso2 } from "../components/CrearOrdenPaso2";

const STEPS = [
  { key: "items", label: "1. Ruta y artículos", desc: "Origen, destino y carrito" },
  { key: "revision", label: "2. Revisión y confirmación", desc: "Impacto operativo y stock" },
];

export function CrearOrdenPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { notifySuccess, notifyError } = useToast();
  const { sedeId } = useSede();
  const { ubicaciones, loading: loadingUbic } = useUbicaciones();
  const { necesidades, loading: loadingNec } = useNecesidades();
  const { productos, loading: loadingProd } = useProductos({ activos: true });
  const { categorias, loading: loadingCat } = useCategorias();

  // Preselección desde navegación (T035 -> T036 / Alertas)
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const preselectedDestinoId = location.state?.destinoId || searchParams.get("destinoId") || "";
  const preselectedProdId = location.state?.productoId || searchParams.get("productoId") || "";
  const preselectedNecIds = useMemo(() => {
    if (location.state?.preselectedNecIds && Array.isArray(location.state.preselectedNecIds)) {
      return new Set(location.state.preselectedNecIds);
    }
    const qNec = searchParams.get("necesidades");
    if (qNec) {
      return new Set(qNec.split(",").map(Number).filter(Boolean));
    }
    return new Set();
  }, [location.state, searchParams]);

  const preselectedItems = useMemo(() => {
    if (Array.isArray(location.state?.preselectedItems)) {
      return location.state.preselectedItems;
    }
    if (preselectedProdId) {
      return [{ productoId: Number(preselectedProdId), cantidad: 1 }];
    }
    return [];
  }, [location.state, preselectedProdId]);

  const [currentStep, setCurrentStep] = useState(0);
  const [destinoId, setDestinoId] = useState(preselectedDestinoId);
  const [origenId, setOrigenId] = useState("");
  const [selectedNecIds, setSelectedNecIds] = useState(preselectedNecIds);
  const [manualItems, setManualItems] = useState(preselectedItems);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [stockDestinoMap, setStockDestinoMap] = useState(new Map());
  const [stockOrigenMap, setStockOrigenMap] = useState(new Map());
  const [loadingStock, setLoadingStock] = useState(false);

  const locales = useMemo(
    () => ubicaciones.filter((u) => u.tipo === "LOCAL" && u.activo),
    [ubicaciones]
  );
  const centrosDistribucion = useMemo(
    () => ubicaciones.filter((u) => u.tipo === "CD" && u.activo),
    [ubicaciones]
  );

  const ubicMap = useMemo(
    () => new Map(ubicaciones.map((u) => [u.id, u.nombre])),
    [ubicaciones]
  );
  const productoMap = useMemo(
    () => new Map(productos.map((producto) => [producto.id, producto])),
    [productos]
  );

  const effectiveDestinoId = destinoId || (locales[0] ? String(locales[0].id) : "");
  const effectiveOrigenId =
    origenId ||
    (centrosDistribucion.some((cd) => String(cd.id) === String(sedeId))
      ? String(sedeId)
      : centrosDistribucion[0]
      ? String(centrosDistribucion[0].id)
      : "");

  const pendingForDestino = useMemo(() => {
    const dId = Number(effectiveDestinoId);
    if (!dId) return [];
    return necesidades.filter((n) => n.localId === dId && n.estado === "PENDIENTE");
  }, [necesidades, effectiveDestinoId]);

  // Sincronización de inventario en origen y destino
  useEffect(() => {
    let active = true;
    async function fetchStocks() {
      if (!effectiveDestinoId && !effectiveOrigenId) return;
      setLoadingStock(true);
      try {
        const [destRes, origRes] = await Promise.all([
          effectiveDestinoId ? stockService.consultarPorUbicacion(Number(effectiveDestinoId)) : [],
          effectiveOrigenId ? stockService.consultarPorUbicacion(Number(effectiveOrigenId)) : [],
        ]);
        if (!active) return;
        const destList = Array.isArray(destRes) ? destRes : destRes?.data || [];
        const origList = Array.isArray(origRes) ? origRes : origRes?.data || [];

        const dMap = new Map();
        for (const item of destList) {
          dMap.set(item.producto_id, {
            disponible: Number(item.cantidad_disponible) || 0,
            enTransito: Number(item.cantidad_en_transito) || 0,
            nivelMinimo: Number(item.nivel_minimo_existencia) || 1,
          });
        }
        setStockDestinoMap(dMap);

        const oMap = new Map();
        for (const item of origList) {
          oMap.set(item.producto_id, {
            disponible: Number(item.cantidad_disponible) || 0,
            enTransito: Number(item.cantidad_en_transito) || 0,
            nivelMinimo: Number(item.nivel_minimo_existencia) || 1,
          });
        }
        setStockOrigenMap(oMap);
      } catch (err) {
        console.warn("Error cargando stocks para orden:", err);
      } finally {
        if (active) setLoadingStock(false);
      }
    }
    fetchStocks();
    return () => {
      active = false;
    };
  }, [effectiveDestinoId, effectiveOrigenId]);

  useEffect(() => {
    if (preselectedNecIds.size > 0 && selectedNecIds.size === 0) {
      setSelectedNecIds(new Set(preselectedNecIds));
    }
  }, [preselectedNecIds]);

  useEffect(() => {
    if (preselectedItems.length > 0 && manualItems.length === 0) {
      setManualItems(preselectedItems);
    }
  }, [preselectedItems]);

  const handleToggleNec = (id) => {
    const nec = pendingForDestino.find((n) => n.id === id);
    if (!nec) return;
    const cdStock = stockOrigenMap.get(nec.productoId)?.disponible || 0;
    // Regla estricta: No ingresar al carrito si no tiene stock en CD
    if (cdStock <= 0 && !selectedNecIds.has(id)) return;

    setSelectedNecIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllNec = () => {
    const availableNecs = pendingForDestino.filter(
      (n) => (stockOrigenMap.get(n.productoId)?.disponible || 0) > 0
    );
    if (selectedNecIds.size >= availableNecs.length && availableNecs.length > 0) {
      setSelectedNecIds(new Set());
    } else {
      setSelectedNecIds(new Set(availableNecs.map((n) => n.id)));
    }
  };

  const handleAddItem = (productoId, cantidad = 1) => {
    const pid = Number(productoId);
    const cant = Number(cantidad);
    const cdStock = stockOrigenMap.get(pid)?.disponible || 0;

    // Regla estricta: No ingresar al carrito si no tiene stock
    if (!pid || cant <= 0 || cdStock <= 0) return;

    const safeCant = Math.min(cant, cdStock);

    const matchingNec = pendingForDestino.find(
      (n) => n.productoId === pid && !selectedNecIds.has(n.id)
    );

    if (matchingNec) {
      setSelectedNecIds((prev) => new Set([...prev, matchingNec.id]));
      const diff = safeCant - matchingNec.cantidad;
      if (diff > 0) {
        setManualItems((prev) => {
          const exists = prev.find((it) => it.productoId === pid);
          if (exists) {
            return prev.map((it) => (it.productoId === pid ? { ...it, cantidad: Math.min(cdStock - matchingNec.cantidad, it.cantidad + diff) } : it));
          }
          return [...prev, { productoId: pid, cantidad: diff }];
        });
      }
    } else {
      setManualItems((prev) => {
        const exists = prev.find((it) => it.productoId === pid);
        if (exists) {
          return prev.map((it) => (it.productoId === pid ? { ...it, cantidad: Math.min(cdStock, it.cantidad + safeCant) } : it));
        }
        return [...prev, { productoId: pid, cantidad: safeCant }];
      });
    }
  };

  const handleUpdateQuantity = (productoId, nuevaCantidad) => {
    const pid = Number(productoId);
    const cdStock = stockOrigenMap.get(pid)?.disponible || 0;
    if (cdStock <= 0) {
      handleRemoveItem(pid);
      return;
    }

    const safeQty = Math.min(Number(nuevaCantidad), cdStock);
    if (safeQty <= 0) {
      handleRemoveItem(pid);
      return;
    }

    const matchingNecs = pendingForDestino.filter((n) => n.productoId === pid && selectedNecIds.has(n.id));
    const totalNecUnits = matchingNecs.reduce((sum, n) => sum + n.cantidad, 0);

    if (totalNecUnits > 0) {
      if (safeQty >= totalNecUnits) {
        const diff = safeQty - totalNecUnits;
        setManualItems((prev) => {
          const filtered = prev.filter((it) => it.productoId !== pid);
          return diff > 0 ? [...filtered, { productoId: pid, cantidad: diff }] : filtered;
        });
      } else {
        setSelectedNecIds((prev) => {
          const next = new Set(prev);
          matchingNecs.forEach((n) => next.delete(n.id));
          return next;
        });
        setManualItems((prev) => {
          const filtered = prev.filter((it) => it.productoId !== pid);
          return [...filtered, { productoId: pid, cantidad: safeQty }];
        });
      }
    } else {
      setManualItems((prev) => {
        const filtered = prev.filter((it) => it.productoId !== pid);
        return [...filtered, { productoId: pid, cantidad: safeQty }];
      });
    }
  };

  const handleRemoveItem = (productoId) => {
    const pid = Number(productoId);
    setManualItems((prev) => prev.filter((it) => it.productoId !== pid));
    setSelectedNecIds((prev) => {
      const next = new Set(prev);
      pendingForDestino.forEach((n) => {
        if (n.productoId === pid) next.delete(n.id);
      });
      return next;
    });
  };

  // Consolidación de renglones respetando estrictamente que ningún ítem exceda stock ni tenga 0 stock
  const consolidatedItems = useMemo(() => {
    const map = new Map();
    for (const nec of pendingForDestino) {
      if (selectedNecIds.has(nec.id)) {
        const cdStock = stockOrigenMap.get(nec.productoId)?.disponible || 0;
        if (cdStock > 0) {
          const cur = map.get(nec.productoId) || { cantidad: 0, origenNec: [] };
          const allowed = Math.min(nec.cantidad, cdStock - cur.cantidad);
          if (allowed > 0) {
            map.set(nec.productoId, {
              cantidad: cur.cantidad + allowed,
              origenNec: [...cur.origenNec, nec.id],
            });
          }
        }
      }
    }
    for (const it of manualItems) {
      const cdStock = stockOrigenMap.get(it.productoId)?.disponible || 0;
      if (cdStock > 0) {
        const cur = map.get(it.productoId) || { cantidad: 0, origenNec: [] };
        const remainingCd = cdStock - cur.cantidad;
        const allowed = Math.min(it.cantidad, Math.max(0, remainingCd));
        if (allowed > 0) {
          map.set(it.productoId, {
            cantidad: cur.cantidad + allowed,
            origenNec: cur.origenNec,
            esManual: true,
          });
        }
      }
    }
    return Array.from(map.entries()).map(([productoId, data]) => ({
      productoId,
      cantidad: data.cantidad,
      origenNec: data.origenNec,
      esManual: data.esManual,
    }));
  }, [pendingForDestino, selectedNecIds, manualItems, stockOrigenMap]);

  const totalUnidades = useMemo(
    () => consolidatedItems.reduce((acc, it) => acc + it.cantidad, 0),
    [consolidatedItems]
  );

  const selectedCdObj = centrosDistribucion.find((cd) => String(cd.id) === String(effectiveOrigenId));
  const isOrigenCdValido = Boolean(selectedCdObj && selectedCdObj.activo && selectedCdObj.tipo === "CD");

  const canProceedStep1 =
    consolidatedItems.length > 0 &&
    Boolean(effectiveDestinoId) &&
    isOrigenCdValido;

  const handleConfirmOrder = async () => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      let createdOrder;
      const necIdsArray = Array.from(selectedNecIds);

      if (necIdsArray.length > 0 && manualItems.length === 0) {
        createdOrder = await logisticaService.consolidarOrden({
          localDestinoId: Number(effectiveDestinoId),
          origenId: Number(effectiveOrigenId),
          necesidadIds: necIdsArray,
        });
      } else {
        createdOrder = await logisticaService.crearOrdenManual({
          origen_id: Number(effectiveOrigenId),
          destino_id: Number(effectiveDestinoId),
          items: consolidatedItems.map((it) => ({
            producto_id: it.productoId,
            cantidad: it.cantidad,
          })),
          necesidad_ids: necIdsArray.length > 0 ? necIdsArray : undefined,
        });
      }

      if (createdOrder?.id) {
        notifySuccess("Orden creada", `Orden de reposición #${createdOrder.id} creada exitosamente.`);
        navigate(`/logistica/ordenes/${createdOrder.id}`);
      } else {
        notifySuccess("Orden creada", "Orden de reposición creada exitosamente.");
        navigate("/logistica/ordenes");
      }
    } catch (err) {
      notifyError(err, { entity: "Orden", action: "crear orden de reposición" });
      setErrorMessage(err.message || "Error al crear la orden de reposición.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUbic || loadingProd || loadingCat) {
    return (
      <div className="p-8 text-center text-secondary">
        Cargando datos maestros para el asistente de órdenes...
      </div>
    );
  }

  return (
    <div className="stack gap-5">
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span className="cursor-pointer text-secondary" onClick={() => navigate("/logistica/ordenes")}>
              Distribución y órdenes
            </span>
            <span>·</span>
            <span>Nueva orden de reposición</span>
          </div>
          <h1 className="text-xl">Crear orden de reposición</h1>
        </div>
      </div>

      <div className="erp-stepper">
        {STEPS.map((s, idx) => {
          const isDone = idx < currentStep;
          const isCurrent = idx === currentStep;
          const stateClass = isCurrent ? "is-current" : isDone ? "is-done" : "";
          return (
            <div key={s.key} className={`erp-stepper__step ${stateClass}`.trim()}>
              <span className="erp-stepper__label">{s.label}</span>
              <span className="text-xs text-muted">{s.desc}</span>
            </div>
          );
        })}
      </div>

      {errorMessage && (
        <Alert
          tone="danger"
          title="No se pudo registrar la orden de reposición"
          description={errorMessage}
          onDismiss={() => setErrorMessage("")}
        />
      )}

      {currentStep === 0 && (
        <CrearOrdenPaso1
          locales={locales}
          centrosDistribucion={centrosDistribucion}
          effectiveDestinoId={effectiveDestinoId}
          onDestinoChange={(val) => {
            setDestinoId(val);
            setSelectedNecIds(new Set());
          }}
          effectiveOrigenId={effectiveOrigenId}
          onOrigenChange={setOrigenId}
          ubicMap={ubicMap}
          productoMap={productoMap}
          categorias={categorias}
          productos={productos}
          pendingForDestino={pendingForDestino}
          selectedNecIds={selectedNecIds}
          onToggleNec={handleToggleNec}
          onSelectAllNec={handleSelectAllNec}
          stockDestinoMap={stockDestinoMap}
          stockOrigenMap={stockOrigenMap}
          loadingStock={loadingStock}
          consolidatedItems={consolidatedItems}
          totalUnidades={totalUnidades}
          onAddItem={handleAddItem}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          canProceedStep1={canProceedStep1}
          onProceed={() => setCurrentStep(1)}
        />
      )}

      {currentStep === 1 && (
        <CrearOrdenPaso2
          effectiveDestinoId={effectiveDestinoId}
          effectiveOrigenId={effectiveOrigenId}
          ubicMap={ubicMap}
          ubicaciones={ubicaciones}
          productoMap={productoMap}
          consolidatedItems={consolidatedItems}
          totalUnidades={totalUnidades}
          stockDestinoMap={stockDestinoMap}
          stockOrigenMap={stockOrigenMap}
          submitting={submitting}
          onConfirmOrder={handleConfirmOrder}
          onBack={() => setCurrentStep(0)}
        />
      )}
    </div>
  );
}

export default CrearOrdenPage;
