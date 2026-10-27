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
  const root = node || (typeof document !== "undefined" ? document.documentElement : null);
  if (!root || typeof window === "undefined") {
    return {
      textColor: "#262623",
      textSecondary: "#65655f",
      textMuted: "#8c8c85",
      border: "#e6e6e2",
      borderSubtle: "#f0f0ed",
      accent: "#262623",
      success: "#15803d",
      warning: "#b45309",
      danger: "#b91c1c",
      info: "#0284c7",
      scopeCd: "#0369a1",
      scopeLocal: "#0f766e",
    };
  }
  const cs = window.getComputedStyle(root);
  const get = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  return {
    textColor: get("--foreground", "#262623"),
    textSecondary: get("--text-secondary", "#65655f"),
    textMuted: get("--text-muted", "#8c8c85"),
    border: get("--border", "#e6e6e2"),
    borderSubtle: get("--border-subtle", "#f0f0ed"),
    accent: get("--accent", "#262623"),
    success: get("--success", "#15803d"),
    warning: get("--warning", "#b45309"),
    danger: get("--danger", "#b91c1c"),
    info: get("--info", "#0284c7"),
    scopeCd: get("--scope-cd", "#0369a1"),
    scopeLocal: get("--scope-local", "#0f766e"),
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

    const layout = {
      autosize: true,
      margin: { l: 45, r: 20, t: 35, b: 45, ...(figure.layout?.margin || {}) },
      font: { family: "inherit", size: 12, color: tokens.textSecondary },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      xaxis: {
        tickfont: { color: tokens.textSecondary, size: 11 },
        gridcolor: tokens.borderSubtle,
        zerolinecolor: tokens.border,
        ...(figure.layout?.xaxis || {}),
      },
      yaxis: {
        tickfont: { color: tokens.textSecondary, size: 11 },
        gridcolor: tokens.borderSubtle,
        zerolinecolor: tokens.border,
        ...(figure.layout?.yaxis || {}),
      },
      ...figure.layout,
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
