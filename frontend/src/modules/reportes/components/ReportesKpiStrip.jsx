import React from "react";
import { MetricCard, Skeleton } from "../../../shared/components/Feedback";

export function ReportesKpiStrip({ kpis = [], loading = false }) {
  if (loading) {
    return (
      <div className="stocky-kpi-grid" aria-busy="true" aria-label="Cargando indicadores">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-3">
            <Skeleton width={120} height={14} className="mb-2" />
            <Skeleton width={90} height={28} className="mb-2" />
            <Skeleton width={160} height={12} />
          </div>
        ))}
      </div>
    );
  }

  if (!kpis || kpis.length === 0) {
    return null;
  }

  return (
    <div className="stocky-kpi-grid" aria-label="Indicadores ejecutivos del reporte">
      {kpis.map((kpi) => (
        <MetricCard
          key={kpi.label}
          label={kpi.label}
          value={kpi.value}
          subtext={kpi.context}
          badgeText={kpi.badgeText}
          badgeTone={kpi.badgeTone || "neutral"}
        />
      ))}
    </div>
  );
}

export default ReportesKpiStrip;
