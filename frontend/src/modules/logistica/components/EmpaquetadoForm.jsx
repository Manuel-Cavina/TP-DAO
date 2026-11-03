import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import { Button } from "../../../shared/components/Button";
import { FormField, TextInput } from "../../../shared/components/FormControls";
import { Select } from "../../../shared/components/Select";
import { Icon } from "../../../shared/components/Icon";

const PRESETS_CAPACIDAD = [
  { value: "10", label: "10 u. (Estándar)" },
  { value: "20", label: "20 u. (Mediana)" },
  { value: "50", label: "50 u. (Grande)" },
  { value: "custom", label: "Personalizada" },
  { value: "unlimited", label: "Sin límite" },
];

function MeterSegment({ item, idx, capacidadEfectiva, totalUnitsDraft }) {
  const segRef = useRef(null);
  const anchoPorc = capacidadEfectiva === Infinity
    ? (item.cantidad / Math.max(1, totalUnitsDraft)) * 100
    : (item.cantidad / capacidadEfectiva) * 100;

  useLayoutEffect(() => {
    if (segRef.current) segRef.current.style.setProperty("--pct", `${anchoPorc}%`);
  }, [anchoPorc]);

  return (
    <div
      ref={segRef}
      className={`erp-bulto-meter__segment erp-bulto-meter__segment--${idx % 5}`}
      title={`Producto #${item.productoId}: ${item.cantidad} u.`}
    />
  );
}

