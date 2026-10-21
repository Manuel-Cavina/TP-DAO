import React, { useContext, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PrototypeContext } from "../feedback/PrototypeContext";

export const WIREFRAME_SCREENS = [
  { id: "login", label: "Acceso", path: "/login" },
  { id: "dashboard", label: "Panel Admin", path: "/dashboard" },
  { id: "masters", label: "Maestros y drawer", path: "/catalogo/productos" },
  { id: "wizard", label: "Wizard de orden", path: "/logistica/wizard" },
  { id: "kanban", label: "Kanban", path: "/logistica/kanban" },
  { id: "order", label: "Detalle orden", path: "/logistica/ordenes/OR-000118" },
  { id: "remito", label: "Detalle remito", path: "/logistica/remitos/RM-000077" },
  { id: "bulto", label: "Detalle bulto", path: "/logistica/bultos/BU-000045" },
  { id: "trace", label: "Trazabilidad", path: "/logistica/trazabilidad" },
  { id: "operator", label: "Operador móvil", path: "/operador" },
  { id: "reports", label: "Reportes y PDF", path: "/reportes" },
];

export function resolveScreenFromPath(pathname) {
  if (!pathname) return "dashboard";
  if (pathname === "/login") return "login";
  if (pathname.startsWith("/operador")) return "operator";
  if (pathname.includes("/wizard")) return "wizard";
  if (pathname.includes("/kanban")) return "kanban";
  if (pathname.includes("/ordenes")) return "order";
  if (pathname.includes("/remitos")) return "remito";
  if (pathname.includes("/bultos")) return "bulto";
  if (pathname.includes("/trazabilidad")) return "trace";
  if (pathname.startsWith("/catalogo")) return "masters";
  if (pathname.startsWith("/reportes")) return "reports";
  if (
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/stock") ||
    pathname.startsWith("/red") ||
    pathname.startsWith("/ventas")
  ) {
    return "dashboard";
  }
  return null;
}

export function WireframeSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const proto = useContext(PrototypeContext);
  const navRef = useRef(null);

  const pathScreen = resolveScreenFromPath(location.pathname);
  const currentScreenId = proto?.activeScreen || pathScreen || "dashboard";

  useEffect(() => {
    if (proto?.setActiveScreen && pathScreen && pathScreen !== proto.activeScreen) {
      proto.setActiveScreen(pathScreen);
    }
  }, [pathScreen, proto]);

  useEffect(() => {
    if (!navRef.current) return;
    const selectedButton = navRef.current.querySelector('button[aria-selected="true"]');
    if (selectedButton) {
      const nav = navRef.current;
      const targetScroll =
        selectedButton.offsetLeft - nav.clientWidth / 2 + selectedButton.clientWidth / 2;
      nav.scrollTo({ left: targetScroll, behavior: "smooth" });
    }
  }, [currentScreenId]);

  const handleScreenClick = (screen) => {
    if (proto?.setActiveScreen) {
      proto.setActiveScreen(screen.id);
    }
    navigate(screen.path);
  };

  return (
    <>
      <div className="prototype-banner">
        Prototipo interactivo para aprobación: no persiste datos ni reemplaza las validaciones del backend
      </div>
      <nav ref={navRef} className="switcher" aria-label="Pantallas del prototipo">
        {WIREFRAME_SCREENS.map((screen) => {
          const isSelected = currentScreenId === screen.id;
          return (
            <button
              key={screen.id}
              type="button"
              data-screen={screen.id}
              aria-selected={isSelected ? "true" : "false"}
              onClick={() => handleScreenClick(screen)}
            >
              {screen.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}

export default WireframeSwitcher;
