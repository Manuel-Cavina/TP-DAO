import React from "react";
import { useAuth } from "../../../app/auth/AuthProvider";
import { actorLabel } from "../services/reportSnapshot.js";

export function ReportesHeader({ title = "Reportes", description = "Consulta de ventas, stock y distribución" }) {
  const { user } = useAuth();
  return (
    <header className="stocky-report-header">
      <div className="stocky-brand-block">
        <div>
          <h1 className="stocky-brand-title">
            {title}
          </h1>
          <p className="stocky-brand-subtitle">
            {description}
          </p>
        </div>
      </div>

      <div className="stocky-header-actions no-print">
        <div className="stocky-operator-pill" title="Sesión activa verificada">
          <span className="stocky-operator-dot" />
          <span>Usuario: <strong>{actorLabel(user)}</strong> ({user?.role || "Sin rol"})</span>
        </div>

      </div>
    </header>
  );
}