export function EmpaquetadoForm({
  itemsPendientes = [],
  onCrearBulto,
  onSubmit,
  loading = false,
  disabled = false,
  error = "",
  isPrimaryAction = true,
  onAvanzarAPrecintos,
}) {
  const [capacidadPreset, setCapacidadPreset] = useState("10");
  const [customCapacidad, setCustomCapacidad] = useState(10);
  const [draftItems, setDraftItems] = useState([]);
  const [selectedProdId, setSelectedProdId] = useState("");
  const [cantidadInput, setCantidadInput] = useState("");
  const [itemError, setItemError] = useState("");

  const totalSolicitadas = useMemo(() => itemsPendientes.reduce((s, it) => s + it.solicitado, 0), [itemsPendientes]);
  const totalEmpaquetadas = useMemo(() => itemsPendientes.reduce((s, it) => s + it.empaquetado, 0), [itemsPendientes]);
  const porcentajeOrden = totalSolicitadas > 0 ? Math.min(100, Math.round((totalEmpaquetadas / totalSolicitadas) * 100)) : 0;

  const progressBarRef = useRef(null);
  useLayoutEffect(() => {
    if (progressBarRef.current) progressBarRef.current.style.setProperty("--progress", `${porcentajeOrden}%`);
  }, [porcentajeOrden]);

  const articulosDisponiblesOrden = useMemo(() => itemsPendientes.filter((it) => it.restante > 0), [itemsPendientes]);
  const todosCompletos = itemsPendientes.length > 0 && articulosDisponiblesOrden.length === 0;

  const capacidadEfectiva = useMemo(() => {
    if (capacidadPreset === "unlimited") return Infinity;
    if (capacidadPreset === "custom") {
      const parsed = parseInt(customCapacidad, 10);
      return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }
    return parseInt(capacidadPreset, 10) || 10;
  }, [capacidadPreset, customCapacidad]);

  const totalUnidadesDraft = useMemo(() => draftItems.reduce((s, it) => s + it.cantidad, 0), [draftItems]);
  const espacioLibreBulto = useMemo(() => {
    if (capacidadEfectiva === Infinity) return Infinity;
    return Math.max(0, capacidadEfectiva - totalUnidadesDraft);
  }, [capacidadEfectiva, totalUnidadesDraft]);

  const porcentajeOcupacionBulto = useMemo(() => {
    if (capacidadEfectiva === Infinity) return 100;
    return Math.min(100, Math.round((totalUnidadesDraft / capacidadEfectiva) * 100));
  }, [capacidadEfectiva, totalUnidadesDraft]);

  const productosParaSeleccionar = useMemo(() => {
    return itemsPendientes
      .map((it) => {
        const itemEnDraft = draftItems.find((d) => d.productoId === it.productoId);
        const cantidadEnDraft = itemEnDraft ? itemEnDraft.cantidad : 0;
        return { ...it, disponibleParaBulto: Math.max(0, it.restante - cantidadEnDraft) };
      })
      .filter((it) => it.disponibleParaBulto > 0);
  }, [itemsPendientes, draftItems]);

  useEffect(() => {
    if (productosParaSeleccionar.length > 0) {
      if (!productosParaSeleccionar.some((p) => String(p.productoId) === String(selectedProdId))) {
        setSelectedProdId(String(productosParaSeleccionar[0].productoId));
        setCantidadInput("");
      }
    } else {
      setSelectedProdId("");
      setCantidadInput("");
    }
  }, [productosParaSeleccionar, selectedProdId]);

  const productoActual = useMemo(() => {
    return productosParaSeleccionar.find((p) => String(p.productoId) === String(selectedProdId)) || null;
  }, [productosParaSeleccionar, selectedProdId]);

  const maximoPermitido = useMemo(() => {
    if (!productoActual) return 0;
    if (capacidadEfectiva === Infinity) return productoActual.disponibleParaBulto;
    return Math.min(productoActual.disponibleParaBulto, espacioLibreBulto);
  }, [productoActual, capacidadEfectiva, espacioLibreBulto]);

  const handleUsarMaximo = () => {
    if (maximoPermitido > 0) {
      setCantidadInput(String(maximoPermitido));
      setItemError("");
    }
  };

  const handleCantidadChange = (e) => {
    setItemError("");
    const val = e.target.value;
    if (val === "") { setCantidadInput(""); return; }
    const num = parseInt(val, 10);
    if (Number.isNaN(num) || num < 1) { setCantidadInput(""); return; }
    if (num > maximoPermitido) {
      setCantidadInput(String(maximoPermitido));
      setItemError(`Tope máximo alcanzado: ${maximoPermitido} u. por capacidad o remanente.`);
    } else {
      setCantidadInput(String(num));
    }
  };

  const handleAgregarAlBulto = (e) => {
    e?.preventDefault();
    setItemError("");
    if (!productoActual) return setItemError("Selecciona un artículo disponible.");
    const cant = parseInt(cantidadInput, 10);
    if (!cant || cant <= 0) return setItemError("Ingresa una cantidad mayor a 0.");
    if (cant > maximoPermitido) return setItemError(`La cantidad supera el máximo permitido (${maximoPermitido} u.).`);

    setDraftItems((prev) => {
      const idx = prev.findIndex((d) => d.productoId === productoActual.productoId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], cantidad: next[idx].cantidad + cant };
        return next;
      }
      return [...prev, { productoId: productoActual.productoId, cantidad: cant, solicitado: productoActual.solicitado }];
    });
    setCantidadInput("");
  };

  const handleQuitarItem = (productoId) => {
    setDraftItems((prev) => prev.filter((d) => d.productoId !== productoId));
    setItemError("");
  };

  const handleAjustarCantidad = (productoId, delta) => {
    setDraftItems((prev) =>
      prev
        .map((it) => {
          if (it.productoId !== productoId) return it;
          const nuevaCant = it.cantidad + delta;
          if (nuevaCant <= 0) return null;
          const ordenItem = itemsPendientes.find((p) => p.productoId === productoId);
          const maxOrden = ordenItem ? ordenItem.restante : it.cantidad;
          if (delta > 0 && nuevaCant > maxOrden) return it;
          if (delta > 0 && capacidadEfectiva !== Infinity && totalUnidadesDraft + delta > capacidadEfectiva) return it;
          return { ...it, cantidad: nuevaCant };
        })
        .filter(Boolean)
    );
  };

  const handleCrearBultoSubmit = async (e) => {
    e?.preventDefault();
    if (draftItems.length === 0 || loading || disabled) return;
    if (onCrearBulto) {
      const ok = await onCrearBulto(draftItems);
      if (ok !== false) {
        setDraftItems([]);
        setCantidadInput("");
        setItemError("");
      }
    } else if (onSubmit) {
      onSubmit(e);
      setDraftItems([]);
    }
  };

  return (
    <div className="card p-4 stack gap-4">
      <div className="stack gap-2">
        <div className="row justify-between align-center">
          <h2 className="text-md font-medium">Artículos de la orden por empaquetar</h2>
          <span className="text-xs text-secondary tabular-nums">
            {totalEmpaquetadas} de {totalSolicitadas} u. ({porcentajeOrden}%)
          </span>
        </div>

        <div className="erp-order-progress-track">
          <div
            ref={progressBarRef}
            className={`erp-order-progress-bar ${porcentajeOrden === 100 ? "is-complete" : ""}`.trim()}
          />
        </div>

        <div className="stack gap-2 pt-1">
          {itemsPendientes.map((it) => (
            <div key={it.productoId} className="row justify-between align-center p-3 rounded bg-surface-muted text-sm">
              <div>
                <span className="font-mono font-medium">Producto #{it.productoId}</span>
                <span className="text-xs text-secondary block">
                  Solicitado: {it.solicitado} u. · Empaquetado: {it.empaquetado} u.
                </span>
              </div>
              <span className={`tabular-nums font-medium ${it.restante === 0 ? "text-success" : "text-primary"}`}>
                {it.restante === 0 ? "Completado" : `${it.restante} u. pendientes`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="p-3 rounded bg-danger-subtle text-danger text-xs">{error}</div>}

      {todosCompletos && draftItems.length === 0 ? (
        <div className="stack gap-3 pt-3 border-t">
          <div className="p-4 rounded bg-surface-muted stack gap-2 text-center align-center">
            <div className="erp-success-circle-icon">
              <Icon name="check-circle" size={24} />
            </div>
            <span className="text-sm font-medium text-success">
              Todos los artículos de la orden están empaquetados
            </span>
            <p className="text-xs text-secondary max-w-md">
              Se asignaron las {totalSolicitadas} unidades solicitadas a bultos en preparación. El
              siguiente paso operativo es la asignación de precintos de seguridad y la aprobación.
            </p>
            {onAvanzarAPrecintos && (
              <div className="pt-2">
                <Button variant="secondary" size="sm" iconRight="arrow-down" onClick={onAvanzarAPrecintos}>
                  Gestionar precintos de seguridad
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="stack gap-4 pt-3 border-t">
          <div className="row justify-between align-center wrap gap-2">
            <div>
              <span className="text-sm font-medium">Diseño y armado de bulto</span>
              <span className="text-xs text-secondary block">
                Agregá uno o más productos a este bulto antes de confirmarlo.
              </span>
            </div>

            <div className="row align-center gap-2">
              <span className="text-xs text-secondary">Capacidad:</span>
              <div className="w-40">
                <Select options={PRESETS_CAPACIDAD} value={capacidadPreset} onChange={setCapacidadPreset} />
              </div>
              {capacidadPreset === "custom" && (
                <div className="w-20">
                  <TextInput
                    type="number"
                    min="1"
                    size="sm"
                    value={customCapacidad}
                    onChange={(e) => setCustomCapacidad(e.target.value)}
                    placeholder="u."
                  />
                </div>
              )}
            </div>
          </div>

          <div className="p-3 rounded bg-surface-muted stack gap-2">
            <div className="row justify-between align-center text-xs">
              <span className="font-medium">
                Ocupación:{" "}
                <span className="tabular-nums font-mono">
                  {totalUnidadesDraft} / {capacidadEfectiva === Infinity ? "∞" : `${capacidadEfectiva} u.`}
                </span>
              </span>
              <span className="text-secondary tabular-nums">
                {capacidadEfectiva === Infinity
                  ? `${totalUnidadesDraft} u. contenidas`
                  : `${porcentajeOcupacionBulto}% ocupado (${espacioLibreBulto} u. libres)`}
              </span>
            </div>

            <div className="erp-bulto-meter">
              {draftItems.map((item, idx) => (
                <MeterSegment
                  key={item.productoId}
                  item={item}
                  idx={idx}
                  capacidadEfectiva={capacidadEfectiva}
                  totalUnitsDraft={totalUnidadesDraft}
                />
              ))}
            </div>

            <div className="row wrap gap-3 pt-1 text-xs">
              {draftItems.map((item, idx) => (
                <span key={item.productoId} className="row align-center gap-1 font-mono">
                  <span className={`erp-bulto-dot erp-bulto-dot--${idx % 5}`} />
                  Producto #{item.productoId}: <strong>{item.cantidad} u.</strong>
                </span>
              ))}
              {capacidadEfectiva !== Infinity && espacioLibreBulto > 0 && (
                <span className="row align-center gap-1 text-secondary">
                  <span className="erp-bulto-dot erp-bulto-dot--empty" />
                  Disponible: {espacioLibreBulto} u.
                </span>
              )}
            </div>
          </div>

          {espacioLibreBulto <= 0 && capacidadEfectiva !== Infinity ? (
            <div className="p-3 rounded bg-surface-muted text-xs text-secondary text-center">
              Capacidad máxima del bulto alcanzada ({capacidadEfectiva} u.). Confirmá este bulto para crearlo y continuar.
            </div>
          ) : productosParaSeleccionar.length === 0 ? (
            <div className="p-3 rounded bg-surface-muted text-xs text-secondary text-center">
              Todos los artículos restantes de la orden ya están cargados en este bulto en armado.
            </div>
          ) : (
            <form onSubmit={handleAgregarAlBulto} className="stack gap-3">
              <div className="grid-2 gap-2">
                <FormField label="Artículo a incorporar">
                  <Select
                    options={productosParaSeleccionar.map((it) => ({
                      value: String(it.productoId),
                      label: `Producto #${it.productoId} (${it.disponibleParaBulto} u. restantes)`,
                    }))}
                    value={selectedProdId}
                    onChange={(val) => {
                      setSelectedProdId(val);
                      setCantidadInput("");
                      setItemError("");
                    }}
                    placeholder="Elegir producto"
                  />
                </FormField>

                <FormField
                  label="Cantidad a colocar"
                  hint={
                    maximoPermitido > 0 ? (
                      <button
                        type="button"
                        onClick={handleUsarMaximo}
                        className="erp-btn-ghost text-xs font-medium cursor-pointer"
                      >
                        Usar máx: {maximoPermitido} u.
                      </button>
                    ) : null
                  }
                >
                  <div className="row gap-2 align-center">
                    <div className="flex-1">
                      <TextInput
                        type="number"
                        min="1"
                        max={maximoPermitido || undefined}
                        placeholder={maximoPermitido > 0 ? `1 a ${maximoPermitido}` : "0"}
                        value={cantidadInput}
                        onChange={handleCantidadChange}
                      />
                    </div>
                    <Button type="button" variant="secondary" size="md" onClick={handleUsarMaximo} disabled={maximoPermitido <= 0}>
                      Máx
                    </Button>
                  </div>
                </FormField>
              </div>

              {itemError && <div className="text-xs text-danger">{itemError}</div>}

              <div className="row justify-end">
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  iconLeft="plus"
                  disabled={!productoActual || maximoPermitido <= 0 || !cantidadInput}
                >
                  Agregar al bulto
                </Button>
              </div>
            </form>
          )}

          <div className="stack gap-2 pt-2 border-t">
            <span className="text-xs text-secondary font-medium">
              Contenido de este bulto ({draftItems.length} producto{draftItems.length !== 1 ? "s" : ""}):
            </span>

            {draftItems.length === 0 ? (
              <div className="p-3 rounded bg-surface-muted text-xs text-secondary text-center">
                El bulto está vacío. Elegí un producto y presioná "Agregar al bulto".
              </div>
            ) : (
              <div className="stack gap-2">
                {draftItems.map((item, idx) => (
                  <div key={item.productoId} className="row justify-between align-center p-2 rounded bg-surface-muted text-xs">
                    <div className="row align-center gap-2">
                      <span className={`erp-bulto-dot erp-bulto-dot--${idx % 5}`} />
                      <span className="font-mono font-medium">Producto #{item.productoId}</span>
                    </div>

                    <div className="row align-center gap-3">
                      <div className="row align-center gap-1">
                        <button
                          type="button"
                          className="erp-btn erp-btn--ghost erp-btn--sm erp-btn-stepper"
                          aria-label={`Disminuir cantidad de Producto #${item.productoId}`}
                          onClick={() => handleAjustarCantidad(item.productoId, -1)}
                          disabled={item.cantidad <= 1}
                        >
                          <Icon name="minus" size={12} />
                        </button>

                        <span className="tabular-nums font-mono font-medium px-2">{item.cantidad} u.</span>

                        <button
                          type="button"
                          className="erp-btn erp-btn--ghost erp-btn--sm erp-btn-stepper"
                          aria-label={`Aumentar cantidad de Producto #${item.productoId}`}
                          onClick={() => handleAjustarCantidad(item.productoId, 1)}
                          disabled={
                            (capacidadEfectiva !== Infinity && espacioLibreBulto <= 0) ||
                            item.cantidad >= (itemsPendientes.find((p) => p.productoId === item.productoId)?.restante || item.cantidad)
                          }
                        >
                          <Icon name="plus" size={12} />
                        </button>
                      </div>

                      <button
                        type="button"
                        className="erp-btn erp-btn--ghost erp-btn--sm text-danger"
                        aria-label={`Quitar Producto #${item.productoId} del bulto`}
                        onClick={() => handleQuitarItem(item.productoId)}
                        title="Quitar este producto del bulto"
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <Button
              variant={isPrimaryAction ? "primary" : "secondary"}
              iconLeft="package"
              type="button"
              loading={loading}
              loadingLabel="Armando bulto..."
              disabled={draftItems.length === 0 || disabled || loading}
              onClick={handleCrearBultoSubmit}
              className="w-full"
            >
              Crear bulto en preparación ({draftItems.length} producto{draftItems.length !== 1 ? "s" : ""} · {totalUnidadesDraft} u.)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmpaquetadoForm;
