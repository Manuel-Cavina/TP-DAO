import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, StatusBadge } from "../../../shared/components/Badge";
import { Button } from "../../../shared/components/Button";
import { SortableDataTable } from "../../../shared/components/SortableDataTable";
import { isDateToday } from "../../../shared";


export const REMITO_STAGES = [
  { stage: 0, key: "EMITIDO", title: "Emitidos en CD" },
  { stage: 1, key: "DESPACHADO", title: "En tránsito" },
  { stage: 2, key: "RECIBIDO", title: "Arribados a destino" },
  { stage: 3, key: "EN_CONTROL", title: "En verificación" },
  { stage: 4, key: "CERRADO", title: "Cerrados hoy" },
];

/**
 * RemitoKanban (T051 / FR-031 / US4):
 * Tablero Kanban segregado exclusivamente para Remitos de traslado.
 * Arrastre visual con inclinacion de 3 grados y drop a confirmacion obligatoria.
 * Incluye vista de lista alternativa y accesible.
 */
export function RemitoKanban({
  remitos = [],
  ubicMap = new Map(),
  viewMode = "kanban", // "kanban" | "list"
  filtroDestino = "",
  onDropRemito,
}) {
  const navigate = useNavigate();
  const [draggedCard, setDraggedCard] = useState(null);
  const [dropTargetStage, setDropTargetStage] = useState(null);

  const cards = useMemo(() => {
    return remitos
      .filter((r) => {
        if (filtroDestino && String(r.destinoId) !== String(filtroDestino)) {
          return false;
        }
        const esCerrado = r.documentoEstado === "CERRADO" || r.estado === "CERRADO";
        if (esCerrado) {
          const fechaRaw = r.fecha || r.creadoEn || r.fechaEmision;
          if (!isDateToday(fechaRaw)) {
            return false;
          }
        }
        return true;
      })
      .map((r) => {
        let stage = 0;
        let badgeText = "Emitido";

        if (r.documentoEstado === "CERRADO" || r.estado === "CERRADO") {
          stage = 4;
          badgeText = "Cerrado";
        } else if (r.documentoEstado === "RECIBIDO" || r.estado === "RECIBIDO") {
          const hayControlados = (r.bultosVerificados || 0) + (r.bultosRechazados || 0) > 0;
          if (hayControlados && r.bultosPendientes > 0) {
            stage = 3;
            badgeText = "En verificación";
          } else {
            stage = 2;
            badgeText = "Recibido";
          }
        } else if (
          r.documentoEstado === "DESPACHADO" ||
          r.estado === "DESPACHADO" ||
          r.estado === "EN_TRANSITO"
        ) {
          stage = 1;
          badgeText = "En tránsito";
        }

        const origenNombre = ubicMap.get(r.origenId) || `CD #${r.origenId}`;
        const destinoNombre = ubicMap.get(r.destinoId) || `Local #${r.destinoId}`;
        const fechaRaw = r.fecha || r.creadoEn || r.fechaEmision;
        const fecha = fechaRaw ? new Date(fechaRaw).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "Sin fecha";

        return {
          id: `rem-${r.numero}`,
          remito: r,
          numero: r.numero,
          ordenId: r.ordenId || r.bultosResumen?.[0]?.ordenId || null,
          code: r.numero,
          stage,
          badgeText,
          documentoEstado: r.documentoEstado || r.estado,
          route: `${origenNombre} -> ${destinoNombre}`,
          origenNombre,
          destinoNombre,
          totalBultos: r.totalBultos || 0,
          bultosVerificados: r.bultosVerificados || 0,
          bultosRechazados: r.bultosRechazados || 0,
          bultosPendientes: r.bultosPendientes || 0,
          owner: stage >= 2 ? "Operador de Sucursal" : "Transporte / CD",
          avatar: stage >= 2 ? "OS" : "TR",
          fecha,
        };
      });
  }, [remitos, ubicMap, filtroDestino]);

  const openOrder = (card, tab = "despacho") => {
    navigate(card.ordenId ? `/logistica/ordenes/${card.ordenId}?tab=${tab}` : `/logistica/remitos/${encodeURIComponent(card.numero)}`);
  };

  const handleDragStart = (e, card) => {
    setDraggedCard(card);
    e.dataTransfer.setData("text/plain", card.numero);
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
    onDropRemito?.(card, targetStage);
  };

  const columns = useMemo(
    () => [
      {
        key: "numero",
        header: "Remito",
        mono: true,
        sortable: true,
        render: (v, row) => (
          <button
            type="button"
            className="logistics-record-link"
            onClick={() => openOrder(row)}
          >
            {row.numero}
          </button>
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
        header: "Área de trabajo",
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
        key: "totalBultos",
        header: "Bultos controlados",
        align: "right",
        sortable: true,
        render: (_, row) => (
          <span className="text-xs tabular-nums font-medium text-foreground">
            {row.bultosVerificados} / {row.totalBultos} bultos ({row.bultosPendientes} pend.)
          </span>
        ),
      },
      {
        key: "documentoEstado",
        header: "Estado",
        sortable: true,
        render: (_, row) => (
          <div className="row gap-2 align-center wrap">
            <StatusBadge status={row.documentoEstado} />
            <Badge tone="neutral" dot={false}>
              {REMITO_STAGES[row.stage]?.title || row.badgeText}
            </Badge>
          </div>
        ),
      },
      {
        key: "acciones",
        header: "Acción",
        align: "right",
        sortable: false,
        render: (_, row) => (
          <div className="row gap-2 justify-end align-center wrap">
            <Button size="sm" variant="ghost" onClick={() => openOrder(row)}>
              Ver remito
            </Button>
            {row.stage === 0 && (
              <Button size="sm" variant="primary" iconLeft="truck" onClick={() => openOrder(row, "despacho")}>
                Despachar
              </Button>
            )}
            {row.stage >= 1 && row.stage < 4 && (
              <Button size="sm" variant="primary" iconLeft="check" onClick={() => openOrder(row, "recepcion")}>
                Verificar
              </Button>
            )}
          </div>
        ),
      },
    ],
    [openOrder]
  );

  if (viewMode === "list") {
    return (
      <div className="stack gap-3">
        <div className="row justify-between align-center">
          <h3 className="text-md font-medium">Listado operacional de remitos de traslado</h3>
          <span className="text-xs text-secondary">{cards.length} remito(s) registrados</span>
        </div>
        <SortableDataTable
          columns={columns}
          data={cards}
          rowKey="id"
          selectable={false}
          emptyTitle="Sin remitos de traslado"
          emptyDescription="No se encontraron remitos registrados para el filtro seleccionado."
        />
      </div>
    );
  }

  return (
    <div className="kanban-shell">
      <div className="kanban receive">
        {REMITO_STAGES.map((col) => {
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
                          onClick={() => openOrder(c, c.stage <= 1 ? "despacho" : "recepcion")}
                        >
                          {c.numero}
                        </strong>
                        <span className="badge-pill bg-surface-muted text-xs">
                          {c.badgeText}
                        </span>
                      </div>

                      <div className="task-route">{c.route}</div>

                      <div className="task-meta">
                        {c.totalBultos} bulto(s) · {c.bultosPendientes} pendientes
                      </div>

                      <div className="owner">
                        <span className="avatar sm light">{c.avatar}</span>
                        {c.owner}
                      </div>

                      <Button
                        size="sm"
                        variant={c.stage < 4 ? "primary" : "secondary"}
                        iconLeft={c.stage === 0 ? "truck" : c.stage < 4 ? "shield-check" : "check"}
                        className="task-next"
                        onClick={() => {
                          if (c.stage === 0) {
                            openOrder(c);
                          } else {
                            openOrder(c, "recepcion");
                          }
                        }}
                      >
                        {c.stage === 0 ? "Revisar despacho" : c.stage < 4 ? "Control en destino" : "Ver remito"}
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

export default RemitoKanban;
