import React, { useEffect, useRef, useState } from "react";
import { Badge } from "../../../shared/components/Badge";

let plotlyLoadPromise = null;

function loadPlotlyScript() {
  if (typeof window !== "undefined" && window.Plotly) {
    return Promise.resolve(window.Plotly);
  }
  if (!plotlyLoadPromise) {
    plotlyLoadPromise = new Promise((resolve, reject) => {
      // Si ya existe el script en el DOM
      const existing = document.querySelector('script[data-plotly="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.Plotly));
        existing.addEventListener("error", reject);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.plot.ly/plotly-2.35.2.min.js";
      script.async = true;
      script.setAttribute("data-plotly", "true");
      script.onload = () => resolve(window.Plotly);
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }
  return plotlyLoadPromise;
}

function getThemeTokens(node) {
  const isDark = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";
  if (isDark) {
    return {
      textColor: "#f8fafc",
      textSecondary: "#94a3b8",
      textMuted: "#64748b",
      border: "#334155",
      borderSubtle: "#1e293b",
      accent: "#38bdf8",
      success: "#22c55e",
      warning: "#f59e0b",
      danger: "#ef4444",
      info: "#38bdf8",
      scopeCd: "#38bdf8",
      scopeLocal: "#2dd4bf",
    };
  }
  return {
    textColor: "#0f172a",
    textSecondary: "#64748b",
    textMuted: "#94a3b8",
    border: "#e2e8f0",
    borderSubtle: "#f1f5f9",
    accent: "#2563eb",
    success: "#16a34a",
    warning: "#d97706",
    danger: "#dc2626",
    info: "#0284c7",
    scopeCd: "#0284c7",
    scopeLocal: "#0d9488",
  };
}

function mapColorToSemanticToken(color, tokens) {
  if (typeof color !== "string") return color;
  const c = color.toLowerCase().trim();
  switch (c) {
    case "#2563eb":
    case "#1d4ed8":
    case "#3b82f6":
      return tokens.accent;
    case "#10b981":
    case "#15803d":
    case "#22c55e":
    case "#059669":
      return tokens.success;
    case "#f59e0b":
    case "#b45309":
    case "#d97706":
      return tokens.warning;
    case "#ef4444":
    case "#b91c1c":
    case "#dc2626":
      return tokens.danger;
    case "#0284c7":
    case "#38bdf8":
    case "#0369a1":
      return tokens.info;
    case "#0f766e":
    case "#2dd4bf":
      return tokens.scopeLocal;
    default:
      return color;
  }
}

export function PlotlyRenderer({
  figure,
  title,
  subtitle,
  badgeText,
  height = 320,
  className = "",
}) {
  const containerRef = useRef(null);
  const [plotlyReady, setPlotlyReady] = useState(
    typeof window !== "undefined" && !!window.Plotly
  );
  const [loadError, setLoadError] = useState(false);
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    let mounted = true;
    if (!plotlyReady) {
      loadPlotlyScript()
        .then(() => {
          if (mounted) setPlotlyReady(true);
        })
        .catch(() => {
          if (mounted) setLoadError(true);
        });
    }
    return () => {
      mounted = false;
    };
  }, [plotlyReady]);

  // Observar cambios de tema (data-theme / data-accent) para actualizar colores dinámicamente
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      setThemeVersion((v) => v + 1);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class", "data-accent"],
    });
    return () => observer.disconnect();
  }, []);

  // Render reactive con Plotly
  useEffect(() => {
    if (!plotlyReady || !containerRef.current || !figure || !figure.data) {
      return;
    }

    const domNode = containerRef.current;
    const tokens = getThemeTokens(domNode);

    // Mapear datos reemplazando colores hardcodeados por tokens semánticos
    const themedData = (figure.data || []).map((trace) => {
      const cloned = { ...trace };
      if (cloned.marker) {
        const marker = { ...cloned.marker };
        if (typeof marker.color === "string") {
          marker.color = mapColorToSemanticToken(marker.color, tokens);
        } else if (Array.isArray(marker.color)) {
          marker.color = marker.color.map((c) => mapColorToSemanticToken(c, tokens));
        }
        if (Array.isArray(marker.colors)) {
          marker.colors = marker.colors.map((c) => mapColorToSemanticToken(c, tokens));
        }
        cloned.marker = marker;
      }
      return cloned;
    });

    const hasMultipleSeries = (figure.data || []).length > 1;
    const titleText = typeof figure.layout?.title === "string" ? figure.layout.title : figure.layout?.title?.text;
    const xAxisTitle = typeof figure.layout?.xaxis?.title === "string" ? figure.layout.xaxis.title : figure.layout?.xaxis?.title?.text;
    const yAxisTitle = typeof figure.layout?.yaxis?.title === "string" ? figure.layout.yaxis.title : figure.layout?.yaxis?.title?.text;

    const layout = {
      autosize: true,
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      ...(figure.layout || {}),
      template: undefined,
      font: { family: "inherit", size: 12, color: tokens.textSecondary },
      title: titleText ? {
        text: titleText,
        font: { family: "inherit", size: 13, color: tokens.textColor || "#f8fafc" },
      } : undefined,
      xaxis: {
        ...(figure.layout?.xaxis || {}),
        title: xAxisTitle ? {
          text: xAxisTitle,
          font: { family: "inherit", size: 11, color: tokens.textSecondary },
        } : undefined,
        tickfont: { family: "inherit", size: 11, color: tokens.textSecondary },
        gridcolor: tokens.borderSubtle,
        zerolinecolor: tokens.border,
        linecolor: tokens.border,
      },
      yaxis: {
        ...(figure.layout?.yaxis || {}),
        title: yAxisTitle ? {
          text: yAxisTitle,
          font: { family: "inherit", size: 11, color: tokens.textSecondary },
        } : undefined,
        tickfont: { family: "inherit", size: 11, color: tokens.textSecondary },
        gridcolor: tokens.borderSubtle,
        zerolinecolor: tokens.border,
        linecolor: tokens.border,
      },
      legend: hasMultipleSeries ? {
        orientation: "h",
        y: 1.15,
        x: 1,
        xanchor: "right",
        font: { family: "inherit", size: 11, color: tokens.textSecondary },
        ...(figure.layout?.legend || {}),
      } : { showlegend: false },
      margin: {
        ...(figure.layout?.margin || {}),
        l: Math.max(figure.layout?.margin?.l || 0, 56),
        r: Math.max(figure.layout?.margin?.r || 0, 48),
        t: hasMultipleSeries ? Math.max(figure.layout?.margin?.t || 0, 56) : (titleText ? 40 : 24),
        b: Math.max(figure.layout?.margin?.b || 0, 48),
      },
    };

    const config = {
      responsive: true,
      displayModeBar: false,
      ...(figure.config || {}),
    };

    try {
      window.Plotly.react(domNode, themedData, layout, config);
    } catch (err) {
      console.warn("Error renderizando gráfico Plotly:", err);
    }

    // Auto-resize reactivo con ResizeObserver
    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        try {
          if (window.Plotly && domNode?.isConnected && domNode.offsetParent) {
            window.Plotly.Plots.resize(domNode);
          }
        } catch {
          // ignore
        }
      });
      resizeObserver.observe(domNode);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      try {
        if (window.Plotly && domNode) {
          window.Plotly.purge(domNode);
        }
      } catch {
        // ignore
      }
    };
  }, [plotlyReady, figure, themeVersion]);

  // Fallback si no está Plotly o está cargando
  const renderFallback = () => {
    if (!figure || !figure.data || !figure.data.length) {
      return (
        <div className="stocky-chart-fallback">
          <span className="text-xs text-muted">Sin datos de gráfico para visualizar</span>
        </div>
      );
    }

    const tokens = getThemeTokens(containerRef.current);
    const firstTrace = figure.data[0];

    // Gráfico de barras fallback
    if (firstTrace.type === "bar" && Array.isArray(firstTrace.x) && Array.isArray(firstTrace.y)) {
      const maxY = Math.max(...firstTrace.y.map((v) => Number(v) || 0), 1);
      const barColor = mapColorToSemanticToken(firstTrace.marker?.color, tokens) || tokens.accent;
      return (
        <div className="stocky-chart-fallback">
          <div className="stocky-chart-fallback-bars">
            {firstTrace.x.map((label, idx) => {
              const val = Number(firstTrace.y[idx]) || 0;
              const pct = Math.round((val / maxY) * 100);
              return (
                <div key={idx} className="stocky-fallback-col">
                  <span className="text-xs font-mono text-secondary tabular-nums">
                    {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                  </span>
                  <div
                    className="stocky-fallback-bar"
                    ref={(el) => {
                      if (el) {
                        el.style.height = `${Math.max(pct, 6)}%`;
                        el.style.backgroundColor = barColor;
                      }
                    }}
                    title={`${label}: ${val}`}
                  />
                  <span className="stocky-fallback-label" title={label}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          <span className="text-xs text-muted">
            {loadError ? "Visualización rápida (Modo Offline)" : "Cargando motor interactivo..."}
          </span>
        </div>
      );
    }

    // Gráfico Pie fallback
    if (firstTrace.type === "pie" && Array.isArray(firstTrace.labels) && Array.isArray(firstTrace.values)) {
      const total = firstTrace.values.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
      return (
        <div className="stocky-chart-fallback">
          <div className="row wrap justify-center gap-4 align-center">
            {firstTrace.labels.map((lbl, idx) => {
              const val = Number(firstTrace.values[idx]) || 0;
              const pct = Math.round((val / total) * 100);
              const rawColor = firstTrace.marker?.colors?.[idx];
              const color = mapColorToSemanticToken(rawColor, tokens) || tokens.accent;
              return (
                <div key={idx} className="row align-center gap-2">
                  <span
                    className="stocky-fallback-swatch"
                    ref={(el) => {
                      if (el) el.style.backgroundColor = color;
                    }}
                  />
                  <span className="text-xs font-medium">
                    {lbl}: <strong className="tabular-nums">{val}</strong> ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
          <span className="text-xs text-muted">
            {loadError ? "Distribución proporcional (Modo Offline)" : "Cargando motor interactivo..."}
          </span>
        </div>
      );
    }

    return (
      <div className="stocky-chart-fallback">
        <span className="text-xs text-muted">Renderizando gráfico...</span>
      </div>
    );
  };

  return (
    <div className={`stocky-chart-container ${className}`.trim()}>
      {(title || subtitle || badgeText) && (
        <div className="stocky-chart-header">
          <div>
            {title && <h3 className="stocky-chart-title">{title}</h3>}
            {subtitle && <p className="text-xs text-secondary">{subtitle}</p>}
          </div>
          {badgeText && <Badge tone="neutral">{badgeText}</Badge>}
        </div>
      )}

      {plotlyReady ? (
        <div
          ref={(el) => {
            containerRef.current = el;
            if (el) el.style.minHeight = `${height}px`;
          }}
          className="stocky-chart-canvas"
        />
      ) : (
        renderFallback()
      )}
    </div>
  );
}
