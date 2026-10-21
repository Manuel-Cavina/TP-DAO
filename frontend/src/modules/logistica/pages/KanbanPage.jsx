import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../../shared/feedback/ToastContext";

const PREP_COLUMNS = [
  { stage: 0, title: "Por preparar", initialCount: 4 },
  { stage: 1, title: "Empaquetando", initialCount: 6 },
  { stage: 2, title: "Para precintar", initialCount: 3 },
  { stage: 3, title: "Para remito", initialCount: 2 },
  { stage: 4, title: "Para despacho", initialCount: 2 },
  { stage: 5, title: "En tránsito", initialCount: 5 },
];

const RECEIVE_COLUMNS = [
  { stage: 0, title: "En tránsito", initialCount: 5 },
  { stage: 1, title: "Arribados", initialCount: 2 },
  { stage: 2, title: "Por verificar", initialCount: 8 },
  { stage: 3, title: "Con incidencia", initialCount: 1 },
  { stage: 4, title: "Cerrados hoy", initialCount: 9 },
];

const INITIAL_PREP_CARDS = [
  {
    id: "card-prep-0",
    stage: 0,
    code: "OR-000123",
    badgeText: "Pendiente",
    badgeClass: "badge",
    route: "CD Central \u2192 Local Norte",
    meta: "24 u. · 3 productos · hace 18 min",
    avatar: "LP",
    owner: "Laura Pérez",
  },
  {
    id: "card-prep-1",
    stage: 1,
    code: "OR-000118",
    badgeText: "En preparación",
    badgeClass: "badge warn",
    route: "CD Central \u2192 Local Palermo",
    hasProgress: true,
    meta: "18/24 u. · faltan 6 u.",
    avatar: "MG",
    owner: "Martín Gómez",
  },
  {
    id: "card-prep-2",
    stage: 2,
    code: "OR-000115",
    badgeText: "2 sin precinto",
    badgeClass: "badge warn",
    route: "CD Norte \u2192 Local Centro",
    meta: "36/36 u. · 3 bultos",
    avatar: "AR",
    owner: "Ana Ruiz",
  },
  {
    id: "card-prep-3",
    stage: 3,
    code: "OR-000111",
    badgeText: "Completa",
    badgeClass: "badge info",
    route: "CD Central \u2192 Local Sur",
    meta: "48/48 u. · 4 precintos",
    avatar: "LP",
    owner: "Laura Pérez",
  },
  {
    id: "card-prep-4",
    stage: 4,
    code: "RM-000077",
    badgeText: "Emitido",
    badgeClass: "badge info",
    route: "CD Central \u2192 Local Sur",
    meta: "4 bultos · 48 u.",
    avatar: "LP",
    owner: "Laura Pérez",
  },
  {
    id: "card-prep-5",
    stage: 5,
    code: "RM-000078",
    badgeText: "En tránsito",
    badgeClass: "badge warn",
    route: "CD Central \u2192 Local Palermo",
    meta: "3 bultos · demorado 3 h",
    avatar: "AR",
    owner: "Ana Ruiz · destino",
  },
];

const INITIAL_RECEIVE_CARDS = [
  {
    id: "card-rec-0",
    stage: 0,
    code: "RM-000078",
    badgeText: "En tránsito",
    badgeClass: "badge warn",
    route: "CD Central \u2192 Local Palermo",
    avatar: "AR",
    owner: "Ana Ruiz",
  },
  {
    id: "card-rec-2",
    stage: 2,
    code: "BU-000045",
    badgeText: "Recibido",
    badgeClass: "badge info",
    route: "Precinto PC-883102",
    avatar: "AR",
    owner: "Ana Ruiz",
  },
];

