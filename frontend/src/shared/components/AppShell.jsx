import React, { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Select } from "./Select";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { UserChip } from "./Avatar";

/**
 * Stocky AppShell (`frontend/src/shared/components/AppShell.jsx`)
 * Grouped operational navigation for Stocky ERP:
 * - Catálogo (Productos, Categorías, Proveedores, Precios y Mínimos)
 * - Red logística (Centros y Locales)
 * - Inventario (Stock, Ingreso mercadería, Alertas)
 * - Distribución (Órdenes, Empaquetado, Remitos, Recepción)
 * - Ventas (Punto de venta y caja)
 * - Auditoría (Salud de stock, Mermas y precintos, Auditoría formal)
 */

export const TASK_GROUPS = [
  {
    id: "catalogo",
    label: "Catálogo",
    icon: "package",
    defaultPath: "/catalogo/productos",
    items: [
      { id: "catalogo-productos", label: "Productos", path: "/catalogo/productos" },
      { id: "catalogo-categorias", label: "Categorías", path: "/catalogo/categorias" },
      { id: "catalogo-proveedores", label: "Proveedores", path: "/catalogo/proveedores" },
    ],
  },
  {
    id: "red",
    label: "Red logística",
    icon: "store",
    defaultPath: "/stock/ubicaciones",
    items: [
      { id: "red-ubicaciones", label: "Centros y Locales", path: "/stock/ubicaciones" },
    ],
  },
  {
    id: "inventario",
    label: "Inventario",
    icon: "warehouse",
    defaultPath: "/stock/stock",
    items: [
      { id: "inventario-stock", label: "Stock", path: "/stock/stock" },
      { id: "inventario-ingresos", label: "Ingreso mercadería", path: "/stock/ingresos" },
      { id: "inventario-alertas", label: "Alertas", path: "/stock/alertas", badge: "2" },
    ],
  },
  {
    id: "distribucion",
    label: "Distribución",
    icon: "truck",
    defaultPath: "/logistica/remitos",
    items: [
      { id: "distribucion-ordenes", label: "Órdenes", path: "/logistica/ordenes" },
      { id: "distribucion-empaquetado", label: "Empaquetado", path: "/logistica/empaquetado" },
      { id: "distribucion-remitos", label: "Remitos", path: "/logistica/remitos" },
      { id: "distribucion-recepcion", label: "Recepción", path: "/logistica/recepcion" },
    ],
  },
  {
    id: "ventas",
    label: "Ventas",
    icon: "credit-card",
    defaultPath: "/ventas",
    items: [
      { id: "ventas-pos", label: "Punto de venta", path: "/ventas" },
    ],
  },
  {
    id: "auditoria",
    label: "Auditoría",
    icon: "chart",
    defaultPath: "/reportes/stock",
    items: [
      { id: "auditoria-stock", label: "Salud de stock", path: "/reportes/stock" },
      { id: "auditoria-mermas", label: "Mermas y precintos", path: "/reportes/mermas" },
      { id: "auditoria-formal", label: "Auditoría formal", path: "/reportes/imprimible" },
    ],
  },
];

// Backwards compatibility alias
export const ERP_MODULES = [
  { key: "catalogo", label: "Catálogo", icon: "package" },
  { key: "ubicaciones_stock", label: "Inventario y red", icon: "warehouse", badge: "2 alertas" },
  { key: "logistica", label: "Distribución", icon: "truck", badge: "3 bultos" },
  { key: "ventas_caja", label: "Ventas (POS)", icon: "credit-card" },
  { key: "reportes", label: "Auditoría", icon: "chart" },
];

export const DEFAULT_LOCATIONS = [
  {
    value: 1,
    id: 1,
    label: "CD Central (Casa Matriz)",
    scope: "CD",
    tipo: "CD",
    icon: "warehouse",
    description: "Habilita compras a proveedor y despacho mayorista",
  },
  {
    value: 2,
    id: 2,
    label: "Local Centro (Minorista)",
    scope: "Local",
    tipo: "LOCAL",
    icon: "store",
    description: "Habilita facturación POS y recepción de bultos",
  },
  {
    value: 3,
    id: 3,
    label: "Local Norte (Minorista)",
    scope: "Local",
    tipo: "LOCAL",
    icon: "store",
    description: "Habilita facturación POS y recepción de bultos",
  },
];

function getActiveGroupId(currentPath, activeModule) {
  const group = TASK_GROUPS.find(
    (candidate) =>
      candidate.items.some(
        (item) =>
          currentPath === item.path ||
          (item.path !== "/" && currentPath.startsWith(item.path))
      ) ||
      candidate.id === activeModule
  );

  return group?.id || null;
}

