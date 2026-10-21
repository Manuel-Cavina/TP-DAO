import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../shared/components/Button";
import { FormField, TextInput } from "../../../shared/components/FormControls";
import { Select } from "../../../shared/components/Select";
import { StatusBadge } from "../../../shared/components/Badge";
import { useSede } from "../../../app/providers/SedeProvider";
import { useUbicaciones } from "../../ubicaciones_stock/hooks/useUbicaciones";
import { useNecesidades } from "../hooks/useNecesidades";
import { useProductos } from "../../catalogo/hooks/useProductos";
import { logisticaService } from "../services";

const STEPS = [
  { key: "items", label: "1. Necesidades y destino", desc: "Sucursal y renglones" },
  { key: "origen", label: "2. Centro de distribución", desc: "CD abastecedor" },
  { key: "revision", label: "3. Revisión y confirmación", desc: "Impacto operativo" },
];

export function CrearOrdenPage() {
  const navigate = useNavigate();
  const { sedeId } = useSede();
  const { ubicaciones } = useUbicaciones();
  const { necesidades, loading: loadingNec } = useNecesidades();
  const { productos } = useProductos({ activos: true });

  const [currentStep, setCurrentStep] = useState(0);
  const [destinoId, setDestinoId] = useState("");
  const [origenId, setOrigenId] = useState("");
  const [selectedNecIds, setSelectedNecIds] = useState(new Set());
  const [manualItems, setManualItems] = useState([]);
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
      .filter((producto) => !query || producto.codigo.toLowerCase().includes(query) || producto.nombre.toLowerCase().includes(query))
      .map((producto) => ({ value: String(producto.id), label: `${producto.codigo} · ${producto.nombre}` }));
  }, [productos, productoSearch]);

  // Inicializar destino y origen por defecto
  const effectiveDestinoId = destinoId || (locales[0] ? String(locales[0].id) : "");
  const effectiveOrigenId = origenId || (centrosDistribucion[0] ? String(centrosDistribucion[0].id) : (sedeId ? String(sedeId) : ""));

  // Necesidades pendientes del destino seleccionado
  const pendingForDestino = useMemo(() => {
    const dId = Number(effectiveDestinoId);
    if (!dId) return [];
    return necesidades.filter((n) => n.localId === dId && n.estado === "PENDIENTE");
  }, [necesidades, effectiveDestinoId]);

  // Manejo de seleccion de necesidades
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

  // Total items consolidados para revision
  const consolidatedItems = useMemo(() => {
    const map = new Map();
    // Sumar necesidades seleccionadas
    for (const nec of pendingForDestino) {
      if (selectedNecIds.has(nec.id)) {
        const cur = map.get(nec.productoId) || 0;
        map.set(nec.productoId, cur + nec.cantidad);
      }
    }
    // Sumar items manuales
    for (const it of manualItems) {
      const cur = map.get(it.productoId) || 0;
      map.set(it.productoId, cur + it.cantidad);
    }
    return Array.from(map.entries()).map(([productoId, cantidad]) => ({
      productoId,
      cantidad,
    }));
  }, [pendingForDestino, selectedNecIds, manualItems]);

  const canProceedStep1 = consolidatedItems.length > 0;
  const canProceedStep2 = Boolean(effectiveOrigenId);

  const handleConfirmOrder = async () => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      let createdOrder;
      const necIdsArray = Array.from(selectedNecIds);

      // Si consolida necesidades y no tiene items manuales adicionales
      if (necIdsArray.length > 0 && manualItems.length === 0) {
        createdOrder = await logisticaService.consolidarOrden({
          localDestinoId: Number(effectiveDestinoId),
          origenId: Number(effectiveOrigenId),
          necesidadIds: necIdsArray,
        });
      } else {
        // Carga manual o mixta
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

      {/* Stepper visual */}
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
        <div className="p-3 rounded bg-danger-subtle text-danger text-sm">
          {errorMessage}
        </div>
      )}

      {/* PASO 1: Destino y Necesidades */}
      {currentStep === 0 && (
        <div className="card p-5 stack gap-4">
          <div>
            <h2 className="text-lg">Paso 1: Destino y necesidades de reposición</h2>
            <p className="text-sm text-secondary">
              Seleccione la sucursal destino. De acuerdo a las reglas del sistema, una orden
              de reposición no puede combinar necesidades de distintas sucursales.
            </p>
          </div>

          <FormField label="Sucursal destino (Local comercial)" required>
            <Select
              options={locales.map((l) => ({ value: String(l.id), label: `${l.nombre} (ID #${l.id})` }))}
              value={effectiveDestinoId}
              onChange={(val) => {
                setDestinoId(val);
                setSelectedNecIds(new Set());
              }}
              placeholder="Seleccionar sucursal destino"
            />
          </FormField>

          <div className="stack gap-2">
            <div className="row justify-between align-center">
              <span className="text-sm font-medium">
                Necesidades pendientes detectadas para esta sucursal ({pendingForDestino.length})
              </span>
              {pendingForDestino.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleSelectAllNec}>
                  {selectedNecIds.size === pendingForDestino.length ? "Deseleccionar todas" : "Seleccionar todas"}
                </Button>
              )}
            </div>

            {loadingNec ? (
              <p className="text-sm text-muted">Cargando necesidades pendientes...</p>
            ) : pendingForDestino.length === 0 ? (
              <div className="p-4 rounded bg-surface-muted text-sm text-secondary">
                No hay necesidades automáticas pendientes para {ubicMap.get(Number(effectiveDestinoId)) || "esta sucursal"}.
                Puede ingresar artículos manualmente debajo.
              </div>
            ) : (
              <div className="stack gap-2">
                {pendingForDestino.map((nec) => {
                  const checked = selectedNecIds.has(nec.id);
                  return (
                    <div
                      key={nec.id}
                      className={`row justify-between align-center p-3 rounded border cursor-pointer ${
                        checked ? "border-primary bg-primary-subtle" : "bg-surface"
                      }`}
                      onClick={() => handleToggleNec(nec.id)}
                    >
                      <div className="row gap-3 align-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => handleToggleNec(nec.id)}
                          aria-label={`Seleccionar necesidad ${nec.id}`}
                        />
                        <div>
                          <span className="font-mono text-sm">Necesidad #{nec.id}</span>
                          <span className="text-sm text-secondary ml-2">
                            {productoMap.get(nec.productoId)?.codigo || `Producto #${nec.productoId}`} · {productoMap.get(nec.productoId)?.nombre || "Sin detalle"}
                          </span>
                        </div>
                      </div>
                      <div className="row gap-3 align-center">
                        <span className="tabular-nums text-sm font-medium">{nec.cantidad} unidades</span>
                        <StatusBadge status={nec.estado} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Carga manual de renglones si se desea agregar */}
          <div className="stack gap-2 pt-2 border-t">
            <span className="text-sm font-medium">Agregar renglón manual adicional</span>
            <div className="grid-2 gap-3">
              <TextInput
                label="Buscar producto"
                value={productoSearch}
                onChange={(e) => setProductoSearch(e.target.value)}
                placeholder="SKU o nombre comercial"
              />
              <FormField label="Producto a agregar">
                <Select
                  options={productOptions}
                  value={newProdId}
                  onChange={setNewProdId}
                  placeholder="Seleccionar producto"
                />
              </FormField>
            </div>
            <div className="row gap-2 wrap align-end">
              <div className="w-32">
                <FormField label="Cantidad">
                  <TextInput
                    type="number"
                    value={newCantidad}
                    onChange={(e) => setNewCantidad(e.target.value)}
                    placeholder="10"
                    min="1"
                  />
                </FormField>
              </div>
              <Button variant="secondary" onClick={handleAddManualItem}>
                Agregar renglón
              </Button>
            </div>
            {manualError && <span className="text-xs text-danger">{manualError}</span>}

            {manualItems.length > 0 && (
              <div className="stack gap-1 pt-2">
                <span className="text-xs text-muted">Renglones manuales cargados:</span>
                {manualItems.map((it) => (
                  <div key={it.productoId} className="row justify-between align-center p-2 rounded bg-surface-muted text-sm">
                    <span>{productoMap.get(it.productoId)?.codigo || `Producto #${it.productoId}`} · {productoMap.get(it.productoId)?.nombre || "Sin detalle"} · {it.cantidad} unidades</span>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveManualItem(it.productoId)}>
                      Quitar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="row justify-end pt-4 border-t">
            <Button
              variant="primary"
              disabled={!canProceedStep1}
              onClick={() => setCurrentStep(1)}
              iconRight="arrow-right"
            >
              Continuar a selección de origen ({consolidatedItems.length} ítems)
            </Button>
          </div>
        </div>
      )}

      {/* PASO 2: Centro de Distribución Origen */}
      {currentStep === 1 && (
        <div className="card p-5 stack gap-4">
          <div>
            <h2 className="text-lg">Paso 2: Centro de distribución origen</h2>
            <p className="text-sm text-secondary">
              Indique el Centro de Distribución desde el cual se abastecerán los artículos de la orden.
            </p>
          </div>

          <div className="p-3 rounded bg-surface-muted row justify-between align-center">
            <span className="text-sm text-muted">Destino seleccionado:</span>
            <span className="text-sm font-medium">
              {ubicMap.get(Number(effectiveDestinoId)) || `Local #${effectiveDestinoId}`}
            </span>
          </div>

          <FormField label="Centro de distribución abastecedor" required>
            <Select
              options={centrosDistribucion.map((cd) => ({
                value: String(cd.id),
                label: `${cd.nombre} (ID #${cd.id})`,
              }))}
              value={effectiveOrigenId}
              onChange={setOrigenId}
              placeholder="Seleccionar CD origen"
            />
          </FormField>

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

      {/* PASO 3: Revisión y Confirmación */}
      {currentStep === 2 && (
        <div className="card p-5 stack gap-4">
          <div>
            <h2 className="text-lg">Paso 3: Revisión y confirmación de la orden</h2>
            <p className="text-sm text-secondary">
              Verifique el impacto operativo y las cantidades antes de emitir la orden formal.
            </p>
          </div>

          <div className="grid-2 gap-3">
            <div className="p-3 rounded bg-surface-muted stack gap-1">
              <span className="text-xs text-muted">Origen (Centro de distribución)</span>
              <span className="text-sm font-medium">
                {ubicMap.get(Number(effectiveOrigenId)) || `CD #${effectiveOrigenId}`}
              </span>
            </div>
            <div className="p-3 rounded bg-surface-muted stack gap-1">
              <span className="text-xs text-muted">Destino (Local comercial)</span>
              <span className="text-sm font-medium">
                {ubicMap.get(Number(effectiveDestinoId)) || `Local #${effectiveDestinoId}`}
              </span>
            </div>
          </div>

          <div className="stack gap-2">
            <span className="text-sm font-medium">Renglones a incluir en la orden</span>
            <div className="stack gap-2">
              {consolidatedItems.map((it) => (
                <div key={it.productoId} className="row justify-between align-center p-3 rounded bg-surface border text-sm">
                  <span className="font-mono">Producto #{it.productoId}</span>
                  <span className="tabular-nums font-medium">{it.cantidad} unidades</span>
                </div>
              ))}
            </div>
          </div>

          <div className="erp-callout">
            <span className="text-sm text-secondary">
              Impacto operativo: Al confirmar, se creará la orden de reposición formal en estado
              PENDIENTE. Las necesidades consolidadas quedarán marcadas como atendidas y podrá
              proceder al empaquetado, precintado de bultos y emisión de remito.
            </span>
          </div>

          <div className="row justify-between pt-4 border-t">
            <Button variant="ghost" onClick={() => setCurrentStep(1)} disabled={submitting} iconLeft="arrow-left">
              Modificar origen
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmOrder}
              loading={submitting}
              loadingLabel="Generando orden formal..."
            >
              Confirmar y crear orden de reposición
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CrearOrdenPage;
