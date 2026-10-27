import React, { useState, useEffect } from "react";
import { Icon } from "./Icon";

/**
 * NotificationPanel (`frontend/src/shared/components/NotificationPanel.jsx`)
 * Panel reutilizable de notificaciones operativas con:
 * - Filtro por estado leido / no leido
 * - Categoria tematica (Stock, Logistica, Bloqueo, Sistema)
 * - Timestamp relativo / horario
 * - Entidad vinculada (Remito, Orden, SKU, Bulto)
 * - Boton de resolucion directa hacia destino
 * - Exactamente una accion primaria visible a nivel contexto (FR-043)
 */
export function NotificationPanel({
  open = true,
  onClose,
  notifications = [],
  onResolve,
  onMarkRead,
  onMarkAllRead,
  className = "",
  embedded = false,
}) {
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      className={`notification-panel ${className}`.trim()}
      role={embedded ? undefined : "dialog"}
      aria-modal={embedded ? undefined : "false"}
      aria-label={embedded ? undefined : "Panel de notificaciones"}
    >
      <div className="row justify-between align-center pb-2 border-b">
        <div className="row align-center gap-2">
          <Icon name="bell" size={16} />
          <strong>Notificaciones</strong>
          {unreadCount > 0 ? (
            <span className="badge bad micro">{unreadCount} pendientes</span>
          ) : (
            <span className="badge ok micro">Al día</span>
          )}
        </div>
        <div className="row align-center gap-1">
          {unreadCount > 0 && onMarkAllRead && (
            <button
              type="button"
              className="button ghost small"
              onClick={onMarkAllRead}
              title="Marcar todas como leídas"
            >
              Marcar leídas
            </button>
          )}
          {!embedded && onClose && (
            <button
              type="button"
              className="icon-button"
              aria-label="Cerrar panel de notificaciones"
              onClick={onClose}
            >
              &times;
            </button>
          )}
        </div>
      </div>

      <div className="row gap-1 py-2">
        <button
          type="button"
          className={`button small ${filter === "all" ? "primary" : "ghost"}`}
          onClick={() => setFilter("all")}
        >
          Todas ({notifications.length})
        </button>
        <button
          type="button"
          className={`button small ${filter === "unread" ? "secondary" : "ghost"}`}
          onClick={() => setFilter("unread")}
        >
          No leídas ({unreadCount})
        </button>
      </div>

      <div className="notification-list">
        {filteredNotifications.length === 0 ? (
          <div className="p-4 text-center text-muted">
            <span className="micro">Sin notificaciones pendientes</span>
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`notification-item ${notif.read ? "is-read" : "is-unread"}`}
            >
              <span className={notif.read ? "dot muted" : "dot"} />
              <div className="stack gap-1">
                <div className="row justify-between align-center wrap gap-1">
                  <span className="micro font-medium text-secondary">
                    {notif.category || "Sistema"}
                  </span>
                  <span className="micro tabular text-muted">
                    {notif.timestamp}
                  </span>
                </div>
                <strong>{notif.title}</strong>
                {notif.description && (
                  <span className="micro text-secondary">
                    {notif.description}
                  </span>
                )}
                {notif.entity && (
                  <div className="row align-center gap-1 mt-1">
                    <span className="micro text-muted">Entidad:</span>
                    <span className="badge info micro">
                      {notif.entity.label || `${notif.entity.type} ${notif.entity.id}`}
                    </span>
                  </div>
                )}
                <div className="row justify-between align-center mt-2">
                  {!notif.read && onMarkRead ? (
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => onMarkRead(notif.id)}
                    >
                      Marcar leída
                    </button>
                  ) : <span />}
                  {(notif.actionLabel || onResolve) && (
                    <button
                      type="button"
                      className="button small"
                      onClick={() => onResolve && onResolve(notif)}
                    >
                      {notif.actionLabel || "Resolver"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default NotificationPanel;
