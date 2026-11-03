import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Button } from "./Button";
import { UserChip } from "./Avatar";
import { Drawer } from "./Motion";
import { NotificationPanel } from "./NotificationPanel";
import { LogoutModal } from "./LogoutModal";
import { navigationFocusTarget } from "../lib/navigationFocus";

export const TASK_GROUPS = [
  {
    id: "inicio",
    label: "Inicio",
    icon: "chart",
    defaultPath: "/dashboard",
    items: [{ id: "inicio-panel", label: "Panel operativo", path: "/dashboard" }],
  },
  {
    id: "maestros",
    label: "Maestros",
    icon: "package",
    defaultPath: "/catalogo/productos",
    items: [
      { id: "maestros-productos", label: "Productos", path: "/catalogo/productos" },
      { id: "maestros-categorias", label: "Categorías", path: "/catalogo/categorias" },
      { id: "maestros-proveedores", label: "Proveedores", path: "/catalogo/proveedores" },
      { id: "maestros-ubicaciones", label: "Centros y locales", path: "/stock/ubicaciones" },
    ],
  },
  {
    id: "inventario",
    label: "Inventario",
    icon: "warehouse",
    defaultPath: "/stock/stock",
    items: [
      { id: "inventario-stock", label: "Stock por ubicación", path: "/stock/stock" },
      { id: "inventario-alertas", label: "Alertas de reposición", path: "/stock/alertas" },
      { id: "inventario-movimientos", label: "Movimientos", path: "/logistica/trazabilidad" },
    ],
  },
  {
    id: "distribucion",
    label: "Distribución",
    icon: "truck",
    defaultPath: "/logistica/operaciones",
    items: [
      { id: "operaciones-tablero", label: "Tablero operativo", path: "/logistica/operaciones" },
      { id: "distribucion-ordenes", label: "Historial de órdenes", path: "/logistica/ordenes" },
    ],
  },
  {
    id: "ventas",
    label: "Ventas y caja",
    icon: "credit-card",
    defaultPath: "/ventas",
    items: [
      { id: "ventas-pos", label: "Punto de venta", path: "/ventas" },
      { id: "ventas-caja", label: "Comprobantes y caja", path: "/ventas?tab=facturas" },
      { id: "ventas-devoluciones", label: "Devoluciones", path: "/ventas?tab=devoluciones" },
    ],
  },
  {
    id: "control",
    label: "Control",
    icon: "chart",
    defaultPath: "/reportes/ventas",
    items: [
      { id: "control-trazabilidad", label: "Trazabilidad", path: "/logistica/trazabilidad" },
      { id: "control-reportes", label: "Reportes gerenciales", path: "/reportes/ventas" },
    ],
  },
];

export const ERP_MODULES = [
  { key: "catalogo", label: "Catálogo", icon: "package" },
  { key: "ubicaciones_stock", label: "Inventario", icon: "warehouse" },
  { key: "logistica", label: "Operaciones", icon: "truck" },
  { key: "ventas_caja", label: "Ventas y caja", icon: "credit-card" },
  { key: "reportes", label: "Reportes", icon: "chart" },
];

const GROUP_LABELS = { maestros: "Catálogo", distribucion: "Operaciones" };
const ITEM_LABELS = {
  "inventario-stock": "Inventario por sede",
  "inventario-ingresos": "Recepción de proveedores",
  "inventario-alertas": "Reposición",
  "distribucion-ordenes": "Historial de órdenes",
  "operaciones-tablero": "Tablero operativo",
};

// La navegación no inventa sedes: SedeProvider carga sólo las disponibles desde la API.
const NAV_GROUP_ORDER = ["inicio", "distribucion", "ventas", "inventario", "maestros", "control"];

export const DEFAULT_LOCATIONS = [];