export function KanbanPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeBoard, setActiveBoard] = useState("prep");
  const [prepCards, setPrepCards] = useState(INITIAL_PREP_CARDS);
  const [receiveCards, setReceiveCards] = useState(INITIAL_RECEIVE_CARDS);

  // Drag state
  const [dragged, setDragged] = useState(null); // { board, cardId, stage, code }
  const [dropTargetStage, setDropTargetStage] = useState(null);

  // Confirmation modal state
  const [pendingModal, setPendingModal] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setPendingModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleEntityClick = (code) => {
    if (code.startsWith("RM-")) {
      navigate(`/logistica/remitos/${code}`);
    } else if (code.startsWith("OR-")) {
      navigate(`/logistica/ordenes/${code}`);
    } else if (code.startsWith("BU-")) {
      navigate(`/logistica/bultos/${code}`);
    }
  };

  const handleDragStart = (e, board, card) => {
    setDragged({ board, cardId: card.id, stage: card.stage, code: card.code });
    e.dataTransfer.setData("text/plain", card.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDragged(null);
    setDropTargetStage(null);
  };

  const handleDragOver = (e, stage) => {
    if (dragged && stage === dragged.stage + 1) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dropTargetStage !== stage) {
        setDropTargetStage(stage);
      }
    }
  };

  const handleDragLeave = (stage) => {
    if (dropTargetStage === stage) {
      setDropTargetStage(null);
    }
  };

  const handleDrop = (e, targetStage, targetTitle) => {
    e.preventDefault();
    setDropTargetStage(null);

    if (!dragged || targetStage !== dragged.stage + 1) {
      setDragged(null);
      toast("Transición no válida. Use únicamente la siguiente etapa habilitada.");
      return;
    }

    const { board, cardId, code } = dragged;
    setDragged(null);

    setPendingModal({
      board,
      cardId,
      code,
      targetStage,
      title: `Completar acción para ${code}`,
      subtitle: `Estado actual \u2192 ${targetTitle}`,
      note: `Soltar la tarjeta no cambió el estado. Revise requisitos y confirme para moverla a “${targetTitle}”.`,
    });
  };

  const handleNextAction = (board, card) => {
    const columns = board === "prep" ? PREP_COLUMNS : RECEIVE_COLUMNS;
    const nextCol = columns.find((c) => c.stage === card.stage + 1);

    if (!nextCol) {
      if (card.code.startsWith("RM-")) {
        navigate(`/logistica/remitos/${card.code}`);
      } else {
        navigate(`/logistica/ordenes/${card.code}`);
      }
      return;
    }

    setPendingModal({
      board,
      cardId: card.id,
      code: card.code,
      targetStage: nextCol.stage,
      title: `Completar acción para ${card.code}`,
      subtitle: `Estado actual \u2192 ${nextCol.title}`,
      note: `La tarjeta todavía no cambió. Revise los requisitos y confirme para moverla a “${nextCol.title}”.`,
    });
  };

  const handleConfirmModal = () => {
    if (!pendingModal) return;
    const { board, cardId, targetStage } = pendingModal;

    if (board === "prep") {
      setPrepCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, stage: targetStage } : c))
      );
    } else {
      setReceiveCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, stage: targetStage } : c))
      );
    }

    setPendingModal(null);
    toast("Acción registrada y añadida a la trazabilidad.");
  };

  const renderCard = (card, board) => {
    const isDragging = dragged?.cardId === card.id;

    return (
      <article
        key={card.id}
        className={`task ${isDragging ? "dragging" : ""}`}
        draggable
        data-stage={card.stage}
        onDragStart={(e) => handleDragStart(e, board, card)}
        onDragEnd={handleDragEnd}
      >
        <div className="task-title">
          <strong
            className="cursor-pointer"
            onClick={() => handleEntityClick(card.code)}
          >
            {card.code}
          </strong>
          <span className={card.badgeClass}>{card.badgeText}</span>
        </div>
        <div className="task-route">{card.route}</div>
        {card.hasProgress && (
          <div className="progress">
            <span className="progress-75" />
          </div>
        )}
        {card.meta && <div className="task-meta">{card.meta}</div>}
        <div className="owner">
          <span className="avatar sm light">{card.avatar}</span>
          {card.owner}
        </div>
        <button
          type="button"
          className="button ghost small task-next"
          onClick={() => handleNextAction(board, card)}
        >
          Acción siguiente
        </button>
      </article>
    );
  };

  return (
    <section className="screen" id="kanban">
      <div className="workspace">
        <main>
          <div className="page-head">
            <div>
              <h1>Tablero operativo</h1>
              <p className="muted">
                Todas las etapas visibles. Arrastrar abre la acción requerida; confirmar recién registra.
              </p>
            </div>
            <span className="micro tabular">Actualizado hace 4 s</span>
          </div>

          <div className="toolbar">
            <button
              type="button"
              className={`button board-toggle ${activeBoard === "prep" ? "primary" : ""}`}
              data-board-show="prep"
              onClick={() => setActiveBoard("prep")}
            >
              Preparación y despacho
            </button>
            <button
              type="button"
              className={`button board-toggle ${activeBoard === "receive" ? "primary" : ""}`}
              data-board-show="receive"
              onClick={() => setActiveBoard("receive")}
            >
              Recepción y control
            </button>
            <select className="select w-170">
              <option>Todos los destinos</option>
            </select>
            <select className="select w-170">
              <option>Todo responsable</option>
            </select>
            <button type="button" className="button">
              Vista lista
            </button>
          </div>

          <div className="board" data-board="prep" hidden={activeBoard !== "prep"}>
            <div className="kanban-shell">
              <div className="kanban">
                {PREP_COLUMNS.map((col) => {
                  const cardsInCol = prepCards.filter((c) => c.stage === col.stage);
                  const isDraggedInPrep = dragged && dragged.board === "prep";
                  const isValidTarget = isDraggedInPrep && col.stage === dragged.stage + 1;
                  const isInvalidTarget = isDraggedInPrep && col.stage !== dragged.stage + 1;
                  const isDropTarget = dropTargetStage === col.stage;

                  let colClass = "column";
                  if (isValidTarget) colClass += " valid-target";
                  if (isInvalidTarget) colClass += " invalid-target";
                  if (isDropTarget) colClass += " drop-target";

                  return (
                    <section
                      key={col.stage}
                      className={colClass}
                      data-stage={col.stage}
                      onDragOver={(e) => handleDragOver(e, col.stage)}
                      onDragLeave={() => handleDragLeave(col.stage)}
                      onDrop={(e) => handleDrop(e, col.stage, col.title)}
                    >
                      <div className="column-head">
                        <span>{col.title}</span>
                        <span className="column-count">
                          {col.initialCount + (cardsInCol.length - INITIAL_PREP_CARDS.filter((c) => c.stage === col.stage).length)}
                        </span>
                      </div>
                      {cardsInCol.map((card) => renderCard(card, "prep"))}
                    </section>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="board" data-board="receive" hidden={activeBoard !== "receive"}>
            <div className="kanban-shell">
              <div className="kanban receive">
                {RECEIVE_COLUMNS.map((col) => {
                  const cardsInCol = receiveCards.filter((c) => c.stage === col.stage);
                  const isDraggedInReceive = dragged && dragged.board === "receive";
                  const isValidTarget = isDraggedInReceive && col.stage === dragged.stage + 1;
                  const isInvalidTarget = isDraggedInReceive && col.stage !== dragged.stage + 1;
                  const isDropTarget = dropTargetStage === col.stage;

                  let colClass = "column";
                  if (isValidTarget) colClass += " valid-target";
                  if (isInvalidTarget) colClass += " invalid-target";
                  if (isDropTarget) colClass += " drop-target";

                  return (
                    <section
                      key={col.stage}
                      className={colClass}
                      data-stage={col.stage}
                      onDragOver={(e) => handleDragOver(e, col.stage)}
                      onDragLeave={() => handleDragLeave(col.stage)}
                      onDrop={(e) => handleDrop(e, col.stage, col.title)}
                    >
                      <div className="column-head">
                        <span>{col.title}</span>
                        <span className="column-count">
                          {col.initialCount + (cardsInCol.length - INITIAL_RECEIVE_CARDS.filter((c) => c.stage === col.stage).length)}
                        </span>
                      </div>
                      {cardsInCol.map((card) => renderCard(card, "receive"))}
                    </section>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="validation-note mt-3">
            Prueba el drag-and-drop: sólo la columna siguiente es válida. La tarjeta se inclina 3°, el drop abre confirmación y no se mueve hasta confirmar. En móvil y teclado se usa el menú de acción equivalente.
          </div>
        </main>
      </div>

      {pendingModal && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modalTitle"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingModal(null);
          }}
        >
          <section className="modal-wrap">
            <div className="drawer-head">
              <div>
                <h2 id="modalTitle">{pendingModal.title}</h2>
                <p className="muted" id="modalSubtitle">{pendingModal.subtitle}</p>
              </div>
              <button
                type="button"
                className="icon-button overlay-close"
                aria-label="Cerrar"
                onClick={() => setPendingModal(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="validation-note">{pendingModal.note}</div>
              <ul className="list">
                <li>
                  <span>Datos actualizados</span>
                  <strong>hace 4 s</strong>
                </li>
                <li>
                  <span>Evidencia</span>
                  <strong>Usuario · sede · fecha · documento</strong>
                </li>
              </ul>
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="button overlay-close"
                onClick={() => setPendingModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button primary"
                onClick={handleConfirmModal}
              >
                Confirmar y registrar
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default KanbanPage;
