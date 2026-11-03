import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, StatusBadge } from "../../../shared/components/Badge";
import { Button } from "../../../shared/components/Button";
import { SortableDataTable } from "../../../shared/components/SortableDataTable";
import { isDateToday } from "../../../shared";

export const ORDEN_STAGES = [
  { stage: 0, key: "PENDIENTE", title: "Por preparar" },
  { stage: 1, key: "EN_PREPARACION", title: "Empaquetando" },
  { stage: 2, key: "FALTA_PRECINTO", title: "Falta precinto" },
  { stage: 3, key: "PARA_REMITO", title: "Para remito" },
  { stage: 4, key: "DESPACHADA", title: "Despachada / En tránsito" },
  { stage: 5, key: "CERRADA", title: "Cerradas hoy" },
];

/**
 * OrdenKanban (T051 / FR-031 / US4):
 * Tablero Kanban segregado exclusivamente para Órdenes de Reposición.
 * Arrastre visual con inclinacion de 3 grados y drop a confirmacion obligatoria.
 * Incluye vista de lista alternativa y accesible.
 */
export function OrdenKanban({
  ordenes = [],
  bultosPorOrden = {},
  ubicMap = new Map(),
  viewMode = "kanban", // "kanban" | "list"
  filtroDestino = "",
  onDropOrder,
}) {
  const navigate = useNavigate();
  const [draggedCard, setDraggedCard] = useState(null);
  const [dropTargetStage, setDropTargetStage] = useState(null);

  // Clasificar cada orden en su etapa segun estado y progreso de bultos
  const cards = useMemo(() => {
    return ordenes
      .filter((o) => {
        if (filtroDestino && String(o.destinoId) !== String(filtroDestino)) {
          return false;
        }
        if (o.estado === "CERRADA") {
          const fechaRaw = o.fecha || o.creadoEn || o.fechaCreacion;
          if (!isDateToday(fechaRaw)) {
            return false;
          }
        }
        return true;
      })
      .map((o) => {
        const bultos = bultosPorOrden[o.id] || [];
        const totalSol = (o.detalles || []).reduce((s, d) => s + (d.cantidadSolicitada || 0), 0);
        const totalEmp = bultos.reduce(
          (sum, b) => sum + (b.detalles?.reduce((s, d) => s + (d.cantidad || 0), 0) || 0),
          0
        );

        let stage = 0;
        let badgeText = "Por preparar";

        if (o.estado === "CERRADA") {
          stage = 5;
          badgeText = "Cerrada hoy";
        } else if (o.estado === "DESPACHADA" || o.estado === "EN_TRANSITO") {
          stage = 4;
          badgeText = "En tránsito";
        } else if (bultos.length > 0) {
          const haySinPrecinto = bultos.some((b) => b.estado === "PREPARADO" || !b.codigoPrecinto);
          if (totalEmp >= totalSol && totalSol > 0 && !haySinPrecinto) {
            stage = 3;
            badgeText = "Lista para remito";
          } else if (haySinPrecinto) {
            stage = 2;
            badgeText = "Falta precinto";
          } else {
            stage = 1;
            badgeText = "Empaquetando";
          }
        } else if (o.estado === "EN_PREPARACION") {
          stage = 1;
          badgeText = "En preparación";
        }

        const origenNombre = ubicMap.get(o.origenId) || `CD #${o.origenId}`;
        const destinoNombre = ubicMap.get(o.destinoId) || `Local #${o.destinoId}`;
        const fechaRaw = o.fecha || o.creadoEn || o.fechaCreacion || "2026-10-28T10:30:00";
        const fecha = fechaRaw ? new Date(fechaRaw).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "Sin fecha";

        return {
          id: `ord-${o.id}`,
          ordenId: o.id,
          code: `OR-${String(o.id).padStart(4, "0")}`,
          stage,
          badgeText,
          estadoReal: o.estado,
          route: `${origenNombre} -> ${destinoNombre}`,
          origenNombre,
          destinoNombre,
          totalSol,
          totalEmp,
          bultosCount: bultos.length,
          owner: "Operador de Logística",
          avatar: "OP",
          fecha,
        };
      });
  }, [ordenes, bultosPorOrden, ubicMap, filtroDestino]);

  // Manejo de drag and drop nativo accesible
  const handleDragStart = (e, card) => {
    setDraggedCard(card);
    e.dataTransfer.setData("text/plain", String(card.ordenId));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
    setDropTargetStage(null);
  };

  const handleDragOver = (e, stage) => {
    if (draggedCard && stage === draggedCard.stage + 1) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dropTargetStage !== stage) setDropTargetStage(stage);
    }
  };

  const handleDragLeave = (stage) => {
    if (dropTargetStage === stage) setDropTargetStage(null);
  };

  const handleDrop = (e, targetStage) => {
    e.preventDefault();
    setDropTargetStage(null);
    if (!draggedCard) return;

    if (targetStage !== draggedCard.stage + 1) {
      setDraggedCard(null);
      return;
    }

    const card = draggedCard;
    setDraggedCard(null);
    onDropOrder?.(card, targetStage);
  };

  const columns = useMemo(
    () => [
      {
        key: "code",
        header: "Orden",
        mono: true,
        sortable: true,
        render: (v, row) => (
          <strong
            className="font-mono text-sm cursor-pointer"
            onClick={() => navigate(`/logistica/ordenes/${row.ordenId}`)}
          >
            {row.code}
          </strong>
        ),
      },
      {
        key: "fecha",
        header: "Hora y fecha",
        sortable: true,
        render: (v) => <span className="text-xs text-secondary tabular-nums">{v}</span>,
      },
      {
        key: "owner",
        header: "Responsable",
        sortable: true,
        render: (v) => <span className="text-xs text-secondary">{v}</span>,
      },
      {
        key: "origenNombre",
        header: "Origen (CD)",
        sortable: true,
        render: (v) => <span className="text-sm font-medium">{v}</span>,
      },
      {
        key: "destinoNombre",
        header: "Destino (Local)",
        sortable: true,
        render: (v) => <span className="text-sm">{v}</span>,
      },
      {
        key: "totalEmp",
        header: "Bultos y unidades",
        align: "right",
        sortable: true,
        render: (_, row) => (
          <span className="text-xs tabular-nums font-medium text-foreground">
            {row.totalEmp} / {row.totalSol} u. ({row.bultosCount} bultos)
          </span>
        ),
      },
      {
        key: "estadoReal",
        header: "Estado",
        sortable: true,
        render: (_, row) => (
          <div className="row gap-2 align-center wrap">
            <StatusBadge status={row.estadoReal} />
            <Badge tone="neutral" dot={false}>
              {ORDEN_STAGES[row.stage]?.title || row.badgeText}
            </Badge>
          </div>
        ),
      },
      {
        key: "acciones",
        header: "Acción",
        align: "right",
        sortable: false,
        render: (_, row) => {
          const tab = row.stage <= 2 ? "empaque" : row.stage === 3 ? "despacho" : "recepcion";
          const actionText =
            row.stage <= 2
              ? "Gestionar empaque"
              : row.stage === 3
              ? "Emitir remito"
              : row.stage === 4
              ? "Gestionar recepción"
              : "Ver orden";
          const icon = row.stage <= 2 ? "package" : row.stage === 3 ? "truck" : row.stage === 4 ? "check" : "eye";
          return (
            <div className="row gap-2 justify-end align-center wrap">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate(`/logistica/ordenes/${row.ordenId}`)}
              >
                Ver orden
              </Button>
              {row.stage < 5 && (
                <Button
                  size="sm"
                  variant="primary"
                  iconLeft={icon}
                  onClick={() => navigate(`/logistica/ordenes/${row.ordenId}?tab=${tab}`)}
                >
                  {actionText}
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [navigate]
  );

  if (viewMode === "list") {
    return (
      <div className="stack gap-3">
        <div className="row justify-between align-center">
          <h3 className="text-md font-medium">Listado operacional de órdenes de reposición</h3>
          <span className="text-xs text-secondary">{cards.length} orden(es) registradas</span>
        </div>
        <SortableDataTable
          columns={columns}
          data={cards}
          rowKey="id"
          selectable={false}
          emptyTitle="Sin órdenes de reposición"
          emptyDescription="No se encontraron órdenes registradas para el filtro seleccionado."
        />
      </div>
    );
  }

  return (
    <div className="kanban-shell">
      <div className="kanban">
        {ORDEN_STAGES.map((col) => {
          const cardsInCol = cards.filter((c) => c.stage === col.stage);
          const isValidTarget = draggedCard && col.stage === draggedCard.stage + 1;
          const isInvalidTarget = draggedCard && col.stage !== draggedCard.stage + 1;
          const isDropTarget = dropTargetStage === col.stage;

          let colClass = "column";
          if (isValidTarget) colClass += " valid-target";
          if (isInvalidTarget) colClass += " invalid-target";
          if (isDropTarget) colClass += " drop-target";

          return (
            <section
              key={col.stage}
              className={colClass}
              onDragOver={(e) => handleDragOver(e, col.stage)}
              onDragLeave={() => handleDragLeave(col.stage)}
              onDrop={(e) => handleDrop(e, col.stage)}
            >
              <div className="column-head">
                <span>{col.title}</span>
                <span className="column-count">{cardsInCol.length}</span>
              </div>

              <div className="stack gap-2 min-h-64">
                {cardsInCol.map((c) => {
                  const isDragging = draggedCard?.id === c.id;
                  return (
                    <article
                      key={c.id}
                      className={`task ${isDragging ? "dragging" : ""}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, c)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="task-title">
                        <strong
                          className="cursor-pointer"
                          onClick={() => {
                            const tab = c.stage <= 2 ? "empaque" : c.stage === 3 ? "despacho" : "recepcion";
                            navigate(`/logistica/ordenes/${c.ordenId}${c.stage < 5 ? `?tab=${tab}` : ""}`);
                          }}
                        >
                          {c.code}
                        </strong>
                        <span className="badge-pill bg-surface-muted text-xs">
                          {c.badgeText}
                        </span>
                      </div>

                      <div className="task-route">{c.route}</div>

                      <div className="task-meta">
                        {c.totalEmp} / {c.totalSol} u. empaquetadas · {c.bultosCount} bulto(s)
                      </div>

                      <div className="owner">
                        <span className="avatar sm light">{c.avatar}</span>
                        {c.owner}
                      </div>

                      <Button
                        size="sm"
                        variant={c.stage === 3 ? "primary" : c.stage === 5 ? "ghost" : "secondary"}
                        iconLeft={c.stage <= 2 ? "package" : c.stage === 3 ? "truck" : c.stage === 4 ? "check" : "eye"}
                        className="task-next"
                        onClick={() => {
                          const tab = c.stage <= 2 ? "empaque" : c.stage === 3 ? "despacho" : "recepcion";
                          navigate(`/logistica/ordenes/${c.ordenId}${c.stage < 5 ? `?tab=${tab}` : ""}`);
                        }}
                      >
                        {c.stage <= 2
                          ? "Gestionar bultos"
                          : c.stage === 3
                          ? "Emitir remito"
                          : c.stage === 4
                          ? "Gestionar recepción"
                          : "Ver orden"}
                      </Button>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default OrdenKanban;
