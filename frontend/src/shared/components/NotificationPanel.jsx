import React, { useState, useEffect } from "react";
import { Bell, CheckCheck, X, ArrowRight, AlertTriangle, ShieldCheck, DollarSign, Package } from "lucide-react";
import { Button } from "../../components/arc/button/button";
import { Badge } from "../../components/arc/badge/badge";

const CATEGORY_ICONS = {
  Bloqueo: AlertTriangle,
  Stock: AlertTriangle,
  Logística: Package,
  Seguridad: ShieldCheck,
  Ventas: DollarSign,
  Caja: DollarSign,
};

function getTone(category = "", severidad = "") {
  const cat = category.toLowerCase();
  const sev = severidad.toLowerCase();
  if (cat.includes("bloqueo") || sev === "critica") return "danger";
  if (cat.includes("stock") || sev === "alta" || sev === "warn") return "warning";
  if (cat.includes("logística") || cat.includes("tránsito") || sev === "info") return "info";
  if (cat.includes("caja") || cat.includes("ventas") || sev === "success") return "success";
  return "neutral";
}

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
      className={`notification-panel stack gap-3 ${className}`.trim()}
      role={embedded ? undefined : "dialog"}
      aria-modal={embedded ? undefined : "false"}
      aria-label={embedded ? undefined : "Panel de notificaciones"}
    >
      <div className="row justify-between align-center pb-2 border-b">
        <div className="row align-center gap-2">
          <Bell width={16} height={16} className="text-secondary" aria-hidden="true" />
          <span className="text-sm font-medium">Centro de notificaciones</span>
          {unreadCount > 0 ? (
            <Badge tone="danger" size="sm" dot>
              {unreadCount} nuevas
            </Badge>
          ) : (
            <Badge tone="success" size="sm" dot>
              Al día
            </Badge>
          )}
        </div>
        <div className="row align-center gap-1">
          {unreadCount > 0 && onMarkAllRead && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllRead}
              title="Marcar todas como leídas"
            >
              <CheckCheck width={14} height={14} aria-hidden="true" />
              <span>Marcar leídas</span>
            </Button>
          )}
          {!embedded && onClose && (
            <button
              type="button"
              className="erp-btn erp-btn--ghost erp-btn--sm"
              aria-label="Cerrar panel de notificaciones"
              onClick={onClose}
            >
              <X width={16} height={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="row gap-2">
        <button
          type="button"
          className={`erp-btn erp-btn--sm erp-category-btn ${filter === "all" ? "erp-btn--primary" : "erp-btn--ghost"}`}
          onClick={() => setFilter("all")}
        >
          <span>Todas ({notifications.length})</span>
        </button>
        <button
          type="button"
          className={`erp-btn erp-btn--sm erp-category-btn ${filter === "unread" ? "erp-btn--primary" : "erp-btn--ghost"}`}
          onClick={() => setFilter("unread")}
        >
          <span>No leídas ({unreadCount})</span>
        </button>
      </div>

      <div className="notification-list stack gap-2">
        {filteredNotifications.length === 0 ? (
          <div className="p-4 text-center text-secondary bg-surface-muted rounded-lg">
            <span className="text-xs">No hay notificaciones para mostrar.</span>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const tone = getTone(notif.category, notif.severidad);
            const IconComponent = CATEGORY_ICONS[notif.category] || Bell;

            return (
              <div
                key={notif.id}
                className={`erp-notif-card erp-notif-${tone} stack gap-2 ${notif.read ? "is-read" : ""}`}
              >
                <div className="row justify-between align-center">
                  <div className="row gap-2 align-center">
                    <IconComponent width={14} height={14} className="text-secondary" aria-hidden="true" />
                    <Badge tone={tone} size="sm">
                      {notif.category || "General"}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted tabular-nums">
                    {notif.timestamp || "Reciente"}
                  </span>
                </div>

                <div className="stack gap-0">
                  <span className="text-sm font-medium text-foreground">{notif.title}</span>
                  {notif.description && (
                    <span className="text-xs text-secondary mt-1">{notif.description}</span>
                  )}
                </div>

                {notif.entity && (
                  <div className="row align-center gap-1">
                    <span className="text-xs text-muted">Entidad:</span>
                    <Badge tone="neutral" size="sm">
                      {notif.entity.label || `${notif.entity.type} #${notif.entity.id}`}
                    </Badge>
                  </div>
                )}

                <div className="row justify-between align-center pt-2 border-t">
                  {!notif.read && onMarkRead ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onMarkRead(notif.id)}
                    >
                      Marcar leída
                    </Button>
                  ) : <span />}

                  {(notif.actionLabel || onResolve) && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onResolve && onResolve(notif)}
                    >
                      <span>{notif.actionLabel || "Resolver"}</span>
                      <ArrowRight width={14} height={14} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default NotificationPanel;
