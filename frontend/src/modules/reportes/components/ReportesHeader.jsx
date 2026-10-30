import React from "react";
import { Button } from "../../../shared/components/Button";
import { Icon } from "../../../shared/components/Icon";
import { useAuth } from "../../../app/auth/AuthProvider";
import { actorLabel } from "../services/reportSnapshot.js";

export function ReportesHeader({ loading, onRefresh }) {
  const { user } = useAuth();
  return (
    <header className="stocky-report-header">
      <div className="stocky-brand-block">
        <img
          src="/brand/stocky-logo.png"
          alt="Stocky Logo Oficial"
          className="stocky-logo-img"
        />
        <div>
          <h1 className="stocky-brand-title">
            Stocky · Sistema de Ventas e Inventario: Centro de Distribución a Locales
          </h1>
          <p className="stocky-brand-subtitle">
            Módulo Analítico Integral · R1 Estado y Valorización de Stock · R2 Auditoría Forense de Mermas
          </p>
        </div>
      </div>

      <div className="stocky-header-actions no-print">
        <div className="stocky-operator-pill" title="Sesión activa verificada">
          <span className="stocky-operator-dot" />
          <span>Usuario: <strong>{actorLabel(user)}</strong> ({user?.role || "Sin rol"})</span>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          iconLeft={loading ? undefined : "refresh"}
        >
          {loading ? "Actualizando..." : "Sincronizar"}
        </Button>
      </div>
    </header>
  );
}
