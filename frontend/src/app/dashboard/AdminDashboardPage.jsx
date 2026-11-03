import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  DollarSign,
  Package,
  Warehouse,
} from "lucide-react";
import { Button } from "../../components/arc/button/button";
import { Badge } from "../../components/arc/badge/badge";
import { Alert } from "../../components/arc/alert/alert";
import { MetricCard } from "../../components/arc/metric-card/metric-card";
import { Progress } from "../../components/arc/progress/progress";
import { useAdminDashboard } from "./useAdminDashboard";

function getCategoryTone(category = "") {
  const cat = category.toLowerCase();
  if (cat.includes("bloqueo")) return "danger";
  if (cat.includes("stock")) return "warning";
  if (cat.includes("logística") || cat.includes("tránsito")) return "info";
  if (cat.includes("caja") || cat.includes("ventas")) return "success";
  return "neutral";
}

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const [notifFilter, setNotifFilter] = useState("all");

  const {
    error,
    refresh,
    freshnessSeconds,
    redInfo,
    alertasAccionables,
    trabajoPendiente,
    kpis,
    cicloOperativo,
    ultimosMovimientos,
    marcarNotificacionLeida,
  } = useAdminDashboard();

  const filteredNotifs = alertasAccionables.filter((a) => {
    if (notifFilter === "criticas") return a.severidad === "critica";
    return true;
  });

  return (
    <main className="dashboard-home stack gap-5">
      {/* 1. Encabezado principal y sincronización en vivo */}
      <div className="erp-flow-header row justify-between align-center">
        <div>
          <h1 className="text-xl font-medium">Panel de control operativo</h1>
          <p className="text-sm text-secondary">
            Supervisión unificada de logística, existencias, caja y alertas en tiempo real.
          </p>
        </div>
        <div className="row gap-3 align-center">
          <div className="row gap-2 align-center text-xs text-secondary tabular-nums">
            <span className="erp-badge__dot bg-success" />
            <span>En vivo · {freshnessSeconds}s</span>
          </div>
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RotateCcw width={14} height={14} aria-hidden="true" />
            <span>Actualizar</span>
          </Button>
        </div>
      </div>

      {/* 2. Barra de contexto operativo */}
      <div className="p-4 rounded-xl border bg-surface-muted row justify-between wrap gap-3 align-center">
        <div className="row gap-4 wrap align-center text-xs">
          <div>
            <span className="text-muted block">Alcance</span>
            <span className="font-medium text-foreground">Red completa</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div>
            <span className="text-muted block">Centros activos</span>
            <span className="font-medium text-foreground">{redInfo.centrosLabel}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div>
            <span className="text-muted block">Locales activos</span>
            <span className="font-medium text-foreground">{redInfo.localesLabel}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div>
            <span className="text-muted block">Período de análisis</span>
            <span className="font-medium text-foreground">Último mes</span>
          </div>
        </div>
      </div>

      {error && (
        <Alert
          tone="danger"
          title="No se pudieron sincronizar los datos del panel"
          description="Ocurrió una demora en la consulta a los servicios operacionales."
        >
          <Button variant="secondary" size="sm" onClick={refresh}>
            Reintentar sincronización
          </Button>
        </Alert>
      )}

      {/* 3. Cuadrícula de KPIs con Arc MetricCard */}
      <div className="grid-4 gap-3">
        <MetricCard
          label="Logística y órdenes"
          value={kpis?.ordenes?.valor || 6}
          change={kpis?.ordenes?.change || "+15%"}
          context={kpis?.ordenes?.context || "4 en prep · 2 en ruta"}
        />
        <MetricCard
          label="Stock y cobertura"
          value={kpis?.stock?.valor || 94}
          suffix="%"
          change={kpis?.stock?.change || "-2 alertas"}
          context={kpis?.stock?.context || "3 artículos bajo mínimo"}
        />
        <MetricCard
          label="Caja y ventas"
          value={kpis?.caja?.valor || 191700}
          change={kpis?.caja?.change || "+12.4%"}
          context={kpis?.caja?.context || "20 tickets registrados (último mes)"}
        />
        <MetricCard
          label="Seguridad y precintos"
          value={kpis?.seguridad?.valor || 90}
          suffix="%"
          change={kpis?.seguridad?.change || "0 violaciones"}
          context={kpis?.seguridad?.context || "18 de 20 bultos verificados OK"}
        />
      </div>

      {/* 4. Disposición en dos columnas: Ciclo Operativo vs Trabajo Pendiente */}
      <div className="erp-dashboard-grid">
        {/* Columna Izquierda: Ciclo Operativo del día */}
        <div className="card p-5 stack gap-4">
          <div className="row justify-between align-center">
            <div>
              <h2 className="text-base font-medium">Ciclo operativo del día</h2>
              <span className="text-xs text-secondary">
                Avance en vivo de pedidos, despachos y recepciones
              </span>
            </div>
            <Badge tone="success" size="sm" dot>
              Jornada activa
            </Badge>
          </div>

          <div className="stack gap-2 p-3 rounded-lg bg-surface-muted border">
            <div className="row justify-between text-xs">
              <span className="font-medium text-foreground">Progreso global de la jornada</span>
              <span className="font-medium text-foreground tabular-nums">
                {cicloOperativo?.progresoGeneral || 75}% completado
              </span>
            </div>
            <Progress
              value={cicloOperativo?.progresoGeneral || 75}
              label="Progreso de órdenes de la jornada"
            />
          </div>

          <div className="stack gap-3 pt-2">
            <span className="text-xs font-medium text-secondary">Desglose por etapa operativa</span>
            {cicloOperativo?.etapas?.map((etapa) => (
              <div key={etapa.key} className="stack gap-1">
                <div className="row justify-between text-xs">
                  <span className="text-foreground">{etapa.label}</span>
                  <span className="text-secondary tabular-nums">
                    {etapa.cantidad} ({etapa.porcentaje}%)
                  </span>
                </div>
                <Progress
                  value={etapa.porcentaje}
                  label={etapa.label}
                />
              </div>
            ))}
          </div>

          <div className="p-3 rounded-lg border bg-surface row justify-between align-center mt-2">
            <div className="row gap-2 align-center">
              <DollarSign width={16} height={16} className="text-success" aria-hidden="true" />
              <div>
                <span className="text-xs font-medium text-foreground">
                  {cicloOperativo?.puntoDeVenta?.estado || "Caja Local Centro (ciclo 24 h)"}
                </span>
                <span className="text-2xs text-secondary block">
                  Efectivo: {cicloOperativo?.puntoDeVenta?.efectivo} · Digital: {cicloOperativo?.puntoDeVenta?.digital}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/ventas/caja")}>
              Ver caja
            </Button>
          </div>
        </div>

        {/* Columna Derecha: Cola de Trabajo Pendiente */}
        <div className="card p-5 stack gap-4">
          <div className="row justify-between align-center">
            <div>
              <h2 className="text-base font-medium">Trabajo pendiente en cola</h2>
              <span className="text-xs text-secondary">
                Acciones requeridas por estación de trabajo
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/logistica/operaciones")}>
              Abrir colas
            </Button>
          </div>

          <div className="stack gap-2">
            <div className="p-3 rounded-lg border bg-surface row justify-between align-center">
              <div className="row gap-2 align-center">
                <Warehouse width={16} height={16} className="text-secondary" aria-hidden="true" />
                <div>
                  <span className="text-sm font-medium text-foreground">Órdenes por preparar en CD</span>
                  <span className="text-2xs text-secondary block">Acondicionamiento y empaque</span>
                </div>
              </div>
              <div className="row gap-2 align-center">
                <span className="text-base font-medium tabular-nums">{trabajoPendiente.ordenesPorPreparar}</span>
                <Button variant="secondary" size="sm" onClick={() => navigate("/logistica/operaciones")}>
                  Preparar
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-lg border bg-surface row justify-between align-center">
              <div className="row gap-2 align-center">
                <Package width={16} height={16} className="text-secondary" aria-hidden="true" />
                <div>
                  <span className="text-sm font-medium text-foreground">Remitos listos para despachar</span>
                  <span className="text-2xs text-secondary block">Bultos precintados esperando transporte</span>
                </div>
              </div>
              <div className="row gap-2 align-center">
                <span className="text-base font-medium tabular-nums">{trabajoPendiente.remitosPorDespachar}</span>
                <Button variant="secondary" size="sm" onClick={() => navigate("/logistica/operaciones")}>
                  Despachar
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-lg border bg-surface row justify-between align-center">
              <div className="row gap-2 align-center">
                <ShieldCheck width={16} height={16} className="text-secondary" aria-hidden="true" />
                <div>
                  <span className="text-sm font-medium text-foreground">Bultos por verificar</span>
                  <span className="text-2xs text-secondary block">Recepción con control de precinto</span>
                </div>
              </div>
              <div className="row gap-2 align-center">
                <span className="text-base font-medium tabular-nums">{trabajoPendiente.bultosPorVerificar}</span>
                <Button variant="secondary" size="sm" onClick={() => navigate("/logistica/operaciones")}>
                  Verificar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Notification Center & Alertas Accionables con colores temáticos claros */}
      <div className="card p-5 stack gap-4">
        <div className="row justify-between align-center wrap gap-2">
          <div>
            <h2 className="text-base font-medium">Centro de notificaciones y alertas operativas</h2>
            <p className="text-xs text-secondary">
              Alertas con resolución directa y colores temáticos claros para alta legibilidad.
            </p>
          </div>
          <div className="row gap-2 align-center">
            <button
              type="button"
              className={`erp-btn erp-btn--sm erp-category-btn ${notifFilter === "all" ? "erp-btn--primary" : "erp-btn--ghost"}`}
              onClick={() => setNotifFilter("all")}
            >
              <span>Todas ({alertasAccionables.length})</span>
            </button>
            <button
              type="button"
              className={`erp-btn erp-btn--sm erp-category-btn ${notifFilter === "criticas" ? "erp-btn--primary" : "erp-btn--ghost"}`}
              onClick={() => setNotifFilter("criticas")}
            >
              <span>Críticas ({alertasAccionables.filter((a) => a.severidad === "critica").length})</span>
            </button>
          </div>
        </div>

        <div className="stack gap-3">
          {filteredNotifs.length === 0 ? (
            <div className="p-6 text-center text-secondary bg-surface-muted rounded-xl">
              <span className="text-sm font-medium">Sin alertas accionables</span>
              <p className="text-xs text-secondary mt-1">
                Todas las estaciones de trabajo y existencias se encuentran al día.
              </p>
            </div>
          ) : (
            filteredNotifs.slice(0, 5).map((alerta) => {
              const tone = getCategoryTone(alerta.categoria);
              return (
                <div
                  key={alerta.id}
                  className={`erp-notif-card erp-notif-${tone} row justify-between align-center wrap gap-3`}
                >
                  <div className="stack gap-1 flex-1 pr-2">
                    <div className="row gap-2 align-center">
                      <Badge tone={tone} size="sm">
                        {alerta.categoria}
                      </Badge>
                      <span className="font-mono text-xs text-secondary">
                        {alerta.entidad?.label || alerta.entidad?.id}
                      </span>
                      <span className="text-xs text-muted tabular-nums">
                        {alerta.timestamp}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-foreground">{alerta.titulo}</span>
                    <span className="text-xs text-secondary">{alerta.descripcion}</span>
                  </div>

                  <div className="row gap-2 align-center">
                    {alerta.accionRuta && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          marcarNotificacionLeida(alerta.id);
                          navigate(alerta.accionRuta);
                        }}
                      >
                        <span>{alerta.accionLabel}</span>
                        <ArrowRight width={14} height={14} aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 6. Tabla de Últimos Movimientos y Trazabilidad */}
      <div className="card p-5 stack gap-4">
        <div className="row justify-between align-center">
          <div>
            <h2 className="text-base font-medium">Últimos movimientos y trazabilidad auditable</h2>
            <p className="text-xs text-secondary">
              Evidencia reciente de transacciones y operaciones en toda la red.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/logistica/trazabilidad")}>
            Ver trazabilidad completa
          </Button>
        </div>

        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm border-collapse text-left">
            <thead>
              <tr className="bg-surface-muted text-xs text-secondary border-b">
                <th className="p-3 font-medium">Hora</th>
                <th className="p-3 font-medium">Módulo</th>
                <th className="p-3 font-medium">Entidad</th>
                <th className="p-3 font-medium">Acción</th>
                <th className="p-3 font-medium">Responsable</th>
                <th className="p-3 font-medium">Sede</th>
                <th className="p-3 font-medium">Consecuencia / Impacto</th>
              </tr>
            </thead>
            <tbody>
              {ultimosMovimientos.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-surface-muted/50 transition-colors">
                  <td className="p-3 tabular-nums text-xs font-mono">{m.hora}</td>
                  <td className="p-3">
                    <Badge tone="neutral" size="sm">
                      {m.modulo}
                    </Badge>
                  </td>
                  <td className="p-3 font-mono text-xs">{m.entidad}</td>
                  <td className="p-3 font-medium text-xs">{m.accion}</td>
                  <td className="p-3 text-secondary text-xs">{m.responsableNombre}</td>
                  <td className="p-3 text-xs">{m.sede}</td>
                  <td className="p-3 text-secondary text-xs">{m.consecuencia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

export default AdminDashboardPage;
