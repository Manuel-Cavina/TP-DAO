import React, { useMemo, useCallback, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  StatusBadge,
  Alert,
  SegmentedControl,
  useLiveResource,
  LiveIndicator,
} from "../../../shared";
import { useUbicaciones } from "../../ubicaciones_stock/hooks/useUbicaciones";
import { useProductos } from "../../catalogo/hooks/useProductos";
import { useAuth } from "../../../app/auth/AuthProvider";
import { logisticaService } from "../services";
import { mapOrdenToUI, mapBultoToUI, mapRemitoToUI } from "../mappers/logisticaMappers";
import { OrdenTimeline } from "../components/OrdenTimeline";
import { OrdenRenglonesCard } from "../components/OrdenRenglonesCard";
import { EmpaquetadoPage } from "./EmpaquetadoPage";
import { RecepcionPage } from "./RecepcionPage";

export function OrdenDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [despachando, setDespachando] = useState(false);
  const [accionError, setAccionError] = useState("");
  const { user } = useAuth();
  const { ubicaciones } = useUbicaciones();
  const { productos } = useProductos({ activos: true });

  const ubicMap = useMemo(
    () => new Map(ubicaciones.map((u) => [u.id, u.nombre])),
    [ubicaciones]
  );
  const productoMap = useMemo(
    () => new Map(productos.map((p) => [p.id, p])),
    [productos]
  );

  const fetchOrderData = useCallback(async () => {
    if (!id) return null;
    const [ordRes, bultosRes, remitosRes] = await Promise.all([
      logisticaService.obtenerOrden(id),
      logisticaService.listarBultosPorOrden(id).catch(() => []),
      logisticaService.listarRemitos().catch(() => []),
    ]);

    const ordenMapped = mapOrdenToUI(ordRes);
    const bultosRaw = Array.isArray(bultosRes) ? bultosRes : bultosRes?.data || [];
    const bultosMapped = bultosRaw.map(mapBultoToUI);
    const remitosRaw = Array.isArray(remitosRes) ? remitosRes : remitosRes?.data || [];
    const allRemitos = remitosRaw.map(mapRemitoToUI);

    const remitoNumeroEnBulto = bultosMapped.find((b) => b.remitoNumero)?.remitoNumero;
    const remitoAsociado =
      allRemitos.find((r) =>
        r.bultosIds?.some((bid) => bultosMapped.some((b) => b.id === bid))
      ) ||
      allRemitos.find((r) => r.numero === remitoNumeroEnBulto) ||
      null;

    return {
      orden: ordenMapped,
      bultos: bultosMapped,
      remito: remitoAsociado,
    };
  }, [id]);

  // Contrato de frescura operativo de 15 segundos (FR-028, SC-014)
  const {
    data,
    error,
    isLoading,
    freshnessSeconds,
    isStale,
    refresh,
  } = useLiveResource(fetchOrderData, {
    enabled: Boolean(id),
    intervalMs: 15000,
  });

  const orden = data?.orden;
  const bultos = data?.bultos || [];
  const remito = data?.remito || null;
  const activeTab = searchParams.get("tab") || "resumen";
  const setActiveTab = (tab) => setSearchParams(tab === "resumen" ? {} : { tab });

  const origenNombre = orden ? ubicMap.get(orden.origenId) || `CD #${orden.origenId}` : "";
  const destinoNombre = orden ? ubicMap.get(orden.destinoId) || `Local #${orden.destinoId}` : "";
  const responsableNombre = user?.displayName || user?.name || "Operador de Logística";

  // Calcular cantidades empaquetadas por cada linea de la orden
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

  const totalSolicitadas = useMemo(
    () => orden?.detalles.reduce((acc, d) => acc + d.cantidadSolicitada, 0) || 0,
    [orden]
  );
  const totalEmpaquetadas = useMemo(
    () => bultos.reduce((acc, b) => acc + (b.detalles || []).reduce((s, det) => s + det.cantidad, 0), 0),
    [bultos]
  );
  const estaCompletamenteEmpaquetada = totalSolicitadas > 0 && totalEmpaquetadas >= totalSolicitadas;
  const bultosTodosPrecintados = bultos.length > 0 && bultos.every((b) => b.estado !== "PREPARADO" && b.codigoPrecinto);

  // Bloqueadores vigentes de la orden (FR-030)
  const bloqueadores = useMemo(() => {
    if (!orden) return [];
    const list = [];

    if (orden.estado === "PENDIENTE" && bultos.length === 0) {
      list.push({
        id: "b-sin-iniciar",
        tone: "info",
        titulo: "Empaquetado pendiente",
        desc: "La orden aún no cuenta con bultos preparados. Debe iniciar el empaquetado para abastecer las unidades solicitadas.",
      });
    } else if (totalEmpaquetadas < totalSolicitadas) {
      list.push({
        id: "b-incompleto",
        tone: "warning",
        titulo: "Cantidades pendientes de empaque",
        desc: `Quedan ${totalSolicitadas - totalEmpaquetadas} unidad(es) solicitadas sin asignar a bultos (${totalEmpaquetadas} de ${totalSolicitadas} empaquetadas).`,
      });
    }

    const bultosSinPrecinto = bultos.filter((b) => b.estado === "PREPARADO" || !b.codigoPrecinto);
    if (bultosSinPrecinto.length > 0) {
      list.push({
        id: "b-sin-precinto",
        tone: "warning",
        titulo: "Bultos pendientes de precinto",
        desc: `Hay ${bultosSinPrecinto.length} bulto(s) sin precinto de seguridad asignado. Es requisito obligatorio que todo bulto esté precintado para emitir remito.`,
      });
    }

    if (
      bultos.length > 0 &&
      totalEmpaquetadas >= totalSolicitadas &&
      bultosSinPrecinto.length === 0 &&
      !remito &&
      orden.estado !== "DESPACHADA" &&
      orden.estado !== "CERRADA"
    ) {
      list.push({
        id: "b-listo-remito",
        tone: "success",
        titulo: "Lista para emisión de remito",
        desc: "Todos los artículos requeridos están empaquetados y sus bultos precintados. La orden se encuentra lista para generar su remito único.",
      });
    }

    return list;
  }, [orden, bultos, remito, totalSolicitadas, totalEmpaquetadas]);

  if (isLoading && !orden) {
    return (
      <div className="p-8 text-center text-secondary">
        Cargando detalle de la orden de reposición...
      </div>
    );
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

  const isPendienteOrPreparando =
    orden.estado === "PENDIENTE" || orden.estado === "EN_PREPARACION";

  const guidanceByTab = {
    resumen: orden.estado === "CERRADA"
      ? { tone: "success", title: "Orden cerrada: no queda trabajo operativo", description: "Empaque, remito y recepción finalizaron. Consultá el historial para la evidencia completa.", targetTab: "historial", targetLabel: "Ver historial" }
      : { tone: "info", title: "Estado actual de la orden", description: `${totalEmpaquetadas} de ${totalSolicitadas} unidades empaquetadas · ${bultos.length} bulto(s) registrado(s).`, targetTab: isPendienteOrPreparando ? "empaque" : "recepcion", targetLabel: isPendienteOrPreparando ? "Continuar empaque" : "Gestionar recepción" },
    empaque: remito
      ? { tone: "success", title: "Empaque y precintos completados", description: `${bultos.length} bulto(s) forman parte de ${remito.numero}. La evidencia de armado y precintos sigue disponible en esta orden.`, targetTab: remito.estado === "EMITIDO" ? "despacho" : "recepcion", targetLabel: remito.estado === "EMITIDO" ? "Despachar remito" : "Continuar recepción" }
      : { tone: totalEmpaquetadas < totalSolicitadas ? "warning" : "info", title: totalEmpaquetadas < totalSolicitadas ? "Empaque en curso" : "Bultos listos para remito", description: totalEmpaquetadas < totalSolicitadas ? `Faltan ${totalSolicitadas - totalEmpaquetadas} unidad(es) por asignar a un bulto.` : "Todos los bultos están empaquetados y precintados; el siguiente paso es emitir el remito.", targetTab: totalEmpaquetadas < totalSolicitadas ? null : "despacho", targetLabel: "Ir a remito y despacho" },
    despacho: !estaCompletamenteEmpaquetada || !bultosTodosPrecintados
      ? { tone: "warning", title: "Despacho bloqueado por empaque pendiente", description: `Hay ${totalSolicitadas - totalEmpaquetadas} unidad(es) sin empaquetar o bultos sin precinto.`, targetTab: "empaque", targetLabel: "Resolver empaque" }
      : !remito
        ? { tone: "info", title: "Lista para emitir el remito", description: `${bultos.length} bulto(s) completos y precintados esperan el documento formal de traslado.`, targetTab: "empaque", targetLabel: "Emitir remito" }
        : remito.estado === "EMITIDO"
          ? { tone: "info", title: `Remito ${remito.numero} emitido`, description: "El documento y los bultos ya están listos; el próximo paso es despachar el traslado.", targetTab: null, targetLabel: null }
          : { tone: "success", title: `Despacho registrado: ${remito.numero}`, description: `El remito está ${remito.estado.toLowerCase()}. La recepción se trabaja dentro de esta misma orden.`, targetTab: "recepcion", targetLabel: "Ir a recepción" },
    recepcion: !remito || remito.estado === "EMITIDO"
      ? { tone: "info", title: "Recepción aún no habilitada", description: "Primero debe emitirse y despacharse el remito; después se registra el arribo y se revisan los precintos.", targetTab: "despacho", targetLabel: "Ir a remito y despacho" }
      : remito.estado === "CERRADO"
        ? { tone: "success", title: "Recepción cerrada: no queda trabajo pendiente", description: `${remito.bultosVerificados} bulto(s) verificados y ${remito.bultosRechazados} rechazado(s) quedaron registrados con su impacto de stock.`, targetTab: "historial", targetLabel: "Ver historial" }
        : remito.estado === "RECIBIDO"
          ? { tone: "warning", title: "Arribo registrado: falta verificar precintos", description: `${remito.bultosPendientes} bulto(s) requieren control físico antes del cierre.`, targetTab: null, targetLabel: null }
          : { tone: "info", title: "Remito en tránsito", description: "El siguiente paso es registrar el arribo en destino para habilitar el control de precintos.", targetTab: null, targetLabel: null },
    historial: { tone: "info", title: "Trazabilidad completa de la orden", description: "La línea de vida conserva orden, bultos, precintos, remito y cierre. No altera el estado operativo.", targetTab: null, targetLabel: null },
  };
  const currentGuidance = guidanceByTab[activeTab] || guidanceByTab.resumen;

  const handleDespachar = async () => {
    if (!remito) return;
    setDespachando(true);
    setAccionError("");
    try {
      await logisticaService.despacharRemito(remito.numero);
      await refresh();
      setActiveTab("recepcion");
    } catch (error) {
      setAccionError(error.message || "No se pudo despachar el remito.");
    } finally {
      setDespachando(false);
    }
  };

  return (
    <div className="stack gap-5">
      {/* Header con breadcrumb y frescura */}
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
            <LiveIndicator
              freshnessSeconds={freshnessSeconds}
              isStale={isStale}
              onRefresh={refresh}
            />
          </div>
        </div>

        {/* ÚNICA ACCIÓN PRIMARIA VISIBLE POR CONTEXTO (FR-043) */}
        <div className="row gap-2 align-center">
          {isPendienteOrPreparando && (!estaCompletamenteEmpaquetada || !bultosTodosPrecintados) && (
            <Button
              variant="primary"
              iconRight="arrow-right"
              onClick={() => setActiveTab("empaque")}
            >
              Comenzar empaquetado
            </Button>
          )}

          {isPendienteOrPreparando && estaCompletamenteEmpaquetada && bultosTodosPrecintados && !remito && (
            <Button
              variant="primary"
              iconRight="arrow-right"
              onClick={() => setActiveTab("despacho")}
            >
              Generar remito de despacho
            </Button>
          )}

          {orden.estado === "DESPACHADA" && (
            <Button
              variant="primary"
              iconRight="arrow-right"
              onClick={() => setActiveTab("recepcion")}
            >
              Gestionar recepción en destino
            </Button>
          )}

          {orden.estado === "CERRADA" && (
            <Button
              variant="secondary"
              onClick={() => navigate("/logistica/ordenes")}
            >
              Volver a órdenes
            </Button>
          )}
        </div>
      </div>

      <SegmentedControl
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: "resumen", label: "Resumen" },
          { value: "empaque", label: "Empaque y precintos", count: bultos.length },
          { value: "despacho", label: "Remito y despacho" },
          { value: "recepcion", label: "Recepción" },
          { value: "historial", label: "Historial" },
        ]}
      />

      {accionError && <Alert tone="danger" title="No se pudo completar la acción" description={accionError} />}

      <Alert
        tone={currentGuidance.tone}
        title={currentGuidance.title}
        description={currentGuidance.description}
        action={<div className="row gap-1">{currentGuidance.targetTab && <Button variant={currentGuidance.tone === "success" ? "secondary" : "primary"} size="sm" onClick={() => setActiveTab(currentGuidance.targetTab)}>{currentGuidance.targetLabel}</Button>}{activeTab !== "historial" && <Button variant="ghost" size="sm" onClick={() => setActiveTab("historial")}>Trazabilidad</Button>}</div>}
      />

      {/* El resumen concentra lo pendiente; cada pestaña queda enfocada en su acción. */}
      {activeTab === "resumen" && bloqueadores.map((b) => (
        <Alert key={b.id} tone={b.tone} title={b.titulo} description={b.desc} />
      ))}

      {/* Información de Ruta, Responsable y Fecha */}
      {activeTab === "resumen" && <>
      <div className="grid-3 gap-3">
        <div className="card p-4 stack gap-1">
          <span className="text-xs text-muted">Origen (Centro de distribución)</span>
          <span className="text-sm font-medium">{origenNombre}</span>
          <span className="text-xs text-secondary">CD activo abastecedor</span>
        </div>

        <div className="card p-4 stack gap-1">
          <span className="text-xs text-muted">Destino (Local comercial)</span>
          <span className="text-sm font-medium">{destinoNombre}</span>
          <span className="text-xs text-secondary">Sucursal comercial receptora</span>
        </div>

        <div className="card p-4 stack gap-1">
          <span className="text-xs text-muted">Usuario responsable</span>
          <span className="text-sm font-medium">{responsableNombre}</span>
          <span className="text-xs text-secondary">
            Fecha: {orden.fecha ? new Date(orden.fecha).toLocaleDateString("es-AR") : "-"}
          </span>
        </div>
      </div>

      {/* Tabla de renglones solicitados vs empaquetados */}
      <OrdenRenglonesCard
        detalles={detallesConProgreso}
        totalSolicitadas={totalSolicitadas}
        totalEmpaquetadas={totalEmpaquetadas}
      />
      </>}

      {/* Enlaces bidireccionales: Remito asociado y Bultos */}
      {activeTab === "despacho" && <>
      {!estaCompletamenteEmpaquetada || !bultosTodosPrecintados ? (
        <div className="card p-4 stack gap-3">
          <div><h3 className="text-md font-medium">Despacho todavía no disponible</h3><p className="text-sm text-secondary">Completá el empaque y asigná un precinto a cada bulto antes de emitir el remito.</p></div>
          <div><Button variant="primary" onClick={() => setActiveTab("empaque")}>Completar empaque y precintos</Button></div>
        </div>
      ) : <>
      <div className="grid-2 gap-3">
        {/* Remito único asociado */}
        <div className="card p-4 stack gap-3">
          <div className="row justify-between align-center">
            <h3 className="text-md font-medium">Remito formal asociado</h3>
            {remito && <StatusBadge status={remito.estado} />}
          </div>

          {remito ? (
            <div className="stack gap-2">
              <div className="row justify-between align-center p-3 rounded bg-surface-muted">
                <div>
                  <span className="text-xs text-muted">Número formal</span>
                  <div className="font-mono text-sm font-medium">{remito.numero}</div>
                </div>
                <div>
                  <span className="text-xs text-muted">Emisión</span>
                  <div className="text-sm">{remito.fechaEmision ? new Date(remito.fechaEmision).toLocaleDateString("es-AR") : "-"}</div>
                </div>
                <Button
                  variant={remito.estado === "EMITIDO" ? "primary" : "secondary"}
                  size="sm"
                  loading={despachando}
                  onClick={remito.estado === "EMITIDO" ? handleDespachar : () => setActiveTab("recepcion")}
                >
                  {remito.estado === "EMITIDO" ? "Despachar remito" : "Gestionar recepción"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded bg-surface-muted text-xs text-secondary">
              Aún no se ha emitido el remito formal de despacho para esta orden. Requiere empaquetar la totalidad de unidades y precintar cada bulto (FR-021).
            </div>
          )}
        </div>

        {/* Impacto operativo y en stock */}
        <div className="card p-4 stack gap-2">
          <h3 className="text-md font-medium">Impacto operativo y en stock</h3>
          <div className="stack gap-1 text-xs text-secondary">
            <p>
              · <strong>En CD Origen ({origenNombre}):</strong> El stock queda reservado durante la preparación y se descuenta al despachar el remito.
            </p>
            <p>
              · <strong>En tránsito:</strong> La mercadería permanece en custodia legal bajo el amparo de remito y precintos numerados.
            </p>
            <p>
              · <strong>En Destino ({destinoNombre}):</strong> La mercadería <strong>NO</strong> suma al stock disponible hasta que los bultos sean verificados con precinto intacto (Regla V1).
            </p>
          </div>
        </div>
      </div>

      {!remito && <div className="card p-4 row justify-between align-center wrap gap-3"><span className="text-sm text-secondary">Los bultos están listos. Emití el remito formal desde Empaque y precintos.</span><Button variant="primary" onClick={() => setActiveTab("empaque")}>Emitir remito</Button></div>}

      </>}
      </>}

      {activeTab === "empaque" && <>
      {isPendienteOrPreparando ? <EmpaquetadoPage ordenId={orden.id} embedded onChange={(result) => { refresh(); if (result?.remitoNumero) setActiveTab("despacho"); }} /> : <div className="card p-4 stack gap-3"><div><h3 className="text-md font-medium">Empaque cerrado para esta orden</h3><p className="text-sm text-secondary">La orden ya avanzó a despacho. Consultá los bultos y el documento en Remito y despacho.</p></div><div><Button variant="secondary" onClick={() => setActiveTab("despacho")}>Ver remito y despacho</Button></div></div>}

      </>}

      {activeTab === "recepcion" && (
        remito?.estado === "DESPACHADO" || remito?.estado === "EN_TRANSITO" || remito?.estado === "RECIBIDO" || remito?.estado === "CERRADO" ? <RecepcionPage remitoNumero={remito.numero} embedded onChange={refresh} /> : <div className="card p-4 stack gap-3"><div><h3 className="text-md font-medium">Recepción todavía no disponible</h3><p className="text-sm text-secondary">Primero emití y despachá el remito; recién entonces se puede registrar el arribo y controlar los precintos.</p></div><div><Button variant="primary" onClick={() => setActiveTab("despacho")}>Ir a remito y despacho</Button></div></div>
      )}

      {activeTab === "historial" && <>
      {/* Línea temporal inmutable */}
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
      </>}
    </div>
  );
}

export default OrdenDetallePage;
