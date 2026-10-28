import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "../../../shared/components/Button";
import { StatusBadge } from "../../../shared/components/Badge";
import { FormField } from "../../../shared/components/FormControls";
import { Select } from "../../../shared/components/Select";
import { SegmentedControl } from "../../../shared/components/SegmentedControl";
import { SortableDataTable } from "../../../shared/components/SortableDataTable";
import { useDisclosure } from "../../../shared/hooks";
import { useUbicaciones } from "../../ubicaciones_stock/hooks/useUbicaciones";
import { useOrdenes } from "../hooks/useOrdenes";
import { logisticaService } from "../services";
import { mapBultoToUI } from "../mappers/logisticaMappers";
import { ConsolidarModal } from "../components/ConsolidarModal";
import { PrecintadoPanel } from "../components/PrecintadoPanel";
import { AprobacionRevisionModal } from "../components/AprobacionRevisionModal";
import { EmpaquetadoForm } from "../components/EmpaquetadoForm";

/**
 * EmpaquetadoPage (T045 / US4):
 * Armado, precintado individual/lote, aprobacion de bultos elegibles y emision de remito unico.
 * Cumple FR-041 (aprobacion de bultos) y FR-043 (una unica accion primaria a la vez).
 */
export function EmpaquetadoPage({ ordenId, embedded = false, onChange }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { ordenes, reload: reloadOrd } = useOrdenes();
  const { ubicaciones } = useUbicaciones();

  const queryOrdenId = searchParams.get("ordenId");
  const effectiveOrdenId = ordenId ? String(ordenId) : queryOrdenId;
  const returnTo = searchParams.get("returnTo");
  const [selectedOrdenId, setSelectedOrdenId] = useState(effectiveOrdenId || "");
  const [listScope, setListScope] = useState("activas");
  const [bultos, setBultos] = useState([]);
  const [loadingBultos, setLoadingBultos] = useState(false);

  // Armado de bultos
  const [selectedProdId, setSelectedProdId] = useState("");
  const [cantidadBulto, setCantidadBulto] = useState("");
  const [creandoBulto, setCreandoBulto] = useState(false);
  const [errorBulto, setErrorBulto] = useState("");

  // Aprobacion de bultos (FR-041)
  const [aprobadosSet, setAprobadosSet] = useState(new Set());
  const [aprobandoId, setAprobandoId] = useState(null);
  const [aprobandoLote, setAprobandoLote] = useState(false);
  const [errorAprobacion, setErrorAprobacion] = useState("");
  const aprobacionModal = useDisclosure(false);

  // Remito modal
  const remitoModal = useDisclosure(false);
  const [generandoRemito, setGenerandoRemito] = useState(false);
  const [errorOperacion, setErrorOperacion] = useState("");

  const ubicMap = useMemo(() => new Map(ubicaciones.map((u) => [u.id, u.nombre])), [ubicaciones]);

  const ordenesDisponibles = useMemo(() => {
    return ordenes.filter((o) => o.estado === "PENDIENTE" || o.estado === "EN_PREPARACION");
  }, [ordenes]);

  useEffect(() => {
    if (effectiveOrdenId) {
      setSelectedOrdenId(effectiveOrdenId);
    } else if (!selectedOrdenId && ordenesDisponibles.length > 0) {
      const firstId = String(ordenesDisponibles[0].id);
      setSelectedOrdenId(firstId);
      setSearchParams({ ordenId: firstId });
    }
  }, [effectiveOrdenId, ordenesDisponibles, selectedOrdenId, setSearchParams]);

  const activeOrden = useMemo(() => {
    return ordenes.find((o) => String(o.id) === String(selectedOrdenId)) || null;
  }, [ordenes, selectedOrdenId]);

  const loadBultos = useCallback(async () => {
    if (!selectedOrdenId) return;
    setLoadingBultos(true);
    try {
      const res = await logisticaService.listarBultosPorOrden(selectedOrdenId);
      const list = Array.isArray(res) ? res : res?.data || [];
      const mapped = list.map(mapBultoToUI);
      setBultos(mapped);
      const setAprob = new Set();
      mapped.forEach((b) => {
        if (b.aprobado) setAprob.add(b.id);
      });
      if (setAprob.size > 0) setAprobadosSet((prev) => new Set([...prev, ...setAprob]));
      setErrorOperacion("");
    } catch (error) {
      setErrorOperacion(error?.message || "No se pudieron consultar los bultos de la orden.");
    } finally {
      setLoadingBultos(false);
    }
  }, [selectedOrdenId]);

  useEffect(() => {
    loadBultos();
  }, [loadBultos]);

  // Articulos solicitados y pendientes
  const itemsPendientes = useMemo(() => {
    if (!activeOrden?.detalles) return [];
    return activeOrden.detalles.map((det) => {
      const empaquetado = bultos.reduce((acc, b) => {
        const itemInB = b.detalles?.find((d) => d.productoId === det.productoId);
        return acc + (itemInB?.cantidad || 0);
      }, 0);
      const restante = Math.max(0, det.cantidadSolicitada - empaquetado);
      return { productoId: det.productoId, solicitado: det.cantidadSolicitada, empaquetado, restante };
    });
  }, [activeOrden, bultos]);

  const totalSolicitadas = useMemo(() => itemsPendientes.reduce((s, it) => s + it.solicitado, 0), [itemsPendientes]);
  const totalEmpaquetadas = useMemo(() => itemsPendientes.reduce((s, it) => s + it.empaquetado, 0), [itemsPendientes]);
  const empaquetadoCompleto = totalSolicitadas > 0 && totalEmpaquetadas >= totalSolicitadas;

  const bultosPrecintados = useMemo(() => bultos.filter((b) => b.estado === "PRECINTADO" && b.codigoPrecinto), [bultos]);
  const bultosPreparados = useMemo(() => bultos.filter((b) => b.estado === "PREPARADO" || !b.codigoPrecinto), [bultos]);
  const bultosElegiblesParaAprobar = useMemo(
    () => bultosPrecintados.filter((b) => !aprobadosSet.has(b.id) && !b.aprobado),
    [bultosPrecintados, aprobadosSet]
  );
  const todosBultosPrecintados = bultos.length > 0 && bultosPreparados.length === 0;
  const todosBultosAprobados =
    bultos.length > 0 && todosBultosPrecintados && bultos.every((b) => aprobadosSet.has(b.id) || b.aprobado);

  const puedeEmitirRemito = empaquetadoCompleto && todosBultosAprobados;

  // Crear bulto
  const handleCrearBulto = async (e) => {
    e.preventDefault();
    setErrorBulto("");
    const pid = Number(selectedProdId || itemsPendientes.find((i) => i.restante > 0)?.productoId);
    const cant = Number(cantidadBulto);

    if (!pid || cant <= 0) {
      setErrorBulto("Debe indicar un producto y cantidad valida mayor a 0.");
      return;
    }
    const itemObj = itemsPendientes.find((it) => it.productoId === pid);
    if (itemObj && cant > itemObj.restante) {
      setErrorBulto(`La cantidad supera las unidades pendientes (${itemObj.restante} u.).`);
      return;
    }

    setCreandoBulto(true);
    try {
      await logisticaService.crearBulto(selectedOrdenId, [{ producto_id: pid, cantidad: cant }]);
      setCantidadBulto("");
      await loadBultos();
      await reloadOrd();
      onChange?.();
    } catch (err) {
      setErrorBulto(err.message || "Error al crear el bulto.");
    } finally {
      setCreandoBulto(false);
    }
  };

  // Precintado individual y por lote
  const handlePrecintarIndividual = async (bultoId, codigo) => {
    setErrorOperacion("");
    try {
      try { await logisticaService.registrarPrecinto(codigo); } catch (error) { if (error?.status !== 409) throw error; }
      await logisticaService.precintarBulto(bultoId, codigo);
      await loadBultos();
      onChange?.();
    } catch (err) {
      setErrorOperacion(err.message || "Error al precintar el bulto.");
      throw err;
    }
  };

  const handlePrecintarLote = async (asignaciones) => {
    setErrorOperacion("");
    try {
      for (const asig of asignaciones) {
        try { await logisticaService.registrarPrecinto(asig.codigoPrecinto); } catch (error) { if (error?.status !== 409) throw error; }
        await logisticaService.precintarBulto(asig.bultoId, asig.codigoPrecinto);
      }
      await loadBultos();
      onChange?.();
    } catch (err) {
      setErrorOperacion(err.message || "Error al precintar el lote.");
      throw err;
    }
  };

  // Aprobacion
  const handleAprobarIndividual = async (bultoId) => {
    setErrorAprobacion("");
    setAprobandoId(bultoId);
    try {
      await logisticaService.aprobarBulto(bultoId);
      setAprobadosSet((prev) => new Set([...prev, bultoId]));
      onChange?.();
    } catch (err) {
      setErrorAprobacion(err.message || "Error al registrar aprobacion de bulto.");
    } finally {
      setAprobandoId(null);
    }
  };

  const handleConfirmarAprobacionLote = async (bultoIds) => {
    setErrorAprobacion("");
    setAprobandoLote(true);
    try {
      await logisticaService.aprobarBultosLote(selectedOrdenId, bultoIds);
      setAprobadosSet((prev) => new Set([...prev, ...bultoIds]));
      aprobacionModal.onClose();
      onChange?.();
    } catch (err) {
      setErrorAprobacion(err.message || "Error al aprobar bultos en lote.");
    } finally {
      setAprobandoLote(false);
    }
  };

  // Emitir remito
  const handleEmitirRemito = async ({ numero, bultosIds }) => {
    setGenerandoRemito(true);
    try {
      const res = await logisticaService.generarRemito(selectedOrdenId, { numero, bultosIds });
      remitoModal.onClose();
      await reloadOrd();
      const num = res?.numero || numero;
      if (embedded) onChange?.({ remitoNumero: num });
      else navigate(`/logistica/remitos/${encodeURIComponent(num)}`);
      return { ok: true };
    } catch (err) {
      setErrorOperacion(err.message || "Error al generar el remito.");
      return { ok: false, error: err.message };
    } finally {
      setGenerandoRemito(false);
    }
  };

  const bultoColumns = [
    { key: "id", header: "ID Bulto", mono: true },
    {
      key: "contenido",
      header: "Contenido",
      render: (_, row) => (
        <div className="stack gap-1">
          {(row.detalles || []).map((d) => (
            <span key={d.productoId} className="text-sm">
              Producto #{d.productoId} · {d.cantidad} u.
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "precinto",
      header: "Precinto",
      render: (_, row) =>
        row.codigoPrecinto ? (
          <span className="font-mono text-sm font-medium">{row.codigoPrecinto}</span>
        ) : (
          <span className="text-xs text-muted">Sin precinto</span>
        ),
    },
    { key: "estado", header: "Estado", render: (v) => <StatusBadge status={v} /> },
    {
      key: "aprobacion",
      header: "Aprobación (FR-041)",
      render: (_, row) => {
        const isAprobado = aprobadosSet.has(row.id) || row.aprobado;
        if (isAprobado) {
          return <span className="badge-pill bg-success-subtle text-success text-xs font-medium">Aprobado</span>;
        }
        if (row.estado === "PRECINTADO") {
          return (
            <Button
              variant="secondary"
              size="sm"
              loading={aprobandoId === row.id}
              onClick={() => handleAprobarIndividual(row.id)}
            >
              Aprobar bulto
            </Button>
          );
        }
        return <span className="text-xs text-muted">Requiere precinto</span>;
      },
    },
  ];

  const ordenesBandeja = ordenes.filter((orden) => listScope === "historial" ? orden.estado === "CERRADA" : orden.estado === "PENDIENTE" || orden.estado === "EN_PREPARACION");

  if (!embedded) {
    return (
      <div className="stack gap-5">
        <div className="erp-flow-header"><div><div className="erp-breadcrumb"><span>Operaciones</span><span>·</span><span>Empaquetado</span></div><h1 className="text-xl">Bandeja de empaque y precintos</h1></div></div>
        <SegmentedControl value={listScope} onChange={setListScope} options={[{ value: "activas", label: "Activas", count: ordenes.filter((o) => o.estado === "PENDIENTE" || o.estado === "EN_PREPARACION").length }, { value: "historial", label: "Historial", count: ordenes.filter((o) => o.estado === "CERRADA").length }]} />
        <SortableDataTable
          columns={[
            { key: "id", header: "Orden", mono: true, render: (value) => `OR-${String(value).padStart(4, "0")}` },
            { key: "origenId", header: "Origen", render: (value) => ubicMap.get(value) || `CD #${value}` },
            { key: "destinoId", header: "Destino", render: (value) => ubicMap.get(value) || `Local #${value}` },
            { key: "estado", header: "Estado", render: (value) => <StatusBadge status={value} /> },
            { key: "accion", header: "Acción", align: "right", sortable: false, render: (_, row) => <Button variant="primary" size="sm" onClick={() => navigate(`/logistica/ordenes/${row.id}?tab=empaque`)}>{row.estado === "CERRADA" ? "Ver orden" : "Gestionar empaque"}</Button> },
          ]}
          data={ordenesBandeja}
          rowKey="id"
          emptyTitle={listScope === "historial" ? "Sin órdenes empaquetadas cerradas" : "No hay órdenes para empaquetar"}
          emptyDescription="Cada acción abre la orden correspondiente y se ejecuta desde su pestaña de Empaque y precintos."
        />
      </div>
    );
  }

  return (
    <div className="stack gap-5">
      {!embedded && <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span className="cursor-pointer text-secondary" onClick={() => navigate("/logistica/ordenes")}>
              Distribución
            </span>
            <span>·</span>
            <span>Empaquetado y precintado</span>
          </div>
          <h1 className="text-xl">Armado, precintado y aprobación de bultos</h1>
        </div>

        {/* FR-043: Exactamente una accion primaria en el header */}
        <div>
          {puedeEmitirRemito ? (
            <Button variant="primary" iconRight="arrow-right" onClick={remitoModal.onOpen}>
              Generar remito único ({bultos.length} bultos)
            </Button>
          ) : bultosElegiblesParaAprobar.length > 0 ? (
            <Button variant="primary" iconLeft="check-circle" onClick={aprobacionModal.onOpen}>
              Aprobar elegibles ({bultosElegiblesParaAprobar.length})
            </Button>
          ) : null}
        </div>
      </div>}

      {!embedded && activeOrden && (
        <div className="row justify-end">
          <Button variant="ghost" size="sm" iconLeft="arrow-left" onClick={() => navigate(returnTo || `/logistica/ordenes/${activeOrden.id}?tab=empaque`)}>
            Volver a la orden #{activeOrden.id}
          </Button>
        </div>
      )}

      {/* Selector de orden activa */}
      {!embedded && <div className="card p-4 row justify-between align-center wrap gap-3">
        <div className="flex-1 min-w-64">
          <FormField label="Seleccionar orden de reposición a empaquetar">
            <Select
              options={ordenesDisponibles.map((o) => ({
                value: String(o.id),
                label: `Orden #${o.id} · Destino: ${ubicMap.get(o.destinoId) || `#${o.destinoId}`} (${o.estado})`,
              }))}
              value={selectedOrdenId}
              onChange={(val) => {
                setSelectedOrdenId(val);
                setSearchParams({ ordenId: val });
              }}
              placeholder="Seleccionar orden pendiente"
            />
          </FormField>
        </div>

        {activeOrden && (
          <div className="row gap-4 align-center pt-2">
            <div>
              <span className="text-xs text-muted block">Origen (CD)</span>
              <span className="text-sm font-medium">{ubicMap.get(activeOrden.origenId) || `CD #${activeOrden.origenId}`}</span>
            </div>
            <div>
              <span className="text-xs text-muted block">Destino (Local)</span>
              <span className="text-sm font-medium">{ubicMap.get(activeOrden.destinoId) || `Local #${activeOrden.destinoId}`}</span>
            </div>
            <div>
              <span className="text-xs text-muted block">Estado</span>
              <StatusBadge status={activeOrden.estado} />
            </div>
          </div>
        )}
      </div>}

      {errorOperacion && <div className="p-3 rounded bg-danger-subtle text-danger text-sm">{errorOperacion}</div>}
      {errorAprobacion && <div className="p-3 rounded bg-danger-subtle text-danger text-sm">{errorAprobacion}</div>}

      {/* Armado y tabla de bultos */}
      {activeOrden && (
        <div className="grid-2 gap-4">
          <EmpaquetadoForm
            itemsPendientes={itemsPendientes}
            selectedProdId={selectedProdId}
            onSelectProdId={setSelectedProdId}
            cantidadBulto={cantidadBulto}
            onChangeCantidad={(e) => setCantidadBulto(e.target.value)}
            onSubmit={handleCrearBulto}
            loading={creandoBulto}
            error={errorBulto}
            isPrimaryAction={!puedeEmitirRemito && bultosElegiblesParaAprobar.length === 0}
          />

          <div className="card p-4 stack gap-3">
            <div className="row justify-between align-center wrap gap-2">
              <div>
                <h2 className="text-md font-medium">Bultos de esta orden ({bultos.length})</h2>
                <span className="text-xs text-secondary">
                  {bultosPrecintados.length} precintados · {aprobadosSet.size} aprobados
                </span>
              </div>

              {bultosElegiblesParaAprobar.length > 0 && !puedeEmitirRemito && (
                <Button variant="secondary" size="sm" onClick={aprobacionModal.onOpen}>
                  Revisar elegibles ({bultosElegiblesParaAprobar.length})
                </Button>
              )}
            </div>

            <SortableDataTable
              columns={bultoColumns}
              data={bultos}
              rowKey="id"
              loading={loadingBultos}
              emptyTitle="Sin bultos creados"
              emptyDescription="Seleccione un artículo de la orden y presione Crear bulto para comenzar."
            />
          </div>
        </div>
      )}

      {/* Panel dedicado de precintado (T046) */}
      {activeOrden && bultosPreparados.length > 0 && (
        <PrecintadoPanel
          bultos={bultos}
          onPrecintarIndividual={handlePrecintarIndividual}
          onPrecintarLote={handlePrecintarLote}
          loading={loadingBultos}
        />
      )}

      {/* Dialogo de revision y aprobacion de bultos (T045 / FR-041) */}
      {activeOrden && (
        <AprobacionRevisionModal
          open={aprobacionModal.open}
          onClose={aprobacionModal.onClose}
          orden={activeOrden}
          bultos={bultos}
          aprobadosSet={aprobadosSet}
          onConfirmarAprobacion={handleConfirmarAprobacionLote}
          pending={aprobandoLote}
        />
      )}

      {/* Modal de emision de remito unico completo (T048) */}
      {activeOrden && (
        <ConsolidarModal
          open={remitoModal.open}
          onClose={remitoModal.onClose}
          orden={activeOrden}
          bultos={bultosPrecintados}
          onSubmit={handleEmitirRemito}
          pending={generandoRemito}
        />
      )}
    </div>
  );
}

export default EmpaquetadoPage;
