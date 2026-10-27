import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Select,
  Modal,
  useLiveResource,
  LiveIndicator,
} from "../../../shared";
import { useUbicaciones } from "../../ubicaciones_stock/hooks/useUbicaciones";
import { logisticaService } from "../services";
import { mapOrdenToUI, mapRemitoToUI, mapBultoToUI } from "../mappers/logisticaMappers";
import { OrdenKanban, ORDEN_STAGES } from "../components/OrdenKanban";
import { RemitoKanban, REMITO_STAGES } from "../components/RemitoKanban";

/**
 * OperacionesPage (T051 / US4 / FR-031):
 * Pantalla central de tableros operativos Kanban separados por tipo de entidad:
 * - Preparacion / Despacho: Tarjetas de Ordenes de reposicion.
 * - Recepcion / Control: Tarjetas de Remitos de traslado.
 * Arrastre asistido con 3 grados de inclinacion y drop que abre modal de confirmacion
 * sin mutar el estado directamente (FR-031).
 * Vista alternativa accesible equivalente en modo lista.
 */
export function OperacionesPage() {
  const navigate = useNavigate();
  const { ubicaciones } = useUbicaciones();

  // Tablero activo: "ordenes" | "remitos"
  const [activeBoard, setActiveBoard] = useState("ordenes");
  // Modo de visualizacion: "kanban" | "list"
  const [viewMode, setViewMode] = useState("kanban");
  // Filtro de destino (Local)
  const [filtroDestino, setFiltroDestino] = useState("");

  // Modales de confirmacion por drop (FR-031)
  const [modalDropOrden, setModalDropOrden] = useState(null);
  const [modalDropRemito, setModalDropRemito] = useState(null);

  const ubicMap = useMemo(
    () => new Map(ubicaciones.map((u) => [u.id, u.nombre])),
    [ubicaciones]
  );

  const localOptions = useMemo(() => {
    return [
      { value: "", label: "Todos los destinos" },
      ...ubicaciones
        .filter((u) => u.tipo === "LOCAL")
        .map((u) => ({ value: String(u.id), label: u.nombre })),
    ];
  }, [ubicaciones]);

  // Carga reactiva de datos operacionales (15s polling - FR-028)
  const fetchOperacionesData = useCallback(async () => {
    const [ordRes, remRes] = await Promise.all([
      logisticaService.listarOrdenes(),
      logisticaService.listarRemitos(),
    ]);

    const ordList = Array.isArray(ordRes) ? ordRes : ordRes?.data || [];
    const remList = Array.isArray(remRes) ? remRes : remRes?.data || [];

    const ordenesMapped = ordList.map(mapOrdenToUI);
    const remitosMapped = remList.map(mapRemitoToUI);

    // Cada tarjeta necesita sus bultos reales, incluso si la orden ya fue cerrada.
    const bultosMap = {};
    await Promise.all(
      ordenesMapped.map(async (o) => {
        const res = await logisticaService.listarBultosPorOrden(o.id);
        const list = Array.isArray(res) ? res : res?.data || [];
        bultosMap[o.id] = list.map(mapBultoToUI);
      })
    );

    return {
      ordenes: ordenesMapped,
      remitos: remitosMapped,
      bultosPorOrden: bultosMap,
    };
  }, []);

  const {
    data,
    isLoading,
    freshnessSeconds,
    isStale,
    refresh,
  } = useLiveResource(fetchOperacionesData, {
    enabled: true,
    intervalMs: 15000,
  });

  const ordenes = data?.ordenes || [];
  const remitos = data?.remitos || [];
  const bultosPorOrden = data?.bultosPorOrden || {};

  // Handlers para drops (FR-031: Intent que abre modal, sin mutar inmediatamente)
  const handleDropOrder = (card, targetStage) => {
    setModalDropOrden({
      card,
      targetStage,
      targetStageInfo: ORDEN_STAGES.find((s) => s.stage === targetStage),
    });
  };

  const handleDropRemito = (card, targetStage) => {
    setModalDropRemito({
      card,
      targetStage,
      targetStageInfo: REMITO_STAGES.find((s) => s.stage === targetStage),
    });
  };

  const handleConfirmarDropOrden = () => {
    if (!modalDropOrden) return;
    const { card, targetStage } = modalDropOrden;
    setModalDropOrden(null);

    const tab = targetStage <= 2 ? "empaque" : targetStage === 3 ? "despacho" : "recepcion";
    navigate(`/logistica/ordenes/${card.ordenId}?tab=${tab}`);
  };

  const handleConfirmarDropRemito = () => {
    if (!modalDropRemito) return;
    const { card, targetStage } = modalDropRemito;
    setModalDropRemito(null);
    const tab = targetStage <= 1 ? "despacho" : "recepcion";
    navigate(
      card.ordenId
        ? `/logistica/ordenes/${card.ordenId}?tab=${tab}`
        : `/logistica/remitos/${encodeURIComponent(card.numero)}`
    );
  };

  return (
    <div className="stack gap-5">
      {/* Header con breadcrumb y frescura */}
      <div className="erp-flow-header">
        <div>
          <div className="erp-breadcrumb">
            <span className="cursor-pointer text-secondary" onClick={() => navigate("/logistica/ordenes")}>
              Distribución
            </span>
            <span>·</span>
            <span>Operaciones logísticas</span>
          </div>
          <div className="row gap-3 align-center mt-1">
            <h1 className="text-xl">Tableros de operaciones</h1>
            <LiveIndicator freshnessSeconds={freshnessSeconds} isStale={isStale} onRefresh={refresh} />
          </div>
        </div>

        {/* FR-043: Una unica accion primaria contextually */}
        <div>
          <Button
            variant="primary"
            iconLeft="plus"
            onClick={() => navigate("/logistica/ordenes/nueva")}
          >
            Nueva orden de reposición
          </Button>
        </div>
      </div>

      {/* Barra de herramientas y filtros */}
      <div className="card p-3 row justify-between align-center wrap gap-3">
        <div className="row gap-2 align-center wrap">
          {/* Selector de entidad */}
          <div className="row gap-1 bg-surface-muted p-1 rounded">
            <Button
              size="sm"
              variant={activeBoard === "ordenes" ? "primary" : "ghost"}
              onClick={() => setActiveBoard("ordenes")}
            >
              Preparación y despacho (Órdenes)
            </Button>
            <Button
              size="sm"
              variant={activeBoard === "remitos" ? "primary" : "ghost"}
              onClick={() => setActiveBoard("remitos")}
            >
              Recepción y control (Remitos)
            </Button>
          </div>

          {/* Selector de vista: Kanban o Lista accesible */}
          <div className="row gap-1 bg-surface-muted p-1 rounded">
            <Button
              size="sm"
              variant={viewMode === "kanban" ? "primary" : "ghost"}
              onClick={() => setViewMode("kanban")}
            >
              Tablero
            </Button>
            <Button
              size="sm"
              variant={viewMode === "list" ? "primary" : "ghost"}
              onClick={() => setViewMode("list")}
            >
              Lista accesible
            </Button>
          </div>
        </div>

        {/* Filtro por destino */}
        <div className="w-64">
          <Select
            options={localOptions}
            value={filtroDestino}
            onChange={setFiltroDestino}
            placeholder="Filtrar por sucursal"
          />
        </div>
      </div>

      {/* Tablero de Ordenes (Preparacion y Despacho) */}
      {activeBoard === "ordenes" && (
        <OrdenKanban
          ordenes={ordenes}
          bultosPorOrden={bultosPorOrden}
          ubicMap={ubicMap}
          viewMode={viewMode}
          filtroDestino={filtroDestino}
          onDropOrder={handleDropOrder}
        />
      )}

      {/* Tablero de Remitos (Recepcion y Control) */}
      {activeBoard === "remitos" && (
        <RemitoKanban
          remitos={remitos}
          ubicMap={ubicMap}
          viewMode={viewMode}
          filtroDestino={filtroDestino}
          onDropRemito={handleDropRemito}
        />
      )}

      {/* Modal de confirmacion para drop de Orden (FR-031) */}
      {modalDropOrden && (
        <Modal
          open={Boolean(modalDropOrden)}
          onClose={() => setModalDropOrden(null)}
          title={`Acción requerida para ${modalDropOrden.card.code}`}
          subtitle={`Intención de avance: ${modalDropOrden.targetStageInfo?.title}`}
          footer={
            <div className="row justify-between w-full">
              <Button variant="ghost" onClick={() => setModalDropOrden(null)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleConfirmarDropOrden}>
                Ir a completar acción
              </Button>
            </div>
          }
        >
          <div className="stack gap-3">
            <div className="erp-callout">
              <span className="text-sm text-secondary">
                Regla FR-031: El arrastre en el tablero expresa una intención de avance y
                no muta el estado directamente sin cumplir los requisitos de empaquetado,
                precintado y emisión formal del remito único.
              </span>
            </div>

            <div className="p-3 rounded bg-surface-muted stack gap-1 text-sm">
              <span className="font-medium">Orden: {modalDropOrden.card.code}</span>
              <span className="text-secondary">Ruta: {modalDropOrden.card.route}</span>
              <span className="text-secondary">
                Avance actual: {modalDropOrden.card.totalEmp} / {modalDropOrden.card.totalSol} u.
                ({modalDropOrden.card.bultosCount} bultos)
              </span>
            </div>

            <p className="text-sm text-secondary">
              Presione &quot;Ir a completar acción&quot; para abrir la pantalla de trabajo correspondiente
              y completar el armado de bultos o la emisión formal del remito.
            </p>
          </div>
        </Modal>
      )}

      {/* Modal de confirmacion para drop de Remito (FR-031 / FR-032) */}
      {modalDropRemito && (
        <Modal
          open={Boolean(modalDropRemito)}
          onClose={() => setModalDropRemito(null)}
          title={`Abrir orden de ${modalDropRemito.card.code}`}
          subtitle={`Etapa de trabajo: ${modalDropRemito.targetStageInfo?.title}`}
          footer={
            <div className="row justify-between w-full">
              <Button
                variant="ghost"
                onClick={() => setModalDropRemito(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmarDropRemito}
            >
                Abrir orden
              </Button>
            </div>
          }
        >
          <div className="stack gap-3">
            <div className="erp-callout">
              <span className="text-sm text-secondary">
                El tablero sólo ordena el trabajo. La acción se completa dentro de la orden, donde
                se conserva la evidencia y se indica el siguiente paso.
              </span>
            </div>

            <div className="p-3 rounded bg-surface-muted stack gap-1 text-sm">
              <span className="font-medium">Remito: {modalDropRemito.card.code}</span>
              <span className="text-secondary">Ruta: {modalDropRemito.card.route}</span>
              <span className="text-secondary">
                Bultos amparados: {modalDropRemito.card.totalBultos} bulto(s)
              </span>
            </div>

            <div className="text-sm text-secondary">
              {modalDropRemito.targetStage === 1 ? (
                <span>
                  Abra la orden para revisar el remito y ejecutar el despacho formal desde su pestaña.
                </span>
              ) : (
                <span>
                  Abra la orden para registrar la recepción y verificar los precintos de cada bulto.
                </span>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default OperacionesPage;
