import React, { useState } from "react";
import { PlotlyRenderer } from "./PlotlyRenderer";
import { Button } from "../../../shared/components/Button";

export function ReportesGraficosView({
  graficoPrincipal,
  graficoComplementario,
  tituloPrincipal = "Gráfico principal",
  tituloComplementario = "Distribución complementaria",
  loading = false,
}) {
  const [activeMode, setActiveMode] = useState("principal"); // "principal" | "complementario" | "dual"

  if (loading) {
    return (
      <div className="card p-4 stack gap-2" aria-busy="true">
        <div className="stocky-chart-fallback">
          <span className="text-xs text-muted">Generando visualización gráfica en vivo...</span>
        </div>
      </div>
    );
  }

  const hasComplementario = Boolean(graficoComplementario);
  if (!graficoPrincipal && !graficoComplementario) {
    return null;
  }

  return (
    <div className="card p-4 stack gap-3" aria-label="Visualizaciones analíticas">
      {hasComplementario && (
        <div className="row wrap align-center justify-between gap-2 border-b border-subtle pb-2">
          <div className="row align-center gap-2">
            <span className="text-xs text-secondary font-medium">
              Modo de gráfico:
            </span>
          </div>

          <div className="row align-center gap-1" role="group" aria-label="Selección de visualización">
            <Button
              variant={activeMode === "principal" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setActiveMode("principal")}
            >
              {tituloPrincipal}
            </Button>
            <Button
              variant={activeMode === "complementario" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setActiveMode("complementario")}
            >
              {tituloComplementario}
            </Button>
            <Button
              variant={activeMode === "dual" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setActiveMode("dual")}
            >
              Vista comparativa dual
            </Button>
          </div>
        </div>
      )}

      {activeMode === "dual" && hasComplementario ? (
        <div className="stocky-chart-dual-grid">
          <div className="card p-3">
            <h4 className="text-xs text-secondary font-medium mb-2">{tituloPrincipal}</h4>
            <div className="overflow-x-auto">
              <PlotlyRenderer figure={graficoPrincipal} height={260} />
            </div>
          </div>
          <div className="card p-3">
            <h4 className="text-xs text-secondary font-medium mb-2">{tituloComplementario}</h4>
            <div className="overflow-x-auto">
              <PlotlyRenderer figure={graficoComplementario} height={260} />
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <PlotlyRenderer
            figure={activeMode === "complementario" && hasComplementario ? graficoComplementario : graficoPrincipal}
            height={270}
          />
        </div>
      )}
    </div>
  );
}

export default ReportesGraficosView;