export function AppShell({
  currentPath = "/stock/stock",
  onNavigate,
  activeModule = "ubicaciones_stock",
  onSelectModule,
  activeLocation = 1,
  onSelectLocation,
  locations = DEFAULT_LOCATIONS,
  observerAlertsCount = 2,
  theme = "light",
  onToggleTheme,
  routeTitle,
  flowContextBadge,
  operatorName = "Martín Gómez",
  operatorRole = "Operador de Planta",
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(() =>
    getActiveGroupId(currentPath, activeModule)
  );

  useEffect(() => {
    setExpandedGroup(getActiveGroupId(currentPath, activeModule));
  }, [currentPath, activeModule]);

  const currentLocation =
    locations.find((l) => String(l.value) === String(activeLocation)) || locations[0];
  const isCD = currentLocation?.scope === "CD" || currentLocation?.tipo === "CD";

  const handleNavigate = (path, groupId) => {
    if (onNavigate) {
      onNavigate(path);
    } else if (onSelectModule && groupId) {
      onSelectModule(groupId);
    }
    setMobileOpen(false);
  };

  const toggleGroup = (groupId) => {
    setExpandedGroup((current) => (current === groupId ? null : groupId));
  };

  return (
    <div className="erp-app-shell">
      {mobileOpen && (
        <div
          className="erp-sidebar__backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`erp-sidebar ${mobileOpen ? "is-open" : ""}`.trim()}
        aria-label="Navegación principal de Stocky"
      >
        <div className="erp-sidebar__brand">
          <img
            className="erp-sidebar__brand-image"
            src="/brand/stocky-logo.png"
            alt="Stocky"
          />
          <div>
            <div className="erp-sidebar__brand-title">Stocky</div>
            <div className="erp-sidebar__brand-sub">Operación y distribución</div>
          </div>
        </div>

        <div className="erp-sidebar__section-label">Grupos operativos</div>
        <nav className="erp-sidebar__nav">
          {TASK_GROUPS.map((group) => {
            const isGroupActive =
              group.items.some(
                (item) =>
                  currentPath === item.path ||
                  (item.path !== "/" && currentPath.startsWith(item.path))
              ) ||
              group.id === activeModule ||
              (group.id === "inventario" && activeModule === "ubicaciones_stock") ||
              (group.id === "distribucion" && activeModule === "logistica") ||
              (group.id === "ventas" && activeModule === "ventas_caja") ||
              (group.id === "auditoria" && activeModule === "reportes");

            const isExpanded = expandedGroup === group.id;

            return (
              <div key={group.id} className="erp-sidebar__group">
                <button
                  type="button"
                  aria-expanded={group.items.length > 1 ? isExpanded : undefined}
                  className={`erp-sidebar__group-header ${isGroupActive ? "is-active" : ""}`.trim()}
                  onClick={() => {
                    if (group.items.length === 1) {
                      handleNavigate(group.items[0].path, group.id);
                    } else if (isGroupActive) {
                      toggleGroup(group.id);
                    } else {
                      setExpandedGroup(group.id);
                      handleNavigate(group.defaultPath, group.id);
                    }
                  }}
                >
                  <span className="erp-sidebar__item-left">
                    <Icon
                      name={group.icon}
                      size={16}
                      className="erp-sidebar__item-icon"
                    />
                    <span>{group.label}</span>
                  </span>
                  {group.items.length > 1 ? (
                    <span
                      className="erp-sidebar__group-toggle"
                      aria-hidden="true"
                    >
                      <Icon
                        name={isExpanded ? "chevron-down" : "chevron-right"}
                        size={14}
                      />
                    </span>
                  ) : null}
                </button>

                {isExpanded && (
                  <div className="erp-sidebar__subnav">
                    {group.items.map((item) => {
                      const isItemActive =
                        currentPath === item.path ||
                        (item.path !== "/" &&
                          item.path !== "/stock" &&
                          currentPath.startsWith(item.path));

                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-current={isItemActive ? "page" : undefined}
                          className={`erp-sidebar__subitem ${isItemActive ? "is-active" : ""}`.trim()}
                          onClick={() => handleNavigate(item.path, group.id)}
                        >
                          <span>{item.label}</span>
                          {item.badge && (
                            <span className="erp-badge erp-badge--warning erp-sidebar__badge">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="erp-sidebar__footer">
          <UserChip name={operatorName} role={operatorRole} />
        </div>
      </aside>

      <div className="erp-main">
        <header className="erp-topbar">
          <div className="erp-topbar__left">
            <Button
              variant="ghost"
              size="sm"
              iconLeft="menu"
              aria-label="Abrir navegación"
              onClick={() => setMobileOpen(true)}
              className="erp-topbar__menu-btn"
            />
            <Select
              options={locations}
              value={activeLocation}
              onChange={onSelectLocation}
              ariaLabel="Sede operativa activa"
            />
            {routeTitle && (
              <span className="erp-topbar__route-title font-medium text-xs text-secondary">
                {routeTitle}
              </span>
            )}
            {flowContextBadge ? (
              <Badge tone="neutral">
                {flowContextBadge}
              </Badge>
            ) : (
              <Badge tone={isCD ? "cd" : "local"}>
                {isCD
                  ? "Ámbito CD: compras a proveedor y despachos"
                  : "Ámbito Local: punto de venta POS y recepción"}
              </Badge>
            )}
          </div>

          <div className="erp-topbar__right">
            <Button
              variant="secondary"
              size="sm"
              iconLeft="alert-triangle"
              onClick={() => handleNavigate("/stock/alertas", "inventario")}
            >
              Alertas: {observerAlertsCount}
            </Button>
            {onToggleTheme && (
              <Button
                variant="secondary"
                size="sm"
                iconLeft={theme === "dark" ? "sun" : "moon"}
                onClick={onToggleTheme}
              >
                {theme === "dark" ? "Modo claro" : "Modo oscuro"}
              </Button>
            )}
          </div>
        </header>

        <main className="erp-workspace">{children}</main>
      </div>
    </div>
  );
}

export default AppShell;
