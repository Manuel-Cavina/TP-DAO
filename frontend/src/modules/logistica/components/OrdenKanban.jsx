import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "../../../shared/components/Badge";
import { Button } from "../../../shared/components/Button";

export const ORDEN_STAGES = [
  { stage: 0, key: "PENDIENTE", title: "Por preparar" },
  { stage: 1, key: "EN_PREPARACION", title: "Empaquetando" },
  { stage: 2, key: "FALTA_PRECINTO", title: "Falta precinto" },
  { stage: 3, key: "PARA_REMITO", title: "Para remito" },
  { stage: 4, key: "DESPACHADA", title: "Despachada / En tránsito" },
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
        if (!filtroDestino) return true;
        return String(o.destinoId) === String(filtroDestino);
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

        if (o.estado === "DESPACHADA" || o.estado === "EN_TRANSITO" || o.estado === "CERRADA") {
          stage = 4;
          badgeText = "Despachada";
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

  if (viewMode === "list") {
    return (
      <div className="card p-4 stack gap-3">
        <div className="row justify-between align-center">
          <h3 className="text-md font-medium">Listado operacional de órdenes de reposición</h3>
          <span className="text-xs text-secondary">{cards.length} orden(es) registradas</span>
        </div>

        {cards.length === 0 ? (
          <div className="p-6 text-center text-secondary">
            No se encontraron órdenes de reposición para el filtro seleccionado.
          </div>
        ) : (
          <div className="stack gap-2">
            {cards.map((c) => (
              <div
                key={c.id}
                className="row justify-between align-center p-3 rounded bg-surface-muted wrap gap-2"
              >
                <div className="stack gap-1">
                  <div className="row gap-2 align-center">
                    <strong
                      className="font-mono text-sm cursor-pointer"
                      onClick={() => navigate(`/logistica/ordenes/${c.ordenId}`)}
                    >
                      {c.code}
                    </strong>
                    <StatusBadge status={c.estadoReal} />
                    <span className="badge-pill bg-accent-subtle text-accent text-xs">
                      {ORDEN_STAGES[c.stage]?.title || c.badgeText}
                    </span>
                  </div>
                  <span className="text-xs text-secondary">Ruta: {c.route}</span>
                </div>

                <div className="row gap-4 align-center">
                  <span className="text-xs tabular-nums text-secondary">
                    {c.totalEmp} / {c.totalSol} u. ({c.bultosCount} bultos)
                  </span>

                  <div className="row gap-2 align-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/logistica/empaquetado?ordenId=${c.ordenId}`)}
                    >
                      Empaquetado
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/logistica/ordenes/${c.ordenId}`)}
                    >
                      Ver orden
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
                          onClick={() => navigate(`/logistica/ordenes/${c.ordenId}`)}
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
                        variant="secondary"
                        onClick={() => {
                          if (c.stage <= 2) {
                            navigate(`/logistica/empaquetado?ordenId=${c.ordenId}`);
                          } else {
                            navigate(`/logistica/ordenes/${c.ordenId}`);
                          }
                        }}
                      >
                        {c.stage <= 2 ? "Gestionar bultos" : "Abrir detalle"}
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
