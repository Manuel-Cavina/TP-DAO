import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Button } from "./Button";
import { UserChip } from "./Avatar";
import { Drawer } from "./Motion";
import { NotificationPanel } from "./NotificationPanel";
import { LogoutModal } from "./LogoutModal";
import { navigationFocusTarget } from "../lib/navigationFocus";

import { ADMIN_TASK_GROUPS, matchNavigation } from "../lib/navigation";

export const TASK_GROUPS = ADMIN_TASK_GROUPS;
export const DEFAULT_LOCATIONS = [];
export const ERP_MODULES = [
  { key: "catalogo", label: "Catálogo", icon: "package" },
  { key: "ubicaciones_stock", label: "Inventario", icon: "warehouse" },
  { key: "logistica", label: "Operaciones", icon: "truck" },
  { key: "ventas_caja", label: "Ventas y caja", icon: "credit-card" },
  { key: "reportes", label: "Reportes", icon: "chart" },
];

export function AppShell({
  currentPath = "/dashboard",
  onNavigate,
  activeModule = "inicio",
  taskGroups = TASK_GROUPS,
  routeTitle,
  contextLabel = "Administración de la red",
  showActivity = true,
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
  const [expandedGroups, setExpandedGroups] = useState(() => new Set([matchNavigation(currentPath, taskGroups)?.group.id].filter(Boolean)));
  const [theme, setTheme] = useState("light");
  useEffect(() => { setTheme(document.documentElement.dataset.theme || "light"); }, []);
  const activeNavigation = matchNavigation(currentPath, taskGroups);
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
    const activeGroup = matchNavigation(currentPath, taskGroups)?.group.id;
    if (activeGroup) setExpandedGroups((current) => new Set([...current, activeGroup]));
  }, [currentPath, activeModule, taskGroups]);

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
        <div className="erp-sidebar__scope">{contextLabel}</div>
        <nav className="erp-sidebar__nav">
          {taskGroups.map((group) => {
            const active = matchNavigation(currentPath, taskGroups)?.group.id === group.id;
            const isExpanded = expandedGroups.has(group.id);
            return (
              <div key={group.id} className="erp-sidebar__group">
                <button
                  type="button"
                  aria-expanded={group.items.length > 1 ? isExpanded : undefined}
                  className={`erp-sidebar__group-header ${active ? "is-active" : ""}`.trim()}
                  onClick={() => group.items.length === 1 ? handleNavigate(group.defaultPath, group.id) : toggleGroup(group.id)}
                >
                  <span className="erp-sidebar__item-left"><Icon name={group.icon} size={16} className="erp-sidebar__item-icon" /><span>{group.label}</span></span>
                  {group.items.length > 1 && <Icon name={isExpanded ? "chevron-down" : "chevron-right"} size={14} className="erp-sidebar__group-toggle" />}
                </button>
                {isExpanded && group.items.length > 1 && (
                  <div className="erp-sidebar__subnav">
                    {group.items.map((item) => {
                      const selected = activeNavigation?.item.id === item.id;
                      return <button key={item.id} type="button" aria-current={selected ? "page" : undefined} className={`erp-sidebar__subitem ${selected ? "is-active" : ""}`.trim()} onClick={() => handleNavigate(item.path, group.id)}>{item.label}</button>;
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
            <span className="erp-topbar__route">{routeTitle || activeNavigation?.item.label || "Stocky"}</span>
            {onSearch && <form className="erp-topbar__search" onSubmit={submitSearch}>
              <Icon name="search" size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar orden, remito, bulto, precinto o SKU (/)" aria-label="Búsqueda global" />
            </form>}
          </div>
          <div className="erp-topbar__right">
            <Button
              variant="ghost"
              size="sm"
              iconLeft={theme === "light" ? "moon" : "sun"}
              aria-label={theme === "light" ? "Activar tema oscuro" : "Activar tema claro"}
              title={theme === "light" ? "Activar tema oscuro" : "Activar tema claro"}
              onClick={() => {
                const current = document.documentElement.dataset.theme;
                const next = current === "light" ? "dark" : "light";
                document.documentElement.dataset.theme = next;
                setTheme(next);
                try { localStorage.setItem("theme", next); } catch { /* Theme still works when storage is unavailable. */ }
              }}
            />
            {showActivity && <Button
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
            </Button>}
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