function getActiveGroupId(currentPath, activeModule) {
  const currentBase = (currentPath || "").split("?")[0];
  const group = TASK_GROUPS.find(
    (candidate) =>
      candidate.items.some((item) => {
        const itemBase = item.path.split("?")[0];
        return currentBase === itemBase || (itemBase !== "/logistica" && currentBase.startsWith(`${itemBase}/`));
      }) ||
      (candidate.id === "distribucion" && activeModule === "logistica") ||
      (candidate.id === "inventario" && activeModule === "ubicaciones_stock") ||
      (candidate.id === "ventas" && activeModule === "ventas_caja") ||
      (candidate.id === "control" && activeModule === "reportes")
  );
  return group?.id || null;
}

export function AppShell({
  currentPath = "/dashboard",
  onNavigate,
  activeModule = "inicio",
  onSelectModule,
  onSearch,
  notifications = [],
  notificationsError,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onResolveNotification,
  operatorName = "Usuario",
  operatorRole = "Administrador",
  onLogout,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches);
  const sidebarRef = useRef(null);
  const mainRef = useRef(null);
  const menuTriggerRef = useRef(null);
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState(() => new Set([getActiveGroupId(currentPath, activeModule)].filter(Boolean)));
  const [activityOpen, setActivityOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const update = () => { setIsMobile(media.matches); if (!media.matches) setMobileOpen(false); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (sidebarRef.current) sidebarRef.current.inert = isMobile && !mobileOpen;
    if (!isMobile || !mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mainRef.current.inert = true;
    const panel = sidebarRef.current;
    const focusables = () => [...panel.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]')];
    focusables()[0]?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape") { event.preventDefault(); setMobileOpen(false); }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) { event.preventDefault(); return; }
      const target = navigationFocusTarget(items, document.activeElement, event.shiftKey);
      if (target) { event.preventDefault(); target.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      if (mainRef.current) mainRef.current.inert = false;
      menuTriggerRef.current?.focus();
    };
  }, [isMobile, mobileOpen]);

  useEffect(() => {
    const activeGroup = getActiveGroupId(currentPath, activeModule);
    if (activeGroup) setExpandedGroups((current) => new Set([...current, activeGroup]));
  }, [currentPath, activeModule]);

  const handleNavigate = (path, groupId) => {
    if (onNavigate) onNavigate(path);
    else if (onSelectModule && groupId) onSelectModule(groupId);
    setMobileOpen(false);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    if (search.trim() && onSearch) onSearch(search.trim());
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <div className="erp-app-shell">
      {mobileOpen && <div className="erp-sidebar__backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />}
      <aside id="stocky-navigation" ref={sidebarRef} className={`erp-sidebar ${mobileOpen ? "is-open" : ""}`.trim()} aria-hidden={isMobile && !mobileOpen ? true : undefined} role={isMobile && mobileOpen ? "dialog" : undefined} aria-modal={isMobile && mobileOpen ? true : undefined} aria-label="Navegación principal de Stocky">
        <Button variant="ghost" className="erp-sidebar__close" onClick={() => setMobileOpen(false)}>Cerrar navegación</Button>
        <div className="erp-sidebar__brand">
          <img className="erp-sidebar__brand-image" src="/brand/stocky-logo.png" alt="Stocky" />
          <div><div className="erp-sidebar__brand-title">Stocky</div><div className="erp-sidebar__brand-sub">Operación y distribución</div></div>
        </div>
        <div className="erp-sidebar__section-label">Operación</div>
        <nav className="erp-sidebar__nav">
          {TASK_GROUPS.filter((group) => group.id !== "recepcion").sort((a, b) => NAV_GROUP_ORDER.indexOf(a.id) - NAV_GROUP_ORDER.indexOf(b.id)).map((group) => {
            const active = getActiveGroupId(currentPath, activeModule) === group.id;
            const isExpanded = expandedGroups.has(group.id);
            return (
              <div key={group.id} className="erp-sidebar__group">
                <button
                  type="button"
                  aria-expanded={group.items.length > 1 ? isExpanded : undefined}
                  className={`erp-sidebar__group-header ${active ? "is-active" : ""}`.trim()}
                  onClick={() => group.items.length === 1 ? handleNavigate(group.defaultPath, group.id) : toggleGroup(group.id)}
                >
                  <span className="erp-sidebar__item-left"><Icon name={group.icon} size={16} className="erp-sidebar__item-icon" /><span>{GROUP_LABELS[group.id] || group.label}</span></span>
                  {group.items.length > 1 && <Icon name={isExpanded ? "chevron-down" : "chevron-right"} size={14} className="erp-sidebar__group-toggle" />}
                </button>
                {isExpanded && group.items.length > 1 && (
                  <div className="erp-sidebar__subnav">
                    {group.items.filter((item) => item.id !== "inventario-movimientos").map((item) => {
                      const selected = currentPath === item.path || (item.path !== "/logistica" && currentPath.startsWith(`${item.path}/`));
                      return <button key={item.id} type="button" aria-current={selected ? "page" : undefined} className={`erp-sidebar__subitem ${selected ? "is-active" : ""}`.trim()} onClick={() => handleNavigate(item.path, group.id)}>{ITEM_LABELS[item.id] || item.label}</button>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="erp-sidebar__footer">
          <div className="erp-sidebar__user-row">
            <UserChip name={operatorName} role={operatorRole} />
            {onLogout && (
              <Button
                variant="ghost"
                size="sm"
                iconLeft="log-out"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                onClick={() => setLogoutOpen(true)}
                className="erp-sidebar__logout-btn"
              />
            )}
          </div>
        </div>
      </aside>
      <div className="erp-main" ref={mainRef}>
        <header className="erp-topbar">
          <div className="erp-topbar__left">
            <Button variant="ghost" size="sm" iconLeft="menu" aria-label="Abrir navegación" aria-expanded={mobileOpen} aria-controls="stocky-navigation" onClick={(event) => { menuTriggerRef.current = event.currentTarget; setMobileOpen(true); }} className="erp-topbar__menu-btn" />
            <form className="erp-topbar__search" onSubmit={submitSearch}>
              <Icon name="search" size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar orden, remito, bulto, precinto o SKU (/)" aria-label="Búsqueda global" />
            </form>
          </div>
          <div className="erp-topbar__right">
            <Button
              variant="ghost"
              size="sm"
              iconLeft="moon"
              aria-label="Tema oscuro (Arc Dark)"
              title="Tema oscuro (Arc Dark)"
              onClick={() => {
                const current = document.documentElement.dataset.theme;
                const next = current === "light" ? "dark" : "light";
                document.documentElement.dataset.theme = next;
                localStorage.setItem("theme", next);
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              iconLeft="bell"
              aria-label="Abrir panel de actividad"
              title="Panel de actividad"
              onClick={() => setActivityOpen(true)}
            >
              {notifications.filter((n) => !n.read).length > 0 && (
                <span className="erp-topbar__badge tabular-nums">
                  {notifications.filter((n) => !n.read).length}
                </span>
              )}
            </Button>
          </div>
        </header>
        <main className="erp-workspace">{children}</main>
      </div>
      <Drawer open={activityOpen} onClose={() => setActivityOpen(false)} title="Actividad operativa" subtitle="Alertas reales de reposición" className="erp-activity-drawer">
        {notificationsError ? <div className="erp-callout erp-callout--danger" role="alert">No se pudieron consultar las alertas. Abrí Alertas de reposición para reintentar.</div> : <NotificationPanel open embedded notifications={notifications} onMarkRead={onMarkNotificationRead} onMarkAllRead={onMarkAllNotificationsRead} onResolve={(notification) => { setActivityOpen(false); onResolveNotification?.(notification); }} />}
      </Drawer>
      <LogoutModal
        open={logoutOpen}
        onClose={() => !loggingOut && setLogoutOpen(false)}
        onConfirm={async () => {
          try {
            setLoggingOut(true);
            if (onLogout) await onLogout();
          } finally {
            setLoggingOut(false);
            setLogoutOpen(false);
          }
        }}
        userName={operatorName}
        userRole={operatorRole}
        isBusy={loggingOut}
      />
    </div>
  );
}

export default AppShell;
