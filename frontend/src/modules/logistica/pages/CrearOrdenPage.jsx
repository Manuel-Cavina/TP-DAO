import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "../../../shared/components/Button";
import { FormField } from "../../../shared/components/FormControls";
import { Select } from "../../../shared/components/Select";
import { Alert } from "../../../shared/components/Feedback";
import { useSede } from "../../../app/providers/SedeProvider";
import { useUbicaciones } from "../../ubicaciones_stock/hooks/useUbicaciones";
import { useNecesidades } from "../hooks/useNecesidades";
import { useProductos } from "../../catalogo/hooks/useProductos";
import { logisticaService } from "../services";
import { CrearOrdenPaso1 } from "../components/CrearOrdenPaso1";

const STEPS = [
  { key: "items", label: "1. Necesidades y destino", desc: "Sucursal y renglones" },
  { key: "origen", label: "2. Centro de distribución", desc: "CD abastecedor activo" },
  { key: "revision", label: "3. Revisión y confirmación", desc: "Impacto operativo y stock" },
];

export function CrearOrdenPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sedeId } = useSede();
  const { ubicaciones, loading: loadingUbic } = useUbicaciones();
  const { necesidades, loading: loadingNec } = useNecesidades();
  const { productos, loading: loadingProd } = useProductos({ activos: true });

  // Preselección desde navegación (T035 -> T036)
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const preselectedDestinoId = location.state?.destinoId || searchParams.get("destinoId") || "";
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
  const preselectedItems = useMemo(
    () => Array.isArray(location.state?.preselectedItems) ? location.state.preselectedItems : [],
    [location.state]
  );

  const [currentStep, setCurrentStep] = useState(0);
  const [destinoId, setDestinoId] = useState(preselectedDestinoId);
  const [origenId, setOrigenId] = useState("");
  const [selectedNecIds, setSelectedNecIds] = useState(preselectedNecIds);
  const [manualItems, setManualItems] = useState(preselectedItems);
  const [newProdId, setNewProdId] = useState("");
  const [newCantidad, setNewCantidad] = useState("");
  const [productoSearch, setProductoSearch] = useState("");
  const [manualError, setManualError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

  const productOptions = useMemo(() => {
    const query = productoSearch.trim().toLowerCase();
    return productos
      .filter((p) => !query || p.codigo.toLowerCase().includes(query) || p.nombre.toLowerCase().includes(query))
      .map((p) => ({ value: String(p.id), label: `${p.codigo} · ${p.nombre}` }));
  }, [productos, productoSearch]);

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

  useEffect(() => {
    if (preselectedNecIds.size > 0 && selectedNecIds.size === 0) {
      setSelectedNecIds(new Set(preselectedNecIds));
    }
  }, [preselectedNecIds]);

  useEffect(() => {
    if (preselectedItems.length > 0) setManualItems(preselectedItems);
  }, [preselectedItems]);

  useEffect(() => {
    if (!newProdId && productOptions.length > 0) setNewProdId(productOptions[0].value);
  }, [newProdId, productOptions]);

  const handleToggleNec = (id) => {
    setSelectedNecIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllNec = () => {
    if (selectedNecIds.size === pendingForDestino.length) {
      setSelectedNecIds(new Set());
    } else {
      setSelectedNecIds(new Set(pendingForDestino.map((n) => n.id)));
    }
  };

  const handleAddManualItem = (e) => {
    e.preventDefault();
    const pid = Number(newProdId);
    const cant = Number(newCantidad);
    if (!pid || !Number.isInteger(cant) || cant <= 0) {
      setManualError("Seleccione un producto y una cantidad entera mayor a cero.");
      return;
    }

    setManualItems((prev) => {
      const exists = prev.find((it) => it.productoId === pid);
      if (exists) {
        return prev.map((it) =>
          it.productoId === pid ? { ...it, cantidad: it.cantidad + cant } : it
        );
      }
      return [...prev, { productoId: pid, cantidad: cant }];
    });
    setNewProdId("");
    setNewCantidad("");
    setManualError("");
  };

  const handleRemoveManualItem = (pid) => {
    setManualItems((prev) => prev.filter((it) => it.productoId !== pid));
  };

  const consolidatedItems = useMemo(() => {
    const map = new Map();
    for (const nec of pendingForDestino) {
      if (selectedNecIds.has(nec.id)) {
        const cur = map.get(nec.productoId) || { cantidad: 0, origenNec: [] };
        map.set(nec.productoId, {
          cantidad: cur.cantidad + nec.cantidad,
          origenNec: [...cur.origenNec, nec.id],
        });
      }
    }
    for (const it of manualItems) {
      const cur = map.get(it.productoId) || { cantidad: 0, origenNec: [] };
      map.set(it.productoId, {
        cantidad: cur.cantidad + it.cantidad,
        origenNec: cur.origenNec,
        esManual: true,
      });
    }
    return Array.from(map.entries()).map(([productoId, data]) => ({
      productoId,
      cantidad: data.cantidad,
      origenNec: data.origenNec,
      esManual: data.esManual,
    }));
  }, [pendingForDestino, selectedNecIds, manualItems]);

  const totalUnidades = useMemo(
    () => consolidatedItems.reduce((acc, it) => acc + it.cantidad, 0),
    [consolidatedItems]
  );

  const canProceedStep1 = consolidatedItems.length > 0 && Boolean(effectiveDestinoId);
  const selectedCdObj = centrosDistribucion.find((cd) => String(cd.id) === String(effectiveOrigenId));
  const isOrigenCdValido = Boolean(selectedCdObj && selectedCdObj.activo && selectedCdObj.tipo === "CD");
  const canProceedStep2 = isOrigenCdValido;

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
        });
      }

      if (createdOrder?.id) {
        navigate(`/logistica/ordenes/${createdOrder.id}`);
      } else {
        navigate("/logistica/ordenes");
      }
    } catch (err) {
      setErrorMessage(err.message || "Error al crear la orden de reposición.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUbic || loadingProd) {
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
          <h1 className="text-xl">Crear orden de reposición en 3 pasos</h1>
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
          effectiveDestinoId={effectiveDestinoId}
          onDestinoChange={(val) => {
            setDestinoId(val);
            setSelectedNecIds(new Set());
          }}
          ubicMap={ubicMap}
          productoMap={productoMap}
          pendingForDestino={pendingForDestino}
          selectedNecIds={selectedNecIds}
          onToggleNec={handleToggleNec}
          onSelectAllNec={handleSelectAllNec}
          loadingNec={loadingNec}
          productOptions={productOptions}
          productoSearch={productoSearch}
          onProductoSearchChange={setProductoSearch}
          newProdId={newProdId}
          onNewProdIdChange={setNewProdId}
          newCantidad={newCantidad}
          onNewCantidadChange={setNewCantidad}
          onAddManualItem={handleAddManualItem}
          manualError={manualError}
          manualItems={manualItems}
          onRemoveManualItem={handleRemoveManualItem}
          consolidatedItems={consolidatedItems}
          totalUnidades={totalUnidades}
          canProceedStep1={canProceedStep1}
          onProceed={() => setCurrentStep(1)}
        />
      )}

      {currentStep === 1 && (
        <div className="card p-5 stack gap-4">
          <div>
            <h2 className="text-lg">Paso 2: Centro de distribución origen</h2>
            <p className="text-sm text-secondary">
              Indique el Centro de Distribución activo desde el cual se abastecerán los renglones de la orden (FR-020).
            </p>
          </div>

          <div className="p-3 rounded bg-surface-muted row justify-between align-center">
            <span className="text-sm text-muted">Destino seleccionado:</span>
            <span className="text-sm font-medium">
              {ubicMap.get(Number(effectiveDestinoId)) || `Local #${effectiveDestinoId}`} (Local comercial)
            </span>
          </div>

          <FormField
            label="Centro de distribución abastecedor (Activo)"
            required
            error={!isOrigenCdValido ? "Debe seleccionar un Centro de Distribución activo." : undefined}
          >
            <Select
              options={centrosDistribucion.map((cd) => ({
                value: String(cd.id),
                label: `${cd.nombre} (ID #${cd.id} · CD Activo)`,
              }))}
              value={effectiveOrigenId}
              onChange={setOrigenId}
              placeholder="Seleccionar CD origen"
            />
          </FormField>

          {selectedCdObj && (
            <div className="p-3 rounded border bg-surface stack gap-1">
              <span className="text-xs text-muted">Detalles del CD abastecedor:</span>
              <span className="text-sm font-medium">{selectedCdObj.nombre}</span>
              <span className="text-xs text-secondary">Tipo: Centro de Distribución · Estado: Operativo</span>
            </div>
          )}

          <div className="erp-callout">
            <span className="text-xs text-secondary">
              Validación de red: Cualquier Centro de Distribución activo puede abastecer cualquier sucursal comercial,
              sujeto a la disponibilidad de stock en el origen seleccionado.
            </span>
          </div>

          <div className="row justify-between pt-4 border-t">
            <Button variant="ghost" onClick={() => setCurrentStep(0)} iconLeft="arrow-left">
              Volver al paso 1
            </Button>
            <Button
              variant="primary"
              disabled={!canProceedStep2}
              onClick={() => setCurrentStep(2)}
              iconRight="arrow-right"
            >
              Continuar a revisión final
            </Button>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="card p-5 stack gap-4">
          <div>
            <h2 className="text-lg">Paso 3: Revisión y confirmación de la orden</h2>
            <p className="text-sm text-secondary">
              Verifique el itinerario de la ruta, la tabla de renglones y el impacto en stock antes de emitir la orden formal.
            </p>
          </div>

          <div className="grid-2 gap-3">
            <div className="p-3 rounded bg-surface-muted stack gap-1">
              <span className="text-xs text-muted">Origen (Centro de distribución)</span>
              <span className="text-sm font-medium">
                {ubicMap.get(Number(effectiveOrigenId)) || `CD #${effectiveOrigenId}`}
              </span>
              <span className="text-xs text-secondary">CD activo emisor</span>
            </div>
            <div className="p-3 rounded bg-surface-muted stack gap-1">
              <span className="text-xs text-muted">Destino (Local comercial)</span>
              <span className="text-sm font-medium">
                {ubicMap.get(Number(effectiveDestinoId)) || `Local #${effectiveDestinoId}`}
              </span>
              <span className="text-xs text-secondary">Sucursal receptora única</span>
            </div>
          </div>

          <div className="stack gap-2">
            <div className="row justify-between align-center">
              <span className="text-sm font-medium">Renglones a incluir en la orden</span>
              <span className="text-xs text-secondary">
                {consolidatedItems.length} producto(s) · {totalUnidades} unidades totales
              </span>
            </div>
            <div className="stack gap-2">
              {consolidatedItems.map((it) => {
                const prod = productoMap.get(it.productoId);
                return (
                  <div key={it.productoId} className="row justify-between align-center p-3 rounded bg-surface border text-sm">
                    <div>
                      <span className="font-mono text-xs text-secondary">{prod?.codigo || `SKU-${it.productoId}`}</span>
                      <div className="font-medium">{prod?.nombre || `Producto #${it.productoId}`}</div>
                      <span className="text-xs text-muted">
                        {it.origenNec?.length > 0
                          ? `Consolida necesidad(es) #${it.origenNec.join(", #")}`
                          : "Carga manual"}
                      </span>
                    </div>
                    <div className="stack align-end gap-0">
                      <span className="tabular-nums font-medium">{it.cantidad} unidades</span>
                      <span className="text-xs text-secondary">Reserva en CD</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="erp-callout stack gap-1">
            <span className="text-sm font-medium">Impacto operativo y en stock (Reglas V1 y V2)</span>
            <p className="text-xs text-secondary">
              · Se emitirá la Orden de Reposición en estado <strong>PENDIENTE</strong> vinculada al CD origen y al Local destino.
            </p>
            <p className="text-xs text-secondary">
              · Las necesidades seleccionadas quedarán marcadas como atendidas y vinculadas a esta orden.
            </p>
            <p className="text-xs text-secondary">
              · En origen (CD), la mercadería queda reservada para empaquetado y precintado de bultos.
            </p>
            <p className="text-xs text-secondary">
              · En destino (Local), la mercadería <strong>NO</strong> suma al stock disponible hasta que los bultos sean recibidos y verificados con precinto intacto.
            </p>
          </div>

          <div className="row justify-between pt-4 border-t align-center">
            <Button variant="ghost" onClick={() => setCurrentStep(1)} disabled={submitting} iconLeft="arrow-left">
              Modificar origen
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmOrder}
              loading={submitting}
              loadingLabel="Creando orden..."
            >
              Crear orden de reposición
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CrearOrdenPage;
