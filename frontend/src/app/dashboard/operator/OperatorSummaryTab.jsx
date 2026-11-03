import React from "react";
import { ArrowRight } from "lucide-react";
import { MetricCard } from "../../../components/arc/metric-card/metric-card";
import { EmptyState } from "../../../components/arc/empty-state/empty-state";
import { Badge } from "../../../components/arc/badge/badge";
import { Button } from "../../../components/arc/button/button";
import { HoldToConfirm } from "../../../components/arc/hold-to-confirm/hold-to-confirm";
import styles from "../OperatorDashboardPage.module.css";

export function OperatorSummaryTab({
  work,
  currentLocal,
  branches = [],
  loading,
  loadError,
  onRecibirRemito,
  onOpenRemitoControl,
  onCerrarRemito,
  onGoToArmado,
  onGoToDespacho,
  onGoToControlar,
}) {
  return (
    <>
      <div className={styles.kpiGrid}>
        <MetricCard
          label="Por armar"
          value={work.porArmar}
          context="Items y bultos pendientes"
        />
        <MetricCard
          label="Por despachar"
          value={work.porDespachar}
          context="Bultos y remitos de salida"
        />
        <MetricCard
          label="Por controlar"
          value={work.porControlar}
          context="Remitos e inspección física"
        />
        <MetricCard
          label="Total acciones"
          value={work.total}
          context="Acciones directas a ejecutar"
        />
      </div>

      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          Mi trabajo en {currentLocal?.nombre || "la sucursal"}
        </h2>
        <span className={styles.sectionCount}>
          {work.total} acciones pendientes
        </span>
      </div>

      {loading && (
        <div className={styles.actionCard}>
          <p className={styles.actionCardSubtitle}>
            Consultando tareas operativas…
          </p>
        </div>
      )}

      {!loading && !loadError && branches.length > 0 && !work.total && (
        <EmptyState
          title="Sin tareas pendientes"
          description={`No hay remitos en tránsito ni bultos pendientes de control para ${
            currentLocal?.nombre || "esta sucursal"
          }.`}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={onGoToControlar}
            >
              Ver remitos activos
            </Button>
          }
        />
      )}

      {/* Tarjetas de remitos en viaje (Pendientes de arribo) */}
      {(work.inTransit || []).map((remito) => (
        <article key={remito.numero} className={styles.actionCard}>
          <div className={styles.actionCardHeader}>
            <div className={styles.actionCardMeta}>
              <h3 className={styles.actionCardTitle}>
                Arribo de transporte: {remito.numero}
              </h3>
              <p className={styles.actionCardSubtitle}>
                {remito.totalBultos} bulto(s) en viaje hacia {currentLocal?.nombre}
              </p>
            </div>
            <Badge tone="warning">En tránsito</Badge>
          </div>
          <Button
            size="md"
            onClick={() => onRecibirRemito(remito.numero)}
          >
            Registrar arribo
          </Button>
        </article>
      ))}

      {/* Tarjetas de remitos arribados (Pendientes de control de precintos) */}
      {(work.pending || []).map((remito) => (
        <article key={remito.numero} className={styles.actionCard}>
          <div className={styles.actionCardHeader}>
            <div className={styles.actionCardMeta}>
              <h3 className={styles.actionCardTitle}>
                Control de precintos: {remito.numero}
              </h3>
              <p className={styles.actionCardSubtitle}>
                {remito.bultosPendientes} bulto(s) pendiente(s) de revisión física
              </p>
            </div>
            <Badge tone="info">Recibido</Badge>
          </div>
          <Button
            size="md"
            onClick={() => onOpenRemitoControl(remito.numero)}
          >
            Controlar precintos
          </Button>
        </article>
      ))}

      {/* Tarjetas de remitos listos para cierre */}
      {(work.closable || []).map((remito) => (
        <article key={remito.numero} className={styles.actionCard}>
          <div className={styles.actionCardHeader}>
            <div className={styles.actionCardMeta}>
              <h3 className={styles.actionCardTitle}>
                Cierre e impacto: {remito.numero}
              </h3>
              <p className={styles.actionCardSubtitle}>
                Todos los {remito.totalBultos} bultos fueron inspeccionados
              </p>
            </div>
            <Badge tone="success">Listo para cierre</Badge>
          </div>
          <HoldToConfirm
            label="Mantener para cerrar e impactar stock"
            confirmedLabel="Remito cerrado"
            icon={<ArrowRight size={18} strokeWidth={1.75} />}
            duration={1200}
            tone="accent"
            onConfirm={() => onCerrarRemito(remito.numero)}
          />
        </article>
      ))}

      {/* Tarjetas de armado pendiente */}
      {work.porArmar > 0 && (
        <article className={styles.actionCard}>
          <div className={styles.actionCardHeader}>
            <div className={styles.actionCardMeta}>
              <h3 className={styles.actionCardTitle}>
                Armado de bultos
              </h3>
              <p className={styles.actionCardSubtitle}>
                {work.porArmar} acción(es) de embalaje, precintado o aprobación pendientes
              </p>
            </div>
            <Badge tone="warning">Pendiente</Badge>
          </div>
          <Button
            size="md"
            variant="secondary"
            onClick={onGoToArmado}
          >
            Ir a armar bultos
          </Button>
        </article>
      )}

      {/* Tarjetas de despacho pendiente */}
      {work.porDespachar > 0 && (
        <article className={styles.actionCard}>
          <div className={styles.actionCardHeader}>
            <div className={styles.actionCardMeta}>
              <h3 className={styles.actionCardTitle}>
                Despacho de operaciones
              </h3>
              <p className={styles.actionCardSubtitle}>
                {work.porDespachar} acción(es) de remito o salida al transporte pendientes
              </p>
            </div>
            <Badge tone="info">Listo</Badge>
          </div>
          <Button
            size="md"
            variant="secondary"
            onClick={onGoToDespacho}
          >
            Ir a despachar
          </Button>
        </article>
      )}
    </>
  );
}
