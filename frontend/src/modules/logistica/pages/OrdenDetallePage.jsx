import "../logistics-workbench.css";
import { OrderWorkflowRail } from "../components/OrderWorkflowRail";
import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  StatusBadge,
  SegmentedControl,
  Alert,
  useLiveResource,
  LiveIndicator,
} from "../../../shared";
import { useDisclosure } from "../../../shared/hooks";
import { useToast } from "../../../shared/feedback/ToastContext";
import { useAuth } from "../../../app/auth/AuthProvider";
import { puedeOperarEnUbicacion, MENSAJE_FUERA_DE_ALCANCE } from "../../../app/auth/rolePolicy";
import { useUbicaciones } from "../../ubicaciones_stock/hooks/useUbicaciones";
import { useProductos } from "../../catalogo/hooks/useProductos";
import { logisticaService } from "../services";
import { mapOrdenToUI, mapBultoToUI, mapRemitoToUI } from "../mappers/logisticaMappers";
import { computeBloqueadoresOrden, computeGuidanceByTab } from "../mappers/ordenDetalleGuidance";
import { OrdenRenglonesCard } from "../components/OrdenRenglonesCard";
import { OrdenTimeline } from "../components/OrdenTimeline";
import { OrdenDespachoTab } from "../components/OrdenDespachoTab";
import { ConsolidarModal } from "../components/ConsolidarModal";
import { EmpaquetadoPage } from "./EmpaquetadoPage";
import { RecepcionPage } from "./RecepcionPage";

