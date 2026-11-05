import "../logistics-workbench.css";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "../../../shared/components/Button";
import { StatusBadge } from "../../../shared/components/Badge";
import { FormField } from "../../../shared/components/FormControls";
import { Select } from "../../../shared/components/Select";
import { SortableDataTable } from "../../../shared/components/SortableDataTable";
import { useDisclosure } from "../../../shared/hooks";
import { useToast } from "../../../shared/feedback/ToastContext";
import { useUbicaciones } from "../../ubicaciones_stock/hooks/useUbicaciones";
import { useOrdenes } from "../hooks/useOrdenes";
import { logisticaService } from "../services";
import { mapBultoToUI } from "../mappers/logisticaMappers";
import { ConsolidarModal } from "../components/ConsolidarModal";
import { PrecintadoPanel } from "../components/PrecintadoPanel";
import { AprobacionRevisionModal } from "../components/AprobacionRevisionModal";
import { EmpaquetadoForm } from "../components/EmpaquetadoForm";
import { BultoDetalleModal } from "../components/BultoDetalleModal";
import { useLiveResource } from "../../../shared";
import { readApprovalOutcome } from "../mappers/sealControl";
import { Alert } from "../../../shared/components/Feedback";
import { useAuth } from "../../../app/auth/AuthProvider";
import { puedeOperarEnUbicacion, MENSAJE_FUERA_DE_ALCANCE } from "../../../app/auth/rolePolicy";
export function EmpaquetadoPage({ ordenId, embedded = false, onChange }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { notifySuccess, notifyError } = useToast();
  const { ordenes, reload: reloadOrd } = useOrdenes();
  const { ubicaciones } = useUbicaciones();
  const { user, scope } = useAuth();
  const effectiveOrdenId = ordenId ? String(ordenId) : searchParams.get("ordenId");
  const returnTo = searchParams.get("returnTo");
  const [selectedOrdenFallback, setSelectedOrdenId] = useState(effectiveOrdenId || "");
  const selectedOrdenId = effectiveOrdenId || selectedOrdenFallback;
  const [creandoBulto, setCreandoBulto] = useState(false);
  const [errorBulto, setErrorBulto] = useState("");
  const [bultoSeleccionado, setBultoSeleccionado] = useState(null);
  const detalleModal = useDisclosure(false);
  const [approvalOutcome, setApprovalOutcome] = useState(null);
  const [aprobandoId, setAprobandoId] = useState(null);
  const [aprobandoLote, setAprobandoLote] = useState(false);
  const [errorAprobacion, setErrorAprobacion] = useState("");
  const aprobacionModal = useDisclosure(false);
  const remitoModal = useDisclosure(false);
  const [generandoRemito, setGenerandoRemito] = useState(false);
  const [errorOperacion, setErrorOperacion] = useState("");
  const ubicMap = useMemo(() => new Map(ubicaciones.map((u) => [u.id, u.nombre])), [ubicaciones]);
  const ordenesDisponibles = useMemo(() => ordenes.filter((o) => o.estado === "PENDIENTE" || o.estado === "EN_PREPARACION"), [ordenes]);
  useEffect(() => {
    if (effectiveOrdenId) {
      setSelectedOrdenId(effectiveOrdenId);
    } else if (!selectedOrdenId && ordenesDisponibles.length > 0) {
      const firstId = String(ordenesDisponibles[0].id);
      setSelectedOrdenId(firstId);
      setSearchParams({ ordenId: firstId });
    }
  }, [effectiveOrdenId, ordenesDisponibles, selectedOrdenId, setSearchParams]);
  const activeOrden = useMemo(() => ordenes.find((o) => String(o.id) === String(selectedOrdenId)) || null, [ordenes, selectedOrdenId]);
  const fetchBultos = useCallback(async ({ signal }) => {
    const res = await logisticaService.listarBultosPorOrden(selectedOrdenId, { signal });
    const list = Array.isArray(res) ? res : res?.data || [];
    return list.map(mapBultoToUI);
  }, [selectedOrdenId]);
  const { data: bultosData, isLoading: loadingBultos, isStale, error: bultosError, refresh: loadBultos } = useLiveResource(fetchBultos, {
    resourceKey: `packaging:${selectedOrdenId}`,
    enabled: Boolean(selectedOrdenId),
  });
  const bultos = bultosData || [];
  const puedeOperarOrigen = puedeOperarEnUbicacion(user, scope, activeOrden?.origenId);
  const aprobadosSet = useMemo(() => new Set(bultos.filter((b) => b.aprobado).map((b) => b.id)), [bultosData]);
  useEffect(() => {
    setApprovalOutcome(null);
    setErrorOperacion("");
    setErrorAprobacion("");
    aprobacionModal.onClose();
    remitoModal.onClose();
    detalleModal.onClose();
  }, [selectedOrdenId]);
  const itemsPendientes = useMemo(() => {
    if (!activeOrden?.detalles) return [];
    return activeOrden.detalles.map((det) => {
      const empaquetado = bultos.reduce((acc, b) => {
        const itemInB = b.detalles?.find((d) => d.productoId === det.productoId);
        return acc + (itemInB?.cantidad || 0);
      }, 0);
      return { productoId: det.productoId, solicitado: det.cantidadSolicitada, empaquetado, restante: Math.max(0, det.cantidadSolicitada - empaquetado) };
    });
  }, [activeOrden, bultos]);

  const totalSolicitadas = useMemo(() => itemsPendientes.reduce((s, it) => s + it.solicitado, 0), [itemsPendientes]);
  const totalEmpaquetadas = useMemo(() => itemsPendientes.reduce((s, it) => s + it.empaquetado, 0), [itemsPendientes]);
  const empaquetadoCompleto = totalSolicitadas > 0 && totalEmpaquetadas >= totalSolicitadas;

  const bultosPrecintados = useMemo(() => bultos.filter((b) => b.estado === "PRECINTADO" && b.codigoPrecinto), [bultos]);
  const bultosPreparados = useMemo(() => bultos.filter((b) => b.estado === "PREPARADO" || !b.codigoPrecinto), [bultos]);
  const bultosElegiblesParaAprobar = useMemo(() => bultosPrecintados.filter((b) => !aprobadosSet.has(b.id) && !b.aprobado), [bultosPrecintados, aprobadosSet]);
  const todosBultosPrecintados = bultos.length > 0 && bultosPreparados.length === 0;
  const todosBultosAprobados = bultos.length > 0 && todosBultosPrecintados && bultos.every((b) => aprobadosSet.has(b.id) || b.aprobado);
  const puedeEmitirRemito = puedeOperarOrigen && empaquetadoCompleto && todosBultosAprobados && !isStale && !loadingBultos;

  const esPrioridadArmado = !empaquetadoCompleto;
  const esPrioridadAprobacion = empaquetadoCompleto && todosBultosPrecintados && bultosElegiblesParaAprobar.length > 0;

  const handleCrearBulto = async (items) => {
    if (!puedeOperarOrigen || isStale || loadingBultos) return false;
    setErrorBulto("");
    if (!items || items.length === 0) {
      setErrorBulto("Debe incorporar al menos un producto al bulto.");
      return false;
    }
    setCreandoBulto(true);
    try {
      const payload = items.map((it) => ({ producto_id: Number(it.productoId), cantidad: Number(it.cantidad) }));
      await logisticaService.crearBulto(selectedOrdenId, payload);
      const totalU = items.reduce((s, it) => s + Number(it.cantidad), 0);
      notifySuccess("Bulto armado", `Bulto con ${items.length} producto(s) y ${totalU} u. creado exitosamente.`);
      await loadBultos();
      await reloadOrd();
      onChange?.();
      return true;
    } catch (err) {
      setErrorBulto(err.message || "Error al crear el bulto.");
      notifyError(err, { entity: "Bulto", action: "crear" });
      return false;
    } finally {
      setCreandoBulto(false);
    }
  };

  const handlePrecintarIndividual = async (bultoId, codigo) => {
    if (!puedeOperarOrigen) throw new Error(MENSAJE_FUERA_DE_ALCANCE);
    if (isStale || loadingBultos) throw new Error("Actualice la orden antes de precintar.");
    setErrorOperacion("");
    try {
      try { await logisticaService.registrarPrecinto(codigo); } catch (error) { if (error?.status !== 409) throw error; }
      await logisticaService.precintarBulto(bultoId, codigo);
      notifySuccess("Precinto asignado", `Precinto ${codigo} asignado al bulto #${bultoId}.`);
      await loadBultos();
      onChange?.();
    } catch (err) {
      setErrorOperacion(err.message || "Error al precintar el bulto.");
      notifyError(err, { entity: "Bulto", action: "precintar" });
      throw err;
    }
  };

  const handlePrecintarLote = async (asignaciones) => {
    if (!puedeOperarOrigen) throw new Error(MENSAJE_FUERA_DE_ALCANCE);
    if (isStale || loadingBultos) throw new Error("Actualice la orden antes de precintar.");
    setErrorOperacion("");
    try {
      await logisticaService.precintarLoteRevisado(selectedOrdenId, asignaciones);
      notifySuccess("Lote precintado", `${asignaciones.length} bulto(s) precintados exitosamente.`);
      await loadBultos();
      onChange?.();
    } catch (err) {
      setErrorOperacion(err.message || "Error al precintar el lote.");
      notifyError(err, { entity: "Lote de bultos", action: "precintar" });
      throw err;
    }
  };

  const handleAprobarIndividual = async (bultoId) => {
    if (isStale || loadingBultos) return;
    setErrorAprobacion("");
    setAprobandoId(bultoId);
    try {
      await logisticaService.aprobarBulto(bultoId);
      notifySuccess("Bulto aprobado", `Bulto #${bultoId} aprobado conforme.`);
      await loadBultos();
      onChange?.();
    } catch (err) {
      setErrorAprobacion(err.message || "Error al registrar aprobación de bulto.");
      notifyError(err, { entity: "Bulto", action: "aprobar" });
    } finally {
      setAprobandoId(null);
    }
  };

  const handleConfirmarAprobacionLote = async () => {
    if (isStale || loadingBultos) return;
    setErrorAprobacion("");
    setAprobandoLote(true);
    try {
      const result = readApprovalOutcome(await logisticaService.aprobarBultosLote(selectedOrdenId));
      setApprovalOutcome(result);
      notifySuccess("Aprobación en lote", `${result.approved.length} bulto(s) aprobado(s).`);
      await loadBultos();
      if (!result.blocked.length) aprobacionModal.onClose();
      onChange?.();
    } catch (err) {
      setErrorAprobacion(err.message || "Error al aprobar bultos en lote.");
      notifyError(err, { entity: "Lote de bultos", action: "aprobar" });
    } finally {
      setAprobandoLote(false);
    }
  };

  const handleEmitirRemito = async ({ numero, bultosIds }) => {
    if (!puedeEmitirRemito) return { ok: false };
    setGenerandoRemito(true);
    try {
      const res = await logisticaService.generarRemito(selectedOrdenId, { numero, bultosIds });
      remitoModal.onClose();
      await reloadOrd();
      const num = res?.numero || numero;
      notifySuccess("Remito emitido", `Remito ${num} emitido exitosamente.`);
      if (embedded) onChange?.({ remitoNumero: num });
      else navigate(`/logistica/remitos/${encodeURIComponent(num)}`);
      return { ok: true };
    } catch (err) {
      const msg = err.message || "Error al generar el remito.";
      setErrorOperacion(msg);
      notifyError(err, { entity: "Remito", action: "emitir" });
      return { ok: false, error: msg };
    } finally {
      setGenerandoRemito(false);
    }
  };

  const handleVerDetalleBulto = (bulto) => {
    setBultoSeleccionado(bulto);
    detalleModal.onOpen();
  };

  const bultoColumns = [
    { key: "id", header: "ID Bulto", mono: true },
    {
      key: "contenido",
      header: "Contenido",
      render: (_, row) => {
        const totalU = (row.detalles || []).reduce((s, d) => s + (d.cantidad || 0), 0);
        return (
          <div className="stack gap-1">
            {(row.detalles || []).map((d) => (
              <span key={d.productoId} className="text-xs">
                Producto #{d.productoId} · <span className="font-mono font-medium">{d.cantidad} u.</span>
              </span>
            ))}
            {(row.detalles || []).length > 1 && (
              <span className="text-xs text-secondary border-t pt-1 font-medium">Total: {totalU} u.</span>
            )}
          </div>
        );
      },
    },
    {
      key: "codigoPrecinto",
      header: "Precinto de seguridad",
      mono: true,
      render: (v) => v ? <span className="font-mono text-sm font-medium">{v}</span> : <span className="text-muted text-xs">Sin precinto</span>,
    },
    { key: "estado", header: "Estado físico", render: (v) => <StatusBadge status={v} /> },
    {
      key: "aprobacion",
      header: "Aprobación para despacho",
      render: (_, row) =>
        aprobadosSet.has(row.id) || row.aprobado ? (
          <span className="badge badge--success text-xs">Aprobado</span>
        ) : !puedeOperarOrigen ? (
          <span className="text-muted text-xs">Fuera de tu alcance operativo</span>
        ) : row.estado === "PRECINTADO" ? (
          <Button
            variant={esPrioridadAprobacion && bultosElegiblesParaAprobar.length === 1 ? "primary" : "secondary"}
            size="sm"
            iconLeft="check"
            onClick={() => handleAprobarIndividual(row.id)}
            loading={aprobandoId === row.id}
          >
            Aprobar
          </Button>
        ) : (
          <span className="text-muted text-xs">Requiere precinto</span>
        ),
    },
    {
      key: "acciones",
      header: "Detalle",
      render: (_, row) => (
        <Button variant="ghost" size="sm" iconLeft="eye" onClick={() => handleVerDetalleBulto(row)}>
          Ver
        </Button>
      ),
    },
  ];

  return (
    <div className="logistics-workbench stack gap-5">
      {!embedded && (
        <div className="erp-flow-header">
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

          <div>
            {puedeEmitirRemito ? (
              <Button variant="primary" iconRight="arrow-right" onClick={remitoModal.onOpen}>
                Generar remito único ({bultos.length} bultos)
              </Button>
            ) : esPrioridadAprobacion ? (
              <Button variant="primary" iconLeft="check-circle" onClick={aprobacionModal.onOpen}>
                Aprobar elegibles ({bultosElegiblesParaAprobar.length})
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {!embedded && activeOrden && (
        <div className="row justify-end">
          <Button variant="ghost" size="sm" iconLeft="arrow-left" onClick={() => navigate(returnTo || `/logistica/ordenes/${activeOrden.id}?tab=empaque`)}>
            Volver a la orden #{activeOrden.id}
          </Button>
        </div>
      )}

      {!embedded && (
        <div className="card p-4 row justify-between align-center wrap gap-3">
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
        </div>
      )}

      {activeOrden && !puedeOperarOrigen && (
        <Alert tone="warning" title="Acciones de empaque no disponibles" description={MENSAJE_FUERA_DE_ALCANCE} />
      )}
      {errorOperacion && <div className="p-3 rounded bg-danger-subtle text-danger text-sm">{errorOperacion}</div>}
      {bultosError && (
        <div role="alert" className="erp-callout">
          No se pudieron actualizar los bultos. Las acciones están bloqueadas.{" "}
          <Button variant="secondary" size="sm" onClick={loadBultos}>Reintentar</Button>
        </div>
      )}
      {errorAprobacion && <div className="p-3 rounded bg-danger-subtle text-danger text-sm">{errorAprobacion}</div>}
      {approvalOutcome && (
        <div role="status" className="erp-callout">
          Resultado del servidor: {approvalOutcome.approved.length} bulto(s) aprobado(s), {approvalOutcome.blocked.length} excluido(s).
          {approvalOutcome.blocked.length > 0 && (
            <ul>
              {approvalOutcome.blocked.map((item) => (
                <li key={item.id}>Bulto #{item.id}: {item.motivo}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeOrden && <div className="logistics-quantity-strip" aria-label="Avance de empaquetado">
        <span>Solicitadas <strong>{totalSolicitadas} u.</strong></span>
        <span>Empaquetadas <strong>{totalEmpaquetadas} u.</strong></span>
        <span>Pendientes <strong>{Math.max(0, totalSolicitadas - totalEmpaquetadas)} u.</strong></span>
      </div>}
      {activeOrden && (
        <div className="logistics-packing-split">
          <EmpaquetadoForm
            itemsPendientes={itemsPendientes}
            onCrearBulto={handleCrearBulto}
            loading={creandoBulto}
            disabled={isStale || loadingBultos || !puedeOperarOrigen}
            error={errorBulto}
            isPrimaryAction={esPrioridadArmado}
            onAvanzarAPrecintos={() => {
              const el = document.getElementById("panel-precintos");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          />

          <div className="card p-4 stack gap-3">
            <div className="row justify-between align-center wrap gap-2">
              <div>
                <h2 className="text-md font-medium">Bultos de esta orden ({bultos.length})</h2>
                <span className="text-xs text-secondary">
                  {bultosPrecintados.length} precintados · {aprobadosSet.size} aprobados
                </span>
              </div>

              <div className="row gap-2 align-center">
                {puedeOperarOrigen && bultosElegiblesParaAprobar.length > 0 && !puedeEmitirRemito && (
                  <Button
                    variant={esPrioridadAprobacion ? "primary" : "secondary"}
                    size="sm"
                    iconLeft="check-circle"
                    onClick={aprobacionModal.onOpen}
                  >
                    Aprobar elegibles ({bultosElegiblesParaAprobar.length})
                  </Button>
                )}
                {puedeEmitirRemito && (
                  <Button variant="primary" size="sm" iconRight="arrow-right" onClick={remitoModal.onOpen}>
                    Generar remito ({bultos.length})
                  </Button>
                )}
              </div>
            </div>

            <SortableDataTable
              columns={bultoColumns}
              data={bultos}
              rowKey="id"
              loading={loadingBultos}
              emptyTitle="Sin bultos creados"
              emptyDescription="Seleccione uno o más artículos y presione Crear bulto para comenzar."
            />
          </div>
        </div>
      )}

      {activeOrden && bultos.length > 0 && (
        <PrecintadoPanel
          bultos={bultos}
          onPrecintarIndividual={handlePrecintarIndividual}
          onPrecintarLote={handlePrecintarLote}
          loading={loadingBultos || !puedeOperarOrigen}
        />
      )}

      {activeOrden && (
        <AprobacionRevisionModal
          open={aprobacionModal.open}
          onClose={aprobacionModal.onClose}
          orden={activeOrden}
          bultos={bultos}
          aprobadosSet={aprobadosSet}
          serverOutcome={approvalOutcome}
          onConfirmarAprobacion={handleConfirmarAprobacionLote}
          pending={aprobandoLote}
        />
      )}

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

      {bultoSeleccionado && (
        <BultoDetalleModal
          open={detalleModal.open}
          onClose={detalleModal.onClose}
          bulto={bultoSeleccionado}
          ordenId={activeOrden?.id}
          isAprobado={Boolean(bultoSeleccionado.aprobado || aprobadosSet.has(bultoSeleccionado.id))}
          aprobando={aprobandoId === bultoSeleccionado.id}
          onAprobar={puedeOperarOrigen ? handleAprobarIndividual : undefined}
        />
      )}
    </div>
  );
}

export default EmpaquetadoPage;