export function OrdenDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [despachando, setDespachando] = useState(false);
  const [generandoRemito, setGenerandoRemito] = useState(false);
  const [accionError, setAccionError] = useState("");
  const remitoModal = useDisclosure(false);
  const { notifySuccess, notifyError } = useToast();
  const { user, scope } = useAuth();
  const { ubicaciones } = useUbicaciones();
  const { productos } = useProductos({ activos: true });

  const ubicMap = useMemo(() => new Map(ubicaciones.map((u) => [u.id, u.nombre])), [ubicaciones]);
  const productoMap = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  const fetchOrderData = useCallback(async ({ signal }) => {
    if (!id) return null;
    const [ordRes, bultosRes, remitosRes] = await Promise.all([
      logisticaService.obtenerOrden(id, { signal }),
      logisticaService.listarBultosPorOrden(id, { signal }),
      logisticaService.listarRemitos({ signal }),
    ]);

    const ordenMapped = mapOrdenToUI(ordRes);
    const bultosRaw = Array.isArray(bultosRes) ? bultosRes : bultosRes?.data || [];
    const bultosMapped = bultosRaw.map(mapBultoToUI);
    const remitosRaw = Array.isArray(remitosRes) ? remitosRes : remitosRes?.data || [];
    const allRemitos = remitosRaw.map(mapRemitoToUI);

    const remitoNumeroEnBulto = bultosMapped.find((b) => b.remitoNumero)?.remitoNumero;
    const remitoAsociado =
      allRemitos.find((r) => r.bultosIds?.some((bid) => bultosMapped.some((b) => b.id === bid))) ||
      allRemitos.find((r) => r.numero === remitoNumeroEnBulto) ||
      null;

    return { orden: ordenMapped, bultos: bultosMapped, remito: remitoAsociado };
  }, [id]);

  const { data, error, isLoading, freshnessSeconds, isStale, refresh } = useLiveResource(fetchOrderData, {
    resourceKey: `order:${id}`,
    enabled: Boolean(id),
    intervalMs: 15000,
  });

  const orden = data?.orden;
  const puedeOperarOrigen = puedeOperarEnUbicacion(user, scope, orden?.origenId);
  const bultos = data?.bultos || [];
  const remito = data?.remito || null;
  const activeTab = searchParams.get("tab") || "resumen";
  const setActiveTab = (tab) => setSearchParams(tab === "resumen" ? {} : { tab });

  const origenNombre = orden ? ubicMap.get(orden.origenId) || `CD #${orden.origenId}` : "";
  const destinoNombre = orden ? ubicMap.get(orden.destinoId) || `Local #${orden.destinoId}` : "";
  const responsableNombre = user?.displayName || user?.name || "Operador de Logística";

  const detallesConProgreso = useMemo(() => {
    if (!orden) return [];
    return orden.detalles.map((d) => {
      const empaquetadas = bultos.reduce((acc, b) => {
        const itemEnBulto = (b.detalles || []).find((det) => det.productoId === d.productoId);
        return acc + (itemEnBulto ? itemEnBulto.cantidad : 0);
      }, 0);
      const restante = Math.max(0, d.cantidadSolicitada - empaquetadas);
      const prod = productoMap.get(d.productoId);
      return {
        ...d,
        productoCodigo: prod?.codigo || `SKU-${d.productoId}`,
        productoNombre: prod?.nombre || `Producto #${d.productoId}`,
        cantidadEmpaquetada: empaquetadas,
        cantidadRestante: restante,
        completo: empaquetadas >= d.cantidadSolicitada,
      };
    });
  }, [orden, bultos, productoMap]);

  const totalSolicitadas = useMemo(() => orden?.detalles.reduce((acc, d) => acc + d.cantidadSolicitada, 0) || 0, [orden]);
  const totalEmpaquetadas = useMemo(() => bultos.reduce((acc, b) => acc + (b.detalles || []).reduce((s, det) => s + det.cantidad, 0), 0), [bultos]);
  const estaCompletamenteEmpaquetada = totalSolicitadas > 0 && totalEmpaquetadas >= totalSolicitadas;
  const bultosTodosPrecintados = bultos.length > 0 && bultos.every((b) => b.estado !== "PREPARADO" && b.codigoPrecinto);
  const bultosPrecintados = useMemo(() => bultos.filter((b) => b.estado !== "PREPARADO" && b.codigoPrecinto), [bultos]);
  const bultosElegiblesParaAprobar = useMemo(
    () => bultosPrecintados.filter((b) => !b.aprobado),
    [bultosPrecintados]
  );
  const todosBultosAprobados =
    bultos.length > 0 && bultosTodosPrecintados && bultos.every((b) => b.aprobado);

  const bloqueadores = useMemo(
    () => computeBloqueadoresOrden({ orden, bultos, remito, totalSolicitadas, totalEmpaquetadas }),
    [orden, bultos, remito, totalSolicitadas, totalEmpaquetadas]
  );

  const handleEmitirRemito = async ({ bultosIds }) => {
    if (!puedeOperarOrigen) return { ok: false, error: MENSAJE_FUERA_DE_ALCANCE };
    setGenerandoRemito(true);
    setAccionError("");
    try {
      const res = await logisticaService.generarRemito(orden.id, { bultosIds });
      remitoModal.onClose();
      const num = res?.numero || "formal";
      notifySuccess("Remito emitido", `Remito ${num} emitido exitosamente.`);
      await refresh();
      setActiveTab("despacho");
      return { ok: true };
    } catch (err) {
      const msg = err.message || "Error al emitir el remito.";
      setAccionError(msg);
      notifyError(err, { entity: "Remito", action: "emitir" });
      return { ok: false, error: msg };
    } finally {
      setGenerandoRemito(false);
    }
  };

  const handleDespachar = async () => {
    if (!remito || isStale || isLoading || !puedeOperarOrigen) return;
    setDespachando(true);
    setAccionError("");
    try {
      await logisticaService.despacharRemito(remito.numero);
      notifySuccess("Remito despachado", `Remito ${remito.numero} despachado. Mercadería en tránsito.`);
      await refresh();
      setActiveTab("recepcion");
    } catch (error) {
      const msg = error.message || "No se pudo despachar el remito.";
      setAccionError(msg);
      notifyError(error, { entity: "Remito", action: "despachar" });
    } finally {
      setDespachando(false);
    }
  };

  const isPendienteOrPreparando = orden?.estado === "PENDIENTE" || orden?.estado === "EN_PREPARACION";
  const guidanceByTab = useMemo(
    () =>
      computeGuidanceByTab({
        orden,
        bultos,
        remito,
        totalSolicitadas,
        totalEmpaquetadas,
        estaCompletamenteEmpaquetada,
        bultosTodosPrecintados,
        onEmitirRemito: remitoModal.onOpen,
        onDespachar: handleDespachar,
        puedeOperar: puedeOperarOrigen,
      }),
    [orden, bultos, remito, totalSolicitadas, totalEmpaquetadas, estaCompletamenteEmpaquetada, bultosTodosPrecintados, remitoModal.onOpen, handleDespachar, puedeOperarOrigen]
  );
  const currentGuidance = guidanceByTab[activeTab] || guidanceByTab.resumen;

  if (isLoading && !orden) {
    return <div className="p-8 text-center text-secondary">Cargando detalle de la orden de reposición...</div>;
  }

  if (error && !orden) {
    return (
      <div className="card p-6 stack gap-4 text-center">
        <h2 className="text-lg text-danger">No se pudo cargar la orden</h2>
        <p className="text-sm text-secondary">{error.message || "La orden solicitada no existe."}</p>
        <div className="row justify-center">
          <Button variant="secondary" onClick={() => navigate("/logistica/ordenes")}>
            Volver al listado de órdenes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="logistics-workbench stack gap-5">
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span className="cursor-pointer text-secondary" onClick={() => navigate("/logistica/ordenes")}>
              Distribución y órdenes
            </span>
            <span>·</span>
            <span>Orden #{orden.id}</span>
          </div>
          <div className="row gap-3 align-center mt-1 wrap">
            <h1 className="text-xl">Orden de reposición #{orden.id}</h1>
            <StatusBadge status={orden.estado} />
            <LiveIndicator freshnessSeconds={freshnessSeconds} isStale={isStale} onRefresh={refresh} />
          </div>
        </div>

        {/* Jerarquía estricta: un único botón principal de mayor peso visual por pantalla */}
        <div className="row gap-2 align-center">
          {!puedeOperarOrigen ? null : activeTab === "empaque" ? (
            estaCompletamenteEmpaquetada && bultosTodosPrecintados && todosBultosAprobados && !remito ? (
              <Button variant="primary" iconRight="arrow-right" disabled={isStale || isLoading} onClick={remitoModal.onOpen}>
                Emitir remito único ({bultos.length} bultos)
              </Button>
            ) : null
          ) : (
            <>
              {isPendienteOrPreparando && bultos.length === 0 && (
                <Button variant="primary" iconLeft="package" onClick={() => setActiveTab("empaque")}>
                  Comenzar empaquetado
                </Button>
              )}

              {isPendienteOrPreparando && bultos.length > 0 && !estaCompletamenteEmpaquetada && (
                <Button variant="primary" iconLeft="package" onClick={() => setActiveTab("empaque")}>
                  Continuar empaquetado ({totalEmpaquetadas}/{totalSolicitadas} u.)
                </Button>
              )}

              {isPendienteOrPreparando && estaCompletamenteEmpaquetada && !bultosTodosPrecintados && (
                <Button variant="primary" iconLeft="shield" onClick={() => setActiveTab("empaque")}>
                  Gestionar precintos ({bultosPrecintados.length}/{bultos.length})
                </Button>
              )}

              {isPendienteOrPreparando && estaCompletamenteEmpaquetada && bultosTodosPrecintados && !todosBultosAprobados && (
                <Button variant="primary" iconLeft="check-circle" onClick={() => setActiveTab("empaque")}>
                  Aprobar bultos elegibles ({bultosElegiblesParaAprobar.length})
                </Button>
              )}

              {isPendienteOrPreparando && estaCompletamenteEmpaquetada && bultosTodosPrecintados && todosBultosAprobados && !remito && (
                <Button variant="primary" iconRight="arrow-right" disabled={isStale || isLoading} onClick={remitoModal.onOpen}>
                  Emitir remito de despacho
                </Button>
              )}
            </>
          )}

          {puedeOperarOrigen && isPendienteOrPreparando && remito && remito.estado === "EMITIDO" && (
            <Button variant="primary" iconRight="truck" loading={despachando} disabled={isStale || isLoading} onClick={handleDespachar}>
              Despachar remito {remito.numero}
            </Button>
          )}

          {orden.estado === "DESPACHADA" && (
            <Button variant="primary" iconRight="arrow-right" onClick={() => setActiveTab("recepcion")}>
              Gestionar recepción en destino
            </Button>
          )}

          {orden.estado === "CERRADA" && (
            <Button variant="secondary" onClick={() => navigate("/logistica/ordenes")}>
              Volver a órdenes
            </Button>
          )}
        </div>
      </div>

      <section className="logistics-order-context" aria-label="Contexto de la orden">
        <div><span>Origen · Centro de distribución</span><strong>{origenNombre}</strong></div>
        <div><span>Destino · Sucursal</span><strong>{destinoNombre}</strong></div>
        <div><span>Documento de traslado</span>{remito ? <><strong>{remito.numero}</strong><StatusBadge status={remito.documentoEstado || remito.estado} /></> : <strong>Remito aún no emitido</strong>}</div>
        <div><span>Unidades empaquetadas / solicitadas</span><strong className="tabular-nums">{totalEmpaquetadas} / {totalSolicitadas}</strong><span>{bultos.length} bulto(s) · {bultos.filter((b) => b.aprobado).length} aprobado(s)</span></div>
      </section>
      <OrderWorkflowRail activeTab={activeTab} onSelect={setActiveTab} orden={orden} remito={remito} />

      {!puedeOperarOrigen && (isPendienteOrPreparando || remito?.estado === "EMITIDO") && (
        <Alert tone="warning" title="Acciones de empaque y despacho no disponibles" description={MENSAJE_FUERA_DE_ALCANCE} />
      )}

      {accionError && <Alert tone="danger" title="No se pudo completar la acción" description={accionError} />}

      {/* Alerta de orientación: NUNCA duplica el botón primario del encabezado */}
      {currentGuidance && (
        <Alert
          tone={currentGuidance.tone}
          title={currentGuidance.title}
          description={currentGuidance.description}

        />
      )}

      {activeTab === "resumen" && (
        <>
          {bloqueadores.map((b) => (
            <Alert key={b.id} tone={b.tone} title={b.titulo} description={b.desc} />
          ))}

          <div className="grid-2 gap-4">
            <OrdenRenglonesCard
              detalles={detallesConProgreso}
              totalSolicitadas={totalSolicitadas}
              totalEmpaquetadas={totalEmpaquetadas}
              estaCompletamenteEmpaquetada={estaCompletamenteEmpaquetada}
              onComenzarEmpaque={() => setActiveTab("empaque")}
            />

            <div className="stack gap-4">
              <div className="card p-4 stack gap-3">
                <h3 className="text-md font-medium">Información de traslado</h3>
                <div className="grid-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted block">Origen (CD)</span>
                    <span className="font-medium">{origenNombre}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted block">Destino (Local)</span>
                    <span className="font-medium">{destinoNombre}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted block">Responsable</span>
                    <span>{responsableNombre}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted block">Fecha de solicitud</span>
                    <span>{new Date(orden.fecha).toLocaleDateString("es-AR")}</span>
                  </div>
                </div>
              </div>

              <div className="card p-4 stack gap-2">
                <div className="row justify-between align-center">
                  <h3 className="text-md font-medium">Bultos armados</h3>
                  <span className="text-xs text-secondary">{bultos.length} registrados</span>
                </div>
                {bultos.length === 0 ? (
                  <p className="text-xs text-secondary">
                    No se han armado bultos todavía. Iniciá el empaquetado para abastecer las unidades solicitadas.
                  </p>
                ) : (
                  <div className="stack gap-1 text-xs">
                    {bultos.slice(0, 4).map((b) => (
                      <div key={b.id} className="row justify-between align-center p-2 rounded bg-surface-muted">
                        <span className="font-mono">Bulto #{b.id}</span>
                        <StatusBadge status={b.estado} />
                      </div>
                    ))}
                    {bultos.length > 4 && (
                      <span className="text-xs text-secondary text-center pt-1">
                        + {bultos.length - 4} bultos más
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "despacho" && (
        <OrdenDespachoTab
          remito={remito}
          origenNombre={origenNombre}
          destinoNombre={destinoNombre}
          estaCompletamenteEmpaquetada={estaCompletamenteEmpaquetada}
          bultosTodosPrecintados={bultosTodosPrecintados}
          bultosTodosAprobados={todosBultosAprobados}
          despachando={despachando}
          puedeOperar={puedeOperarOrigen}
          onEmitirRemitoClick={remitoModal.onOpen}
          onDespacharClick={handleDespachar}
          onIrAEmpaque={() => setActiveTab("empaque")}
          onIrARecepcion={() => setActiveTab("recepcion")}
        />
      )}

      {activeTab === "empaque" && (
        <>
          {isPendienteOrPreparando ? (
            <EmpaquetadoPage
              ordenId={orden.id}
              embedded
              onChange={(result) => {
                refresh();
                if (result?.remitoNumero) setActiveTab("despacho");
              }}
            />
          ) : (
            <div className="card p-4 stack gap-3">
              <div>
                <h3 className="text-md font-medium">Empaque cerrado para esta orden</h3>
                <p className="text-sm text-secondary">
                  La orden ya avanzó a despacho. Consultá los bultos y el documento en Remito y despacho.
                </p>
              </div>
              <div>
                <Button variant="secondary" onClick={() => setActiveTab("despacho")}>
                  Ver remito y despacho
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "recepcion" && (
        remito?.estado === "DESPACHADO" ||
        remito?.estado === "EN_TRANSITO" ||
        remito?.estado === "RECIBIDO" ||
        remito?.estado === "CERRADO" ? (
          <RecepcionPage remitoNumero={remito.numero} embedded onChange={refresh} />
        ) : (
          <div className="card p-4 stack gap-3">
            <div>
              <h3 className="text-md font-medium">Recepción todavía no disponible</h3>
              <p className="text-sm text-secondary">
                Primero emití y despachá el remito; recién entonces se puede registrar el arribo y controlar los precintos.
              </p>
            </div>
            <div>
              <Button variant="primary" onClick={() => setActiveTab("despacho")}>
                Ir a remito y despacho
              </Button>
            </div>
          </div>
        )
      )}

      {activeTab === "historial" && (
        <div className="card p-4">
          <OrdenTimeline
            orden={orden}
            bultos={bultos}
            remito={remito}
            origenNombre={origenNombre}
            destinoNombre={destinoNombre}
            responsableNombre={responsableNombre}
          />
        </div>
      )}

      {orden && (
        <ConsolidarModal
          open={remitoModal.open}
          onClose={remitoModal.onClose}
          orden={orden}
          bultos={bultosPrecintados}
          onSubmit={handleEmitirRemito}
          pending={generandoRemito}
        />
      )}
    </div>
  );
}

export default OrdenDetallePage;
